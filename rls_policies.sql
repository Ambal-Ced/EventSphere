-- =====================================================
-- RLS POLICIES FOR EVENTSPHERE AUTHENTICATION
-- =====================================================
-- Run these in your Supabase SQL editor to set up proper Row Level Security

-- =====================================================
-- 1. ENABLE RLS ON AUTH TABLES
-- =====================================================

-- Enable RLS on auth.users (if not already enabled)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on profiles table (if it exists)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PROFILES TABLE POLICIES
-- =====================================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- =====================================================
-- 3. AUTH.USERS TABLE POLICIES (for password changes)
-- =====================================================

-- Policy: Users can view their own auth data
CREATE POLICY "Users can view own auth data" ON auth.users
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own password
CREATE POLICY "Users can update own password" ON auth.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Service role can update any user (for admin operations)
CREATE POLICY "Service role can update any user" ON auth.users
    FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: Service role can view any user (for admin operations)
CREATE POLICY "Service role can view any user" ON auth.users
    FOR SELECT USING (auth.role() = 'service_role');

-- =====================================================
-- 4. EVENTS TABLE POLICIES (if events table exists)
-- =====================================================

-- Enable RLS on events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all events
CREATE POLICY "Users can view all events" ON events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Users can create events
CREATE POLICY "Users can create events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own events
CREATE POLICY "Users can update own events" ON events
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own events
CREATE POLICY "Users can delete own events" ON events
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. COLLABORATORS TABLE POLICIES (if collaborators table exists)
-- =====================================================

-- Enable RLS on collaborators table
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view collaborators for events they own or are part of
CREATE POLICY "Users can view relevant collaborators" ON collaborators
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
        )
    );

-- Policy: Event owners can add collaborators
CREATE POLICY "Event owners can add collaborators" ON collaborators
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
        )
    );

-- Policy: Users can remove themselves as collaborators
CREATE POLICY "Users can remove themselves as collaborators" ON collaborators
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 6. ANALYTICS/STATS POLICIES (if analytics tables exist)
-- =====================================================

-- Enable RLS on analytics tables
ALTER TABLE event_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own analytics
CREATE POLICY "Users can view own event stats" ON event_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own user stats" ON user_stats
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 7. FEEDBACK TABLE POLICIES (if feedback table exists)
-- =====================================================

-- Enable RLS on feedback table
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create feedback
CREATE POLICY "Users can create feedback" ON feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Event owners can view feedback for their events
CREATE POLICY "Event owners can view event feedback" ON feedback
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM events WHERE id = event_id
        )
    );

-- Policy: Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- Policy: Admins can update all feedback
CREATE POLICY "Admins can update all feedback" ON feedback
    FOR UPDATE USING (
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

-- Policy: Admins can delete all feedback
CREATE POLICY "Admins can delete all feedback" ON feedback
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- Policy: Service role full access to feedback (for API routes)
CREATE POLICY "Service role full access to feedback" ON feedback
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 8. USER RATINGS TABLE POLICIES (if user_ratings table exists)
-- =====================================================

-- Enable RLS on user_ratings table
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own rating
CREATE POLICY "Users can view own rating" ON user_ratings
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own rating
CREATE POLICY "Users can insert own rating" ON user_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own rating
CREATE POLICY "Users can update own rating" ON user_ratings
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rating
CREATE POLICY "Users can delete own rating" ON user_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Admins can view all ratings
CREATE POLICY "Admins can view all ratings" ON user_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.account_type = 'admin'
        )
    );

-- Policy: Service role full access to user_ratings (for API routes)
CREATE POLICY "Service role full access to user_ratings" ON user_ratings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 9. VERIFY RLS STATUS
-- =====================================================

-- Check which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- Check all policies
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
WHERE schemaname IN ('public', 'auth')
ORDER BY tablename, policyname;
