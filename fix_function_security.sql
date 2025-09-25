-- Fix Function Search Path Mutable Warnings
-- This script fixes security warnings without breaking functionality
-- Run this to resolve function_search_path_mutable warnings

-- =====================================================
-- FIX TRIGGER FUNCTIONS
-- =====================================================

-- Fix handle_feedback_updated_at function
CREATE OR REPLACE FUNCTION public.handle_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix handle_chat_updated_at function
CREATE OR REPLACE FUNCTION public.handle_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix handle_feedback_resolved function
CREATE OR REPLACE FUNCTION public.handle_feedback_resolved()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix handle_message_deletion function
CREATE OR REPLACE FUNCTION public.handle_message_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        NEW.deleted_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- FIX VALIDATION FUNCTIONS
-- =====================================================

-- Fix validate_email_format function
CREATE OR REPLACE FUNCTION public.validate_email_format(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- FIX EVENT ROLE FUNCTIONS
-- =====================================================

-- Fix has_event_role function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix can_edit_event function
CREATE OR REPLACE FUNCTION public.can_edit_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix can_view_event function
CREATE OR REPLACE FUNCTION public.can_view_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'member') OR 
         public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that all functions now have explicit search paths
SELECT 
    proname as function_name,
    prosrc as function_source,
    CASE 
        WHEN proconfig @> '{search_path=public}' THEN 'FIXED: search_path=public'
        ELSE 'NEEDS FIX: No search_path set'
    END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN (
    'handle_feedback_updated_at',
    'handle_chat_updated_at', 
    'handle_feedback_resolved',
    'handle_message_deletion',
    'validate_email_format',
    'has_event_role',
    'can_edit_event',
    'can_view_event'
  )
ORDER BY proname;

-- =====================================================
-- TEST FUNCTION FUNCTIONALITY
-- =====================================================

-- Test that functions still work (optional)
-- You can run these to verify functionality is preserved

-- Test email validation
-- SELECT public.validate_email_format('test@example.com'); -- Should return true
-- SELECT public.validate_email_format('invalid-email'); -- Should return false

-- Test event role functions (if you have test data)
-- SELECT public.has_event_role('00000000-0000-0000-0000-000000000000', 'creator'); -- Should return false for non-existent event
