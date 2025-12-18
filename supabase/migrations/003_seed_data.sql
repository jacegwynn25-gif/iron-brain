-- ============================================================
-- IRON BRAIN - Seed Data
-- Run this AFTER 001 and 002
-- ============================================================

-- ============================================================
-- MUSCLE GROUPS
-- ============================================================

INSERT INTO muscle_groups (name, category, display_order) VALUES
-- Upper body
('Chest', 'upper', 1),
('Front Delts', 'upper', 2),
('Side Delts', 'upper', 3),
('Rear Delts', 'upper', 4),
('Triceps', 'upper', 5),
('Lats', 'upper', 6),
('Upper Back', 'upper', 7),
('Biceps', 'upper', 8),
('Forearms', 'upper', 9),
('Traps', 'upper', 10),
-- Lower body
('Quads', 'lower', 11),
('Hamstrings', 'lower', 12),
('Glutes', 'lower', 13),
('Calves', 'lower', 14),
('Hip Flexors', 'lower', 15),
('Adductors', 'lower', 16),
('Abductors', 'lower', 17),
-- Core
('Abs', 'core', 18),
('Obliques', 'core', 19),
('Lower Back', 'core', 20),
('Spinal Erectors', 'core', 21);

-- ============================================================
-- EQUIPMENT
-- ============================================================

INSERT INTO equipment (name, equipment_type) VALUES
('Barbell', 'barbell'),
('Dumbbell', 'dumbbell'),
('EZ Bar', 'barbell'),
('Cable Machine', 'cable'),
('Leg Press', 'machine'),
('Hack Squat', 'machine'),
('Smith Machine', 'machine'),
('Chest Press Machine', 'machine'),
('Shoulder Press Machine', 'machine'),
('Lat Pulldown', 'machine'),
('Cable Crossover', 'cable'),
('Leg Curl Machine', 'machine'),
('Leg Extension Machine', 'machine'),
('Pec Deck', 'machine'),
('Preacher Curl Bench', 'machine'),
('Resistance Band', 'band'),
('Kettlebell', 'kettlebell'),
('Pull-up Bar', 'bodyweight'),
('Dip Station', 'bodyweight'),
('Bodyweight', 'bodyweight');

-- ============================================================
-- SYSTEM EXERCISES (Compound Movements)
-- ============================================================

DO $$
DECLARE
  barbell_id UUID;
  dumbbell_id UUID;
  bodyweight_id UUID;
  cable_id UUID;

  -- Exercise IDs we'll need for muscle mapping
  squat_id UUID;
  bench_id UUID;
  deadlift_id UUID;
  ohp_id UUID;
  row_id UUID;
  pullup_id UUID;
  dip_id UUID;
  lunge_id UUID;
  rdl_id UUID;

  -- Muscle group IDs
  chest_id UUID;
  front_delt_id UUID;
  side_delt_id UUID;
  rear_delt_id UUID;
  triceps_id UUID;
  lats_id UUID;
  upper_back_id UUID;
  biceps_id UUID;
  quads_id UUID;
  hamstrings_id UUID;
  glutes_id UUID;
  lower_back_id UUID;
  spinal_id UUID;
  abs_id UUID;
