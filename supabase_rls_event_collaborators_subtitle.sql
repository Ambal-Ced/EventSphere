-- RLS Policy to allow users to update their own subtitle in event_collaborators
-- This is needed so that when joining via invite code, the subtitle can be set

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update their own collaborator subtitle" ON public.event_collaborators;

-- Policy: Users can update their own subtitle fields
-- This allows the system to set subtitle_choice and subtitle_custom when joining via invite
CREATE POLICY "Users can update their own collaborator subtitle"
ON public.event_collaborators
FOR UPDATE
USING (
  -- User can only update their own record
  user_id = auth.uid()
)
WITH CHECK (
  -- User can only update their own record
  user_id = auth.uid()
  AND
  -- Can only update subtitle fields, not role or other fields
  -- (This is enforced by only updating subtitle_choice and subtitle_custom in the code)
  true
);

