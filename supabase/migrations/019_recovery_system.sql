-- Recovery System Database Schema
-- Supports biological simulator: fatigue tracking, Bayesian calibration, context data

-- ==================== FATIGUE EVENTS ====================
-- Stores every training event for exponential decay calculations

CREATE TABLE IF NOT EXISTS fatigue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  exercise_name TEXT NOT NULL,
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  weight NUMERIC NOT NULL CHECK (weight >= 0),
  rpe NUMERIC NOT NULL CHECK (rpe >= 0 AND rpe <= 10),
  volume NUMERIC NOT NULL, -- sets × reps × weight
  effective_volume NUMERIC NOT NULL, -- RPE-adjusted volume
  initial_fatigue NUMERIC NOT NULL CHECK (initial_fatigue >= 0 AND initial_fatigue <= 100),
  set_duration NUMERIC, -- seconds (optional, for PCr calculations)
  rest_interval NUMERIC, -- seconds (optional, for PCr recovery)
  is_eccentric BOOLEAN DEFAULT false,
  is_ballistic BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fatigue_events_user_timestamp ON fatigue_events(user_id, timestamp DESC);
CREATE INDEX idx_fatigue_events_exercise ON fatigue_events(user_id, exercise_name, timestamp DESC);

-- RLS Policies
ALTER TABLE fatigue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fatigue events"
  ON fatigue_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fatigue events"
  ON fatigue_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==================== USER RECOVERY PARAMETERS ====================
-- Bayesian calibration: learns user-specific recovery rates

CREATE TABLE IF NOT EXISTS user_recovery_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL, -- e.g., "Quads_halfLife", "Barbell Back Squat_halfLife"
  population_mean NUMERIC NOT NULL,
  population_std_dev NUMERIC NOT NULL,
  user_mean NUMERIC NOT NULL,
  user_std_dev NUMERIC NOT NULL,
  observation_count INTEGER DEFAULT 0 CHECK (observation_count >= 0),
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, parameter_name)
);

CREATE INDEX idx_recovery_params_user ON user_recovery_parameters(user_id);

-- RLS Policies
ALTER TABLE user_recovery_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery parameters"
  ON user_recovery_parameters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recovery parameters"
  ON user_recovery_parameters FOR ALL
  USING (auth.uid() = user_id);

-- ==================== USER CONTEXT DATA ====================
-- Sleep, nutrition, stress tracking (daily)

CREATE TABLE IF NOT EXISTS user_context_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Sleep
  sleep_hours NUMERIC CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  sleep_quality TEXT CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  sleep_interruptions INTEGER CHECK (sleep_interruptions >= 0),

  -- Nutrition
  protein_intake NUMERIC CHECK (protein_intake >= 0), -- g/kg bodyweight
  carb_intake NUMERIC CHECK (carb_intake >= 0), -- g/kg bodyweight
  calorie_balance TEXT CHECK (calorie_balance IN ('deficit', 'maintenance', 'surplus')),
  hydration_level TEXT CHECK (hydration_level IN ('poor', 'fair', 'good', 'excellent')),
  meal_timing TEXT CHECK (meal_timing IN ('poor', 'fair', 'good')), -- post-workout nutrition

  -- Stress & Recovery Markers
  work_stress NUMERIC CHECK (work_stress >= 0 AND work_stress <= 10),
  life_stress NUMERIC CHECK (life_stress >= 0 AND life_stress <= 10),
  perceived_stress NUMERIC CHECK (perceived_stress >= 0 AND perceived_stress <= 10),
  resting_heart_rate NUMERIC CHECK (resting_heart_rate > 0), -- bpm
  heart_rate_variability NUMERIC CHECK (heart_rate_variability >= 0), -- ms

  -- Subjective Readiness
  subjective_readiness NUMERIC CHECK (subjective_readiness >= 1 AND subjective_readiness <= 10),

  -- Source
  source TEXT DEFAULT 'manual', -- 'manual', 'oura', 'whoop', 'apple_health', 'google_fit'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_context_data_user_date ON user_context_data(user_id, date DESC);

-- RLS Policies
ALTER TABLE user_context_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context data"
  ON user_context_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own context data"
  ON user_context_data FOR ALL
  USING (auth.uid() = user_id);

-- ==================== USER DEMOGRAPHICS ====================
-- Age, sex, training age, injuries (for context modifiers)

CREATE TABLE IF NOT EXISTS user_demographics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  training_age INTEGER CHECK (training_age >= 0), -- years of consistent training
  athletic_background TEXT CHECK (athletic_background IN ('beginner', 'intermediate', 'advanced', 'elite')),
  bodyweight NUMERIC CHECK (bodyweight > 0), -- kg
  height NUMERIC CHECK (height > 0), -- cm
  current_injuries TEXT[], -- array of injury descriptions
  chronic_conditions TEXT[], -- array of chronic health conditions
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own demographics"
  ON user_demographics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own demographics"
  ON user_demographics FOR ALL
  USING (auth.uid() = user_id);

-- ==================== MENSTRUAL CYCLE DATA ====================
-- For female users: cycle phase tracking (affects recovery)

CREATE TABLE IF NOT EXISTS menstrual_cycle_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('follicular', 'ovulation', 'luteal', 'menstruation', 'unknown')),
  day_in_cycle INTEGER CHECK (day_in_cycle >= 1 AND day_in_cycle <= 45),
  symptoms TEXT[], -- e.g., ['cramps', 'fatigue', 'heavy_bleeding']
  symptom_severity TEXT CHECK (symptom_severity IN ('none', 'mild', 'moderate', 'severe')),
  hormonal_contraception BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_cycle_data_user_date ON menstrual_cycle_data(user_id, date DESC);

