-- User Ratings table
-- Run this in Supabase SQL editor to create the user_ratings table

-- Create user_ratings table
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 0 AND rating <= 5),
  suggestion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS user_ratings_user_id_idx ON public.user_ratings(user_id);

-- Create index on rating for analytics
CREATE INDEX IF NOT EXISTS user_ratings_rating_idx ON public.user_ratings(rating);

-- Enable RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own rating
CREATE POLICY "Users can view own rating" ON public.user_ratings
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own rating
CREATE POLICY "Users can insert own rating" ON public.user_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own rating
CREATE POLICY "Users can update own rating" ON public.user_ratings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rating
CREATE POLICY "Users can delete own rating" ON public.user_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Admins can view all ratings
CREATE POLICY "Admins can view all ratings" ON public.user_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.account_type = 'admin'
    )
  );

-- Policy: Service role full access to user_ratings (for API routes)
CREATE POLICY "Service role full access to user_ratings" ON public.user_ratings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_ratings_updated_at
  BEFORE UPDATE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ratings_updated_at();

