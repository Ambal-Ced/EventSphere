-- Admin RLS policies for feedback table
-- Run this in Supabase SQL editor to allow admins to view all feedback

-- Policy: Admins can view all feedback
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'feedback' 
    AND policyname = 'Admins can view all feedback'
  ) THEN
    CREATE POLICY "Admins can view all feedback"
      ON public.feedback
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() 
          AND p.account_type = 'admin'
        )
      );
  END IF;
END $$;

-- Policy: Admins can update all feedback
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'feedback' 
    AND policyname = 'Admins can update all feedback'
  ) THEN
    CREATE POLICY "Admins can update all feedback"
      ON public.feedback
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() 
          AND p.account_type = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() 
          AND p.account_type = 'admin'
        )
      );
  END IF;
END $$;

-- Policy: Admins can delete all feedback
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'feedback' 
    AND policyname = 'Admins can delete all feedback'
  ) THEN
    CREATE POLICY "Admins can delete all feedback"
      ON public.feedback
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() 
          AND p.account_type = 'admin'
        )
      );
  END IF;
END $$;

-- Service role full access (for API routes using service role key)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'feedback' 
    AND policyname = 'Service role full access to feedback'
  ) THEN
    CREATE POLICY "Service role full access to feedback"
      ON public.feedback
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

