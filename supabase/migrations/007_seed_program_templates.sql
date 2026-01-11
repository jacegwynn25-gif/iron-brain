-- Seed built-in program templates with metadata
-- This enables future program_set_id mapping while keeping programs as JS objects (hybrid approach)

-- Insert the 10 built-in program templates
INSERT INTO program_templates (
  name,
  description,
  goal,
  difficulty,
  duration_weeks,
  days_per_week,
  periodization_type,
  is_system,
  app_metadata
) VALUES
  -- 1. Lifting Pro Bench Specialization
  (
    'Lifting Pro: Bench Specialization',
    '12-week progressive bench press program focused on building max strength through volume, intensity, and specificity',
    'strength',
    'intermediate',
    12,
    4,
    'linear',
    true,
    '{"app_program_id": "lifting_pro_bench_specialization_v1", "author": "Lifting Pro"}'::jsonb
  ),
  -- 2. 5-Day Bench Specialization
  (
    '5-Day Bench Specialization',
    '4-week bench-focused training block with high frequency (3x/week bench)',
    'strength',
    'intermediate',
    4,
    5,
    'block',
    true,
    '{"app_program_id": "bench_spec_5d_v1"}'::jsonb
  ),
  -- 3. PHUL (Power Hypertrophy Upper Lower)
  (
    'PHUL (Power Hypertrophy Upper Lower)',
    '4-day split focusing on power (strength) and hypertrophy (size) across upper/lower days',
    'hypertrophy',
    'intermediate',
    12,
    4,
    'dualfactor',
    true,
    '{"app_program_id": "phul_4day_v1"}'::jsonb
  ),
  -- 4. Upper/Lower 4-Day Split
  (
    'Upper/Lower 4-Day Split',
    'Classic 4-day upper/lower split for balanced strength and hypertrophy',
    'general',
    'beginner',
    12,
    4,
    'linear',
    true,
    '{"app_program_id": "upper_lower_4day_v1"}'::jsonb
  ),
  -- 5. Wendler 5/3/1
  (
    'Wendler 5/3/1',
    'Classic 4-week wave periodization for the big 4 lifts (squat, bench, deadlift, press)',
    'strength',
    'intermediate',
    4,
    4,
    'wave',
    true,
    '{"app_program_id": "wendler_531_v1", "author": "Jim Wendler"}'::jsonb
  ),
  -- 6. Starting Strength
  (
    'Starting Strength',
    'Beginner 3-day full-body program focused on linear progression for novice lifters',
    'strength',
    'beginner',
    12,
    3,
    'linear',
    true,
    '{"app_program_id": "starting_strength_v1", "author": "Mark Rippetoe"}'::jsonb
  ),
  -- 7. StrongLifts 5x5
  (
    'StrongLifts 5x5',
    'Beginner-friendly 5x5 program alternating between two full-body workouts (A/B split)',
    'strength',
    'beginner',
    12,
    3,
    'linear',
    true,
    '{"app_program_id": "stronglifts_5x5_v1"}'::jsonb
  ),
  -- 8. Push/Pull/Legs (PPL)
  (
    'Push/Pull/Legs (PPL)',
    '6-day split organizing training by movement pattern: push (chest/shoulders/triceps), pull (back/biceps), legs',
    'hypertrophy',
    'intermediate',
    12,
    6,
    'linear',
    true,
    '{"app_program_id": "push_pull_legs_v1"}'::jsonb
  ),
  -- 9. Bro Split
  (
    'Bro Split',
    '5-day bodybuilding split dedicating one day to each major muscle group',
    'hypertrophy',
    'beginner',
    12,
    5,
    'linear',
    true,
    '{"app_program_id": "bro_split_v1"}'::jsonb
  ),
  -- 10. GZCLP (Cody Lefever)
  (
    'GZCLP (GZCL Linear Progression)',
    '4-day program using tiered progression (T1: main compound, T2: supplemental, T3: accessory)',
    'strength',
    'beginner',
    12,
    4,
    'linear',
    true,
    '{"app_program_id": "gzclp_v1", "author": "Cody Lefever"}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Verify insertion
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM program_templates WHERE is_system = true;
  RAISE NOTICE 'Seeded % program templates', template_count;
END $$;
