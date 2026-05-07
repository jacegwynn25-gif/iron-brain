-- Add persisted prescribed load targets for fixed-weight and percentage-based program prescriptions.
ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS prescribed_weight NUMERIC(10,2);

ALTER TABLE set_logs
  DROP CONSTRAINT IF EXISTS set_logs_prescribed_weight_nonnegative;

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_prescribed_weight_nonnegative
  CHECK (prescribed_weight IS NULL OR prescribed_weight >= 0);

COMMENT ON COLUMN set_logs.prescribed_weight IS
  'Unadjusted prescribed load in the set weight_unit. Actual auto-filled weight may be adjusted by readiness.';
