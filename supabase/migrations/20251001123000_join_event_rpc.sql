-- Create a safe server-side join function to avoid complex client-side RLS paths
-- This function validates the invite and inserts the collaborator atomically
-- Uses SECURITY DEFINER to bypass RLS while enforcing our own checks

CREATE OR REPLACE FUNCTION public.join_event_with_code(p_user uuid, p_code text)
RETURNS TABLE(event_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS
$$
DECLARE
  inv RECORD;
  assigned_role text;
BEGIN
  SELECT * INTO inv
  FROM public.event_invites
  WHERE invite_code = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(inv.current_uses, 0) >= COALESCE(inv.max_uses, 1) THEN
    RAISE EXCEPTION 'This invite code has reached its maximum usage limit' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_collaborators ec
    WHERE ec.event_id = inv.event_id AND ec.user_id = p_user
  ) THEN
    RAISE EXCEPTION 'You are already a member of this event' USING ERRCODE = 'P0001';
  END IF;

  assigned_role := CASE lower(COALESCE(inv.role, ''))
    WHEN 'moderator' THEN 'moderator'
    ELSE 'member'
  END;

  INSERT INTO public.event_collaborators(event_id, user_id, role, invite_code, invited_by)
  VALUES (inv.event_id, p_user, assigned_role::text, inv.invite_code, inv.created_by);

  UPDATE public.event_invites
  SET current_uses = COALESCE(current_uses, 0) + 1,
      is_active = (COALESCE(current_uses, 0) + 1) < COALESCE(max_uses, 1)
  WHERE id = inv.id;

  RETURN QUERY SELECT inv.event_id, assigned_role;
END;
$$;

-- Allow authenticated users to execute
REVOKE ALL ON FUNCTION public.join_event_with_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_event_with_code(uuid, text) TO authenticated;


