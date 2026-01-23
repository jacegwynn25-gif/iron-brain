-- Fix RLS policies for workout_sessions table
-- Migration 018: Add missing RLS policies for workout logging

-- Drop existing policies if any (cleanup)
DROP POLICY IF EXISTS "Users can view own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can insert own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can update own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can delete own workouts" ON workout_sessions;

-- Create policies for workout_sessions
CREATE POLICY "Users can view own workouts"
  ON workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
  ON workout_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workout_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Also fix set_logs table (child table)
DROP POLICY IF EXISTS "Users can view own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can insert own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can update own set logs" ON set_logs;
DROP POLICY IF EXISTS "Users can delete own set logs" ON set_logs;

CREATE POLICY "Users can view own set logs"
  ON set_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own set logs"
  ON set_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own set logs"
  ON set_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own set logs"
  ON set_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );
