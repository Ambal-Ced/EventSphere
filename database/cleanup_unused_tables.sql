-- =====================================================
-- CLEANUP UNUSED TABLES
-- =====================================================
-- This script removes unused tables that are not being used by the application

-- Drop billing_history table (unused - billing history comes from transactions table)
DROP TABLE IF EXISTS public.billing_history CASCADE;

-- Note: user_trial_status table does not exist in the current schema

-- Note: The following tables are being used and should NOT be dropped:
-- - account_status (used by account-status-manager.ts)
-- - transactions (used for billing history and admin tracking)
-- - user_subscriptions (core subscription data)
-- - subscription_plans (plan definitions)
-- - user_usage (ACTIVELY USED for AI insights, events, usage limits)
-- - events (event data)
-- - profiles (user profiles)
-- - tickets (event tickets)

-- Verify tables were dropped
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name = 'billing_history';

-- Should return no rows if billing_history was successfully dropped
