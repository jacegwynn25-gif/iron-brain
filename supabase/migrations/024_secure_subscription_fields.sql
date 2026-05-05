-- Migration 024: Secure subscription fields against user self-escalation
-- Users must not be able to modify their own is_pro, subscription_tier, etc.

-- Prevent subscription field changes on UPDATE
CREATE OR REPLACE FUNCTION prevent_subscription_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := current_setting('request.jwt.claims', true)::json->>'role';

  -- Allow service_role (server-side / webhooks) to make any changes
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For authenticated users (and anon), prevent changes to subscription fields
  IF NEW.is_pro IS DISTINCT FROM OLD.is_pro OR
     NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR
     NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
     NEW.subscription_started_at IS DISTINCT FROM OLD.subscription_started_at OR
     NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
  THEN
    RAISE EXCEPTION 'Subscription fields can only be modified by the billing system';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_subscription_field_protection ON user_profiles;
CREATE TRIGGER enforce_subscription_field_protection
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_subscription_self_escalation();

-- Prevent subscription field injection on INSERT (users should not set these on creation)
CREATE OR REPLACE FUNCTION prevent_subscription_field_injection()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := current_setting('request.jwt.claims', true)::json->>'role';

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_pro IS NOT NULL AND NEW.is_pro != false THEN
    RAISE EXCEPTION 'Cannot set is_pro on insert';
  END IF;

  IF NEW.subscription_tier IS NOT NULL AND NEW.subscription_tier != 'free' THEN
    RAISE EXCEPTION 'Cannot set subscription_tier on insert';
  END IF;

  IF NEW.stripe_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot set stripe_customer_id on insert';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_subscription_insert_protection ON user_profiles;
CREATE TRIGGER enforce_subscription_insert_protection
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_subscription_field_injection();

-- Stripe event IDs must be globally unique so concurrent webhook retries cannot
-- double-apply side effects like decrementing lifetime slots.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_stripe_event_id_unique
  ON subscription_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- The slot decrement RPC is used only by the Stripe webhook through the service
-- role. Without explicit grants, normal API clients can call RPC functions by
-- default and could burn lifetime slots.
REVOKE EXECUTE ON FUNCTION decrement_lifetime_slots() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION decrement_lifetime_slots() FROM anon;
REVOKE EXECUTE ON FUNCTION decrement_lifetime_slots() FROM authenticated;
GRANT EXECUTE ON FUNCTION decrement_lifetime_slots() TO service_role;
