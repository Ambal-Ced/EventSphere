-- =====================================================
-- RLS POLICIES FOR USER_RATINGS TABLE
-- =====================================================
-- Run these in your Supabase SQL editor to set up proper Row Level Security
-- for the user_ratings table

-- =====================================================
-- 1. ENABLE RLS ON USER_RATINGS TABLE
-- =====================================================

-- Enable RLS on user_ratings table (if not already enabled)
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. DROP EXISTING POLICIES (to avoid conflicts)
-- =====================================================

-- Drop existing policies if they exist (this prevents errors if policies already exist)
DROP POLICY IF EXISTS "Users can view own rating" ON user_ratings;
DROP POLICY IF EXISTS "Users can insert own rating" ON user_ratings;
DROP POLICY IF EXISTS "Users can update own rating" ON user_ratings;
DROP POLICY IF EXISTS "Users can delete own rating" ON user_ratings;
DROP POLICY IF EXISTS "Admins can view all ratings" ON user_ratings;
DROP POLICY IF EXISTS "Admins can update all ratings" ON user_ratings;
DROP POLICY IF EXISTS "Admins can delete all ratings" ON user_ratings;
DROP POLICY IF EXISTS "Service role full access to user_ratings" ON user_ratings;

-- =====================================================
-- 3. USER POLICIES (for regular users)
-- =====================================================

-- Policy: Users can view their own rating
CREATE POLICY "Users can view own rating" ON user_ratings
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own rating
CREATE POLICY "Users can insert own rating" ON user_ratings
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own rating
CREATE POLICY "Users can update own rating" ON user_ratings
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rating
CREATE POLICY "Users can delete own rating" ON user_ratings
    FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- 4. ADMIN POLICIES (for admin users)
-- =====================================================

-- Policy: Admins can view all ratings
-- This checks if the user has account_type = 'admin' in the profiles table
CREATE POLICY "Admins can view all ratings" ON user_ratings
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- Policy: Admins can update all ratings
CREATE POLICY "Admins can update all ratings" ON user_ratings
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- Policy: Admins can delete all ratings
CREATE POLICY "Admins can delete all ratings" ON user_ratings
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- =====================================================
-- 5. SERVICE ROLE POLICIES (for API routes with service role key)
-- =====================================================

-- Policy: Service role full access to user_ratings (for API routes)
-- This allows the service role key to bypass RLS completely
CREATE POLICY "Service role full access to user_ratings" ON user_ratings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. VERIFY RLS STATUS AND POLICIES
-- =====================================================

-- Check if RLS is enabled on user_ratings table
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'user_ratings';

-- Check all policies on user_ratings table
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
WHERE schemaname = 'public' AND tablename = 'user_ratings'
ORDER BY policyname;

-- =====================================================
-- 7. TEST QUERIES (run these to verify policies work)
-- =====================================================

-- Test as authenticated user (should only see own ratings)
-- SELECT * FROM user_ratings;

-- Test as admin (should see all ratings)
-- Make sure you're logged in as an admin user
-- SELECT * FROM user_ratings;

-- Test as service role (should see all ratings)
-- This is done via API routes using SUPABASE_SERVICE_ROLE_KEY

