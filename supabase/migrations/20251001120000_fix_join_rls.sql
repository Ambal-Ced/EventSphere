-- Fix RLS to allow users to join events via invite codes
-- Safe to run multiple times due to IF EXISTS guards

-- Ensure RLS is enabled
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Relax SELECT on invites so non-owners can validate active codes
-- Previous policy only let creators read their own invites
DROP POLICY IF EXISTS "Users can view own invites" ON public.event_invites;

-- Allow anyone (signed-in or anon if auth.uid() is null) to read active, non-expired invites
CREATE POLICY "Read active invites for joining" ON public.event_invites
  FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Keep/ensure creators can still fully manage invites
DROP POLICY IF EXISTS "Event creators can manage invites" ON public.event_invites;
CREATE POLICY "Event creators can manage invites" ON public.event_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
      AND e.user_id = auth.uid()
    )
  );

-- Allow users to insert themselves as collaborators (join)
-- Owners can still manage via existing policy; this adds a user-join path
DROP POLICY IF EXISTS "Users can join events via invites" ON public.event_collaborators;
CREATE POLICY "Users can join events via invites" ON public.event_collaborators
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.status NOT IN ('cancelled','archived')
    )
  );

-- Preserve owner manage policy if present (recreate to be explicit)
DROP POLICY IF EXISTS "Only event creators can manage collaborations" ON public.event_collaborators;
CREATE POLICY "Only event creators can manage collaborations" ON public.event_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND e.user_id = auth.uid()
    )
  );

-- Basic visibility of collaborations for participants and owners
DROP POLICY IF EXISTS "Users can view event collaborations" ON public.event_collaborators;
CREATE POLICY "Users can view event collaborations" ON public.event_collaborators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_collaborators.event_id
      AND (e.user_id = auth.uid() OR event_collaborators.user_id = auth.uid())
    )
  );


