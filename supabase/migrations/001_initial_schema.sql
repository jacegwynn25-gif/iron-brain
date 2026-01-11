-- ============================================================
-- IRON BRAIN - Initial Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================
-- 1. USER PROFILES & SETTINGS
-- ============================================================

-- Extended user profile
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'elite')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
  distance_unit TEXT DEFAULT 'miles' CHECK (distance_unit IN ('miles', 'km')),
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  rest_timer_sound BOOLEAN DEFAULT true,
  rest_timer_vibration BOOLEAN DEFAULT true,
  default_rest_seconds INTEGER DEFAULT 120,
  show_warmup_sets BOOLEAN DEFAULT true,
  auto_start_rest_timer BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. EXERCISE LIBRARY
-- ============================================================

-- Muscle groups
CREATE TABLE muscle_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT CHECK (category IN ('upper', 'lower', 'core', 'full_body')),
  display_order INTEGER
);

-- Equipment
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  equipment_type TEXT CHECK (equipment_type IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band', 'kettlebell', 'other'))
);

-- Master exercise library
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  instructions TEXT,
  exercise_type TEXT CHECK (exercise_type IN ('compound', 'isolation', 'cardio', 'plyometric', 'stretch')),
  mechanics TEXT CHECK (mechanics IN ('push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'other')),
  force_type TEXT CHECK (force_type IN ('push', 'pull', 'static')),
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  -- Primary equipment
  primary_equipment_id UUID REFERENCES equipment(id),

  -- Default rest time
  default_rest_seconds INTEGER DEFAULT 120,

  -- Tracking options
  track_weight BOOLEAN DEFAULT true,
  track_reps BOOLEAN DEFAULT true,
  track_time BOOLEAN DEFAULT false,
  track_distance BOOLEAN DEFAULT false,

  -- Media
  video_url TEXT,
  thumbnail_url TEXT,

  -- Ownership
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise to muscle group mapping (many-to-many)
CREATE TABLE exercise_muscles (
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group_id UUID REFERENCES muscle_groups(id) ON DELETE CASCADE,
  involvement TEXT CHECK (involvement IN ('primary', 'secondary', 'tertiary')),
  activation_percentage INTEGER CHECK (activation_percentage BETWEEN 0 AND 100),
  PRIMARY KEY (exercise_id, muscle_group_id)
);

-- ============================================================
-- 3. PROGRAM TEMPLATES
-- ============================================================

-- Program templates (the "blueprints")
CREATE TABLE program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Program metadata
  goal TEXT CHECK (goal IN ('strength', 'hypertrophy', 'powerlifting', 'powerbuilding', 'general_fitness', 'sport_specific', 'rehabilitation')),
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'elite')),
  duration_weeks INTEGER,
  days_per_week INTEGER,

  -- Periodization
  periodization_type TEXT CHECK (periodization_type IN ('linear', 'undulating', 'block', 'conjugate', 'autoregulated', 'custom')),

  -- Ownership & sharing
  is_public BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),

  -- Stats
  times_used INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weeks within a program
CREATE TABLE program_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES program_templates(id) ON DELETE CASCADE,

  week_number INTEGER NOT NULL,
  name TEXT,
  description TEXT,

  -- Week type
  week_type TEXT CHECK (week_type IN ('normal', 'deload', 'test', 'intro')),

  -- Modifiers
  intensity_modifier DECIMAL(4,2) DEFAULT 1.0,
  volume_modifier DECIMAL(4,2) DEFAULT 1.0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(program_id, week_number)
);

-- Days within a week
CREATE TABLE program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID REFERENCES program_weeks(id) ON DELETE CASCADE,

  day_index INTEGER NOT NULL,
  day_of_week TEXT CHECK (day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  name TEXT NOT NULL,
  description TEXT,

  focus TEXT,
  estimated_duration_minutes INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(week_id, day_index)
);

