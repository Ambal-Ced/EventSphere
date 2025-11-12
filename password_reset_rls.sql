-- =====================================================
-- FOCUSED RLS POLICIES FOR PASSWORD RESET
-- =====================================================
-- Run these in your Supabase SQL editor for password reset functionality

-- =====================================================
-- 1. ENABLE RLS ON AUTH.USERS
-- =====================================================

-- Enable RLS on auth.users table
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PASSWORD RESET SPECIFIC POLICIES
-- =====================================================

-- Policy: Allow service role to update any user's password
-- This is needed for the admin password reset API
CREATE POLICY "Service role can update passwords" ON auth.users
    FOR UPDATE USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow service role to read user data for verification
CREATE POLICY "Service role can read users" ON auth.users
    FOR SELECT USING (auth.role() = 'service_role');

-- Policy: Users can update their own password (for regular password changes)
CREATE POLICY "Users can update own password" ON auth.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Users can read their own auth data
CREATE POLICY "Users can read own auth data" ON auth.users
    FOR SELECT USING (auth.uid() = id);

-- =====================================================
-- 3. PROFILES TABLE POLICIES (if you have a profiles table)
-- =====================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own profile
CREATE POLICY "Users can manage own profile" ON profiles
    FOR ALL USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- 4. VERIFY THE POLICIES
-- =====================================================

-- Check if RLS is enabled on auth.users
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check all policies on auth.users
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users'
ORDER BY policyname;
