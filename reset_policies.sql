-- Reset All RLS Policies to None
-- This script completely removes all Row Level Security policies from all tables
-- Use this to start completely fresh or temporarily disable RLS

-- =====================================================
-- DROP ALL EXISTING POLICIES FROM ALL TABLES
-- =====================================================

-- Drop all policies from profiles table
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Drop all policies from events table
DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Event creators can delete events" ON public.events;
DROP POLICY IF EXISTS "Only event creators can delete events" ON public.events;
DROP POLICY IF EXISTS "Only owners can delete events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events." ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events." ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events." ON public.events;
DROP POLICY IF EXISTS "Users can view all events" ON public.events;
DROP POLICY IF EXISTS "Users can view events they own or collaborate on" ON public.events;
DROP POLICY IF EXISTS "Public events are viewable by everyone." ON public.events;
DROP POLICY IF EXISTS "Only owners can update event settings" ON public.events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Event creators and moderators can update events" ON public.events;

-- Drop all policies from feedback table
DROP POLICY IF EXISTS "Comprehensive feedback access" ON public.feedback;
DROP POLICY IF EXISTS "Regular users can manage own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Event creators can view event feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON public.feedback;

-- Drop all policies from event_chat table
DROP POLICY IF EXISTS "Comprehensive chat view access" ON public.event_chat;
DROP POLICY IF EXISTS "Comprehensive chat insert access" ON public.event_chat;
DROP POLICY IF EXISTS "Comprehensive chat update access" ON public.event_chat;
DROP POLICY IF EXISTS "Comprehensive chat delete access" ON public.event_chat;
DROP POLICY IF EXISTS "Regular participants can interact with chat" ON public.event_chat;
DROP POLICY IF EXISTS "Regular participants can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Message owners can manage own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Message owners can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators and moderators can manage chat" ON public.event_chat;
DROP POLICY IF EXISTS "Admins can manage all chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event participants can interact with chat" ON public.event_chat;
DROP POLICY IF EXISTS "Event participants can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can manage own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event creators and moderators can delete messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can update own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can create chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can view event chat" ON public.event_chat;

-- Drop all policies from event_collaborators table
DROP POLICY IF EXISTS "Comprehensive collaboration access" ON public.event_collaborators;
DROP POLICY IF EXISTS "Event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Collaborators can view own collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Admins can manage all collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can manage event collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Only event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view event collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Event owners can manage collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.event_collaborators;

-- Drop all policies from event_invites table
DROP POLICY IF EXISTS "Comprehensive invite access" ON public.event_invites;
DROP POLICY IF EXISTS "Invite creators can manage own invites" ON public.event_invites;
DROP POLICY IF EXISTS "Event creators can manage event invites" ON public.event_invites;
DROP POLICY IF EXISTS "Admins can manage all invites" ON public.event_invites;
DROP POLICY IF EXISTS "Users can manage event invites" ON public.event_invites;
DROP POLICY IF EXISTS "Event creators can manage invites" ON public.event_invites;
DROP POLICY IF EXISTS "Users can view own invites" ON public.event_invites;

-- Drop all policies from event_items table
DROP POLICY IF EXISTS "Comprehensive item access" ON public.event_items;
DROP POLICY IF EXISTS "Event participants can view items" ON public.event_items;
DROP POLICY IF EXISTS "Event creators and moderators can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Admins can manage all items" ON public.event_items;
DROP POLICY IF EXISTS "Event participants can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Event creators and moderators can manage items" ON public.event_items;
DROP POLICY IF EXISTS "Event items are viewable by event participants" ON public.event_items;
DROP POLICY IF EXISTS "Moderators and owners can edit items" ON public.event_items;
DROP POLICY IF EXISTS "Only owners can delete items" ON public.event_items;
DROP POLICY IF EXISTS "Users can delete items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can insert items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can update items for their own events" ON public.event_items;
DROP POLICY IF EXISTS "Users can view items for events they own or are invited to" ON public.event_items;
DROP POLICY IF EXISTS "Users can view items of events they collaborate on" ON public.event_items;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that all policies have been dropped (should return 0 rows)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count remaining policies (should be 0)
SELECT 
    COUNT(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- List all tables that had RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'events', 'feedback', 'event_chat', 
    'event_collaborators', 'event_invites', 'event_items'
  )
ORDER BY tablename;

-- =====================================================
-- OPTIONAL: DISABLE RLS ON TABLES (UNCOMMENT IF NEEDED)
-- =====================================================

-- Uncomment the lines below if you want to completely disable RLS on tables
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_chat DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_collaborators DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_invites DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_items DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- OPTIONAL: ENABLE RLS ON TABLES (UNCOMMENT IF NEEDED)
-- =====================================================

-- Uncomment the lines below if you want to re-enable RLS on tables
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;
