-- Policy Fix Final: Single Comprehensive Policies
-- This script creates ONE policy per action per table to eliminate ALL multiple_permissive_policies warnings
-- Run this to completely resolve all 80 remaining warnings

-- =====================================================
-- DROP ALL EXISTING POLICIES TO START COMPLETELY FRESH
-- =====================================================

-- Drop all policies from all tables
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Event creators can delete events" ON public.events;

DROP POLICY IF EXISTS "Regular users can manage own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event creators can view event feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;

DROP POLICY IF EXISTS "Regular participants can interact with chat" ON public.event_chat;
DROP POLICY IF EXISTS "Regular participants can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Message owners can manage own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Message owners can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators and moderators can manage chat" ON public.event_chat;
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.event_chat;

DROP POLICY IF EXISTS "Event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Collaborators can view own collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Admins can manage all collaborations" ON public.event_collaborators;

DROP POLICY IF EXISTS "Invite creators can manage own invites" ON public.event_invites;
DROP POLICY IF EXISTS "Event creators can manage event invites" ON public.event_invites;
DROP POLICY IF EXISTS "Admins can manage all invites" ON public.event_invites;

DROP POLICY IF EXISTS "Event participants can view items" ON public.event_items;
DROP POLICY IF EXISTS "Event creators and moderators can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Admins can manage all items" ON public.event_items;

-- =====================================================
-- CREATE SINGLE COMPREHENSIVE POLICIES (ONE PER ACTION)
-- =====================================================

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Single policy for all operations on own profile
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING ((SELECT auth.uid()) = id);

-- =====================================================
-- EVENTS POLICIES
-- =====================================================

-- Single policy for event creation
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Single policy for event deletion
CREATE POLICY "Event creators can delete events" ON public.events
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FEEDBACK POLICIES - SINGLE COMPREHENSIVE POLICY
-- =====================================================

-- Single comprehensive policy for all feedback operations
CREATE POLICY "Comprehensive feedback access" ON public.feedback
  FOR ALL USING (
    -- Users can manage their own feedback
    (SELECT auth.uid()) = user_id
    OR
    -- Event creators can view feedback for their events
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    OR
    -- Admins can manage all feedback
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT CHAT POLICIES - SINGLE COMPREHENSIVE POLICIES
-- =====================================================

-- Single comprehensive policy for SELECT operations
CREATE POLICY "Comprehensive chat view access" ON public.event_chat
  FOR SELECT USING (
    -- Event participants can view chat
    public.can_view_event(event_id)
    OR
    -- Admins can view all chat
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Single comprehensive policy for INSERT operations
CREATE POLICY "Comprehensive chat insert access" ON public.event_chat
  FOR INSERT WITH CHECK (
    -- Event participants can create chat messages
    public.can_view_event(event_id)
    OR
    -- Admins can create chat messages
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Single comprehensive policy for UPDATE operations
CREATE POLICY "Comprehensive chat update access" ON public.event_chat
  FOR UPDATE USING (
    -- Users can update their own messages
    ((SELECT auth.uid()) = user_id AND is_deleted = false)
    OR
    -- Event creators and moderators can update any message
    public.can_edit_event(event_id)
    OR
    -- Admins can update any message
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Single comprehensive policy for DELETE operations
CREATE POLICY "Comprehensive chat delete access" ON public.event_chat
  FOR DELETE USING (
    -- Users can delete their own messages
    (SELECT auth.uid()) = user_id
    OR
    -- Event creators and moderators can delete any message
    public.can_edit_event(event_id)
    OR
    -- Admins can delete any message
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT COLLABORATORS POLICIES - SINGLE COMPREHENSIVE POLICY
-- =====================================================

-- Single comprehensive policy for all collaboration operations
CREATE POLICY "Comprehensive collaboration access" ON public.event_collaborators
  FOR ALL USING (
    -- Event creators can manage collaborations
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    OR
    -- Collaborators can view their own collaborations
    event_collaborators.user_id = (SELECT auth.uid())
    OR
    -- Admins can manage all collaborations
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT INVITES POLICIES - SINGLE COMPREHENSIVE POLICY
-- =====================================================

-- Single comprehensive policy for all invite operations
CREATE POLICY "Comprehensive invite access" ON public.event_invites
  FOR ALL USING (
    -- Invite creators can manage their own invites
    created_by = (SELECT auth.uid())
    OR
    -- Event creators can manage invites for their events
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    OR
    -- Admins can manage all invites
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT ITEMS POLICIES - SINGLE COMPREHENSIVE POLICY
-- =====================================================

-- Single comprehensive policy for all item operations
CREATE POLICY "Comprehensive item access" ON public.event_items
  FOR ALL USING (
    -- Event participants can view items
    public.can_view_event(event_id)
    OR
    -- Event creators and moderators can manage items
    public.can_edit_event(event_id)
    OR
    -- Admins can manage all items
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for remaining multiple permissive policies (should return 0 rows)
SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- Check for auth function usage (should all be wrapped in SELECT)
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%auth.%' AND qual NOT LIKE '%(select auth.%' THEN 'NEEDS FIX: ' || qual
        WHEN with_check LIKE '%auth.%' AND with_check NOT LIKE '%(select auth.%' THEN 'NEEDS FIX: ' || with_check
        ELSE 'OK'
    END AS auth_function_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%')
ORDER BY tablename, policyname;

-- Summary of all policies by table (should show 1 policy per action per table)
SELECT 
    tablename,
    COUNT(*) AS total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) AS select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) AS insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) AS update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) AS delete_policies,
    COUNT(CASE WHEN cmd = 'ALL' THEN 1 END) AS all_policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Detailed policy breakdown
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        ELSE 'No USING condition'
    END AS using_condition,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'No WITH CHECK condition'
    END AS with_check_condition
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
