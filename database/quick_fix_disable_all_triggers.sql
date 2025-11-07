-- QUICK FIX: Disable all triggers on feedback table
-- This will allow the admin_update_feedback function to work
-- Run this in Supabase SQL editor

-- First, list all triggers to see what we're disabling
SELECT 
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

-- Disable ALL user-defined triggers on feedback table (not system triggers)
-- Build dynamic SQL to disable each trigger individually
DO $$
DECLARE
  trigger_rec RECORD;
  disabled_count INTEGER := 0;
BEGIN
  FOR trigger_rec IN 
    SELECT t.tgname as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'feedback'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal  -- Only user-defined triggers
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.feedback DISABLE TRIGGER %I', trigger_rec.trigger_name);
      disabled_count := disabled_count + 1;
      RAISE NOTICE 'Disabled trigger: %', trigger_rec.trigger_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not disable trigger %: %', trigger_rec.trigger_name, SQLERRM;
    END;
  END LOOP;
  
  IF disabled_count = 0 THEN
    RAISE NOTICE 'No user-defined triggers found to disable';
  ELSE
    RAISE NOTICE 'Successfully disabled % trigger(s)', disabled_count;
  END IF;
END $$;

-- Verify triggers are disabled
SELECT 
    t.tgname as trigger_name,
    t.tgenabled as is_enabled,
    CASE t.tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'R' THEN 'Replica'
        WHEN 'A' THEN 'Always'
        ELSE 'Unknown'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

-- Note: To re-enable triggers later, run this DO block:
/*
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT t.tgname as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'feedback'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE public.feedback ENABLE TRIGGER %I', trigger_rec.trigger_name);
    RAISE NOTICE 'Re-enabled trigger: %', trigger_rec.trigger_name;
  END LOOP;
END $$;
*/

