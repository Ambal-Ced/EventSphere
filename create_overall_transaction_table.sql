-- Create overall_transaction table with the same structure as transactions
-- This table will persist transaction data even when accounts are deleted
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS overall_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID,
  invoice_number TEXT UNIQUE,
  original_amount_cents INTEGER NOT NULL,
  net_amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'PHP',
  payment_method_type TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  paymongo_payment_id TEXT,
  paymongo_payment_intent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('paid', 'cancelled', 'pending', 'failed')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'cancellation', 'refund')),
  plan_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_overall_transaction_user_id ON overall_transaction(user_id);
CREATE INDEX IF NOT EXISTS idx_overall_transaction_status ON overall_transaction(status);
CREATE INDEX IF NOT EXISTS idx_overall_transaction_transaction_type ON overall_transaction(transaction_type);
CREATE INDEX IF NOT EXISTS idx_overall_transaction_created_at ON overall_transaction(created_at);
CREATE INDEX IF NOT EXISTS idx_overall_transaction_invoice_number ON overall_transaction(invoice_number);

-- Enable Row Level Security (RLS)
ALTER TABLE overall_transaction ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role full access to overall_transaction" ON overall_transaction
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own overall_transaction" ON overall_transaction
  FOR SELECT
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE overall_transaction IS 'Persistent transaction records that survive account deletion. Mirrors transactions table structure.';

