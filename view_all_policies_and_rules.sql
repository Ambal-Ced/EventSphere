-- Comprehensive Query to View All Policies and Rules in Supabase
-- Run these queries in your Supabase SQL editor to see all security settings

-- =====================================================
-- 1. VIEW ALL RLS POLICIES
-- =====================================================

-- View all Row Level Security policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 2. VIEW ALL TABLE CONSTRAINTS
-- =====================================================

-- View all table constraints (Primary Keys, Foreign Keys, Unique, Check)
SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.is_deferrable,
    tc.initially_deferred
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- =====================================================
-- 3. VIEW ALL CHECK CONSTRAINTS
-- =====================================================

-- View all check constraints with their conditions
SELECT 
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- 4. VIEW ALL FOREIGN KEY RELATIONSHIPS
-- =====================================================

-- View all foreign key relationships
SELECT 
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 5. VIEW ALL STORAGE POLICIES
-- =====================================================

-- View all storage bucket policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
    AND tablename = 'objects'
ORDER BY policyname;

-- =====================================================
-- 6. VIEW ALL FUNCTIONS AND TRIGGERS
-- =====================================================

-- View all custom functions
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    t.typname AS return_type,
    p.prosrc AS function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_type t ON p.prorettype = t.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- View all triggers
SELECT 
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    p.proname AS function_name,
    t.tgenabled AS enabled,
    t.tgtype AS trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
ORDER BY c.relname, t.tgname;

-- =====================================================
-- 7. VIEW ALL INDEXES
-- =====================================================

-- View all indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- 8. VIEW RLS STATUS
-- =====================================================

-- View which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- 9. VIEW ALL STORAGE BUCKETS
-- =====================================================

-- View all storage buckets
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at,
    updated_at
FROM storage.buckets
ORDER BY name;

-- =====================================================
-- 10. COMPREHENSIVE POLICY SUMMARY
-- =====================================================

-- Get a summary of all policies by table
SELECT 
    tablename,
    COUNT(*) AS total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) AS select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) AS insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) AS update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) AS delete_policies,
    COUNT(CASE WHEN cmd = 'ALL' THEN 1 END) AS all_policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- 11. VIEW SPECIFIC TABLE POLICIES
-- =====================================================

-- View policies for a specific table (replace 'events' with your table name)
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'events'
ORDER BY cmd, policyname;

-- =====================================================
-- 12. VIEW POLICY DETAILS WITH SQL
-- =====================================================

-- View detailed policy information with SQL conditions
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        ELSE 'No USING condition'
    END AS using_condition,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'No WITH CHECK condition'
    END AS with_check_condition
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- 13. VIEW ALL TABLES WITH THEIR SECURITY SETTINGS
-- =====================================================

-- Comprehensive view of all tables and their security settings
SELECT 
    t.table_schema,
    t.table_name,
    CASE WHEN p.rowsecurity THEN 'Yes' ELSE 'No' END AS rls_enabled,
    COUNT(pol.policyname) AS total_policies,
    COUNT(DISTINCT tc.constraint_name) AS total_constraints,
    COUNT(DISTINCT i.indexname) AS total_indexes
FROM information_schema.tables t
LEFT JOIN pg_tables p ON t.table_name = p.tablename AND t.table_schema = p.schemaname
LEFT JOIN pg_policies pol ON t.table_name = pol.tablename AND t.table_schema = pol.schemaname
LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name AND t.table_schema = tc.table_schema
LEFT JOIN pg_indexes i ON t.table_name = i.tablename AND t.table_schema = i.schemaname
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_schema, t.table_name, p.rowsecurity
ORDER BY t.table_name;

-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================

-- Run these queries to see different aspects of your database:
-- 1. Query 1: See all RLS policies
-- 2. Query 2: See all table constraints
-- 3. Query 3: See all check constraints
-- 4. Query 4: See all foreign key relationships
-- 5. Query 5: See all storage policies
-- 6. Query 6: See all functions and triggers
-- 7. Query 7: See all indexes
-- 8. Query 8: See RLS status
-- 9. Query 9: See all storage buckets
-- 10. Query 10: See policy summary
-- 11. Query 11: See policies for specific table
-- 12. Query 12: See detailed policy conditions
-- 13. Query 13: See comprehensive table security summary

-- This will give you a complete overview of all security settings in your database!
