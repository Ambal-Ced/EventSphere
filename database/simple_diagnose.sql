-- Simple diagnostic script - run each query separately if needed
-- Run this in Supabase SQL editor

-- Query 1: Check if the function exists
SELECT 
    proname as function_name,
    pronargs as num_args
FROM pg_proc
WHERE proname = 'admin_update_feedback';

-- Query 2: List all user-defined triggers on feedback
SELECT 
    t.tgname as trigger_name,
    CASE 
        WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
        WHEN t.tgtype & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype & 8 = 8 THEN 'DELETE'
        ELSE 'OTHER'
    END as event_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

-- Query 3: Find functions with the error message
SELECT 
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    prosrc ILIKE '%Only admins can modify resolution fields%'
    OR prosrc ILIKE '%resolution fields%'
);

-- Query 4: Get trigger function names for feedback table
SELECT DISTINCT
    p.proname as trigger_function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'feedback'
AND n.nspname = 'public'
AND NOT t.tgisinternal;

