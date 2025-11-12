-- =====================================================
-- RLS POLICIES FOR PROFILES TABLE - SERVICE ROLE ACCESS
-- =====================================================
-- Run these in your Supabase SQL editor to allow service role
-- to access profiles for joins in admin API routes

-- =====================================================
-- 1. DROP EXISTING SERVICE ROLE POLICY (if it exists)
-- =====================================================

DROP POLICY IF EXISTS "Service role full access to profiles" ON profiles;

-- =====================================================
-- 2. SERVICE ROLE POLICIES (for API routes with service role key)
-- =====================================================

-- Policy: Service role full access to profiles (for API routes)
-- This allows the service role key to bypass RLS completely
-- Needed for joins in admin queries (e.g., user_ratings with profiles)
CREATE POLICY "Service role full access to profiles" ON profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 3. VERIFY THE POLICY
-- =====================================================

-- Check if the policy was created
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
  AND tablename = 'profiles'
  AND policyname = 'Service role full access to profiles';

