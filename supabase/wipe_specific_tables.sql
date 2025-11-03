-- =====================================================
-- WIPE SPECIFIC TABLES ONLY
-- =====================================================
-- Use this if you only want to delete data from specific tables
-- Comment/uncomment the tables you want to affect
-- =====================================================

-- Events related tables
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE event_collaborators CASCADE;
TRUNCATE TABLE event_items CASCADE;
TRUNCATE TABLE event_invites CASCADE;

-- Attendance and Feedback
TRUNCATE TABLE attendance_records CASCADE;
TRUNCATE TABLE attendance_portals CASCADE;
TRUNCATE TABLE feedback_responses CASCADE;
TRUNCATE TABLE feedback_portals CASCADE;

-- User data (BE CAREFUL - this removes user profiles!)
-- TRUNCATE TABLE profiles CASCADE;

-- Subscription and Payment data
-- TRUNCATE TABLE user_subscriptions CASCADE;
-- TRUNCATE TABLE subscription_plans CASCADE;
-- TRUNCATE TABLE transactions CASCADE;

-- Other tables
-- TRUNCATE TABLE tickets CASCADE;
-- TRUNCATE TABLE notifications CASCADE;
-- TRUNCATE TABLE notifications_dedupe CASCADE;
-- TRUNCATE TABLE event_revenue CASCADE;

