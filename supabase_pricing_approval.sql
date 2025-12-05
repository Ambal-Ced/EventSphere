-- Create table for pricing approval/rejection tracking
CREATE TABLE IF NOT EXISTS public.event_pricing_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rejected_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rejection_type TEXT NOT NULL,
  rejection_reason TEXT,
  proposed_markup_type TEXT CHECK (proposed_markup_type IN ('percentage', 'fixed')),
  proposed_markup_value NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop existing constraint if it exists and add new one with 'approve' included
ALTER TABLE public.event_pricing_approvals
  DROP CONSTRAINT IF EXISTS event_pricing_approvals_rejection_type_check;

ALTER TABLE public.event_pricing_approvals
  ADD CONSTRAINT event_pricing_approvals_rejection_type_check
  CHECK (rejection_type IN ('cancel', 'bargain', 'approve'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_pricing_approvals_event_id ON public.event_pricing_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_event_pricing_approvals_status ON public.event_pricing_approvals(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.event_pricing_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Event owners can view pricing approvals" ON public.event_pricing_approvals;
DROP POLICY IF EXISTS "Event Owner subtitle users can view their approvals" ON public.event_pricing_approvals;
DROP POLICY IF EXISTS "Event Owner subtitle users can create approvals" ON public.event_pricing_approvals;
DROP POLICY IF EXISTS "Event Owner subtitle users can create rejections" ON public.event_pricing_approvals;
DROP POLICY IF EXISTS "Event owners can resolve pricing approvals" ON public.event_pricing_approvals;

-- Policy: Event owners and approval creators can view approvals
CREATE POLICY "Event owners can view pricing approvals"
ON public.event_pricing_approvals
FOR SELECT
USING (
  -- Event owner can view
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_pricing_approvals.event_id
    AND events.user_id = auth.uid()
  )
  OR
  -- User who created the approval can view it
  rejected_by = auth.uid()
);

-- Policy: Users with Event Owner subtitle can create approvals/rejections
CREATE POLICY "Event Owner subtitle users can create approvals"
ON public.event_pricing_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- User must be the one creating the record
  rejected_by = auth.uid()
  AND
  -- User must have Event Owner subtitle for this event
  EXISTS (
    SELECT 1 FROM public.event_collaborators
    WHERE event_collaborators.event_id = event_pricing_approvals.event_id
    AND event_collaborators.user_id = auth.uid()
    AND event_collaborators.subtitle_choice = 'owner'
  )
);

-- Policy: Users with Event Owner subtitle can view their own approvals
CREATE POLICY "Event Owner subtitle users can view their approvals"
ON public.event_pricing_approvals
FOR SELECT
USING (
  -- Can view if they created it
  rejected_by = auth.uid()
  OR
  -- Or if they're the event owner
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_pricing_approvals.event_id
    AND events.user_id = auth.uid()
  )
);

-- Policy: Event owners can update (resolve) approvals
CREATE POLICY "Event owners can resolve pricing approvals"
ON public.event_pricing_approvals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_pricing_approvals.event_id
    AND events.user_id = auth.uid()
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_pricing_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_event_pricing_approvals_updated_at ON public.event_pricing_approvals;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_event_pricing_approvals_updated_at
  BEFORE UPDATE ON public.event_pricing_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_event_pricing_approvals_updated_at();

