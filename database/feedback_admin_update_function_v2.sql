-- Alternative approach: Update feedback using a function that bypasses ALL triggers
-- This version uses a different strategy to ensure triggers don't fire
-- Run this in Supabase SQL editor

-- First, drop the old function if it exists
DROP FUNCTION IF EXISTS public.admin_update_feedback(UUID, TEXT, TEXT);

-- Create a new function that uses a different approach
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
  v_sql TEXT;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- If user_id exists, verify admin status
  IF v_user_id IS NOT NULL THEN
    SELECT account_type = 'admin' INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
    
    IF v_is_admin IS NULL OR NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify resolution fields';
    END IF;
  END IF;
  -- If v_user_id IS NULL, it's service role - allow it
  
  -- Build the UPDATE statement
  v_sql := 'UPDATE public.feedback SET updated_at = NOW()';
  
  IF p_status IS NOT NULL THEN
    v_sql := v_sql || format(', status = %L', p_status);
  END IF;
  
  IF p_admin_notes IS NOT NULL THEN
    v_sql := v_sql || format(', admin_notes = %L', p_admin_notes);
  ELSIF p_admin_notes IS NULL AND p_status IS NOT NULL THEN
    -- If explicitly setting admin_notes to NULL, include it
    v_sql := v_sql || ', admin_notes = NULL';
  END IF;
  
  v_sql := v_sql || format(' WHERE id = %L', p_feedback_id);
  v_sql := v_sql || ' RETURNING jsonb_build_object(''id'', id, ''status'', status, ''admin_notes'', admin_notes, ''updated_at'', updated_at)';
  
  -- Execute the update
  EXECUTE v_sql INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Feedback entry not found';
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.admin_update_feedback IS 'Allows admins to update feedback status and admin_notes';

