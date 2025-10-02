-- Fix recursive RLS policies causing 42P17 on event_collaborators

-- Ensure RLS is enabled
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting/recursive policies (safe if not present)
DROP POLICY IF EXISTS "Comprehensive collaboration access" ON public.event_collaborators;
DROP POLICY IF EXISTS "Event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Collaborators can view own collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Admins can manage all collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can manage event collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Only event creators can manage collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view event collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Event owners can manage collaborators" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.event_collaborators;
DROP POLICY IF EXISTS "Users can join events via invites" ON public.event_collaborators;

-- Minimal, non-recursive policy set

-- Read: participants can see their rows; owners can see all for their event
CREATE POLICY "collab_select_owner_or_self" ON public.event_collaborators
  FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  );

-- Insert: a user can add themself to an event; owner can also add anyone
CREATE POLICY "collab_insert_self_or_owner" ON public.event_collaborators
  FOR INSERT
  WITH CHECK (
    (user_id = auth.uid()) OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  );

-- Update/Delete: only the event owner can manage
CREATE POLICY "collab_owner_manage" ON public.event_collaborators
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "collab_owner_delete" ON public.event_collaborators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  );


