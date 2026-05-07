-- Migration 029: Add missing indexes for performance

-- Custom programs: filter by user + order by updated_at (program sync)
CREATE INDEX IF NOT EXISTS idx_custom_programs_user_updated
  ON custom_programs(user_id, updated_at DESC);

-- Set logs: filter by exercise + order by performed_at (exercise stats, PR tracking)
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_performed
  ON set_logs(exercise_id, performed_at DESC);

-- Program templates: lookup by app_program_id (progress resolution)
CREATE INDEX IF NOT EXISTS idx_program_templates_app_id
  ON program_templates(app_program_id);

-- Workout sessions: filter by user + status (analytics dashboards)
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_status
  ON workout_sessions(user_id, status);

-- Subscription events: audit trail reads by user + date
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_created
  ON subscription_events(user_id, created_at DESC);
