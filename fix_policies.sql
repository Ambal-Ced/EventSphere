-- Fix and Align EventSphere Database Policies
-- This script will clean up duplicate policies and align them with supabase_table_schema.sql
-- Run this after your main schema setup to fix policy inconsistencies

-- =====================================================
-- CREATE REQUIRED FUNCTIONS FIRST
-- =====================================================

-- Function to check if user has event role (creator, moderator, or member)
CREATE OR REPLACE FUNCTION public.has_event_role(event_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is event creator
  IF EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = event_id AND events.user_id = (SELECT auth.uid())
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has collaborator role
  IF EXISTS (
    SELECT 1 FROM public.event_collaborators 
    WHERE event_collaborators.event_id = event_id 
    AND event_collaborators.user_id = (SELECT auth.uid())
    AND event_collaborators.role = required_role
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can edit event (creator or moderator)
CREATE OR REPLACE FUNCTION public.can_edit_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can view event (creator, moderator, or member)
CREATE OR REPLACE FUNCTION public.can_view_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'member') OR 
         public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CLEAN UP EXISTING POLICIES
-- =====================================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators can delete messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can update own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can view event chat" ON public.event_chat;

DROP POLICY IF EXISTS "Event owners can manage collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.event_collaborators;

DROP POLICY IF EXISTS "Moderators and owners can edit items" ON public.event_items;
DROP POLICY IF EXISTS "Only owners can delete items" ON public.event_items;
DROP POLICY IF EXISTS "Users can delete items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can insert items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can update items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can view items for events they own or are invited to" ON public.event_items;
DROP POLICY IF EXISTS "Users can view items of events they collaborate on" ON public.event_items;

DROP POLICY IF EXISTS "Only owners can delete events" ON public.events;
DROP POLICY IF EXISTS "Only owners can update event settings" ON public.events;
DROP POLICY IF EXISTS "Public events are viewable by everyone." ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events." ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events." ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events." ON public.events;
DROP POLICY IF EXISTS "Users can view all events" ON public.events;
DROP POLICY IF EXISTS "Users can view events they own or collaborate on" ON public.events;

DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event creators can view event feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;

DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- =====================================================
-- RECREATE CORRECT POLICIES (ALIGNED WITH SCHEMA)
-- =====================================================

-- =====================================================
-- PROFILES POLICIES
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
-- EVENTS POLICIES
-- =====================================================

-- Events are viewable by everyone
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

-- Users can create events
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Event creators and moderators can update events
CREATE POLICY "Event creators and moderators can update events" ON public.events
  FOR UPDATE USING (public.can_edit_event(id));

-- Only event creators can delete events
CREATE POLICY "Only event creators can delete events" ON public.events
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- EVENT ITEMS POLICIES
-- =====================================================

-- Event items are viewable by event participants
CREATE POLICY "Event items are viewable by event participants" ON public.event_items
  FOR SELECT USING (public.can_view_event(event_id));

-- Event creators and moderators can manage items
CREATE POLICY "Event creators and moderators can manage items" ON public.event_items
  FOR ALL USING (public.can_edit_event(event_id));

-- =====================================================
-- EVENT COLLABORATORS POLICIES
-- =====================================================

-- Users can view event collaborations
CREATE POLICY "Users can view event collaborations" ON public.event_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND (events.user_id = (SELECT auth.uid()) OR event_collaborators.user_id = (SELECT auth.uid()))
    )
  );

-- Only event creators can manage collaborations
CREATE POLICY "Only event creators can manage collaborations" ON public.event_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- EVENT INVITES POLICIES
-- =====================================================

-- Users can view own invites
CREATE POLICY "Users can view own invites" ON public.event_invites
  FOR SELECT USING (created_by = (SELECT auth.uid()));

-- Event creators can manage invites
CREATE POLICY "Event creators can manage invites" ON public.event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- FEEDBACK POLICIES
-- =====================================================

-- Users can view own feedback
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Event creators can view event feedback
CREATE POLICY "Event creators can view event feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = (SELECT auth.uid())
    )
  );

-- Users can create feedback
CREATE POLICY "Users can create feedback" ON public.feedback
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own feedback (only if not resolved)
CREATE POLICY "Users can update own feedback" ON public.feedback
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id 
    AND status != 'resolved'
  );

-- Users can delete their own feedback (only if not resolved)
CREATE POLICY "Users can delete own feedback" ON public.feedback
  FOR DELETE USING (
    (SELECT auth.uid()) = user_id 
    AND status != 'resolved'
  );

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage all feedback
CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- EVENT CHAT POLICIES
-- =====================================================

-- Event participants can view chat
CREATE POLICY "Event participants can view chat" ON public.event_chat
  FOR SELECT USING (public.can_view_event(event_id));

-- Event participants can create chat messages
CREATE POLICY "Event participants can create chat messages" ON public.event_chat
  FOR INSERT WITH CHECK (public.can_view_event(event_id));

-- Users can update their own messages (only if not deleted)
CREATE POLICY "Users can update own messages" ON public.event_chat
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id 
    AND is_deleted = false
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.event_chat
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Event creators and moderators can delete any message in their event
CREATE POLICY "Event creators and moderators can delete messages" ON public.event_chat
  FOR DELETE USING (public.can_edit_event(event_id));

-- Admins can manage all chat messages
CREATE POLICY "Admins can manage all chat messages" ON public.event_chat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (SELECT auth.uid()) 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- STORAGE POLICIES (IF NOT ALREADY CREATED)
-- =====================================================

-- Avatar bucket policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload own avatar'
    ) THEN
        CREATE POLICY "Users can upload own avatar" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view all avatars'
    ) THEN
        CREATE POLICY "Users can view all avatars" ON storage.objects
        FOR SELECT USING (bucket_id = 'avatars');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update own avatar'
    ) THEN
        CREATE POLICY "Users can update own avatar" ON storage.objects
        FOR UPDATE USING (bucket_id = 'avatars' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete own avatar'
    ) THEN
        CREATE POLICY "Users can delete own avatar" ON storage.objects
        FOR DELETE USING (bucket_id = 'avatars' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
    END IF;
END $$;

-- Event images bucket policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload event images'
    ) THEN
        CREATE POLICY "Users can upload event images" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'event-images');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view all event images'
    ) THEN
        CREATE POLICY "Users can view all event images" ON storage.objects
        FOR SELECT USING (bucket_id = 'event-images');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Event creators and moderators can update event images'
    ) THEN
        CREATE POLICY "Event creators and moderators can update event images" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'event-images' 
            AND EXISTS (
                SELECT 1 FROM public.events 
                WHERE events.image_url LIKE '%' || storage.objects.name || '%'
                AND public.can_edit_event(events.id)
            )
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Event creators and moderators can delete event images'
    ) THEN
        CREATE POLICY "Event creators and moderators can delete event images" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'event-images' 
            AND EXISTS (
                SELECT 1 FROM public.events 
                WHERE events.image_url LIKE '%' || storage.objects.id || '%'
                AND public.can_edit_event(events.id)
            )
        );
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Run this to verify all policies are correctly set
SELECT 
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

-- =====================================================
-- POLICY SUMMARY
-- =====================================================

-- Get a summary of all policies by table
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
