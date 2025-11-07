-- Disable or modify triggers that block feedback updates
-- Run this in Supabase SQL editor

-- First, check what triggers exist
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN 
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'feedback'
    AND event_manipulation = 'UPDATE'
  LOOP
    RAISE NOTICE 'Found trigger: % on % event', trigger_rec.trigger_name, trigger_rec.event_manipulation;
  END LOOP;
END $$;

-- Disable any triggers that might be blocking updates
-- Note: Replace 'trigger_name' with the actual trigger name found above
-- ALTER TABLE public.feedback DISABLE TRIGGER trigger_name;

-- Alternative: Drop triggers that check admin status (if they exist)
-- DROP TRIGGER IF EXISTS trigger_name ON public.feedback;

