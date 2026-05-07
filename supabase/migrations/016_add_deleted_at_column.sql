-- Add deleted_at column for soft delete functionality
-- Enables trash/recovery feature

ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries on non-deleted workouts
CREATE INDEX IF NOT EXISTS idx_workout_sessions_deleted_at
ON workout_sessions(user_id, deleted_at)
WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN workout_sessions.deleted_at IS 'Timestamp when workout was soft-deleted. NULL means active, non-NULL means in trash.';

DO $$
BEGIN
  RAISE NOTICE '✅ Added deleted_at column to workout_sessions';
  RAISE NOTICE '   - Enables 30-day trash recovery feature';
  RAISE NOTICE '   - NULL = active workout, timestamp = soft-deleted';
END $$;
