-- Fix table schema issues and ensure consistency
-- This migration will correct the existing tables to match the intended schema

-- First, let's check what we have and what needs to be fixed
-- The events table has duplicate fields (user_id and owner_id) - we should keep user_id

-- Fix events table - remove duplicate owner_id field and add missing fields
ALTER TABLE public.events 
DROP COLUMN IF EXISTS owner_id;

-- Add missing fields to events table if they don't exist
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

-- Fix event_items table - add missing is_completed field
ALTER TABLE public.event_items 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Remove shared_with field from event_items if it exists (not in original schema)
ALTER TABLE public.event_items 
DROP COLUMN IF EXISTS shared_with;

-- Fix event_collaborators table - ensure it has the correct structure
-- This table seems to be for event participants/collaborators
-- Let's make sure it has the right fields

-- Fix event_invites table - ensure it has the correct structure
-- This table seems to be for event invitation management

-- Fix feedback table - ensure all constraints are properly set
-- Add check constraints if they don't exist
DO $$
BEGIN
    -- Add feedback_type check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'feedback_feedback_type_check'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_feedback_type_check 
        CHECK (feedback_type IN ('general', 'bug_report', 'feature_request', 'event_feedback', 'user_experience'));
    END IF;

    -- Add status check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'feedback_status_check'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_status_check 
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
    END IF;

    -- Add priority check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'feedback_priority_check'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_priority_check 
        CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    END IF;

    -- Add rating check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'feedback_rating_check'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_rating_check 
        CHECK (rating >= 1 AND rating <= 5);
    END IF;
END $$;

-- Fix event_chat table - ensure all constraints are properly set
DO $$
BEGIN
    -- Add message_type check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'event_chat_message_type_check'
    ) THEN
        ALTER TABLE public.event_chat 
        ADD CONSTRAINT event_chat_message_type_check 
        CHECK (message_type IN ('text', 'image', 'file', 'system'));
    END IF;
END $$;

-- Ensure all tables have proper foreign key constraints
-- Add missing foreign key constraints if they don't exist

-- Add foreign key for event_chat.parent_message_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_chat_parent_message_id_fkey'
    ) THEN
        ALTER TABLE public.event_chat 
        ADD CONSTRAINT event_chat_parent_message_id_fkey 
        FOREIGN KEY (parent_message_id) REFERENCES public.event_chat(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key for feedback.resolved_by if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'feedback_resolved_by_fkey'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_resolved_by_fkey 
        FOREIGN KEY (resolved_by) REFERENCES auth.users(id);
    END IF;
END $$;

-- Add foreign key for event_chat.deleted_by if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'event_chat_deleted_by_fkey'
    ) THEN
        ALTER TABLE public.event_chat 
        ADD CONSTRAINT event_chat_deleted_by_fkey 
        FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
    END IF;
END $$;

-- Ensure all tables have proper indexes
-- Create missing indexes if they don't exist

-- Create indexes for event_collaborators if they don't exist
CREATE INDEX IF NOT EXISTS idx_event_collaborators_event_id ON public.event_collaborators(event_id);
CREATE INDEX IF NOT EXISTS idx_event_collaborators_user_id ON public.event_collaborators(user_id);

-- Create indexes for event_invites if they don't exist
CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON public.event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_invite_code ON public.event_invites(invite_code);

-- Create indexes for events if they don't exist
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- Ensure all tables have proper RLS policies
-- Enable RLS on tables that might not have it enabled
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for event_collaborators
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'event_collaborators'
    ) THEN
        -- Users can view collaborations for events they're part of
        CREATE POLICY "Users can view event collaborations" ON public.event_collaborators
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.events 
                WHERE events.id = event_collaborators.event_id 
                AND (events.user_id = auth.uid() OR event_collaborators.user_id = auth.uid())
            )
        );

        -- Event creators can manage collaborations
        CREATE POLICY "Event creators can manage collaborations" ON public.event_collaborators
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.events 
                WHERE events.id = event_collaborators.event_id 
                AND events.user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Create basic RLS policies for event_invites
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'event_invites'
    ) THEN
        -- Users can view invites they created
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
    END IF;
END $$;

-- Add comments to tables for documentation
COMMENT ON TABLE public.events IS 'Main events table containing event information';
COMMENT ON TABLE public.event_items IS 'Items/tasks associated with events';
COMMENT ON TABLE public.event_collaborators IS 'Users collaborating on events';
COMMENT ON TABLE public.event_invites IS 'Invitation system for events';
COMMENT ON TABLE public.feedback IS 'User feedback and support tickets';
COMMENT ON TABLE public.event_chat IS 'Real-time chat for event participants';
COMMENT ON TABLE public.profiles IS 'User profile information';
