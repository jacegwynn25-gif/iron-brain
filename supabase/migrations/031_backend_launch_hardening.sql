-- Launch hardening for support payments, RPC access, and analytics views.
-- This intentionally preserves legacy billing columns for compatibility while
-- preventing client-side tier escalation and unsafe RPC access.

-- ============================================================
-- 1) Subscription/support payment protection
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_subscription_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := current_setting('request.jwt.claims', true)::json->>'role';

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS enforce_subscription_field_protection ON user_profiles;
CREATE TRIGGER enforce_subscription_field_protection
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_subscription_self_escalation();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS enforce_subscription_insert_protection ON user_profiles;
CREATE TRIGGER enforce_subscription_insert_protection
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_subscription_field_injection();

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_stripe_event_id_unique
  ON subscription_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_created
  ON subscription_events(user_id, created_at DESC);

-- Legacy slot tracking is not used for the free beta support flow. Keep the
-- function for compatibility, but only the service role may call it.
CREATE OR REPLACE FUNCTION decrement_lifetime_slots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE app_settings
  SET lifetime_slots_remaining = GREATEST(0, lifetime_slots_remaining - 1),
      updated_at = NOW()
  WHERE id = 'singleton';
END;
$$;

REVOKE ALL ON FUNCTION decrement_lifetime_slots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_lifetime_slots() TO service_role;

-- ============================================================
-- 2) RPC functions must not bypass user ownership
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_acwr(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acute_load NUMERIC;
  v_chronic_load NUMERIC;
  v_acwr NUMERIC;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid())
  THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(volume), 0) INTO v_acute_load
  FROM fatigue_events
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - INTERVAL '7 days';

  SELECT COALESCE(SUM(volume), 0) / 4.0 INTO v_chronic_load
  FROM fatigue_events
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - INTERVAL '28 days';

  IF v_chronic_load > 0 THEN
    v_acwr := v_acute_load / v_chronic_load;
  ELSE
    v_acwr := 0;
  END IF;

  RETURN v_acwr;
END;
$$;

CREATE OR REPLACE FUNCTION get_latest_context_data(p_user_id UUID)
RETURNS user_context_data
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context user_context_data;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid())
  THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_context
  FROM user_context_data
  WHERE user_id = p_user_id
  ORDER BY date DESC
  LIMIT 1;

  RETURN v_context;
END;
$$;

CREATE OR REPLACE FUNCTION get_workout_history_for_recovery(
  p_user_id UUID,
  p_days_back INTEGER DEFAULT 90
)
RETURNS TABLE (
  event_timestamp TIMESTAMPTZ,
  exercise_name TEXT,
  sets INTEGER,
  reps INTEGER,
  weight NUMERIC,
  rpe NUMERIC,
  volume NUMERIC,
  effective_volume NUMERIC,
  initial_fatigue NUMERIC,
  set_duration NUMERIC,
  rest_interval NUMERIC,
  is_eccentric BOOLEAN,
  is_ballistic BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days_back INTEGER := LEAST(GREATEST(COALESCE(p_days_back, 90), 1), 365);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid())
  THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    fe.timestamp AS event_timestamp,
    fe.exercise_name,
    fe.sets,
    fe.reps,
    fe.weight,
    fe.rpe,
    fe.volume,
    fe.effective_volume,
    fe.initial_fatigue,
    fe.set_duration,
    fe.rest_interval,
    fe.is_eccentric,
    fe.is_ballistic
  FROM fatigue_events fe
  WHERE fe.user_id = p_user_id
    AND fe.timestamp >= NOW() - (v_days_back || ' days')::INTERVAL
  ORDER BY fe.timestamp ASC;
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_model_stats(
  p_user_id UUID,
  p_workout_sets INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workout_sets INTEGER := LEAST(GREATEST(COALESCE(p_workout_sets, 0), 0), 500);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid())
  THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO user_fatigue_models (user_id, total_workouts, total_sets, last_updated_at)
  VALUES (p_user_id, 1, v_workout_sets, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_workouts = user_fatigue_models.total_workouts + 1,
    total_sets = user_fatigue_models.total_sets + v_workout_sets,
    last_updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION calculate_acwr(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_latest_context_data(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_workout_history_for_recovery(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION increment_user_model_stats(UUID, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION calculate_acwr(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_latest_context_data(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_workout_history_for_recovery(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_user_model_stats(UUID, INTEGER) TO authenticated, service_role;

-- SECURITY INVOKER functions still rely on RLS, but they should not be callable
-- anonymously.
REVOKE ALL ON FUNCTION get_model_performance_metrics(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_or_build_hierarchical_model(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_exercise_avg_sfr(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION identify_junk_volume_exercises(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cleanup_expired_caches() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION calculate_hours_since_training(TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_model_performance_metrics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_or_build_hierarchical_model(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_exercise_avg_sfr(UUID, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION identify_junk_volume_exercises(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_caches() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_hours_since_training(TIMESTAMPTZ) TO authenticated, service_role;

-- Trigger functions should not be exposed as public RPC endpoints.
REVOKE ALL ON FUNCTION update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION invalidate_model_cache_on_workout() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION prevent_subscription_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION prevent_subscription_field_injection() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'auto_confirm_user'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION auto_confirm_user() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- ============================================================
-- 3) Analytics views must respect underlying RLS
-- ============================================================

ALTER VIEW recent_sfr_trends SET (security_invoker = true);
ALTER VIEW exercise_efficiency_leaderboard SET (security_invoker = true);

REVOKE ALL ON TABLE recent_sfr_trends FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE exercise_efficiency_leaderboard FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE recent_sfr_trends TO authenticated, service_role;
GRANT SELECT ON TABLE exercise_efficiency_leaderboard TO authenticated, service_role;
