-- =====================================================
-- VERIFY AND FIX RLS POLICIES - Run this to verify and fix issues
-- =====================================================
-- This script verifies RLS policies exist and recreates them if needed
-- Run this if you're still seeing timeout errors after running fix_rls_policies.sql

-- =====================================================
-- STEP 1: Check current RLS status
-- =====================================================
SELECT 
    'Current RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename;

-- =====================================================
-- STEP 2: Check existing policies
-- =====================================================
SELECT 
    'Existing Policies' as check_type,
    tablename,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename, cmd;

-- =====================================================
-- STEP 3: Fix TRANSACTIONS table RLS policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can delete transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;

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

-- Create DELETE policy - optional, for deleting transactions
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Service role policy - for admin operations
CREATE POLICY "Service role can manage transactions" ON transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- STEP 4: Fix USER_SUBSCRIPTIONS table RLS policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON user_subscriptions;

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
-- STEP 5: Fix SUBSCRIPTION_PLANS table RLS policies
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Service role can manage subscription plans" ON subscription_plans;

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
-- STEP 6: Verify policies were created
-- =====================================================
SELECT 
    'Verification' as check_type,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(cmd::TEXT, ', ' ORDER BY cmd) as operations_allowed
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- transactions table should have at least 4 policies (INSERT, SELECT, UPDATE, DELETE)
-- user_subscriptions table should have at least 4 policies (INSERT, SELECT, UPDATE, DELETE)
-- subscription_plans table should have at least 1 policy (SELECT)
--
-- If you see fewer policies, there may have been an error.
-- Check the Supabase SQL Editor output for any error messages.

