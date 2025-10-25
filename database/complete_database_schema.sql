-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR EVENTTRIA
-- =====================================================
-- Based on actual Supabase database structure
-- Ready for migration to any hosting provider

-- =====================================================
-- 1. ACCOUNT STATUS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS account_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  new_account BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  billing_period TEXT NOT NULL,
  features JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. USER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  plan_id UUID NOT NULL UNIQUE REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN DEFAULT false,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference your auth system
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  original_amount_cents INTEGER NOT NULL,
  net_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method_type TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  paymongo_payment_id TEXT UNIQUE,
  paymongo_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'paid',
  transaction_type TEXT NOT NULL DEFAULT 'purchase',
  plan_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- =====================================================
-- 5. EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Will reference your auth system
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id UUID NOT NULL, -- Will reference your auth system
  is_public BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'coming_soon',
  role TEXT DEFAULT 'owner',
  markup_type TEXT DEFAULT 'percentage',
  markup_value NUMERIC(10,2) DEFAULT 0.00,
  discount_type TEXT DEFAULT 'none',
  discount_value NUMERIC(10,2) DEFAULT 0.00,
  ai_chat_enabled BOOLEAN DEFAULT false,
  ai_insights TEXT,
  insights_generated_at TIMESTAMP WITH TIME ZONE,
  insights_generated_by UUID -- Will reference your auth system
);

-- =====================================================
-- 6. EVENT COLLABORATORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  role TEXT NOT NULL,
  invite_code TEXT REFERENCES event_invites(invite_code),
  invited_by UUID, -- Will reference your auth system
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- =====================================================
-- 7. EVENT INVITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_by UUID NOT NULL, -- Will reference your auth system
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 20,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. ATTENDANCE RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  portal_id UUID NOT NULL REFERENCES attendance_portals(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT,
  note TEXT,
  checkin_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checkout_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT,
  ip_hash TEXT
);

-- =====================================================
-- 9. ATTENDANCE PORTALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_portals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL, -- Will reference your auth system
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  title TEXT DEFAULT 'Event Check-in',
  description TEXT
);

-- =====================================================
-- 10. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY, -- Will reference your auth system
  username TEXT,
  email TEXT,
  fname TEXT,
  lname TEXT,
  mname TEXT,
  suffix TEXT,
  address TEXT,
  contact_no TEXT,
  birthday DATE,
  age INTEGER,
  gender TEXT,
  interests UUID[],
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT
);

-- =====================================================
-- 11. USER USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  events_created INTEGER DEFAULT 0,
  events_joined INTEGER DEFAULT 0,
  ai_chat_messages INTEGER DEFAULT 0,
  feedback_responses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. AI CHAT USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_chat_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  questions_asked INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL UNIQUE,
  last_question_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 13. AI INSIGHTS USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_insights_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  insights_generated INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL UNIQUE,
  last_generation_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 14. EVENT CHAT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  parent_message_id UUID REFERENCES event_chat(id),
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID -- Will reference your auth system
);

-- =====================================================
-- 15. EVENT ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shared_with UUID[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost NUMERIC(10,2) DEFAULT 0.00
);

-- =====================================================
-- 16. EVENT NOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  notes TEXT DEFAULT ''
);

-- =====================================================
-- 17. EVENT REVENUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL, -- Will reference your auth system
  total_item_cost NUMERIC(10,2) DEFAULT 0.00,
  markup_amount NUMERIC(10,2) DEFAULT 0.00,
  discount_amount NUMERIC(10,2) DEFAULT 0.00,
  final_event_price NUMERIC(10,2) DEFAULT 0.00,
  total_revenue NUMERIC(10,2) DEFAULT 0.00,
  total_participants INTEGER DEFAULT 0,
  revenue_per_participant NUMERIC(10,2) DEFAULT 0.00,
  gross_profit NUMERIC(10,2) DEFAULT 0.00,
  profit_margin_percentage NUMERIC(5,2) DEFAULT 0.00,
  status TEXT DEFAULT 'active'
);

-- =====================================================
-- 18. EVENT SCRIPT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_script (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Will reference your auth system
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT
);

-- =====================================================
-- 19. FEEDBACK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL, -- Will reference your auth system
  event_id TEXT,
  feedback_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rating INTEGER,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID -- Will reference your auth system
);

-- =====================================================
-- 20. FEEDBACK PORTALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback_portals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL, -- Will reference your auth system
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  title TEXT DEFAULT 'Event Feedback',
  description TEXT
);

-- =====================================================
-- 21. FEEDBACK RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  portal_id UUID NOT NULL REFERENCES feedback_portals(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  respondent_name TEXT,
  respondent_email TEXT,
  rating INTEGER,
  sentiment TEXT,
  comments TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

-- =====================================================
-- 22. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL, -- Will reference your auth system
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'info',
  link_url TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 23. NOTIFICATIONS DEDUPE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications_dedupe (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 24. SECURE CARD DATA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS secure_card_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE, -- Will reference your auth system
  payment_method_id TEXT UNIQUE,
  last4 TEXT,
  brand TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SAMPLE DATA FOR SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (id, name, price_cents, currency, billing_period, features, limits) VALUES
('00000000-0000-0000-0000-000000000000', 'Free', 0, 'PHP', 'monthly',
 '{"ai_insights": 5, "events": 3, "participants": 10}', 
 '{"ai_insights_per_month": 5, "events_created": 3, "max_participants": 10}'),

('11111111-1111-1111-1111-111111111111', 'Small Event Org', 159000, 'PHP', 'monthly',
 '{"ai_insights": 25, "events": 10, "participants": 50}', 
 '{"ai_insights_per_month": 25, "events_created": 10, "max_participants": 50}'),

('22222222-2222-2222-2222-222222222222', 'Large Event Org', 300000, 'PHP', 'monthly',
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
