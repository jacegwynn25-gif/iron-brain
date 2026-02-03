-- Migration: Add missing indexes identified in structural audit
-- These indexes optimize frequently filtered columns that were missing coverage

-- ============================================================
-- HIGH PRIORITY: Core query performance
-- ============================================================

-- set_logs.completed - filtered in completeWorkoutSession() and updateExerciseStats()
-- Composite index with workout_session_id since they're always queried together
CREATE INDEX IF NOT EXISTS idx_set_logs_workout_completed
  ON set_logs(workout_session_id, completed)
  WHERE completed = true;

-- exercises.created_by - filtered in useExercises() for user custom exercises
-- Partial index since most exercises have NULL created_by (system exercises)
CREATE INDEX IF NOT EXISTS idx_exercises_created_by
  ON exercises(created_by)
  WHERE created_by IS NOT NULL;

-- user_programs.status - filtered in useActiveProgram() to find active programs
CREATE INDEX IF NOT EXISTS idx_user_programs_user_status
  ON user_programs(user_id, status);

-- exercise_stats.user_id - filtered in useExerciseStats()
CREATE INDEX IF NOT EXISTS idx_exercise_stats_user
  ON exercise_stats(user_id);

-- ============================================================
-- MEDIUM PRIORITY: Search and lookup performance
-- ============================================================

-- exercises.slug - used for exercise lookups in migration and matching
CREATE INDEX IF NOT EXISTS idx_exercises_slug
  ON exercises(slug)
  WHERE slug IS NOT NULL;

-- personal_records.record_type - filtered with user_id and exercise_id in checkAndUpdatePersonalRecords()
-- Composite index covers the common query pattern
CREATE INDEX IF NOT EXISTS idx_personal_records_lookup
  ON personal_records(user_id, exercise_id, record_type, is_current);

-- ============================================================
-- ADDITIONAL: Composite indexes for common query patterns
-- ============================================================

-- exercise_stats with exercise join - common pattern in stats queries
CREATE INDEX IF NOT EXISTS idx_exercise_stats_user_exercise
  ON exercise_stats(user_id, exercise_id);