-- RLS Policies
ALTER TABLE menstrual_cycle_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cycle data"
  ON menstrual_cycle_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own cycle data"
  ON menstrual_cycle_data FOR ALL
  USING (auth.uid() = user_id);

-- ==================== FITNESS TRACKER CONNECTIONS ====================
-- OAuth connections to Oura, Whoop, Apple Health, etc.

CREATE TABLE IF NOT EXISTS fitness_tracker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('oura', 'whoop', 'apple_health', 'google_fit', 'garmin', 'fitbit')),
  access_token TEXT NOT NULL, -- Should be encrypted in production
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT, -- OAuth scope granted
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'failed', 'partial'
  sync_error TEXT, -- Error message if sync failed
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_tracker_connections_active ON fitness_tracker_connections(user_id, is_active);

-- RLS Policies
ALTER TABLE fitness_tracker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracker connections"
  ON fitness_tracker_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tracker connections"
  ON fitness_tracker_connections FOR ALL
  USING (auth.uid() = user_id);

-- ==================== RECOVERY SNAPSHOTS ====================
-- Cache computed recovery state to avoid recalculating constantly

CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_timestamp TIMESTAMPTZ NOT NULL,

  -- Overall Metrics
  overall_recovery_score NUMERIC NOT NULL CHECK (overall_recovery_score >= 0 AND overall_recovery_score <= 100),
  global_fatigue NUMERIC NOT NULL CHECK (global_fatigue >= 0 AND global_fatigue <= 100),
  acwr NUMERIC CHECK (acwr >= 0),

  -- Injury Risk
  injury_risk_score NUMERIC CHECK (injury_risk_score >= 0 AND injury_risk_score <= 100),
  injury_risk_level TEXT CHECK (injury_risk_level IN ('low', 'moderate', 'high', 'very_high', 'critical')),

  -- Muscle States (JSONB for flexibility)
  muscle_states JSONB NOT NULL, -- Map of muscle -> {currentFatigue, recoveryPercentage, etc.}

  -- Exercise States
  exercise_states JSONB, -- Map of exercise -> {currentFatigue, recoveryPercentage, etc.}

  -- Energy Systems
  energy_states JSONB, -- Map of muscle -> {phosphocreatine, glycogen, imtg}

  -- Connective Tissue
  connective_tissue_states JSONB, -- Array of {structure, currentStress, riskLevel}

  -- Warnings & Recommendations
  warnings TEXT[],
  recommendations TEXT[],

  -- Metadata
  computation_time_ms INTEGER, -- How long it took to calculate
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_timestamp)
);

CREATE INDEX idx_recovery_snapshots_user_time ON recovery_snapshots(user_id, snapshot_timestamp DESC);

-- RLS Policies
ALTER TABLE recovery_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery snapshots"
  ON recovery_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery snapshots"
  ON recovery_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==================== HELPER FUNCTIONS ====================

-- Function to get latest context data for user
CREATE OR REPLACE FUNCTION get_latest_context_data(p_user_id UUID)
RETURNS user_context_data
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_context user_context_data;
BEGIN
  SELECT * INTO v_context
  FROM user_context_data
  WHERE user_id = p_user_id
  ORDER BY date DESC
  LIMIT 1;

  RETURN v_context;
END;
$$;

-- Function to get workout history for recovery calculations
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
AS $$
BEGIN
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
    AND fe.timestamp >= NOW() - (p_days_back || ' days')::INTERVAL
  ORDER BY fe.timestamp ASC;
END;
$$;

-- Function to calculate ACWR
CREATE OR REPLACE FUNCTION calculate_acwr(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_acute_load NUMERIC;
  v_chronic_load NUMERIC;
  v_acwr NUMERIC;
BEGIN
  -- Acute load: last 7 days
  SELECT COALESCE(SUM(volume), 0) INTO v_acute_load
  FROM fatigue_events
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - INTERVAL '7 days';

  -- Chronic load: last 28 days (4 weeks average)
  SELECT COALESCE(SUM(volume), 0) / 4.0 INTO v_chronic_load
  FROM fatigue_events
  WHERE user_id = p_user_id
    AND timestamp >= NOW() - INTERVAL '28 days';

  -- Calculate ratio
  IF v_chronic_load > 0 THEN
    v_acwr := v_acute_load / v_chronic_load;
  ELSE
    v_acwr := 0;
  END IF;

  RETURN v_acwr;
END;
$$;

-- ==================== TRIGGERS ====================

-- Update updated_at timestamp on user_context_data
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_context_data_updated_at
  BEFORE UPDATE ON user_context_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_demographics_updated_at
  BEFORE UPDATE ON user_demographics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menstrual_cycle_data_updated_at
  BEFORE UPDATE ON menstrual_cycle_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fitness_tracker_connections_updated_at
  BEFORE UPDATE ON fitness_tracker_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== INITIAL DATA ====================

-- Add default demographics for existing users (optional)
-- Users can update this during onboarding

COMMENT ON TABLE fatigue_events IS 'Stores every training event for exponential decay calculations';
COMMENT ON TABLE user_recovery_parameters IS 'Bayesian calibration: learns user-specific recovery rates';
COMMENT ON TABLE user_context_data IS 'Daily context: sleep, nutrition, stress';
COMMENT ON TABLE user_demographics IS 'User profile: age, sex, training age, injuries';
COMMENT ON TABLE menstrual_cycle_data IS 'Menstrual cycle tracking for female users';
COMMENT ON TABLE fitness_tracker_connections IS 'OAuth connections to fitness trackers';
COMMENT ON TABLE recovery_snapshots IS 'Cached recovery state to avoid constant recalculation';
