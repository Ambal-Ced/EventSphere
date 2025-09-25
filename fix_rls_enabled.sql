-- Fix RLS Disabled Issues
-- This script enables RLS on tables that need it for security
-- Run this to resolve policy_exists_rls_disabled and rls_disabled_in_public errors

-- =====================================================
-- ENABLE RLS ON TABLES THAT NEED IT
-- =====================================================

-- Enable RLS on event_collaborators table
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Enable RLS on event_invites table
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables that should have it
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFY RLS STATUS
-- =====================================================

-- Check RLS status on all tables
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'events', 'feedback', 'event_chat', 
    'event_collaborators', 'event_invites', 'event_items'
  )
ORDER BY tablename;

-- =====================================================
-- CHECK FOR EXISTING POLICIES
-- =====================================================

-- Verify that tables with RLS enabled have policies
SELECT 
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN t.rowsecurity AND COUNT(p.policyname) > 0 THEN '✅ Secure'
        WHEN t.rowsecurity AND COUNT(p.policyname) = 0 THEN '⚠️ RLS enabled but no policies'
        WHEN NOT t.rowsecurity THEN '❌ RLS disabled'
    END as security_status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public' 
  AND t.tablename IN (
    'profiles', 'events', 'feedback', 'event_chat', 
    'event_collaborators', 'event_invites', 'event_items'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- =====================================================
-- QUICK POLICY CHECK
-- =====================================================

-- List all existing policies to see what's available
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        ELSE 'No USING condition'
    END AS using_condition
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
