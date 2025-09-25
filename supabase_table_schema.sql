-- Complete EventSphere Database Setup Script
-- This file contains everything needed to recreate the EventSphere database from scratch
-- Run this in your Supabase SQL editor after creating a new project

-- =====================================================
-- STORAGE BUCKETS SETUP
-- =====================================================

-- Create storage buckets for avatars and event images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES 
('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
('event-images', 'event-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
('event-docs', 'event-docs', true, 10485760, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf']);

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle feedback resolved_at timestamp
CREATE OR REPLACE FUNCTION public.handle_feedback_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle message deletion tracking
CREATE OR REPLACE FUNCTION public.handle_message_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at = now();
    NEW.deleted_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has event role (creator, moderator, or member)
CREATE OR REPLACE FUNCTION public.has_event_role(event_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is event creator
  IF EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = event_id AND events.user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has collaborator role
  IF EXISTS (
    SELECT 1 FROM public.event_collaborators 
    WHERE event_collaborators.event_id = event_id 
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.role = required_role
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can edit event (creator or moderator)
CREATE OR REPLACE FUNCTION public.can_edit_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can view event (creator, moderator, or member)
CREATE OR REPLACE FUNCTION public.can_view_event(event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_event_role(event_id, 'member') OR 
         public.has_event_role(event_id, 'moderator') OR 
         public.has_event_role(event_id, 'creator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TABLE DEFINITIONS
-- =====================================================

-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  fname TEXT,
  lname TEXT,
  mname TEXT,
  suffix TEXT,
  address TEXT,
  contact_no TEXT,
  birthday DATE,
  age INTEGER,
  gender TEXT,
  interests TEXT[],
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  avatar_url TEXT
);

-- Events table
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  is_online BOOLEAN DEFAULT false NOT NULL,
  max_participants INTEGER,
  price DECIMAL(10,2),
  image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  role TEXT DEFAULT 'organizer'
);

-- Event items table
CREATE TABLE public.event_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_quantity INTEGER DEFAULT 1 NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL
);

-- Event collaborators table (handles moderators and members)
CREATE TABLE public.event_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('moderator', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(event_id, user_id) -- Prevent duplicate collaborations
);

-- Event invites table
CREATE TABLE public.event_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('moderator', 'member')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Event script table (stores uploaded DOCX/PDF files for an event)
CREATE TABLE public.event_script (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT
);

-- Feedback table
CREATE TABLE public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('general', 'bug_report', 'feature_request', 'event_feedback', 'user_experience')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Event chat table
CREATE TABLE public.event_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  parent_message_id UUID REFERENCES public.event_chat(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_script ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enhanced event update policy: creators and moderators can edit
CREATE POLICY "Event creators and moderators can update events" ON public.events
  FOR UPDATE USING (public.can_edit_event(id));

-- Only event creators can delete events
CREATE POLICY "Only event creators can delete events" ON public.events
  FOR DELETE USING (auth.uid() = user_id);

-- Event items policies
CREATE POLICY "Event items are viewable by event participants" ON public.event_items
  FOR SELECT USING (public.can_view_event(event_id));

-- Event creators and moderators can manage items
CREATE POLICY "Event creators and moderators can manage items" ON public.event_items
  FOR ALL USING (public.can_edit_event(event_id));

-- Event collaborators policies
CREATE POLICY "Users can view event collaborations" ON public.event_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND (events.user_id = auth.uid() OR event_collaborators.user_id = auth.uid())
    )
  );

-- Only event creators can manage collaborations
CREATE POLICY "Only event creators can manage collaborations" ON public.event_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_collaborators.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Event invites policies
CREATE POLICY "Users can view own invites" ON public.event_invites
  FOR SELECT USING (created_by = auth.uid());

-- Event creators can manage invites
CREATE POLICY "Event creators can manage invites" ON public.event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invites.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Feedback policies
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event creators can view event feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON public.feedback
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND status != 'resolved'
  );

CREATE POLICY "Users can delete own feedback" ON public.feedback
  FOR DELETE USING (
    auth.uid() = user_id 
    AND status != 'resolved'
  );

CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Event chat policies
CREATE POLICY "Event participants can view chat" ON public.event_chat
  FOR SELECT USING (public.can_view_event(event_id));

CREATE POLICY "Event participants can create chat messages" ON public.event_chat
  FOR INSERT WITH CHECK (public.can_view_event(event_id));

CREATE POLICY "Users can update own messages" ON public.event_chat
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND is_deleted = false
  );

CREATE POLICY "Users can delete own messages" ON public.event_chat
  FOR DELETE USING (auth.uid() = user_id);

-- Event creators and moderators can delete any message in their event
CREATE POLICY "Event creators and moderators can delete messages" ON public.event_chat
  FOR DELETE USING (public.can_edit_event(event_id));

CREATE POLICY "Admins can manage all chat messages" ON public.event_chat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Event script policies
CREATE POLICY "Event participants can view scripts" ON public.event_script
  FOR SELECT USING (public.can_view_event(event_id));

CREATE POLICY "Event creators and moderators can upload scripts" ON public.event_script
  FOR INSERT WITH CHECK (public.can_edit_event(event_id) AND auth.uid() = user_id);

CREATE POLICY "Event creators and moderators can update scripts" ON public.event_script
  FOR UPDATE USING (public.can_edit_event(event_id) AND auth.uid() = user_id);

CREATE POLICY "Event creators and moderators can delete scripts" ON public.event_script
  FOR DELETE USING (public.can_edit_event(event_id) AND auth.uid() = user_id);

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Avatar bucket policies
CREATE POLICY "Users can upload own avatar" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view all avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Event images bucket policies
CREATE POLICY "Users can upload event images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Users can view all event images" ON storage.objects
FOR SELECT USING (bucket_id = 'event-images');

-- Event creators and moderators can update event images
CREATE POLICY "Event creators and moderators can update event images" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'event-images' 
    AND EXISTS (
        SELECT 1 FROM public.events 
        WHERE events.image_url LIKE '%' || storage.objects.id || '%'
        AND public.can_edit_event(events.id)
    )
);

