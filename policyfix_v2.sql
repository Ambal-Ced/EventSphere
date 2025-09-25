-- Policy Fix V2: Complete Elimination of Multiple Permissive Policies
-- This script creates role-specific policies to eliminate all multiple_permissive_policies warnings
-- Run this to completely resolve the 32 remaining warnings

-- =====================================================
-- DROP ALL EXISTING POLICIES TO START COMPLETELY FRESH
-- =====================================================

-- Drop all policies from all tables
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Only event creators can delete events" ON public.events;

DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event creators can view event feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;

DROP POLICY IF EXISTS "Event participants can interact with chat" ON public.event_chat;
DROP POLICY IF EXISTS "Event participants can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can manage own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators and moderators can delete messages" ON public.event_chat;
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.event_chat;

DROP POLICY IF EXISTS "Users can manage event collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Only event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view event collaborations" ON public.event_collaborators;

DROP POLICY IF EXISTS "Users can manage event invites" ON public.event_invites;
DROP POLICY IF EXISTS "Event creators can manage invites" ON public.event_invites;
DROP POLICY IF EXISTS "Users can view own invites" ON public.event_invites;

DROP POLICY IF EXISTS "Event participants can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Event creators and moderators can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Event items are viewable by event participants" ON public.event_items;

-- =====================================================
-- CREATE ROLE-SPECIFIC POLICIES (NO OVERLAPS)
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
-- FEEDBACK POLICIES - ROLE-SPECIFIC APPROACH
-- =====================================================

-- Policy for regular users (non-admin, non-event-creator)
CREATE POLICY "Regular users can manage own feedback" ON public.feedback
  FOR ALL USING (
    (SELECT auth.uid()) = user_id 
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- Policy for event creators (non-admin)
CREATE POLICY "Event creators can view event feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins (overrides all others)
CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT CHAT POLICIES - ROLE-SPECIFIC APPROACH
-- =====================================================

-- Policy for regular participants (non-admin, non-moderator, non-creator)
CREATE POLICY "Regular participants can interact with chat" ON public.event_chat
  FOR SELECT USING (
    public.can_view_event(event_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT public.can_edit_event(event_id)
  );

CREATE POLICY "Regular participants can create chat messages" ON public.event_chat
  FOR INSERT WITH CHECK (
    public.can_view_event(event_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT public.can_edit_event(event_id)
  );

-- Policy for message owners (non-admin, non-moderator, non-creator)
CREATE POLICY "Message owners can manage own messages" ON public.event_chat
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id 
    AND is_deleted = false
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT public.can_edit_event(event_id)
  );

CREATE POLICY "Message owners can delete own messages" ON public.event_chat
  FOR DELETE USING (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT public.can_edit_event(event_id)
  );

-- Policy for event creators and moderators (non-admin)
CREATE POLICY "Event creators and moderators can manage chat" ON public.event_chat
  FOR ALL USING (
    public.can_edit_event(event_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins (overrides all others)
CREATE POLICY "Admins can manage all chat messages" ON public.event_chat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT COLLABORATORS POLICIES - ROLE-SPECIFIC APPROACH
-- =====================================================

-- Policy for event creators (non-admin)
CREATE POLICY "Event creators can manage collaborations" ON public.event_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Policy for collaborators (non-admin, non-creator)
CREATE POLICY "Collaborators can view own collaborations" ON public.event_collaborators
  FOR SELECT USING (
    event_collaborators.user_id = (SELECT auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- Policy for admins (overrides all others)
CREATE POLICY "Admins can manage all collaborations" ON public.event_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT INVITES POLICIES - ROLE-SPECIFIC APPROACH
-- =====================================================

-- Policy for invite creators (non-admin, non-event-creator)
CREATE POLICY "Invite creators can manage own invites" ON public.event_invites
  FOR ALL USING (
    created_by = (SELECT auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- Policy for event creators (non-admin)
CREATE POLICY "Event creators can manage event invites" ON public.event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins (overrides all others)
CREATE POLICY "Admins can manage all invites" ON public.event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT ITEMS POLICIES - ROLE-SPECIFIC APPROACH
-- =====================================================

-- Policy for event participants (non-admin, non-moderator, non-creator)
CREATE POLICY "Event participants can view items" ON public.event_items
  FOR SELECT USING (
    public.can_view_event(event_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
    AND NOT public.can_edit_event(event_id)
  );

-- Policy for event creators and moderators (non-admin)
CREATE POLICY "Event creators and moderators can manage items" ON public.event_items
  FOR ALL USING (
    public.can_edit_event(event_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins (overrides all others)
CREATE POLICY "Admins can manage all items" ON public.event_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for remaining multiple permissive policies
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

-- Summary of all policies by table
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
