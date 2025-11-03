-- =====================================================
-- ⚠️  DANGEROUS OPERATION - WIPE ALL DATA ⚠️
-- =====================================================
-- 
-- ⚠️  WARNING: This will PERMANENTLY DELETE ALL DATA from ALL tables!
-- ⚠️  This operation CANNOT be undone!
-- ⚠️  Make sure you have a backup before running this!
-- 
-- This script will:
-- 1. Disable triggers temporarily
-- 2. Truncate all tables in the public schema
-- 3. Reset sequences (for auto-increment columns)
-- 
-- Tables will remain intact, but all data will be deleted.
-- 
-- =====================================================
-- HOW TO USE:
-- =====================================================
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire script
-- 3. Review the tables that will be affected
-- 4. Run the script
-- 
-- OR use the individual table truncate commands below
-- 
-- =====================================================

-- Option 1: Truncate all tables automatically (RECOMMENDED)
-- This uses a DO block to dynamically find and truncate all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Disable triggers temporarily
    SET session_replication_role = 'replica';
    
    -- Loop through all tables in public schema
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Truncated table: %', r.tablename;
    END LOOP;
    
    -- Re-enable triggers
    SET session_replication_role = 'origin';
    
    RAISE NOTICE 'All tables have been truncated!';
END $$;

-- =====================================================
-- Option 2: Manually truncate specific tables
-- =====================================================
-- Uncomment the tables you want to truncate:

-- TRUNCATE TABLE events CASCADE;
-- TRUNCATE TABLE event_collaborators CASCADE;
-- TRUNCATE TABLE event_items CASCADE;
-- TRUNCATE TABLE attendance_records CASCADE;
-- TRUNCATE TABLE profiles CASCADE;
-- TRUNCATE TABLE tickets CASCADE;
-- TRUNCATE TABLE user_subscriptions CASCADE;
-- TRUNCATE TABLE subscription_plans CASCADE;
-- TRUNCATE TABLE transactions CASCADE;
-- TRUNCATE TABLE notifications CASCADE;
-- TRUNCATE TABLE feedback_responses CASCADE;
-- TRUNCATE TABLE attendance_portals CASCADE;
-- TRUNCATE TABLE feedback_portals CASCADE;
-- TRUNCATE TABLE event_invites CASCADE;
-- TRUNCATE TABLE event_revenue CASCADE;
-- TRUNCATE TABLE notifications_dedupe CASCADE;

-- =====================================================
-- Option 3: Delete all rows (slower but more flexible)
-- =====================================================
-- DELETE FROM events;
-- DELETE FROM event_collaborators;
-- DELETE FROM event_items;
-- DELETE FROM attendance_records;
-- DELETE FROM profiles;
-- DELETE FROM tickets;
-- DELETE FROM user_subscriptions;
-- DELETE FROM transactions;
-- DELETE FROM notifications;
-- DELETE FROM feedback_responses;
-- DELETE FROM attendance_portals;
-- DELETE FROM feedback_portals;
-- DELETE FROM event_invites;
-- DELETE FROM event_revenue;
-- DELETE FROM notifications_dedupe;

-- =====================================================
-- VERIFY: Check that all tables are empty
-- =====================================================
-- Run this after truncating to verify:
SELECT 
    tablename,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', schemaname, tablename), false, true, '')))[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

