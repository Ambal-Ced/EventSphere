-- Check for triggers on feedback table that might be blocking updates
-- Run this in Supabase SQL editor to see what triggers exist

-- Method 1: Using pg_trigger (more detailed)
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
ORDER BY t.tgname;

-- Method 2: Using information_schema (simpler, but may not show all details)
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'feedback'
AND event_object_schema = 'public'
ORDER BY trigger_name;

