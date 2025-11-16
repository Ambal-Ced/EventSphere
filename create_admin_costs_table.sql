-- Create admin_costs table for tracking operational costs
-- This table allows admins to input costs for repair, expansion, hosting, etc.
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS admin_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('repair', 'expansion', 'hosting', 'other')),
  description TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT DEFAULT 'PHP',
  date_incurred DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_costs_cost_type ON admin_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_admin_costs_date_incurred ON admin_costs(date_incurred);
CREATE INDEX IF NOT EXISTS idx_admin_costs_created_at ON admin_costs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_costs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role full access to admin_costs" ON admin_costs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Only admins can view all costs
CREATE POLICY "Admins can view admin_costs" ON admin_costs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

-- Policy: Only admins can insert costs
CREATE POLICY "Admins can insert admin_costs" ON admin_costs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

-- Policy: Only admins can update costs
CREATE POLICY "Admins can update admin_costs" ON admin_costs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

-- Policy: Only admins can delete costs
CREATE POLICY "Admins can delete admin_costs" ON admin_costs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

-- Add comment to table
COMMENT ON TABLE admin_costs IS 'Operational costs tracked by admins for ROI prediction calculations.';

