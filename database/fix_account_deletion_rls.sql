-- =====================================================
-- FIX RLS POLICIES FOR account_deletion_requests TABLE
-- =====================================================
-- This script adds the missing DELETE policy for account_deletion_requests
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. VERIFY RLS IS ENABLED
-- =====================================================
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. ADD DELETE POLICY (if missing)
-- =====================================================

-- Drop existing DELETE policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can delete own deletion request" ON account_deletion_requests;

-- Policy: Users can delete their own deletion request
CREATE POLICY "Users can delete own deletion request" ON account_deletion_requests
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- =====================================================
-- 3. VERIFY ALL POLICIES EXIST
-- =====================================================
-- Verify policies exist
SELECT 
    'RLS Policies' as check_type,
    policyname,
    cmd as operation,
    qual as using_expression
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'account_deletion_requests'
ORDER BY cmd, policyname;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Users can now delete their own deletion requests
-- 2. This allows the cancel functionality to work properly
-- 3. Service role policies remain for admin operations

