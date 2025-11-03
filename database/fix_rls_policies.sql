-- =====================================================
-- FIX RLS POLICIES FOR TRANSACTIONS AND SUBSCRIPTIONS
-- =====================================================
-- This script fixes RLS policies to prevent timeout issues
-- Run this in your Supabase SQL editor

-- =====================================================
-- 1. TRANSACTIONS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on transactions table (if not already enabled)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can delete transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;

-- Policy 1: Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own transactions (CRITICAL for payment processing)
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own transactions (for linking subscription_id after creation)
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Service role can do everything (for admin operations)
CREATE POLICY "Service role can manage transactions" ON transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 2. USER_SUBSCRIPTIONS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on user_subscriptions table (if not already enabled)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON user_subscriptions;

-- Policy 1: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own subscriptions (CRITICAL for subscription creation)
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own subscriptions (CRITICAL for subscription updates)
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own subscriptions (optional, for cancellations)
CREATE POLICY "Users can delete own subscriptions" ON user_subscriptions
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Policy 5: Service role can do everything (for admin operations)
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 3. SUBSCRIPTION_PLANS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on subscription_plans table (if not already enabled)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Service role can manage subscription plans" ON subscription_plans;

-- Policy 1: Anyone authenticated can view subscription plans (needed for payment page)
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Policy 2: Service role can manage subscription plans (for admin operations)
CREATE POLICY "Service role can manage subscription plans" ON subscription_plans
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 4. VERIFY RLS POLICIES
-- =====================================================

-- Check which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
ORDER BY tablename;

-- Check all policies for these tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
ORDER BY tablename, policyname;

-- =====================================================
-- 5. TEST QUERIES (Optional - run these to verify policies work)
-- =====================================================

-- Test 1: Verify you can view your own subscriptions
-- SELECT * FROM user_subscriptions WHERE user_id = auth.uid();

-- Test 2: Verify you can view subscription plans
-- SELECT * FROM subscription_plans WHERE is_active = true;

-- Test 3: Verify you can view your own transactions
-- SELECT * FROM transactions WHERE user_id = auth.uid();

-- =====================================================
-- NOTES
-- =====================================================
-- 1. These policies allow users to:
--    - View their own subscriptions and transactions
--    - Insert their own subscriptions and transactions (for payment processing)
--    - Update their own subscriptions and transactions (for subscription upgrades/downgrades)
--
-- 2. The policies use auth.uid() which is the current authenticated user's ID
--
-- 3. Service role can do everything (for admin operations via API routes)
--
-- 4. If you're still experiencing timeouts after running this script, the issue
--    might be database triggers or network connectivity, not RLS policies

