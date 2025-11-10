-- Add missing INSERT policy for overall_transaction table
-- Run this if the table already exists but INSERT is failing with 400 error

-- Check if policy already exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'overall_transaction' 
    AND policyname = 'Users can insert own overall_transaction'
  ) THEN
    CREATE POLICY "Users can insert own overall_transaction" ON overall_transaction
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Also add UPDATE policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'overall_transaction' 
    AND policyname = 'Users can update own overall_transaction'
  ) THEN
    CREATE POLICY "Users can update own overall_transaction" ON overall_transaction
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

