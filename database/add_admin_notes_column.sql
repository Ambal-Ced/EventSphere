-- Add admin_notes column to feedback table
-- Run this in Supabase SQL editor if the column doesn't exist

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feedback' 
    AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.feedback 
    ADD COLUMN admin_notes TEXT;
    
    COMMENT ON COLUMN public.feedback.admin_notes IS 'Admin-only notes for internal tracking and communication';
  END IF;
END $$;

