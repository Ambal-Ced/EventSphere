-- Comprehensive script to find and fix feedback table triggers
-- Run this in Supabase SQL editor

-- Step 1: Find all triggers on feedback table
DO $$
DECLARE
  trigger_rec RECORD;
  trigger_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Checking for triggers on feedback table ===';
  
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
  LOOP
    trigger_count := trigger_count + 1;
    RAISE NOTICE 'Trigger #%: %', trigger_count, trigger_rec.trigger_name;
    RAISE NOTICE '  Event: %', trigger_rec.event_manipulation;
    RAISE NOTICE '  Timing: %', trigger_rec.action_timing;
    RAISE NOTICE '  Definition: %', trigger_rec.trigger_definition;
    RAISE NOTICE '---';
  END LOOP;
  
  IF trigger_count = 0 THEN
    RAISE NOTICE 'No triggers found on feedback table';
  ELSE
    RAISE NOTICE 'Total triggers found: %', trigger_count;
  END IF;
END $$;

-- Step 2: Find trigger functions that might check admin status
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  RAISE NOTICE '=== Checking trigger functions for admin checks ===';
  
  FOR func_rec IN
    SELECT 
      p.proname as function_name,
      pg_get_functiondef(p.oid) as function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND (
      pg_get_functiondef(p.oid) ILIKE '%admin%'
      OR pg_get_functiondef(p.oid) ILIKE '%resolution%'
      OR pg_get_functiondef(p.oid) ILIKE '%modify%'
    )
  LOOP
    RAISE NOTICE 'Function: %', func_rec.function_name;
    RAISE NOTICE 'Definition: %', func_rec.function_definition;
    RAISE NOTICE '---';
  END LOOP;
END $$;

-- Step 3: If you find a problematic trigger, you can disable it:
-- ALTER TABLE public.feedback DISABLE TRIGGER trigger_name;

-- Step 4: Or modify the trigger function to allow service_role:
-- (Replace 'function_name' and 'trigger_name' with actual names found above)

/*
-- Example: Modify a trigger function to allow service_role
CREATE OR REPLACE FUNCTION function_name()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Get the role from JWT
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
  -- IF ... THEN
  --   RAISE EXCEPTION 'Only admins can modify resolution fields';
  -- END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/

