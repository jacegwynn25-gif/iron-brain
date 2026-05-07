-- Fix set_logs columns to accept decimal values for RPE and RIR
-- RPE (Rate of Perceived Exertion) and RIR (Reps In Reserve) are commonly recorded as decimals (6.5, 7.5, etc.)

-- Change RPE columns from INTEGER to NUMERIC(3,1) - allows values like 6.5, 7.5, 8.5
ALTER TABLE set_logs
  ALTER COLUMN prescribed_rpe TYPE NUMERIC(3,1),
  ALTER COLUMN actual_rpe TYPE NUMERIC(3,1);

-- Change RIR columns from INTEGER to NUMERIC(3,1) - allows values like 3.5, 2.5, 1.5
ALTER TABLE set_logs
  ALTER COLUMN prescribed_rir TYPE NUMERIC(3,1),
  ALTER COLUMN actual_rir TYPE NUMERIC(3,1);

-- Also fix workout_sessions.average_rpe to accept decimals
ALTER TABLE workout_sessions
  ALTER COLUMN average_rpe TYPE NUMERIC(3,1);
