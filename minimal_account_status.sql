-- =====================================================
-- MINIMAL ACCOUNT STATUS SCHEMA
-- =====================================================
-- Simple table for tracking new accounts eligible for trials

-- Create the table
CREATE TABLE IF NOT EXISTS public.account_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    new_account BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own account status"
ON public.account_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own account status"
ON public.account_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own account status"
ON public.account_status FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all account status"
ON public.account_status FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_account_status_user_id ON public.account_status(user_id);
CREATE INDEX IF NOT EXISTS idx_account_status_new_account ON public.account_status(new_account);
