-- =====================================================
-- TEST RLS PERMISSIONS - Run this FIRST to verify the issue
-- =====================================================
-- This script tests if RLS policies are blocking operations
-- Run this BEFORE fixing RLS policies to confirm the problem

-- =====================================================
-- NOTE: auth.uid() returns NULL in SQL Editor context
-- =====================================================
-- The SQL Editor runs without authenticated user context,
-- so auth.uid() will be NULL. These tests should be run
-- through your application API, not in SQL Editor.
--
-- If you're seeing timeout errors in your application,
-- that's a clear sign RLS policies are blocking operations.
-- Skip this test script and go straight to fix_rls_policies.sql

-- =====================================================
-- 1. CHECK: Verify RLS is enabled on tables (this works in SQL Editor)
-- =====================================================
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '⚠️ RLS is enabled - policies must allow operations'
        ELSE '✅ RLS is disabled - operations should work'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename;

-- =====================================================
-- 2. CHECK: List existing RLS policies (this works in SQL Editor)
-- =====================================================
SELECT 
    tablename,
    policyname,
    cmd as operation, -- SELECT, INSERT, UPDATE, DELETE
    permissive,
    roles,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- INTERPRETATION
-- =====================================================
-- If you see:
-- - RLS enabled = true: RLS is ON, need proper policies
-- - Few or no policies: INSERT/UPDATE will be blocked
-- - Policies exist but INSERT/UPDATE fail: Policies may be too restrictive
--
-- SOLUTION: Run database/fix_rls_policies.sql to fix this

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- If you see:
-- - RLS enabled = true: RLS is ON, need proper policies
-- - Few or no INSERT/UPDATE policies: Operations will be blocked
-- - Timeout errors in your application: Confirms RLS is blocking
--
-- SOLUTION: Run database/fix_rls_policies.sql to fix this
--
-- Note: The timeout errors you're seeing in your application
-- (like "Subscription lookup timeout after 8 seconds") are
-- already confirming that RLS policies are blocking operations.
-- You can skip further testing and go straight to running
-- fix_rls_policies.sql to fix the issue.

