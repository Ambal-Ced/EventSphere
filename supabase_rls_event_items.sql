-- RLS Policies for event_items table
-- This allows members to add items (which go to pending) and approvers to manage them

-- First, add subtitle columns to event_collaborators if they don't exist
ALTER TABLE public.event_collaborators
  ADD COLUMN IF NOT EXISTS subtitle_choice TEXT CHECK (subtitle_choice IN ('collaborator', 'owner', 'other')),
  ADD COLUMN IF NOT EXISTS subtitle_custom TEXT;

-- Add columns for item approval system to event_items if they don't exist
ALTER TABLE public.event_items
  ADD COLUMN IF NOT EXISTS status TEXT
    NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Enable RLS on event_items table
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view items for events they have access to" ON public.event_items;
DROP POLICY IF EXISTS "Authenticated users can insert items" ON public.event_items;
DROP POLICY IF EXISTS "Item requesters can update their own pending items" ON public.event_items;
DROP POLICY IF EXISTS "Event owners can update items" ON public.event_items;
DROP POLICY IF EXISTS "Moderators can update items" ON public.event_items;
DROP POLICY IF EXISTS "Event owners can delete items" ON public.event_items;
DROP POLICY IF EXISTS "Moderators can delete items" ON public.event_items;

-- Policy 1: SELECT - Users can view items for events they have access to
-- (event owner, collaborators, or anyone who can see the event)
CREATE POLICY "Users can view items for events they have access to"
ON public.event_items
FOR SELECT
USING (
  -- Event owner can see all items
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_items.event_id
    AND events.user_id = auth.uid()
  )
  OR
  -- Collaborators can see all items
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_items.event_id
    AND event_collaborators.user_id = auth.uid()
  )
  OR
  -- Anyone who requested an item can see it (for pending items they submitted)
  event_items.requested_by = auth.uid()
);

-- Policy 2: INSERT - Any authenticated user can insert items
-- Members will create items with status='pending', approvers can create with status='approved'
CREATE POLICY "Authenticated users can insert items"
ON public.event_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- Must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- Must have access to the event (owner or collaborator)
  (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_items.event_id
      AND events.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.event_collaborators
      WHERE event_collaborators.event_id = event_items.event_id
      AND event_collaborators.user_id = auth.uid()
    )
  )
  AND
  -- requested_by must be the current user
  event_items.requested_by = auth.uid()
);

-- Policy 3: UPDATE - Item requesters can update their own pending items
-- (so they can edit before approval)
CREATE POLICY "Item requesters can update their own pending items"
ON public.event_items
FOR UPDATE
USING (
  -- Can only update if status is pending and they requested it
  event_items.status = 'pending'
  AND event_items.requested_by = auth.uid()
)
WITH CHECK (
  -- Can only keep it as pending (can't self-approve)
  event_items.status = 'pending'
  AND event_items.requested_by = auth.uid()
);

-- Policy 4: UPDATE - Event owners can update/approve/reject any items
CREATE POLICY "Event owners can update items"
ON public.event_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy 5: UPDATE - Moderators can update/approve/reject items
CREATE POLICY "Moderators can update items"
ON public.event_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_items.event_id
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.role = 'moderator'
  )
);

-- Policy 6: UPDATE - Users with "Event Owner" subtitle can update/approve/reject items
CREATE POLICY "Event Owner subtitle users can update items"
ON public.event_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_items.event_id
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.subtitle_choice = 'owner'
  )
);

-- Policy 7: DELETE - Event owners can delete items
CREATE POLICY "Event owners can delete items"
ON public.event_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_items.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy 8: DELETE - Moderators can delete items
CREATE POLICY "Moderators can delete items"
ON public.event_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_items.event_id
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.role = 'moderator'
  )
);

-- Policy 9: DELETE - Users with "Event Owner" subtitle can delete items
CREATE POLICY "Event Owner subtitle users can delete items"
ON public.event_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_items.event_id
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.subtitle_choice = 'owner'
  )
);

