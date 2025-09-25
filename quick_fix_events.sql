-- Quick Fix for Event Creation
-- Run this immediately to restore event creation functionality

-- =====================================================
-- ADD MISSING EVENT CREATION POLICY
-- =====================================================

-- Drop any existing broken policies first
DROP POLICY IF EXISTS "Users can create events" ON public.events;

-- Create the correct event creation policy
CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================================
-- VERIFY THE POLICY WAS CREATED
-- =====================================================

-- Check that the policy exists
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'No WITH CHECK condition'
    END AS with_check_condition
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'events' 
  AND cmd = 'INSERT';

-- =====================================================
-- TEST EVENT CREATION (OPTIONAL)
-- =====================================================

-- You can test if the policy works by trying to create an event
-- The policy should now allow authenticated users to create events
-- where the user_id matches their auth.uid()
