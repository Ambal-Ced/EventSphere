-- Add image_url column to event_chat table for image messages
ALTER TABLE public.event_chat
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add index for faster queries on image_url
CREATE INDEX IF NOT EXISTS idx_event_chat_image_url ON public.event_chat(image_url) WHERE image_url IS NOT NULL;

-- Note: Make sure you have a Supabase storage bucket named "chat-images" with public access
-- You can create it in the Supabase dashboard under Storage > Create bucket
-- Bucket name: chat-images
-- Public bucket: Yes

