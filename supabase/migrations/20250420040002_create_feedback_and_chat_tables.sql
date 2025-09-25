-- Create feedback table
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

-- Create event_chat table
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

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;

-- Create policies for feedback table
-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view feedback for events they created
CREATE POLICY "Event creators can view event feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = feedback.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Users can create feedback
CREATE POLICY "Users can create feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback (only if not resolved)
CREATE POLICY "Users can update own feedback" ON public.feedback
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND status != 'resolved'
  );

-- Users can delete their own feedback (only if not resolved)
CREATE POLICY "Users can delete own feedback" ON public.feedback
  FOR DELETE USING (
    auth.uid() = user_id 
    AND status != 'resolved'
  );

-- Admins can view all feedback (assuming admin role in profiles table)
CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage all feedback
CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create policies for event_chat table
-- Users can view chat messages for events they're participating in or created
CREATE POLICY "Users can view event chat" ON public.event_chat
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_chat.event_id 
      AND (events.user_id = auth.uid() OR true) -- Allow viewing for now, can be restricted later
    )
  );

-- Users can create chat messages
CREATE POLICY "Users can create chat messages" ON public.event_chat
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages (only if not deleted)
CREATE POLICY "Users can update own messages" ON public.event_chat
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND is_deleted = false
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.event_chat
  FOR DELETE USING (auth.uid() = user_id);

-- Event creators can delete any message in their event
CREATE POLICY "Event creators can delete messages" ON public.event_chat
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_chat.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Admins can manage all chat messages
CREATE POLICY "Admins can manage all chat messages" ON public.event_chat
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_event_id ON public.feedback(event_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_type ON public.feedback(feedback_type);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at);

CREATE INDEX idx_event_chat_event_id ON public.event_chat(event_id);
CREATE INDEX idx_event_chat_user_id ON public.event_chat(user_id);
CREATE INDEX idx_event_chat_created_at ON public.event_chat(created_at);
CREATE INDEX idx_event_chat_parent_message_id ON public.event_chat(parent_message_id);

-- Create function to handle updated_at for feedback
CREATE OR REPLACE FUNCTION public.handle_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle updated_at for event_chat
CREATE OR REPLACE FUNCTION public.handle_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_feedback_updated_at();

CREATE TRIGGER handle_chat_updated_at
  BEFORE UPDATE ON public.event_chat
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_chat_updated_at();

-- Create function to handle resolved_at timestamp
CREATE OR REPLACE FUNCTION public.handle_feedback_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for resolved_at
CREATE TRIGGER handle_feedback_resolved
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_feedback_resolved();

-- Create function to handle message deletion
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

-- Create trigger for message deletion
CREATE TRIGGER handle_message_deletion
  BEFORE UPDATE ON public.event_chat
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_message_deletion();
