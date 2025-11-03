-- =====================================================
-- ADD account_type COLUMN TO PROFILES TABLE
-- =====================================================
-- This adds an account_type column to the profiles table
-- Default value is 'user', only admin (service_role) can set it to 'admin'

-- Add account_type column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user' CHECK (account_type IN ('user', 'admin'));

-- Create index for account_type for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);

-- =====================================================
-- FUNCTION: Prevent users from changing account_type to admin
-- =====================================================
-- This function checks if the account_type change is allowed
CREATE OR REPLACE FUNCTION check_account_type_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role to change account_type to anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Regular users can only set account_type to 'user' or keep it unchanged
  IF NEW.account_type = 'admin' AND OLD.account_type != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can set account_type to admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce account_type restrictions
DROP TRIGGER IF EXISTS prevent_account_type_admin_update ON profiles;

CREATE TRIGGER prevent_account_type_admin_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.account_type IS DISTINCT FROM NEW.account_type)
  EXECUTE FUNCTION check_account_type_update();

-- =====================================================
-- RLS POLICY: Users can update their own profile
-- =====================================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Policy: Users can update their own profile (but account_type is protected by trigger)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
  );

-- Service role can update any profile with any account_type
DROP POLICY IF EXISTS "Service role can update profiles" ON profiles;

CREATE POLICY "Service role can update profiles" ON profiles
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify column was added
SELECT 
    'Column Added' as check_type,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'account_type';

-- Verify check constraint exists
SELECT 
    'Check Constraint' as check_type,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%account_type%';

-- =====================================================
-- NOTES
-- =====================================================
-- 1. account_type defaults to 'user' for all new profiles
-- 2. Users cannot change their account_type to 'admin' - only service_role can
-- 3. Users can update their profile but account_type will remain 'user' unless admin changes it
-- 4. Use account_type = 'admin' to identify admin users in queries