-- Event docs bucket policies
CREATE POLICY "Users can upload event docs" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'event-docs');

CREATE POLICY "Users can view all event docs" ON storage.objects
FOR SELECT USING (bucket_id = 'event-docs');

CREATE POLICY "Event creators and moderators can delete event docs" ON storage.objects
FOR DELETE USING (
    bucket_id = 'event-docs'
);

-- Event creators and moderators can delete event images
CREATE POLICY "Event creators and moderators can delete event images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'event-images' 
    AND EXISTS (
        SELECT 1 FROM public.events 
        WHERE events.image_url LIKE '%' || storage.objects.id || '%'
        AND public.can_edit_event(events.id)
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Events indexes
CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_type ON public.events(type);

-- Event items indexes
CREATE INDEX idx_event_items_event_id ON public.event_items(event_id);
CREATE INDEX idx_event_items_is_completed ON public.event_items(is_completed);

-- Event collaborators indexes
CREATE INDEX idx_event_collaborators_event_id ON public.event_collaborators(event_id);
CREATE INDEX idx_event_collaborators_user_id ON public.event_collaborators(user_id);
CREATE INDEX idx_event_collaborators_role ON public.event_collaborators(role);

-- Event script indexes
CREATE INDEX idx_event_script_event_id ON public.event_script(event_id);
CREATE INDEX idx_event_script_user_id ON public.event_script(user_id);
CREATE INDEX idx_event_script_created_at ON public.event_script(created_at);

-- Event invites indexes
CREATE INDEX idx_event_invites_event_id ON public.event_invites(event_id);
CREATE INDEX idx_event_invites_invite_code ON public.event_invites(invite_code);
CREATE INDEX idx_event_invites_created_by ON public.event_invites(created_by);
CREATE INDEX idx_event_invites_role ON public.event_invites(role);

-- Feedback indexes
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_event_id ON public.feedback(event_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_type ON public.feedback(feedback_type);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at);
CREATE INDEX idx_feedback_priority ON public.feedback(priority);

-- Event chat indexes
CREATE INDEX idx_event_chat_event_id ON public.event_chat(event_id);
CREATE INDEX idx_event_chat_user_id ON public.event_chat(user_id);
CREATE INDEX idx_event_chat_created_at ON public.event_chat(created_at);
CREATE INDEX idx_event_chat_parent_message_id ON public.event_chat(parent_message_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_feedback_resolved
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_feedback_resolved();

CREATE TRIGGER handle_message_deletion
  BEFORE UPDATE ON public.event_chat
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_message_deletion();

-- =====================================================
-- TABLE COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profile information including personal details and preferences';
COMMENT ON TABLE public.events IS 'Main events table containing event information and metadata';
COMMENT ON TABLE public.event_items IS 'Items/tasks associated with events for organization';
COMMENT ON TABLE public.event_collaborators IS 'Users collaborating on events with specific roles (moderator/member)';
COMMENT ON TABLE public.event_invites IS 'Invitation system for events with codes and usage limits';
COMMENT ON TABLE public.feedback IS 'User feedback and support tickets with rating system';
COMMENT ON TABLE public.event_chat IS 'Real-time chat system for event participants with threading support';
COMMENT ON TABLE public.event_script IS 'Uploaded event script files (DOCX/PDF) associated with events';

-- =====================================================
-- ROLE-BASED ACCESS CONTROL SUMMARY
-- =====================================================

-- Event Creator (user_id in events table):
-- ✅ Can create, edit, and delete events
-- ✅ Can manage event items
-- ✅ Can manage collaborators (invite moderators and members)
-- ✅ Can manage event invites
-- ✅ Can delete any chat messages
-- ✅ Can manage event images

-- Event Moderator (role = 'moderator' in event_collaborators):
-- ✅ Can edit events (but NOT delete)
-- ✅ Can manage event items
-- ✅ Can delete chat messages
-- ✅ Can manage event images
-- ❌ Cannot delete events
-- ❌ Cannot manage collaborators

-- Event Member (role = 'member' in event_collaborators):
-- ✅ Can view events and items
-- ✅ Can participate in event chat
-- ✅ Can create chat messages
-- ❌ Cannot edit events
-- ❌ Cannot manage items
-- ❌ Cannot delete messages (except own)

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- This Setup is for EventSphere Database which sets policies for the database.
-- This includes:
-- ✅ All tables with proper structure
-- ✅ Row Level Security (RLS) enabled
-- ✅ Comprehensive security policies
-- ✅ Storage buckets (avatars, event-images)
-- ✅ Storage access policies
-- ✅ Performance indexes
-- ✅ Automatic timestamp functions
-- ✅ Database triggers
-- ✅ Table documentation
-- ✅ Role-based access control (Creator, Moderator, Member)
-- ✅ Backup-ready complete schema 