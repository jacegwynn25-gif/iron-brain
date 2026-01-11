-- Phase 2: Cross-Session Fatigue Tracking
-- Enables tracking fatigue history and recovery modeling across workouts

-- ============================================================
-- FATIGUE HISTORY TABLE
-- ============================================================
-- Stores fatigue snapshots after each workout completion
CREATE TABLE IF NOT EXISTS fatigue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,

  -- Which muscle group this fatigue score represents
  muscle_group TEXT NOT NULL,

  -- Fatigue score (0-100 scale)
  fatigue_score DECIMAL(5,2) NOT NULL CHECK (fatigue_score >= 0 AND fatigue_score <= 100),

  -- Contributing factors (for analysis)
  rpe_overshoot_avg DECIMAL(3,1),
  form_breakdown_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  volume_load DECIMAL(10,2),

  -- When this fatigue was recorded
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_fatigue_user_muscle ON fatigue_history(user_id, muscle_group, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fatigue_session ON fatigue_history(workout_session_id);

-- ============================================================
-- RECOVERY ESTIMATES TABLE
-- ============================================================
-- Tracks estimated recovery state for each muscle group per user
CREATE TABLE IF NOT EXISTS recovery_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Muscle group being tracked
  muscle_group TEXT NOT NULL,

  -- Recovery timeline
  last_trained_at TIMESTAMPTZ NOT NULL,
  estimated_recovery_at TIMESTAMPTZ NOT NULL,

  -- Current recovery state (0-100%)
  current_recovery_percentage DECIMAL(5,2) DEFAULT 0 CHECK (current_recovery_percentage >= 0 AND current_recovery_percentage <= 100),

  -- Factors affecting recovery
  last_fatigue_score DECIMAL(5,2),
  rest_days INTEGER DEFAULT 0,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One recovery estimate per muscle per user
  UNIQUE(user_id, muscle_group)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_muscle ON recovery_estimates(user_id, muscle_group);

-- ============================================================
-- HELPER FUNCTION: Calculate Hours Since Training
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_hours_since_training(last_trained TIMESTAMPTZ)
RETURNS NUMERIC AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (NOW() - last_trained)) / 3600;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- VERIFY SETUP
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Fatigue tracking tables created successfully';
  RAISE NOTICE '   - fatigue_history: Stores per-muscle fatigue after each workout';
  RAISE NOTICE '   - recovery_estimates: Tracks recovery state per muscle group';
END $$;
