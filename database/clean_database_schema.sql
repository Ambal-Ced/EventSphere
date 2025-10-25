-- =====================================================
-- CLEAN DATABASE SCHEMA FOR EVENTTRIA
-- =====================================================
-- This script creates all tables and columns needed for EventTria
-- WITHOUT Supabase-specific features (RLS, auth.users references, etc.)
-- Ready for any hosting provider with PostgreSQL/MySQL support

-- =====================================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  features JSONB,
  limits JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. USER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference your auth system
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due'
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  payment_method_brand TEXT, -- 'visa', 'mastercard', etc.
  payment_method_last4 TEXT, -- Last 4 digits
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference your auth system
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  original_amount_cents INTEGER NOT NULL, -- Plan price (e.g., 300000 for ₱300)
  net_amount_cents INTEGER NOT NULL, -- Same as original_amount_cents for admin tracking
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method_type TEXT, -- 'card'
  payment_method_brand TEXT, -- 'visa', 'mastercard'
  payment_method_last4 TEXT, -- Last 4 digits
  paymongo_payment_id TEXT UNIQUE,
  paymongo_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'paid', -- 'paid', 'refunded', 'failed', 'cancelled'
  transaction_type TEXT NOT NULL DEFAULT 'purchase', -- 'purchase', 'refund', 'cancellation'
  plan_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB -- Additional transaction data
);

-- =====================================================
-- 4. EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  user_id UUID NOT NULL, -- Will reference your auth system
  max_participants INTEGER,
  price DECIMAL(10,2),
  image_url TEXT,
  status TEXT DEFAULT 'active',
  role TEXT DEFAULT 'organizer'
);

-- =====================================================
-- 5. EVENT COLLABORATORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  role TEXT NOT NULL DEFAULT 'participant', -- 'organizer', 'participant', 'volunteer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' -- 'active', 'cancelled'
);

-- =====================================================
-- 6. ATTENDANCE RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  attended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'present' -- 'present', 'absent', 'late'
);

-- =====================================================
-- 7. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. TICKETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  ticket_type TEXT NOT NULL DEFAULT 'general',
  price DECIMAL(10,2),
  status TEXT DEFAULT 'active', -- 'active', 'used', 'cancelled'
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 9. USER USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference your auth system
  usage_type TEXT NOT NULL, -- 'ai_insights', 'events_created', 'events_joined'
  count INTEGER DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. ACCOUNT STATUS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS account_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  is_new_account BOOLEAN DEFAULT true,
  first_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User Subscriptions Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);

-- Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_paymongo_payment_id ON transactions(paymongo_payment_id);

-- Events Indexes
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public);

-- Event Collaborators Indexes
CREATE INDEX IF NOT EXISTS idx_event_collaborators_event_id ON event_collaborators(event_id);
CREATE INDEX IF NOT EXISTS idx_event_collaborators_user_id ON event_collaborators(user_id);

-- Attendance Records Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_event_id ON attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);

-- Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Tickets Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);

-- User Usage Indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_type ON user_usage(usage_type);

-- Account Status Indexes
CREATE INDEX IF NOT EXISTS idx_account_status_user_id ON account_status(user_id);

-- =====================================================
-- SAMPLE DATA FOR SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (id, name, description, price_cents, currency, features, limits) VALUES
('00000000-0000-0000-0000-000000000000', 'Free', 'Free tier with basic features', 0, 'PHP', 
 '{"ai_insights": 5, "events": 3, "participants": 10}', 
 '{"ai_insights_per_month": 5, "events_created": 3, "max_participants": 10}'),

('11111111-1111-1111-1111-111111111111', 'Small Event Org', 'Perfect for small organizations', 159000, 'PHP',
 '{"ai_insights": 25, "events": 10, "participants": 50}', 
 '{"ai_insights_per_month": 25, "events_created": 10, "max_participants": 50}'),

('22222222-2222-2222-2222-222222222222', 'Large Event Org', 'Ideal for large organizations', 300000, 'PHP',
 '{"ai_insights": 85, "events": 50, "participants": 200}', 
 '{"ai_insights_per_month": 85, "events_created": 50, "max_participants": 200}')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- NOTES FOR MIGRATION
-- =====================================================
-- 1. Replace all UUID references to auth.users(id) with your auth system's user ID
-- 2. Update foreign key constraints to match your auth system
-- 3. Add any additional columns needed for your hosting provider
-- 4. Test all indexes and constraints after migration
-- 5. Consider adding application-level security instead of RLS
