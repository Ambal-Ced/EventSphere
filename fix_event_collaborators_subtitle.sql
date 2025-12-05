-- Fix existing event_collaborators records with invalid subtitle_choice values
-- This script normalizes any incorrect subtitle values to match the constraint

-- First, let's see what invalid values exist
SELECT DISTINCT subtitle_choice 
FROM event_collaborators 
WHERE subtitle_choice IS NOT NULL 
AND subtitle_choice NOT IN ('collaborator', 'owner', 'other');

-- Update any records with common variations to the correct format
UPDATE event_collaborators
SET subtitle_choice = CASE
  WHEN LOWER(TRIM(subtitle_choice)) LIKE '%collaborator%' THEN 'collaborator'
  WHEN LOWER(TRIM(subtitle_choice)) LIKE '%owner%' AND LOWER(TRIM(subtitle_choice)) NOT LIKE '%collaborator%' THEN 'owner'
  WHEN LOWER(TRIM(subtitle_choice)) LIKE '%other%' THEN 'other'
  ELSE NULL
END
WHERE subtitle_choice IS NOT NULL
AND subtitle_choice NOT IN ('collaborator', 'owner', 'other');

-- Verify the fix
SELECT id, user_id, event_id, role, subtitle_choice, subtitle_custom
FROM event_collaborators
WHERE subtitle_choice IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Note: When manually editing in Supabase, use these exact values (lowercase):
-- - 'collaborator' (for Event Collaborator)
-- - 'owner' (for Event Owner)
-- - 'other' (for custom subtitles)
-- 
-- The subtitle_custom field should only be filled when subtitle_choice = 'other'

