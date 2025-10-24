-- =====================================================
-- ACCOUNT STATUS SYSTEM SCHEMA
-- =====================================================
-- This schema handles new account status tracking for 1-month free trials

-- =====================================================
-- 1. CREATE ACCOUNT STATUS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.account_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    new_account BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user
    UNIQUE(user_id)
);

-- =====================================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_account_status_user_id ON public.account_status(user_id);
CREATE INDEX IF NOT EXISTS idx_account_status_new_account ON public.account_status(new_account);

-- =====================================================
-- 3. CREATE FUNCTION TO ADD NEW ACCOUNT STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION add_new_account_status(user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert new account status if user doesn't exist
    INSERT INTO public.account_status (user_id, new_account, created_at, updated_at)
    VALUES (user_id, TRUE, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'New account status added for user %', user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE FUNCTION TO ACTIVATE 1-MONTH TRIAL
-- =====================================================

CREATE OR REPLACE FUNCTION activate_new_account_trial(user_id UUID)
RETURNS UUID AS $$
DECLARE
    trial_subscription_id UUID;
    trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if user has new_account status
    IF NOT EXISTS (
        SELECT 1 FROM public.account_status 
        WHERE account_status.user_id = activate_new_account_trial.user_id 
        AND new_account = TRUE
    ) THEN
        RAISE EXCEPTION 'User is not eligible for new account trial';
    END IF;
    
    -- Check if user already has an active subscription
    IF EXISTS (
        SELECT 1 FROM public.user_subscriptions 
        WHERE user_subscriptions.user_id = activate_new_account_trial.user_id 
        AND status IN ('active', 'trialing')
        AND current_period_end > NOW()
    ) THEN
        RAISE EXCEPTION 'User already has an active subscription';
    END IF;
    
    -- Calculate trial end date (1 month from now)
    trial_end_date := NOW() + INTERVAL '1 month';
    
    -- Create trial subscription using small_event_org plan
    INSERT INTO public.user_subscriptions (
        user_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        trial_start,
        trial_end,
        created_at
    ) VALUES (
        user_id,
        'small_event_org', -- Use existing small_event_org plan
        'active',
        NOW(),
        trial_end_date,
        NOW(),
        trial_end_date,
        NOW()
    ) RETURNING id INTO trial_subscription_id;
    
    -- Mark account as no longer new
    UPDATE public.account_status 
    SET new_account = FALSE, updated_at = NOW()
    WHERE user_id = activate_new_account_trial.user_id;
    
    -- Log trial activation
    RAISE NOTICE 'New account trial activated for user % until %', user_id, trial_end_date;
    
    RETURN trial_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CREATE FUNCTION TO CHECK NEW ACCOUNT STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_new_account(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_new BOOLEAN;
BEGIN
    SELECT new_account INTO is_new
    FROM public.account_status
    WHERE account_status.user_id = is_user_new_account.user_id;
    
    RETURN COALESCE(is_new, FALSE);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE FUNCTION TO HANDLE TRIAL EXPIRATION
-- =====================================================

CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Update expired trials to cancelled status
    UPDATE public.user_subscriptions 
    SET status = 'cancelled',
        cancelled_at = NOW()
    WHERE status = 'active' 
    AND trial_start IS NOT NULL
    AND trial_end < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log expired trials
    IF expired_count > 0 THEN
        RAISE NOTICE 'Expired % trial subscriptions', expired_count;
    END IF;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own account status
CREATE POLICY "Users can view their own account status" 
ON public.account_status FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own account status
CREATE POLICY "Users can update their own account status" 
ON public.account_status FOR UPDATE 
USING (auth.uid() = user_id);

-- Service role can manage all account status
CREATE POLICY "Service role can manage all account status" 
ON public.account_status FOR ALL 
TO service_role 
USING (TRUE) 
WITH CHECK (TRUE);

-- =====================================================
-- 8. HELPFUL QUERIES
-- =====================================================

-- View all new accounts
-- SELECT * FROM public.account_status WHERE new_account = TRUE;

-- Count new accounts
-- SELECT COUNT(*) as new_accounts FROM public.account_status WHERE new_account = TRUE;

-- Check if specific user is new account
-- SELECT is_user_new_account('user-uuid-here');

-- View active trials
-- SELECT us.*, sp.name as plan_name 
-- FROM public.user_subscriptions us
-- JOIN public.subscription_plans sp ON us.plan_id = sp.id
-- WHERE us.trial_start IS NOT NULL AND us.status = 'active';

-- =====================================================
-- 9. VERIFY SETUP
-- =====================================================

-- Check if account_status table exists
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'account_status' 
ORDER BY ordinal_position;
