-- Fix feedback table triggers to allow admin updates
-- Run this in Supabase SQL editor

-- First, find all triggers on feedback table
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

-- If you find a trigger that checks admin status, you can either:
-- 1. Drop it: DROP TRIGGER trigger_name ON public.feedback;
-- 2. Modify it to allow service_role
-- 3. Or modify the trigger function to check for service_role

-- Example: If there's a trigger function that checks admin status,
-- modify it like this (replace function_name with actual name):

/*
CREATE OR REPLACE FUNCTION function_name()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check if it's service_role
  SELECT current_setting('request.jwt.claims', true)::json->>'role' INTO v_role;
  
  IF v_role = 'service_role' THEN
    RETURN NEW; -- Allow service role
  END IF;
  
  -- Your existing admin check here
  -- ...
END;
$$ LANGUAGE plpgsql;
*/

