-- ============================================================
-- Optimize RLS policies to use the subquery pattern
-- (select auth.uid()) is evaluated once per query instead of
-- once per row, significantly improving performance on large tables.
-- ============================================================

-- ============================================================
-- WORKOUT_SESSIONS
-- ============================================================

DROP POLICY IF EXISTS "Users can view own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can insert own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can update own workouts" ON workout_sessions;
DROP POLICY IF EXISTS "Users can delete own workouts" ON workout_sessions;

CREATE POLICY "Users can view own workouts"
  ON workout_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own workouts"
  ON workout_sessions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own workouts"
  ON workout_sessions FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workout_sessions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- SET_LOGS (join-based policies, optimize the inner auth.uid())
-- ============================================================

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
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own set logs"
  ON set_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own set logs"
  ON set_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own set logs"
  ON set_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = set_logs.workout_session_id
      AND workout_sessions.user_id = (select auth.uid())
    )
  );

-- ============================================================
-- CUSTOM_PROGRAMS
-- ============================================================

DROP POLICY IF EXISTS "Users can view own custom programs" ON custom_programs;
DROP POLICY IF EXISTS "Users can insert own custom programs" ON custom_programs;
DROP POLICY IF EXISTS "Users can update own custom programs" ON custom_programs;
DROP POLICY IF EXISTS "Users can delete own custom programs" ON custom_programs;

CREATE POLICY "Users can view own custom programs"
  ON custom_programs FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own custom programs"
  ON custom_programs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own custom programs"
  ON custom_programs FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own custom programs"
  ON custom_programs FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- PROGRAM_TEMPLATES (uses created_by, not user_id)
-- ============================================================

DROP POLICY IF EXISTS "Users can view own and public programs" ON program_templates;
DROP POLICY IF EXISTS "Users can create own programs" ON program_templates;
DROP POLICY IF EXISTS "Users can update own programs" ON program_templates;
DROP POLICY IF EXISTS "Users can delete own programs" ON program_templates;

CREATE POLICY "Users can view own and public programs"
  ON program_templates FOR SELECT
  USING (is_public = true OR is_system = true OR created_by = (select auth.uid()));

CREATE POLICY "Users can create own programs"
  ON program_templates FOR INSERT
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can update own programs"
  ON program_templates FOR UPDATE
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can delete own programs"
  ON program_templates FOR DELETE
  USING ((select auth.uid()) = created_by);
