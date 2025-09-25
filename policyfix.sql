-- Policy Fix for Supabase Linting Issues
-- This script resolves auth_rls_initplan and multiple_permissive_policies warnings
-- Run this after your main schema setup to optimize RLS policies

-- =====================================================
-- DROP EXISTING POLICIES TO START FRESH
-- =====================================================

-- Drop all existing policies to eliminate conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Only event creators can delete events" ON public.events;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event creators can view event feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;

DROP POLICY IF EXISTS "Users can update own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators and moderators can delete messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event participants can view chat" ON public.event_chat;
DROP POLICY IF EXISTS "Event participants can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.event_chat;

DROP POLICY IF EXISTS "Only event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view event collaborations" ON public.event_collaborators;

DROP POLICY IF EXISTS "Event creators can manage invites" ON public.event_invites;
DROP POLICY IF EXISTS "Users can view own invites" ON public.event_invites;

DROP POLICY IF EXISTS "Event creators and moderators can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Event items are viewable by event participants" ON public.event_items;

-- =====================================================
-- RECREATE OPTIMIZED POLICIES
-- =====================================================

-- =====================================================
-- PROFILES POLICIES (Fixed auth_rls_initplan)
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- =====================================================
-- EVENTS POLICIES (Fixed auth_rls_initplan)
-- =====================================================

-- Users can create events
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Only event creators can delete events
CREATE POLICY "Only event creators can delete events" ON public.events
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- FEEDBACK POLICIES (Fixed auth_rls_initplan + consolidated)
-- =====================================================

-- Consolidated policy: Users can view and manage their own feedback
CREATE POLICY "Users can manage own feedback" ON public.feedback
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- Consolidated policy: Event creators can view event feedback
CREATE POLICY "Event creators can view event feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- Consolidated policy: Admins can manage all feedback
CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT CHAT POLICIES (Fixed auth_rls_initplan + consolidated)
-- =====================================================

-- Consolidated policy: Event participants can view and create chat
CREATE POLICY "Event participants can interact with chat" ON public.event_chat
  FOR SELECT USING (public.can_view_event(event_id));

CREATE POLICY "Event participants can create chat messages" ON public.event_chat
  FOR INSERT WITH CHECK (public.can_view_event(event_id));

-- Consolidated policy: Users can manage their own messages
CREATE POLICY "Users can manage own messages" ON public.event_chat
  FOR UPDATE USING ((SELECT auth.uid()) = user_id AND is_deleted = false);

CREATE POLICY "Users can delete own messages" ON public.event_chat
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Consolidated policy: Event creators and moderators can delete any message
CREATE POLICY "Event creators and moderators can delete messages" ON public.event_chat
  FOR DELETE USING (public.can_edit_event(event_id));

-- Consolidated policy: Admins can manage all chat messages
CREATE POLICY "Admins can manage all chat messages" ON public.event_chat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT COLLABORATORS POLICIES (Consolidated)
-- =====================================================

-- Consolidated policy: Users can view and manage collaborations
CREATE POLICY "Users can manage event collaborations" ON public.event_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND (events.user_id = (SELECT auth.uid()) OR event_collaborators.user_id = (SELECT auth.uid()))
    )
  );

-- =====================================================
-- EVENT INVITES POLICIES (Consolidated)
-- =====================================================

-- Consolidated policy: Users can view and manage invites
CREATE POLICY "Users can manage event invites" ON public.event_invites
  FOR ALL USING (
    created_by = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- EVENT ITEMS POLICIES (Consolidated)
-- =====================================================

-- Consolidated policy: Event participants can view and manage items
CREATE POLICY "Event participants can manage items" ON public.event_items
  FOR ALL USING (public.can_view_event(event_id));

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for remaining auth_rls_initplan issues
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

-- Check for multiple permissive policies
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

-- Summary of all policies
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
