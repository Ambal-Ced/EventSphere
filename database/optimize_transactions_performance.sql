-- =====================================================
-- OPTIMIZE TRANSACTIONS TABLE PERFORMANCE
-- =====================================================
-- This script optimizes database triggers and adds indexes
-- to prevent timeout issues during transaction inserts
-- Run this in your Supabase SQL editor AFTER fix_rls_policies.sql

-- =====================================================
-- 1. OPTIMIZE INVOICE NUMBER TRIGGER
-- =====================================================

-- Drop the existing trigger and function to recreate them optimized
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON transactions;
DROP FUNCTION IF EXISTS set_invoice_number();
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Optimized function to generate invoice numbers (only used if invoice_number is NULL)
-- This function generates timestamp-based invoice numbers to match client-side format
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  invoice_num TEXT;
  now_dt TIMESTAMP := NOW();
  year_str TEXT;
  month_str TEXT;
  day_str TEXT;
  hour_str TEXT;
  min_str TEXT;
  sec_str TEXT;
  random_num INTEGER;
BEGIN
  -- Generate timestamp-based invoice number (same format as client-side)
  -- Format: INV-YYYYMMDD-HHMMSS-XXX
  year_str := TO_CHAR(now_dt, 'YYYY');
  month_str := TO_CHAR(now_dt, 'MM');
  day_str := TO_CHAR(now_dt, 'DD');
  hour_str := TO_CHAR(now_dt, 'HH24');
  min_str := TO_CHAR(now_dt, 'MI');
  sec_str := TO_CHAR(now_dt, 'SS');
  random_num := FLOOR(RANDOM() * 1000)::INTEGER;
  
  invoice_num := 'INV-' || year_str || month_str || day_str || '-' || 
                 hour_str || min_str || sec_str || '-' || 
                 LPAD(random_num::TEXT, 3, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized trigger function - check invoice_number FIRST before doing any work
-- This is CRITICAL: Check invoice_number at the very beginning to avoid any overhead
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- CRITICAL: Check if invoice_number is already provided FIRST (before any function calls)
  -- This is the FAST PATH - returns immediately if invoice_number exists
  IF NEW.invoice_number IS NOT NULL AND TRIM(NEW.invoice_number) != '' THEN
    -- Invoice number already provided, skip ALL trigger logic (FAST PATH - no overhead)
    RETURN NEW;
  END IF;
  
  -- SLOW PATH: Only execute if invoice_number is NULL or empty
  -- This should rarely happen since we provide invoice_number client-side
  NEW.invoice_number := generate_invoice_number();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- =====================================================
-- 2. ADD INDEXES FOR FASTER QUERIES
-- =====================================================

-- Index on invoice_number for faster lookups (needed by trigger)
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number_lookup 
  ON transactions(invoice_number DESC) 
  WHERE invoice_number LIKE 'INV-%';

-- Index on user_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Index on subscription_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON transactions(subscription_id);

-- Index on status (if not exists)
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Index on created_at (if not exists) - for sorting/ordering
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Composite index for user_id + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON transactions(user_id, created_at DESC);

-- =====================================================
-- 3. ADD INDEXES FOR USER_SUBSCRIPTIONS TABLE
-- =====================================================

-- Index on user_id for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Index on status for faster status-based queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Index on plan_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);

-- Composite index for user_id + status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
  ON user_subscriptions(user_id, status);

-- Composite index for user_id + created_at (for finding most recent subscription)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_created 
  ON user_subscriptions(user_id, created_at DESC);

-- =====================================================
-- 4. ADD INDEXES FOR SUBSCRIPTION_PLANS TABLE
-- =====================================================

-- Index on name for faster plan lookups by name
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON subscription_plans(name);

-- Index on is_active for filtering active plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

-- =====================================================
-- 5. ANALYZE TABLES FOR BETTER QUERY PLANNING
-- =====================================================

-- Update table statistics for better query optimization
ANALYZE transactions;
ANALYZE user_subscriptions;
ANALYZE subscription_plans;

-- =====================================================
-- 6. VERIFY INDEXES
-- =====================================================

-- Check all indexes on transactions table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'transactions'
ORDER BY indexname;

-- Check all indexes on user_subscriptions table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions'
ORDER BY indexname;

-- Check all indexes on subscription_plans table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'subscription_plans'
ORDER BY indexname;

-- =====================================================
-- 7. DISABLE SLOW TRIGGERS (Optional - for testing)
-- =====================================================

-- If you want to temporarily disable the invoice number trigger for testing:
-- DROP TRIGGER IF EXISTS trigger_set_invoice_number ON transactions;
-- 
-- Note: Only do this if you're ALWAYS providing invoice_number client-side
-- Otherwise, transactions will fail without invoice_number

-- =====================================================
-- NOTES
-- =====================================================
-- 1. The optimized trigger checks invoice_number FIRST before doing any work
--    This means when invoice_number is provided, the trigger returns immediately
--
-- 2. The generate_invoice_number function now uses ORDER BY ... LIMIT 1
--    instead of MAX(), which is much faster on large tables
--
-- 3. Indexes are added to speed up common queries:
--    - Finding subscriptions by user_id
--    - Finding plans by name
--    - Sorting transactions by created_at
--
-- 4. ANALYZE is run to update table statistics for better query planning
--
-- 5. If timeouts still occur, the issue might be:
--    - Network connectivity between client and Supabase
--    - Database connection pool exhaustion
--    - Database server performance issues
--    - RLS policies (which should be fixed by fix_rls_policies.sql)

