-- Migration 011: Custom Exercises and User Maxes
-- Description: Add tables for user-created exercises and 1RM tracking
-- Date: 2026-01-10

-- ============================================================
-- CUSTOM EXERCISES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_exercises (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Exercise metadata
  name TEXT NOT NULL,
  slug TEXT NOT NULL,

  -- Equipment and type
  equipment TEXT NOT NULL CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other')),
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('compound', 'isolation')),

  -- Muscle groups (array fields)
  primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',

  -- Movement pattern (optional)
  movement_pattern TEXT CHECK (movement_pattern IN ('push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'other', NULL)),

  -- Tracking options
  track_weight BOOLEAN NOT NULL DEFAULT true,
  track_reps BOOLEAN NOT NULL DEFAULT true,
  track_time BOOLEAN NOT NULL DEFAULT false,

  -- Default rest time
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT custom_exercises_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT custom_exercises_slug_not_empty CHECK (LENGTH(TRIM(slug)) > 0),
  CONSTRAINT custom_exercises_primary_muscles_not_empty CHECK (ARRAY_LENGTH(primary_muscles, 1) > 0)
);

-- Indexes for custom exercises
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id ON custom_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_slug ON custom_exercises(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_created_at ON custom_exercises(created_at DESC);

-- RLS Policies for custom exercises
ALTER TABLE custom_exercises ENABLE ROW LEVEL SECURITY;

-- Users can only read their own custom exercises
CREATE POLICY "Users can view own custom exercises"
  ON custom_exercises FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own custom exercises
CREATE POLICY "Users can create own custom exercises"
  ON custom_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own custom exercises
CREATE POLICY "Users can update own custom exercises"
  ON custom_exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own custom exercises
CREATE POLICY "Users can delete own custom exercises"
  ON custom_exercises FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- USER MAXES TABLE (1RM tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_maxes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Exercise reference
  exercise_id TEXT NOT NULL,  -- Can reference system exercises or custom exercises
  exercise_name TEXT NOT NULL,

  -- Max weight data
  weight DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs' CHECK (unit IN ('lbs', 'kg')),

  -- When was this tested
  tested_at DATE NOT NULL,

  -- Was this tested or estimated (from E1RM calculation)
  estimated_or_tested TEXT NOT NULL DEFAULT 'tested' CHECK (estimated_or_tested IN ('tested', 'estimated')),

  -- Optional notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_maxes_weight_positive CHECK (weight > 0),
  CONSTRAINT user_maxes_exercise_id_not_empty CHECK (LENGTH(TRIM(exercise_id)) > 0),
  CONSTRAINT user_maxes_exercise_name_not_empty CHECK (LENGTH(TRIM(exercise_name)) > 0)
);

-- Indexes for user maxes
CREATE INDEX IF NOT EXISTS idx_user_maxes_user_id ON user_maxes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_maxes_exercise_id ON user_maxes(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_user_maxes_tested_at ON user_maxes(tested_at DESC);

-- RLS Policies for user maxes
ALTER TABLE user_maxes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own maxes
CREATE POLICY "Users can view own maxes"
  ON user_maxes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own maxes
CREATE POLICY "Users can create own maxes"
  ON user_maxes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own maxes
CREATE POLICY "Users can update own maxes"
  ON user_maxes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own maxes
CREATE POLICY "Users can delete own maxes"
  ON user_maxes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER FUNCTIONS FOR UPDATED_AT
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for custom_exercises
DROP TRIGGER IF EXISTS update_custom_exercises_updated_at ON custom_exercises;
CREATE TRIGGER update_custom_exercises_updated_at
  BEFORE UPDATE ON custom_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_maxes
DROP TRIGGER IF EXISTS update_user_maxes_updated_at ON user_maxes;
CREATE TRIGGER update_user_maxes_updated_at
  BEFORE UPDATE ON user_maxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE custom_exercises IS 'User-created custom exercises with full metadata';
COMMENT ON TABLE user_maxes IS 'User 1RM (one-rep max) tracking for percentage-based training';

COMMENT ON COLUMN custom_exercises.slug IS 'URL-friendly version of exercise name for potential future use';
COMMENT ON COLUMN custom_exercises.primary_muscles IS 'Array of primary muscle groups targeted';
COMMENT ON COLUMN custom_exercises.secondary_muscles IS 'Array of secondary muscle groups targeted';
COMMENT ON COLUMN custom_exercises.movement_pattern IS 'Fundamental movement pattern classification';

COMMENT ON COLUMN user_maxes.estimated_or_tested IS 'Whether this max was actually tested or estimated from E1RM calculations';
COMMENT ON COLUMN user_maxes.tested_at IS 'Date when max was achieved/estimated (for staleness detection)';