BEGIN
  -- Get equipment IDs
  SELECT id INTO barbell_id FROM equipment WHERE name = 'Barbell';
  SELECT id INTO dumbbell_id FROM equipment WHERE name = 'Dumbbell';
  SELECT id INTO bodyweight_id FROM equipment WHERE name = 'Bodyweight';
  SELECT id INTO cable_id FROM equipment WHERE name = 'Cable Machine';

  -- Get muscle group IDs
  SELECT id INTO chest_id FROM muscle_groups WHERE name = 'Chest';
  SELECT id INTO front_delt_id FROM muscle_groups WHERE name = 'Front Delts';
  SELECT id INTO side_delt_id FROM muscle_groups WHERE name = 'Side Delts';
  SELECT id INTO rear_delt_id FROM muscle_groups WHERE name = 'Rear Delts';
  SELECT id INTO triceps_id FROM muscle_groups WHERE name = 'Triceps';
  SELECT id INTO lats_id FROM muscle_groups WHERE name = 'Lats';
  SELECT id INTO upper_back_id FROM muscle_groups WHERE name = 'Upper Back';
  SELECT id INTO biceps_id FROM muscle_groups WHERE name = 'Biceps';
  SELECT id INTO quads_id FROM muscle_groups WHERE name = 'Quads';
  SELECT id INTO hamstrings_id FROM muscle_groups WHERE name = 'Hamstrings';
  SELECT id INTO glutes_id FROM muscle_groups WHERE name = 'Glutes';
  SELECT id INTO lower_back_id FROM muscle_groups WHERE name = 'Lower Back';
  SELECT id INTO spinal_id FROM muscle_groups WHERE name = 'Spinal Erectors';
  SELECT id INTO abs_id FROM muscle_groups WHERE name = 'Abs';

  -- SQUAT
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Barbell Back Squat', 'barbell-back-squat', 'compound', 'squat', 'push', 'intermediate', barbell_id, true)
  RETURNING id INTO squat_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (squat_id, quads_id, 'primary', 85),
  (squat_id, glutes_id, 'primary', 80),
  (squat_id, hamstrings_id, 'secondary', 50),
  (squat_id, spinal_id, 'secondary', 40),
  (squat_id, abs_id, 'tertiary', 30);

  -- BENCH PRESS
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Barbell Bench Press', 'barbell-bench-press', 'compound', 'push', 'push', 'beginner', barbell_id, true)
  RETURNING id INTO bench_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (bench_id, chest_id, 'primary', 90),
  (bench_id, front_delt_id, 'primary', 70),
  (bench_id, triceps_id, 'secondary', 60);

  -- DEADLIFT
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Conventional Deadlift', 'conventional-deadlift', 'compound', 'hinge', 'pull', 'advanced', barbell_id, true)
  RETURNING id INTO deadlift_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (deadlift_id, hamstrings_id, 'primary', 85),
  (deadlift_id, glutes_id, 'primary', 85),
  (deadlift_id, spinal_id, 'primary', 80),
  (deadlift_id, lats_id, 'secondary', 60),
  (deadlift_id, upper_back_id, 'secondary', 70),
  (deadlift_id, quads_id, 'secondary', 50);

  -- OVERHEAD PRESS
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Barbell Overhead Press', 'barbell-overhead-press', 'compound', 'push', 'push', 'intermediate', barbell_id, true)
  RETURNING id INTO ohp_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (ohp_id, front_delt_id, 'primary', 90),
  (ohp_id, side_delt_id, 'primary', 80),
  (ohp_id, triceps_id, 'secondary', 65),
  (ohp_id, upper_back_id, 'tertiary', 40);

  -- BARBELL ROW
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Barbell Bent-Over Row', 'barbell-bent-over-row', 'compound', 'pull', 'pull', 'intermediate', barbell_id, true)
  RETURNING id INTO row_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (row_id, lats_id, 'primary', 85),
  (row_id, upper_back_id, 'primary', 90),
  (row_id, rear_delt_id, 'secondary', 70),
  (row_id, biceps_id, 'secondary', 60),
  (row_id, spinal_id, 'tertiary', 50);

  -- PULL-UP
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Pull-up', 'pull-up', 'compound', 'pull', 'pull', 'intermediate', bodyweight_id, true)
  RETURNING id INTO pullup_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (pullup_id, lats_id, 'primary', 90),
  (pullup_id, biceps_id, 'primary', 80),
  (pullup_id, upper_back_id, 'secondary', 75);

  -- DIP
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Dip', 'dip', 'compound', 'push', 'push', 'intermediate', bodyweight_id, true)
  RETURNING id INTO dip_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (dip_id, chest_id, 'primary', 80),
  (dip_id, triceps_id, 'primary', 90),
  (dip_id, front_delt_id, 'secondary', 60);

  -- LUNGE
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Dumbbell Lunge', 'dumbbell-lunge', 'compound', 'squat', 'push', 'beginner', dumbbell_id, true)
  RETURNING id INTO lunge_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (lunge_id, quads_id, 'primary', 85),
  (lunge_id, glutes_id, 'primary', 80),
  (lunge_id, hamstrings_id, 'secondary', 50);

  -- ROMANIAN DEADLIFT
  INSERT INTO exercises (name, slug, exercise_type, mechanics, force_type, difficulty, primary_equipment_id, is_system)
  VALUES ('Romanian Deadlift', 'romanian-deadlift', 'compound', 'hinge', 'pull', 'intermediate', barbell_id, true)
  RETURNING id INTO rdl_id;

  INSERT INTO exercise_muscles (exercise_id, muscle_group_id, involvement, activation_percentage) VALUES
  (rdl_id, hamstrings_id, 'primary', 90),
  (rdl_id, glutes_id, 'primary', 85),
  (rdl_id, spinal_id, 'secondary', 70),
  (rdl_id, lower_back_id, 'secondary', 60);

  RAISE NOTICE 'System exercises created successfully! 💪';
END $$;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'Seed data loaded successfully! 🌱';
  RAISE NOTICE 'Muscle groups: 21';
  RAISE NOTICE 'Equipment types: 20';
  RAISE NOTICE 'System exercises: 10';
  RAISE NOTICE '================================';
END $$;