-- Set templates
CREATE TABLE program_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id),

  order_index INTEGER NOT NULL,
  set_index INTEGER NOT NULL,

  set_type TEXT DEFAULT 'straight' CHECK (set_type IN ('straight', 'drop', 'rest-pause', 'cluster', 'superset', 'giant_set', 'myo-reps', 'warm-up', 'backoff')),
  superset_group TEXT,

  prescription_type TEXT CHECK (prescription_type IN ('rpe', 'rir', 'percentage', 'fixed_weight', 'amrap', 'time_based')),

  prescribed_reps TEXT,
  min_reps INTEGER,
  max_reps INTEGER,

  target_rpe DECIMAL(3,1),
  target_rir INTEGER,
  target_percentage DECIMAL(5,2),
  fixed_weight DECIMAL(7,2),
  target_seconds INTEGER,

  tempo TEXT,
  rest_seconds INTEGER,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. USER'S ACTIVE PROGRAMS
-- ============================================================

CREATE TABLE user_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  program_template_id UUID REFERENCES program_templates(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  current_week INTEGER DEFAULT 1,
  current_cycle INTEGER DEFAULT 1,

  starting_maxes JSONB,
  custom_settings JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_program_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_id UUID REFERENCES user_programs(id) ON DELETE CASCADE,

  program_week_id UUID REFERENCES program_weeks(id),
  program_day_id UUID REFERENCES program_days(id),

  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),

  scheduled_date DATE,
  completed_at TIMESTAMPTZ,

  workout_session_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. WORKOUT LOGGING
-- ============================================================

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  user_program_id UUID REFERENCES user_programs(id),
  program_day_id UUID REFERENCES program_days(id),

  name TEXT,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,

  total_volume_load DECIMAL(12,2),
  total_sets INTEGER,
  total_reps INTEGER,
  average_rpe DECIMAL(3,1),

  bodyweight DECIMAL(5,1),
  notes TEXT,

  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,

  exercise_id UUID REFERENCES exercises(id),
  program_set_id UUID REFERENCES program_sets(id),

  order_index INTEGER NOT NULL,
  set_index INTEGER NOT NULL,

  prescribed_reps TEXT,
  prescribed_rpe DECIMAL(3,1),
  prescribed_rir INTEGER,
  prescribed_percentage DECIMAL(5,2),

  actual_weight DECIMAL(7,2),
  actual_reps INTEGER,
  actual_rpe DECIMAL(3,1),
  actual_rir INTEGER,

  e1rm DECIMAL(7,2),
  volume_load DECIMAL(10,2),

  set_type TEXT,
  drop_set_rounds JSONB,
  rest_pause_rounds JSONB,
  cluster_rounds JSONB,

  tempo TEXT,
  actual_seconds INTEGER,
  rest_seconds INTEGER,
  notes TEXT,

  completed BOOLEAN DEFAULT true,
  skipped BOOLEAN DEFAULT false,

  performed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ANALYTICS & PERSONAL RECORDS
-- ============================================================

CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,

  record_type TEXT CHECK (record_type IN ('max_weight', 'max_reps', 'max_e1rm', 'max_volume')),

  weight DECIMAL(7,2),
  reps INTEGER,
  e1rm DECIMAL(7,2),
  volume DECIMAL(10,2),

  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  set_log_id UUID REFERENCES set_logs(id),

  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exercise_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,

  total_sets INTEGER DEFAULT 0,
  total_reps INTEGER DEFAULT 0,
  total_volume DECIMAL(12,2) DEFAULT 0,

  avg_weight DECIMAL(7,2),
  avg_reps DECIMAL(5,1),
  avg_rpe DECIMAL(3,1),

  best_weight DECIMAL(7,2),
  best_reps INTEGER,
  best_e1rm DECIMAL(7,2),

  last_performed_at TIMESTAMPTZ,
  times_performed INTEGER DEFAULT 0,

  weight_trend DECIMAL(5,2),
  e1rm_trend DECIMAL(5,2),

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id)
);

-- ============================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, date DESC);
CREATE INDEX idx_set_logs_workout ON set_logs(workout_session_id);
CREATE INDEX idx_set_logs_exercise ON set_logs(exercise_id);
CREATE INDEX idx_user_programs_user ON user_programs(user_id);
CREATE INDEX idx_exercises_system ON exercises(is_system) WHERE is_system = true;
CREATE INDEX idx_program_templates_public ON program_templates(is_public) WHERE is_public = true;

-- Partial unique index: Only one current record per user/exercise/type
CREATE UNIQUE INDEX idx_personal_records_current
  ON personal_records(user_id, exercise_id, record_type)
  WHERE is_current = true;

-- ============================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_sessions_updated_at BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Iron Brain schema created successfully! 🧠💪';
END $$;
