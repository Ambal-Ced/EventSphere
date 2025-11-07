-- Disable ALL triggers on feedback table temporarily
-- WARNING: This will disable ALL triggers, including ones you might need
-- Use this only if you've identified that triggers are the problem
-- Run this in Supabase SQL editor

-- List all triggers first
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'feedback'
AND event_object_schema = 'public';

-- Disable all UPDATE triggers on feedback table
-- Replace 'trigger_name' with actual trigger names from above
-- Example:
-- ALTER TABLE public.feedback DISABLE TRIGGER trigger_name;

-- Or disable ALL triggers (use with caution):
-- ALTER TABLE public.feedback DISABLE TRIGGER ALL;

-- To re-enable later:
-- ALTER TABLE public.feedback ENABLE TRIGGER ALL;

