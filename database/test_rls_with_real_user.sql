-- =====================================================
-- TEST RLS POLICIES WITH REAL USER ID
-- =====================================================
-- This script tests if RLS policies work by simulating a user operation
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID from the error logs
-- You can get the user ID from the browser console logs

-- Replace this with your actual user ID (from the error logs: user_id: '12068615-9ed4-4d10-8e11-1add89a27c6f')
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '12068615-9ed4-4d10-8e11-1add89a27c6f';

-- Test 1: Can we SELECT from user_subscriptions?
SELECT 
    '✅ SELECT test' as test_name,
    COUNT(*) as subscription_count
FROM user_subscriptions 
WHERE user_id = '12068615-9ed4-4d10-8e11-1add89a27c6f';

-- Test 2: Can we INSERT into transactions? (will rollback)
BEGIN;
    INSERT INTO transactions (
        user_id,
        invoice_number,
        original_amount_cents,
        net_amount_cents,
        currency,
        status,
        transaction_type,
        plan_name
    ) VALUES (
        '12068615-9ed4-4d10-8e11-1add89a27c6f',
        'TEST-INV-' || NOW()::TEXT,
        100,
        100,
        'PHP',
        'paid',
        'purchase',
        'Test Plan'
    );
    SELECT '✅ INSERT test' as test_name, 'Success' as result;
ROLLBACK;

-- Test 3: Can we UPDATE user_subscriptions? (will rollback)
BEGIN;
    UPDATE user_subscriptions
    SET updated_at = NOW()
    WHERE id IN (
        SELECT id 
        FROM user_subscriptions 
        WHERE user_id = '12068615-9ed4-4d10-8e11-1add89a27c6f' 
        LIMIT 1
    );
    SELECT '✅ UPDATE test' as test_name, 'Success' as result;
ROLLBACK;

-- =====================================================
-- ALTERNATIVE: Check if policies are too restrictive
-- =====================================================
-- If the above tests fail, check the policy conditions:
SELECT 
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('transactions', 'user_subscriptions')
  AND (qual IS NOT NULL OR with_check IS NOT NULL)
ORDER BY tablename, cmd;

-- If using_clause or with_check_clause don't include auth.uid() = user_id,
-- that's the problem!

