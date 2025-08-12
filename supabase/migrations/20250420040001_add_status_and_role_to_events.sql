-- Add status and role columns to events table
ALTER TABLE public.events 
ADD COLUMN status TEXT DEFAULT 'coming_soon' CHECK (status IN ('coming_soon', 'ongoing', 'done', 'cancelled', 'archived')),
ADD COLUMN role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'moderator', 'member'));

-- Update existing events to have default values
UPDATE public.events 
SET status = 'coming_soon', role = 'owner' 
WHERE status IS NULL OR role IS NULL;

-- Create index for status for better performance
CREATE INDEX idx_events_status ON public.events(status);

-- Create index for role for better performance  
CREATE INDEX idx_events_role ON public.events(role);

-- Add comment to explain the status values
COMMENT ON COLUMN public.events.status IS 'Event status: coming_soon, ongoing, done, cancelled, archived';
COMMENT ON COLUMN public.events.role IS 'User role in event: owner, moderator, member';
