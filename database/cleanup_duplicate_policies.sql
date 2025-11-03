-- =====================================================
-- CLEANUP DUPLICATE RLS POLICIES
-- =====================================================
-- This script removes duplicate policies and ensures only correct policies exist
-- Run this to fix the duplicate policies issue on user_subscriptions table

-- =====================================================
-- STEP 1: List ALL existing policies (to see what we have)
-- =====================================================
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- STEP 2: Clean up USER_SUBSCRIPTIONS table - Remove ALL policies
-- =====================================================

-- Drop ALL existing policies on user_subscriptions to start fresh
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on user_subscriptions
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_subscriptions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_subscriptions', policy_record.policyname);
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: Create clean USER_SUBSCRIPTIONS policies (only one set)
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - CRITICAL for subscription creation
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create SELECT policy - CRITICAL for subscription lookup
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create UPDATE policy - CRITICAL for subscription updates
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create DELETE policy - optional, for deleting subscriptions
CREATE POLICY "Users can delete own subscriptions" ON user_subscriptions
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Service role policy - for admin operations
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- STEP 4: Clean up TRANSACTIONS table (ensure no duplicates)
-- =====================================================

-- Drop all existing policies on transactions
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'transactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON transactions', policy_record.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - CRITICAL for transaction creation
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create SELECT policy - for viewing transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create UPDATE policy - for updating transactions (linking subscription_id)
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create DELETE policy - optional
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Service role policy - for admin operations
CREATE POLICY "Service role can manage transactions" ON transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- STEP 5: Clean up SUBSCRIPTION_PLANS table
-- =====================================================

-- Drop all existing policies on subscription_plans
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subscription_plans'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON subscription_plans', policy_record.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create SELECT policy - for viewing plans
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Service role policy
CREATE POLICY "Service role can manage subscription plans" ON subscription_plans
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- STEP 6: Verify final policy count
-- =====================================================
SELECT 
    'Final Verification' as check_type,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(DISTINCT cmd::TEXT, ', ' ORDER BY cmd::TEXT) as operations_allowed
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- EXPECTED FINAL RESULTS
-- =====================================================
-- transactions: Should have 5 policies (INSERT, SELECT, UPDATE, DELETE, ALL)
-- user_subscriptions: Should have 5 policies (INSERT, SELECT, UPDATE, DELETE, ALL)
-- subscription_plans: Should have 2 policies (SELECT, ALL)
--
-- If you see these numbers, the cleanup was successful!
-- Now try purchasing a subscription again - it should work.

