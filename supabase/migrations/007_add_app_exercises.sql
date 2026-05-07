-- Add all app exercises to the database with slugs matching app exercise IDs
-- This enables UUID mapping from exercise_slug to exercise_id

-- First, let's add the necessary equipment if not exists
INSERT INTO equipment (name, category) VALUES
  ('Barbell', 'free_weight'),
  ('Dumbbell', 'free_weight'),
  ('Cable Machine', 'machine'),
  ('Machine', 'machine'),
  ('Bodyweight', 'bodyweight'),
  ('EZ Bar', 'free_weight')
ON CONFLICT (name) DO NOTHING;

-- Get equipment IDs
DO $$
DECLARE
  barbell_eq_id UUID;
  dumbbell_eq_id UUID;
  cable_eq_id UUID;
  machine_eq_id UUID;
  bodyweight_eq_id UUID;
  ezbar_eq_id UUID;
BEGIN
  SELECT id INTO barbell_eq_id FROM equipment WHERE name = 'Barbell';
  SELECT id INTO dumbbell_eq_id FROM equipment WHERE name = 'Dumbbell';
  SELECT id INTO cable_eq_id FROM equipment WHERE name = 'Cable Machine';
  SELECT id INTO machine_eq_id FROM equipment WHERE name = 'Machine';
  SELECT id INTO bodyweight_eq_id FROM equipment WHERE name = 'Bodyweight';
  SELECT id INTO ezbar_eq_id FROM equipment WHERE name = 'EZ Bar';

  -- Insert all app exercises
  -- Bench variations
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system) VALUES
    ('Bench Press (Touch & Go)', 'bench_tng', 'compound', 'push', 'push', 'beginner', barbell_eq_id, true),
    ('Paused Bench Press', 'bench_paused', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Tempo Bench Press', 'bench_tempo', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Close Grip Bench Press', 'bench_close_grip', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Bench Press Backoff Sets', 'bench_backoff', 'compound', 'push', 'push', 'beginner', barbell_eq_id, true),
    ('Incline Bench Press', 'incline_bench', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Decline Bench Press', 'decline_bench', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Dumbbell Bench Press', 'db_bench_press', 'compound', 'push', 'push', 'beginner', dumbbell_eq_id, true),
    ('Dumbbell Incline Press', 'db_incline_press', 'compound', 'push', 'push', 'beginner', dumbbell_eq_id, true),

    -- Squat variations
    ('Barbell Back Squat', 'squat', 'compound', 'squat', 'push', 'intermediate', barbell_eq_id, true),
    ('Front Squat', 'front_squat', 'compound', 'squat', 'push', 'advanced', barbell_eq_id, true),
    ('Hack Squat', 'hack_squat', 'compound', 'squat', 'push', 'beginner', machine_eq_id, true),
    ('Bulgarian Split Squat', 'bulgarian_split_squat', 'compound', 'squat', 'push', 'intermediate', dumbbell_eq_id, true),

    -- Deadlift variations
    ('Conventional Deadlift', 'deadlift', 'compound', 'hinge', 'pull', 'advanced', barbell_eq_id, true),
    ('Romanian Deadlift', 'rdl', 'compound', 'hinge', 'pull', 'intermediate', barbell_eq_id, true),

    -- Back exercises
    ('Barbell Bent-Over Row', 'bent_over_row', 'compound', 'pull', 'pull', 'intermediate', barbell_eq_id, true),
    ('Chest Supported Row', 'row_chest_supported', 'compound', 'pull', 'pull', 'beginner', machine_eq_id, true),
    ('Neutral Grip Row', 'row_neutral', 'compound', 'pull', 'pull', 'beginner', machine_eq_id, true),
    ('Cable Row', 'row_cable', 'compound', 'pull', 'pull', 'beginner', cable_eq_id, true),
    ('Dumbbell Row', 'db_row', 'compound', 'pull', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Lat Pulldown', 'lat_pulldown', 'compound', 'pull', 'pull', 'beginner', cable_eq_id, true),
    ('Pull-up', 'pullup', 'compound', 'pull', 'pull', 'intermediate', bodyweight_eq_id, true),

    -- Shoulder exercises
    ('Barbell Overhead Press', 'ohp', 'compound', 'push', 'push', 'intermediate', barbell_eq_id, true),
    ('Dumbbell Shoulder Press', 'db_shoulder_press', 'compound', 'push', 'push', 'beginner', dumbbell_eq_id, true),
    ('Machine Shoulder Press', 'shoulder_press_machine', 'compound', 'push', 'push', 'beginner', machine_eq_id, true),
    ('Lateral Raise', 'lateral_raise', 'isolation', 'lateral_raise', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Front Raise', 'front_raise', 'isolation', 'raise', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Rear Delt Fly', 'rear_delt_fly', 'isolation', 'fly', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Face Pull', 'face_pull', 'isolation', 'pull', 'pull', 'beginner', cable_eq_id, true),

    -- Tricep exercises
    ('Tricep Pressdown', 'tricep_pressdown', 'isolation', 'extension', 'push', 'beginner', cable_eq_id, true),
    ('Overhead Cable Extension', 'tricep_overhead_cable', 'isolation', 'extension', 'push', 'beginner', cable_eq_id, true),
    ('Skull Crusher', 'skull_crusher', 'isolation', 'extension', 'push', 'intermediate', barbell_eq_id, true),
    ('JM Press', 'jm_press', 'compound', 'push', 'push', 'advanced', barbell_eq_id, true),
    ('Dumbbell Overhead Extension', 'db_overhead_extension', 'isolation', 'extension', 'push', 'beginner', dumbbell_eq_id, true),

    -- Bicep exercises
    ('Cable Curl', 'bicep_curl_cable', 'isolation', 'curl', 'pull', 'beginner', cable_eq_id, true),
    ('Hammer Curl', 'bicep_curl_hammer', 'isolation', 'curl', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Preacher Curl', 'bicep_curl_preacher', 'isolation', 'curl', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Barbell Curl', 'barbell_curl', 'isolation', 'curl', 'pull', 'beginner', barbell_eq_id, true),
    ('EZ Bar Curl', 'ez_curl', 'isolation', 'curl', 'pull', 'beginner', ezbar_eq_id, true),
    ('Dumbbell Curl', 'db_curl', 'isolation', 'curl', 'pull', 'beginner', dumbbell_eq_id, true),
    ('Hammer Curl', 'hammer_curl', 'isolation', 'curl', 'pull', 'beginner', dumbbell_eq_id, true),

    -- Leg exercises
    ('Leg Press', 'leg_press', 'compound', 'squat', 'push', 'beginner', machine_eq_id, true),
    ('Leg Curl', 'leg_curl', 'isolation', 'curl', 'pull', 'beginner', machine_eq_id, true),
    ('Leg Extension', 'leg_extension', 'isolation', 'extension', 'push', 'beginner', machine_eq_id, true),
    ('Standing Calf Raise', 'standing_calf_raise', 'isolation', 'raise', 'push', 'beginner', machine_eq_id, true),
    ('Seated Calf Raise', 'seated_calf_raise', 'isolation', 'raise', 'push', 'beginner', machine_eq_id, true),

    -- Chest isolation
    ('Cable Fly', 'cable_fly', 'isolation', 'fly', 'push', 'beginner', cable_eq_id, true),
    ('Dumbbell Fly', 'db_fly', 'isolation', 'fly', 'push', 'beginner', dumbbell_eq_id, true),

    -- Core/abs
    ('Ab Wheel', 'ab_wheel', 'isolation', 'extension', 'pull', 'intermediate', bodyweight_eq_id, true),
    ('Plank', 'plank', 'isolation', 'static', 'static', 'beginner', bodyweight_eq_id, true),
    ('Hanging Leg Raise', 'hanging_leg_raise', 'isolation', 'raise', 'pull', 'intermediate', bodyweight_eq_id, true)
  ON CONFLICT (slug) DO NOTHING;

END $$;

-- Add comment
COMMENT ON COLUMN exercises.slug IS 'App-specific exercise identifier matching exercise IDs in the frontend';
