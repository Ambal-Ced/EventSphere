-- =====================================================
-- FIX RLS POLICIES FOR TRANSACTIONS AND SUBSCRIPTIONS - FORCE MODE
-- =====================================================
-- This script FORCE drops and recreates RLS policies
-- Use this if fix_rls_policies.sql shows "policy already exists" errors
-- Run this in your Supabase SQL editor

-- =====================================================
-- 1. TRANSACTIONS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on transactions table (if not already enabled)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- FORCE DROP ALL existing policies (using DO block to handle errors)
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on transactions table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'transactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON transactions', policy_record.policyname);
    END LOOP;
END $$;

-- Policy 1: Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 2: Users can insert their own transactions (CRITICAL for payment processing)
-- Make it explicit and permissive - check that user_id matches authenticated user
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 3: Users can update their own transactions (for linking subscription_id after creation)
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 4: Users can delete their own transactions
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 5: Service role can do everything (for admin operations)
CREATE POLICY "Service role can manage transactions" ON transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- 2. USER_SUBSCRIPTIONS TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on user_subscriptions table (if not already enabled)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- FORCE DROP ALL existing policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on user_subscriptions table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_subscriptions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_subscriptions', policy_record.policyname);
    END LOOP;
END $$;

-- Policy 1: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 2: Users can insert their own subscriptions (CRITICAL for subscription creation)
-- Make it explicit and permissive - check that user_id matches authenticated user
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 3: Users can update their own subscriptions (CRITICAL for subscription updates)
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Policy 4: Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions" ON user_subscriptions
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

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

-- FORCE DROP ALL existing policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on subscription_plans table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'subscription_plans'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON subscription_plans', policy_record.policyname);
    END LOOP;
END $$;

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
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
ORDER BY tablename;

-- Check all policies for these tables
SELECT 
    'Policies' as check_type,
    tablename,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
ORDER BY tablename, cmd;

-- Count policies per table
SELECT 
    'Policy Count' as check_type,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(DISTINCT cmd::TEXT, ', ' ORDER BY cmd::TEXT) as operations_allowed
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions', 'subscription_plans')
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- transactions: Should have 5 policies (SELECT, INSERT, UPDATE, DELETE, ALL)
-- user_subscriptions: Should have 5 policies (SELECT, INSERT, UPDATE, DELETE, ALL)
-- subscription_plans: Should have 2 policies (SELECT, ALL)
--
-- If you see these numbers, the policies were created successfully!

