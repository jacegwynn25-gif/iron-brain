-- Migration 003: Subscription System for Iron Pro
-- Adds subscription tiers, Stripe integration, and lifetime slots tracking

-- Add subscription fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT CHECK (subscription_tier IN ('free', 'pro_lifetime', 'pro_monthly')) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Create app_settings table for lifetime slots tracking
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  lifetime_slots_total INTEGER DEFAULT 200,
  lifetime_slots_remaining INTEGER DEFAULT 200,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial settings row
INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

-- Create subscription_events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'upgrade', 'downgrade', 'cancel', 'renew'
  old_tier TEXT,
  new_tier TEXT,
  stripe_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Users can view own subscription events"
  ON subscription_events FOR SELECT
  USING (auth.uid() = user_id);

-- Function to decrement lifetime slots
CREATE OR REPLACE FUNCTION decrement_lifetime_slots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE app_settings
  SET lifetime_slots_remaining = GREATEST(0, lifetime_slots_remaining - 1),
      updated_at = NOW()
  WHERE id = 'singleton';
END;
$$;
