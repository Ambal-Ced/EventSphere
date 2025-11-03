-- =====================================================
-- SAFE DATA DELETION - With Confirmation Step
-- =====================================================
-- This script requires you to manually confirm each step
-- Use this if you want more control over what gets deleted
-- =====================================================

-- Step 1: First, see what tables exist and their row counts
SELECT 
    tablename,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
     AND table_name = t.tablename) as column_count,
    'Run COUNT query for each table manually' as row_count_info
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- Step 2: Check row counts for each table (run individually)
SELECT COUNT(*) as events_count FROM events;
SELECT COUNT(*) as event_collaborators_count FROM event_collaborators;
SELECT COUNT(*) as profiles_count FROM profiles;
SELECT COUNT(*) as subscriptions_count FROM user_subscriptions;
SELECT COUNT(*) as transactions_count FROM transactions;
-- ... add more as needed

-- Step 3: Delete data from tables ONE BY ONE (review each before running)
-- Uncomment ONLY the tables you want to wipe:

-- DELETE FROM events WHERE true;
-- DELETE FROM event_collaborators WHERE true;
-- DELETE FROM event_items WHERE true;
-- DELETE FROM attendance_records WHERE true;
-- DELETE FROM profiles WHERE true;
-- DELETE FROM tickets WHERE true;
-- DELETE FROM user_subscriptions WHERE true;
-- DELETE FROM subscription_plans WHERE true;
-- DELETE FROM transactions WHERE true;
-- DELETE FROM notifications WHERE true;
-- DELETE FROM feedback_responses WHERE true;
-- DELETE FROM attendance_portals WHERE true;
-- DELETE FROM feedback_portals WHERE true;
-- DELETE FROM event_invites WHERE true;
-- DELETE FROM event_revenue WHERE true;
-- DELETE FROM notifications_dedupe WHERE true;

-- Step 4: Verify deletion (run this after each DELETE)
SELECT COUNT(*) as remaining_rows FROM [table_name];

