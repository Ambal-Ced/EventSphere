-- Create transactions table for admin tracking and billing history
-- Note: For admin revenue tracking, we use plan prices (₱159, ₱300) instead of PayMongo net amounts
-- This ensures admin sees consistent revenue numbers based on subscription plans
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  original_amount_cents INTEGER NOT NULL, -- Plan price (e.g., 300000 for ₱300)
  net_amount_cents INTEGER NOT NULL, -- Same as original_amount_cents for admin tracking (plan price)
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method_type TEXT, -- e.g., 'card'
  payment_method_brand TEXT, -- e.g., 'visa', 'mastercard'
  payment_method_last4 TEXT, -- Last 4 digits of card
  paymongo_payment_id TEXT UNIQUE, -- PayMongo payment ID
  paymongo_payment_intent_id TEXT UNIQUE, -- PayMongo payment intent ID
  status TEXT NOT NULL DEFAULT 'paid', -- 'paid', 'refunded', 'failed', 'cancelled'
  transaction_type TEXT NOT NULL DEFAULT 'purchase', -- 'purchase', 'refund', 'cancellation'
  plan_name TEXT, -- Plan name at time of transaction (e.g., 'Large Event Org')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB -- Additional transaction data
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_paymongo_payment_id ON transactions(paymongo_payment_id);

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get the next invoice number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM transactions
  WHERE invoice_number LIKE 'INV-%';
  
  -- Format as INV-XXX
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON transactions;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add missing fields to user_subscriptions table for auto-cancellation
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Add RLS (Row Level Security) policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can update transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can delete transactions" ON transactions;

-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transactions (for payment processing)
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only service role can update transactions (for refunds, etc.)
CREATE POLICY "Service role can update transactions" ON transactions
  FOR UPDATE USING (auth.role() = 'service_role');

-- Only service role can delete transactions
CREATE POLICY "Service role can delete transactions" ON transactions
  FOR DELETE USING (auth.role() = 'service_role');