-- Diagnostic script to find the source of the "Only admins can modify resolution fields" error
-- Run this in Supabase SQL editor

-- Step 1: Check if the function exists
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'admin_update_feedback';

-- Step 2: Check ALL triggers on feedback table (not just UPDATE)
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
        WHEN (t.tgtype & 4 = 4 AND t.tgtype & 8 = 8) THEN 'INSERT OR DELETE'
        WHEN (t.tgtype & 4 = 4 AND t.tgtype & 16 = 16) THEN 'INSERT OR UPDATE'
        WHEN (t.tgtype & 8 = 8 AND t.tgtype & 16 = 16) THEN 'DELETE OR UPDATE'
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

-- Step 2b: Get trigger function definitions separately
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Step 3: Search for functions that contain the error message
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    pg_get_functiondef(p.oid) ILIKE '%Only admins can modify resolution fields%'
    OR pg_get_functiondef(p.oid) ILIKE '%resolution fields%'
    OR pg_get_functiondef(p.oid) ILIKE '%modify resolution%'
)
ORDER BY p.proname;

-- Step 4: Check for check constraints on feedback table
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.feedback'::regclass
AND contype = 'c';  -- 'c' = check constraint

-- Step 5: Try a test update to see the actual error
-- (This will help identify if it's a trigger, constraint, or RLS)
-- Uncomment the line below and replace with an actual feedback ID to test
-- UPDATE public.feedback SET status = 'resolved' WHERE id = 'your-feedback-id-here' LIMIT 1;

