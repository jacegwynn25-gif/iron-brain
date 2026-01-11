-- Add metadata column to store program information and other structured data
ALTER TABLE workout_sessions
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster metadata queries
CREATE INDEX idx_workout_sessions_metadata ON workout_sessions USING gin (metadata);

-- Add comment explaining the metadata structure
COMMENT ON COLUMN workout_sessions.metadata IS 'Stores program metadata: programId, programName, programDayId, cycleNumber, weekNumber, dayOfWeek, dayName, and other structured data';
