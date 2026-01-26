-- Migration 017: Add weight_unit to set_logs
-- Description: Persist per-set weight units (lbs/kg) for correct conversions across the app.
-- Date: 2026-01-24

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lbs';

ALTER TABLE set_logs
  ALTER COLUMN weight_unit SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'set_logs_weight_unit_check'
  ) THEN
    ALTER TABLE set_logs
      ADD CONSTRAINT set_logs_weight_unit_check
      CHECK (weight_unit IN ('lbs', 'kg'));
  END IF;
END $$;

