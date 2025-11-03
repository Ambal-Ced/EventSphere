-- =====================================================
-- ACCOUNT DELETION REQUESTS TABLE
-- =====================================================
-- This table tracks account deletion requests with grace period
-- Prevents users from cheating free trial system by tracking deletion history

-- Create account_deletion_requests table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- One deletion request per user
  user_email TEXT NOT NULL, -- Store email to track deletion history (prevents free trial abuse)
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_deletion_date TIMESTAMP WITH TIME ZONE NOT NULL, -- 7+ business days from request
  cancelled_at TIMESTAMP WITH TIME ZONE NULL, -- If user cancels deletion
  deleted_at TIMESTAMP WITH TIME ZONE NULL, -- When account was actually deleted
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'cancelled', 'completed'
  deletion_reason TEXT, -- Optional reason from user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_email ON account_deletion_requests(user_email);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_scheduled_date ON account_deletion_requests(scheduled_deletion_date);

-- Enable RLS
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_deletion_requests
DROP POLICY IF EXISTS "Users can view own deletion request" ON account_deletion_requests;
DROP POLICY IF EXISTS "Users can insert own deletion request" ON account_deletion_requests;
DROP POLICY IF EXISTS "Users can update own deletion request" ON account_deletion_requests;
DROP POLICY IF EXISTS "Service role can manage deletion requests" ON account_deletion_requests;

-- Users can view their own deletion request
CREATE POLICY "Users can view own deletion request" ON account_deletion_requests
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Users can create their own deletion request
CREATE POLICY "Users can insert own deletion request" ON account_deletion_requests
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Users can update their own deletion request (to cancel)
CREATE POLICY "Users can update own deletion request" ON account_deletion_requests
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- Service role can manage all deletion requests (for cron jobs)
CREATE POLICY "Service role can manage deletion requests" ON account_deletion_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- HELPER FUNCTION: Calculate scheduled deletion date (7+ business days)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_scheduled_deletion_date()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  scheduled_date TIMESTAMP WITH TIME ZONE;
  days_to_add INTEGER := 7;
  business_days_added INTEGER := 0;
  target_date DATE := CURRENT_DATE;
BEGIN
  -- Add 7 business days (excluding weekends)
  WHILE business_days_added < days_to_add LOOP
    target_date := target_date + INTERVAL '1 day';
    -- Check if it's a weekday (Monday = 1, Sunday = 7 in EXTRACT(DOW))
    IF EXTRACT(DOW FROM target_date) BETWEEN 1 AND 5 THEN
      business_days_added := business_days_added + 1;
    END IF;
  END LOOP;
  
  -- Set to end of business day (5 PM) on the scheduled date
  scheduled_date := (target_date + INTERVAL '17 hours')::TIMESTAMP WITH TIME ZONE;
  
  RETURN scheduled_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Check if email was previously deleted (prevents free trial abuse)
-- =====================================================
CREATE OR REPLACE FUNCTION was_email_previously_deleted(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count
  FROM account_deletion_requests
  WHERE user_email = p_email
    AND status = 'completed'
    AND deleted_at IS NOT NULL;
  
  RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get pending deletion requests (for admin use)
-- =====================================================
-- This function returns all pending deletion requests that are past their scheduled date
-- Admin will use this to manually process deletions
CREATE OR REPLACE FUNCTION get_pending_deletion_requests()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  requested_at TIMESTAMP WITH TIME ZONE,
  scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
  days_until_deletion INTEGER,
  deletion_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    adr.id,
    adr.user_id,
    adr.user_email,
    adr.requested_at,
    adr.scheduled_deletion_date,
    GREATEST(0, EXTRACT(DAY FROM (adr.scheduled_deletion_date - NOW()))::INTEGER) as days_until_deletion,
    adr.deletion_reason,
    adr.created_at
  FROM account_deletion_requests adr
  WHERE adr.status = 'pending'
    AND adr.scheduled_deletion_date <= NOW()
    AND adr.cancelled_at IS NULL
  ORDER BY adr.scheduled_deletion_date ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NOTE: Actual deletion will be handled by admin
-- =====================================================
-- The process_scheduled_account_deletions() function is not created here
-- Admin will handle permanent deletions manually or via admin panel
-- Users can only REQUEST deletion and CANCEL their requests

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify table was created
SELECT 
    'Table Created' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'account_deletion_requests';

-- Verify policies exist
SELECT 
    'Policies' as check_type,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'account_deletion_requests'
ORDER BY cmd;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. This table tracks account deletion REQUESTS (users cannot delete themselves)
-- 2. Users have 7+ business days to cancel deletion request
-- 3. Admin must manually process deletions after grace period
-- 4. auth.users is NOT deleted (user can reuse email)
-- 5. Email is stored to prevent free trial abuse
-- 6. Use was_email_previously_deleted(email) to check if email was deleted before
-- 7. Use get_pending_deletion_requests() to get requests ready for admin processing

