-- ============================================================
-- IRON BRAIN - Row Level Security Policies
-- Run this AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER PROFILES & SETTINGS POLICIES
-- ============================================================

-- User profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- EXERCISE LIBRARY POLICIES
-- ============================================================

-- Muscle groups (read-only for all)
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view muscle groups"
  ON muscle_groups FOR SELECT
  USING (true);

-- Equipment (read-only for all)
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view equipment"
  ON equipment FOR SELECT
  USING (true);

-- Exercises (system exercises visible to all, user exercises visible to creator)
CREATE POLICY "Anyone can view system exercises"
  ON exercises FOR SELECT
  USING (is_system = true OR created_by = auth.uid());

CREATE POLICY "Users can create own exercises"
  ON exercises FOR INSERT
  WITH CHECK (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can update own exercises"
  ON exercises FOR UPDATE
  USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own exercises"
  ON exercises FOR DELETE
  USING (created_by = auth.uid() AND is_system = false);

-- Exercise muscles (follows exercise permissions)
ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view exercise muscles"
  ON exercise_muscles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exercises
      WHERE exercises.id = exercise_muscles.exercise_id
      AND (exercises.is_system = true OR exercises.created_by = auth.uid())
    )
  );

-- ============================================================
-- PROGRAM TEMPLATES POLICIES
-- ============================================================

-- Program templates
CREATE POLICY "Users can view public or own programs"
  ON program_templates FOR SELECT
  USING (is_public = true OR is_system = true OR created_by = auth.uid());

CREATE POLICY "Users can create own programs"
  ON program_templates FOR INSERT
  WITH CHECK (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can update own programs"
  ON program_templates FOR UPDATE
  USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own programs"
  ON program_templates FOR DELETE
  USING (created_by = auth.uid() AND is_system = false);

-- Program weeks (follows program permissions)
CREATE POLICY "Users can view program weeks"
  ON program_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_templates
      WHERE program_templates.id = program_weeks.program_id
      AND (program_templates.is_public = true OR program_templates.is_system = true OR program_templates.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can manage own program weeks"
  ON program_weeks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM program_templates
      WHERE program_templates.id = program_weeks.program_id
      AND program_templates.created_by = auth.uid()
    )
  );

-- Program days (follows program permissions)
CREATE POLICY "Users can view program days"
  ON program_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks
      JOIN program_templates ON program_templates.id = program_weeks.program_id
      WHERE program_weeks.id = program_days.week_id
      AND (program_templates.is_public = true OR program_templates.is_system = true OR program_templates.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can manage own program days"
  ON program_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks
      JOIN program_templates ON program_templates.id = program_weeks.program_id
      WHERE program_weeks.id = program_days.week_id
      AND program_templates.created_by = auth.uid()
    )
  );

-- Program sets (follows program permissions)
CREATE POLICY "Users can view program sets"
  ON program_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_days
      JOIN program_weeks ON program_weeks.id = program_days.week_id
      JOIN program_templates ON program_templates.id = program_weeks.program_id
      WHERE program_days.id = program_sets.day_id
      AND (program_templates.is_public = true OR program_templates.is_system = true OR program_templates.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can manage own program sets"
  ON program_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM program_days
      JOIN program_weeks ON program_weeks.id = program_days.week_id
      JOIN program_templates ON program_templates.id = program_weeks.program_id
      WHERE program_days.id = program_sets.day_id
      AND program_templates.created_by = auth.uid()
    )
  );

-- ============================================================
-- USER PROGRAMS & PROGRESS POLICIES
-- ============================================================

-- User programs
CREATE POLICY "Users can view own user programs"
  ON user_programs FOR ALL
  USING (auth.uid() = user_id);

-- User program progress
CREATE POLICY "Users can view own progress"
  ON user_program_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_programs
      WHERE user_programs.id = user_program_progress.user_program_id
      AND user_programs.user_id = auth.uid()
    )
  );

-- ============================================================
-- WORKOUT LOGGING POLICIES
-- ============================================================

-- Workout sessions
CREATE POLICY "Users can view own workouts"
  ON workout_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Set logs
CREATE POLICY "Users can view own set logs"
  ON set_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- ============================================================
-- ANALYTICS & RECORDS POLICIES
-- ============================================================

-- Personal records
CREATE POLICY "Users can view own records"
  ON personal_records FOR ALL
  USING (auth.uid() = user_id);

-- Exercise stats
CREATE POLICY "Users can view own stats"
  ON exercise_stats FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies created successfully! 🔒';
  RAISE NOTICE 'Your data is now secure with row-level security.';
END $$;
