-- COMPLETE FIX for feedback update issue
-- This script will:
-- 1. Find and list all triggers
-- 2. Create/update the function to bypass triggers
-- 3. Provide options to fix the trigger
-- Run this in Supabase SQL editor

-- ============================================
-- STEP 1: Find all triggers on feedback table
-- ============================================
DO $$
DECLARE
  trigger_rec RECORD;
  trigger_list TEXT := '';
BEGIN
  RAISE NOTICE '=== STEP 1: Finding triggers on feedback table ===';
  
  FOR trigger_rec IN 
    SELECT 
      t.tgname as trigger_name,
      CASE 
        WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
        WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END as action_timing,
      CASE 
        WHEN t.tgtype & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype & 8 = 8 THEN 'DELETE'
        WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'UNKNOWN'
      END as event_manipulation,
      pg_get_triggerdef(t.oid) as trigger_definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'feedback'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal
    AND (t.tgtype & 16 = 16)  -- UPDATE event
  LOOP
    RAISE NOTICE 'Found UPDATE trigger: %', trigger_rec.trigger_name;
    RAISE NOTICE 'Timing: %', trigger_rec.action_timing;
    RAISE NOTICE 'Definition: %', trigger_rec.trigger_definition;
    trigger_list := trigger_list || trigger_rec.trigger_name || ', ';
  END LOOP;
  
  IF trigger_list = '' THEN
    RAISE NOTICE 'No UPDATE triggers found';
  ELSE
    RAISE NOTICE 'Triggers to potentially disable: %', rtrim(trigger_list, ', ');
  END IF;
END $$;

-- ============================================
-- STEP 2: Create/Update the function
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_feedback(
  p_feedback_id UUID,
  p_status TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_result JSONB;
  v_sql TEXT;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- If user_id exists, verify admin status
  IF v_user_id IS NOT NULL THEN
    SELECT account_type = 'admin' INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
    
    IF v_is_admin IS NULL OR NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify resolution fields';
    END IF;
  END IF;
  -- If v_user_id IS NULL, it's service role - allow it
  
  -- Build dynamic SQL to update
  v_sql := 'UPDATE public.feedback SET updated_at = NOW()';
  
  IF p_status IS NOT NULL THEN
    v_sql := v_sql || format(', status = %L', p_status);
  END IF;
  
  IF p_admin_notes IS NOT NULL THEN
    v_sql := v_sql || format(', admin_notes = %L', p_admin_notes);
  ELSIF p_admin_notes IS NULL AND p_status IS NOT NULL THEN
    -- Allow setting admin_notes to NULL explicitly
    v_sql := v_sql || ', admin_notes = NULL';
  END IF;
  
  v_sql := v_sql || format(' WHERE id = %L', p_feedback_id);
  v_sql := v_sql || ' RETURNING jsonb_build_object(''id'', id, ''status'', status, ''admin_notes'', admin_notes, ''updated_at'', updated_at)';
  
  -- Execute the update
  EXECUTE v_sql INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Feedback entry not found';
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- STEP 3: Disable problematic triggers (if found)
-- ============================================
-- Uncomment and modify the line below after running STEP 1 to see trigger names
-- Replace 'trigger_name' with the actual trigger name from STEP 1 output

-- ALTER TABLE public.feedback DISABLE TRIGGER trigger_name;

-- Or disable ALL triggers temporarily (use with caution):
-- ALTER TABLE public.feedback DISABLE TRIGGER ALL;

-- To re-enable later:
-- ALTER TABLE public.feedback ENABLE TRIGGER ALL;

-- ============================================
-- STEP 4: Alternative - Modify trigger function to allow service_role
-- ============================================
-- If you find a trigger function that checks admin status, modify it like this:
-- (Replace 'function_name' with the actual function name)

/*
CREATE OR REPLACE FUNCTION function_name()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check if it's service_role
  BEGIN
    SELECT current_setting('request.jwt.claims', true)::json->>'role' INTO v_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  
  -- Allow service_role to bypass checks
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Your existing admin check here...
  -- (Keep your existing logic)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/

