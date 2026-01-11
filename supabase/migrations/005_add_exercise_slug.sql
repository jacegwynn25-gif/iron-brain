-- Add exercise_slug column to store app exercise IDs (non-UUID string IDs)
-- This allows us to reference exercises by their app IDs without requiring UUID mapping
ALTER TABLE set_logs
ADD COLUMN exercise_slug TEXT;

-- Add index for faster queries
CREATE INDEX idx_set_logs_exercise_slug ON set_logs(exercise_slug);

-- Add comment explaining the column
COMMENT ON COLUMN set_logs.exercise_slug IS 'App-specific exercise identifier (e.g., "bicep_curl_hammer", "bench_press"). Used when exercise_id UUID is not available.';
