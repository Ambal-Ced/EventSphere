-- Create a function to allow admins to update feedback status and admin_notes
-- This function uses SECURITY DEFINER to bypass RLS and triggers
-- Run this in Supabase SQL editor

CREATE OR REPLACE FUNCTION public.admin_update_feedback(
  p_feedback_id UUID,
  p_status TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_result JSONB;
  v_current_role TEXT;
BEGIN
  -- Get the current user ID (will be NULL for service role)
  v_user_id := auth.uid();
  
  -- Check current role from JWT claims
  BEGIN
    SELECT current_setting('request.jwt.claims', true)::json->>'role' INTO v_current_role;
  EXCEPTION WHEN OTHERS THEN
    v_current_role := NULL;
  END;
  
  -- If it's service_role, allow the update without any checks
  IF v_current_role = 'service_role' THEN
    -- Service role operation - allow it directly, skip all checks
    NULL; -- Continue to update
  ELSIF v_user_id IS NOT NULL THEN
    -- Check if user is admin
    SELECT account_type = 'admin' INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- If not admin, raise exception
    IF v_is_admin IS NULL OR NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify resolution fields';
    END IF;
  ELSE
    -- No user ID - could be service role, allow it
    -- (service role operations don't have auth.uid())
    NULL; -- Continue to update
  END IF;
  
  -- Build update query dynamically
  -- Execute update directly - SECURITY DEFINER should bypass triggers
  -- But if triggers still fire, we'll use EXECUTE with dynamic SQL
  IF p_status IS NOT NULL AND p_admin_notes IS NOT NULL THEN
    EXECUTE format('
      UPDATE public.feedback
      SET 
        status = %L,
        admin_notes = %L,
        updated_at = NOW()
      WHERE id = %L
      RETURNING jsonb_build_object(
        ''id'', id,
        ''status'', status,
        ''admin_notes'', admin_notes,
        ''updated_at'', updated_at
      )',
      p_status,
      p_admin_notes,
      p_feedback_id
    ) INTO v_result;
  ELSIF p_status IS NOT NULL THEN
    EXECUTE format('
      UPDATE public.feedback
      SET 
        status = %L,
        updated_at = NOW()
      WHERE id = %L
      RETURNING jsonb_build_object(
        ''id'', id,
        ''status'', status,
        ''updated_at'', updated_at
      )',
      p_status,
      p_feedback_id
    ) INTO v_result;
  ELSIF p_admin_notes IS NOT NULL THEN
    EXECUTE format('
      UPDATE public.feedback
      SET 
        admin_notes = %L,
        updated_at = NOW()
      WHERE id = %L
      RETURNING jsonb_build_object(
        ''id'', id,
        ''admin_notes'', admin_notes,
        ''updated_at'', updated_at
      )',
      p_admin_notes,
      p_feedback_id
    ) INTO v_result;
  ELSE
    RAISE EXCEPTION 'At least one field must be provided for update';
  END IF;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Feedback entry not found';
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.admin_update_feedback IS 'Allows admins to update feedback status and admin_notes, bypassing RLS and triggers';

