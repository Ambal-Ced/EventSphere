-- =====================================================
-- RLS POLICIES FOR EVENT_CHAT TABLE
-- =====================================================
-- Run these in your Supabase SQL editor to set up proper Row Level Security for chat

-- Enable RLS on event_chat table
ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view event chat messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event collaborators can send messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can update own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.event_chat;
DROP POLICY IF EXISTS "Event owners can delete any message" ON public.event_chat;
DROP POLICY IF EXISTS "Moderators can delete messages" ON public.event_chat;

-- Policy: Users can view chat messages for events they can access
-- Allow viewing if user is authenticated and the event is public OR user is event owner/collaborator
CREATE POLICY "Users can view event chat messages" ON public.event_chat
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' AND (
            -- Event is public
            EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = event_chat.event_id 
                AND e.is_public = true
            )
            OR
            -- User is event owner
            EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = event_chat.event_id 
                AND e.user_id = auth.uid()
            )
            OR
            -- User is a collaborator
            EXISTS (
                SELECT 1 FROM public.event_collaborators ec 
                WHERE ec.event_id = event_chat.event_id 
                AND ec.user_id = auth.uid()
            )
        )
    );

-- Policy: Event owners and collaborators can send messages
CREATE POLICY "Event collaborators can send messages" ON public.event_chat
    FOR INSERT 
    WITH CHECK (
        auth.role() = 'authenticated' AND (
            -- User is event owner
            EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = event_chat.event_id 
                AND e.user_id = auth.uid()
            )
            OR
            -- User is a collaborator
            EXISTS (
                SELECT 1 FROM public.event_collaborators ec 
                WHERE ec.event_id = event_chat.event_id 
                AND ec.user_id = auth.uid()
            )
        )
        AND auth.uid() = user_id
    );

-- Policy: Users can update their own messages
CREATE POLICY "Users can update own messages" ON public.event_chat
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.event_chat
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Policy: Event owners can delete any message in their events
CREATE POLICY "Event owners can delete any message" ON public.event_chat
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.events e 
            WHERE e.id = event_chat.event_id 
            AND e.user_id = auth.uid()
        )
    );

-- Policy: Moderators can delete messages in events they moderate
CREATE POLICY "Moderators can delete messages" ON public.event_chat
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.event_collaborators ec 
            WHERE ec.event_id = event_chat.event_id 
            AND ec.user_id = auth.uid()
            AND ec.role = 'moderator'
        )
    );

-- =====================================================
-- STORAGE BUCKET SETUP FOR CHAT IMAGES
-- =====================================================
-- Note: You need to create the storage bucket manually in Supabase Dashboard
-- 1. Go to Storage > Create bucket
-- 2. Bucket name: chat-images
-- 3. Public bucket: Yes (or set up proper storage policies)
-- 4. File size limit: 5MB (recommended)
-- 5. Allowed MIME types: image/*

-- Storage policy: Allow authenticated users to upload chat images
-- This assumes you've created the bucket. Run this after creating the bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-images',
    'chat-images',
    true,
    5242880, -- 5MB in bytes
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow authenticated users to upload to chat-images
CREATE POLICY "Authenticated users can upload chat images" ON storage.objects
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'chat-images' 
        AND auth.role() = 'authenticated'
    );

-- Storage policy: Allow public read access to chat images
CREATE POLICY "Public can view chat images" ON storage.objects
    FOR SELECT 
    USING (bucket_id = 'chat-images');

-- Storage policy: Allow users to delete their own uploaded images
CREATE POLICY "Users can delete own chat images" ON storage.objects
    FOR DELETE 
    USING (
        bucket_id = 'chat-images' 
        AND auth.role() = 'authenticated'
        -- Allow deletion if user is event owner or message owner
        AND (
            -- Extract event_id from path (format: event_id/filename)
            EXISTS (
                SELECT 1 FROM public.event_chat ec
                WHERE ec.image_url LIKE '%' || (storage.objects.name).text || '%'
                AND (
                    ec.user_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.events e 
                        WHERE e.id = ec.event_id 
                        AND e.user_id = auth.uid()
                    )
                )
            )
        )
    );

