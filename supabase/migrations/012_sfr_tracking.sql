-- Phase 3: Stimulus-to-Fatigue Ratio (SFR) Tracking
-- Enables training efficiency analysis and junk volume detection

-- ============================================================
-- SFR ANALYSES TABLE
-- ============================================================
-- Stores SFR calculation results per exercise per workout
CREATE TABLE IF NOT EXISTS sfr_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,

  -- Exercise identification
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,

  -- Volume metrics
  total_sets INTEGER NOT NULL,
  total_volume_load DECIMAL(10,2) NOT NULL,      -- Raw volume (reps × weight)
  effective_volume DECIMAL(10,2) NOT NULL,       -- Weighted by proximity to failure
  avg_rpe DECIMAL(3,1),

  -- Fatigue metrics
  total_fatigue DECIMAL(5,2) NOT NULL,
  fatigue_per_set DECIMAL(5,2),

  -- SFR calculation
  sfr DECIMAL(8,2) NOT NULL,
  interpretation TEXT NOT NULL CHECK (interpretation IN ('excellent', 'good', 'moderate', 'poor', 'excessive')),
  recommendation TEXT,

  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sfr_user_exercise ON sfr_analyses(user_id, exercise_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sfr_session ON sfr_analyses(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_sfr_interpretation ON sfr_analyses(user_id, interpretation);

-- ============================================================
-- WORKOUT SFR SUMMARIES TABLE
-- ============================================================
-- Stores overall SFR for each workout session
CREATE TABLE IF NOT EXISTS workout_sfr_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE UNIQUE,

  -- Overall metrics
  overall_sfr DECIMAL(8,2) NOT NULL,
  overall_interpretation TEXT NOT NULL CHECK (overall_interpretation IN ('excellent', 'good', 'moderate', 'poor', 'excessive')),

  -- Counts
  total_exercises INTEGER NOT NULL,
  excellent_count INTEGER DEFAULT 0,
  good_count INTEGER DEFAULT 0,
  moderate_count INTEGER DEFAULT 0,
  poor_count INTEGER DEFAULT 0,
  excessive_count INTEGER DEFAULT 0,

  -- Insights (stored as JSONB array)
  insights JSONB,

  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workout_sfr_user ON workout_sfr_summaries(user_id, recorded_at DESC);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View: Recent SFR trends per exercise (last 10 sessions)
CREATE OR REPLACE VIEW recent_sfr_trends AS
SELECT
  user_id,
  exercise_id,
  exercise_name,
  AVG(sfr) as avg_sfr,
  STDDEV(sfr) as sfr_variance,
  COUNT(*) as session_count,
  MAX(recorded_at) as last_performed
FROM sfr_analyses
GROUP BY user_id, exercise_id, exercise_name
HAVING COUNT(*) >= 3;  -- Only show exercises with 3+ sessions

-- View: Exercise efficiency leaderboard (best SFR per user)
CREATE OR REPLACE VIEW exercise_efficiency_leaderboard AS
SELECT
  user_id,
  exercise_id,
  exercise_name,
  AVG(sfr) as avg_sfr,
  COUNT(*) as times_performed,
  MAX(sfr) as best_sfr,
  MIN(sfr) as worst_sfr
FROM sfr_analyses
WHERE recorded_at > NOW() - INTERVAL '90 days'  -- Last 90 days
GROUP BY user_id, exercise_id, exercise_name
ORDER BY avg_sfr DESC;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function: Get average SFR for an exercise (for trend comparison)
CREATE OR REPLACE FUNCTION get_exercise_avg_sfr(
  p_user_id UUID,
  p_exercise_id TEXT,
  p_days_back INTEGER DEFAULT 90
)
RETURNS DECIMAL(8,2) AS $$
DECLARE
  avg_sfr DECIMAL(8,2);
BEGIN
  SELECT AVG(sfr) INTO avg_sfr
  FROM sfr_analyses
  WHERE user_id = p_user_id
    AND exercise_id = p_exercise_id
    AND recorded_at > NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN COALESCE(avg_sfr, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Identify junk volume exercises (SFR < 75 consistently)
CREATE OR REPLACE FUNCTION identify_junk_volume_exercises(
  p_user_id UUID,
  p_min_sessions INTEGER DEFAULT 3
)
RETURNS TABLE(
  exercise_id TEXT,
  exercise_name TEXT,
  avg_sfr DECIMAL(8,2),
  session_count BIGINT,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.exercise_id,
    sa.exercise_name,
    AVG(sa.sfr)::DECIMAL(8,2) as avg_sfr,
    COUNT(*)::BIGINT as session_count,
    CASE
      WHEN AVG(sa.sfr) < 50 THEN 'Replace this exercise - consistently poor efficiency'
      WHEN AVG(sa.sfr) < 75 THEN 'Reduce volume or improve technique - below optimal'
      ELSE 'Monitor - efficiency declining'
    END as recommendation
  FROM sfr_analyses sa
  WHERE sa.user_id = p_user_id
    AND sa.recorded_at > NOW() - INTERVAL '60 days'
  GROUP BY sa.exercise_id, sa.exercise_name
  HAVING COUNT(*) >= p_min_sessions
    AND AVG(sa.sfr) < 100
  ORDER BY AVG(sa.sfr) ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFY SETUP
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ SFR tracking tables created successfully';
  RAISE NOTICE '   - sfr_analyses: Stores per-exercise efficiency metrics';
  RAISE NOTICE '   - workout_sfr_summaries: Stores overall workout efficiency';
  RAISE NOTICE '   - Views: recent_sfr_trends, exercise_efficiency_leaderboard';
  RAISE NOTICE '   - Functions: get_exercise_avg_sfr, identify_junk_volume_exercises';
END $$;
