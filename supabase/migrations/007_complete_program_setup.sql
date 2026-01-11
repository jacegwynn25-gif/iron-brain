-- Complete program templates setup for hybrid architecture
-- Run this in Supabase SQL Editor

-- Step 1: Add app_program_id column
ALTER TABLE program_templates ADD COLUMN IF NOT EXISTS app_program_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_program_templates_app_program_id ON program_templates(app_program_id);

-- Step 2: Seed all 10 built-in programs
INSERT INTO program_templates (
  name,
  description,
  goal,
  difficulty,
  duration_weeks,
  days_per_week,
  periodization_type,
  is_system,
  app_program_id
) VALUES
  (
    'Lifting Pro: Bench Specialization',
    '12-week progressive bench press program focused on building max strength through volume, intensity, and specificity',
    'strength',
    'intermediate',
    12,
    4,
    'linear',
    true,
    'lifting_pro_bench_specialization_v1'
  ),
  (
    '5-Day Bench Specialization',
    '4-week bench-focused training block with high frequency (3x/week bench)',
    'strength',
    'intermediate',
    4,
    5,
    'block',
    true,
    'bench_spec_5d_v1'
  ),
  (
    'PHUL (Power Hypertrophy Upper Lower)',
    '4-day split focusing on power (strength) and hypertrophy (size) across upper/lower days',
    'hypertrophy',
    'intermediate',
    12,
    4,
    'custom',
    true,
    'phul_4day_v1'
  ),
  (
    'Upper/Lower 4-Day Split',
    'Classic 4-day upper/lower split for balanced strength and hypertrophy',
    'hypertrophy',
    'beginner',
    12,
    4,
    'linear',
    true,
    'upper_lower_4day_v1'
  ),
  (
    'Wendler 5/3/1',
    'Classic 4-week wave periodization for the big 4 lifts (squat, bench, deadlift, press)',
    'strength',
    'intermediate',
    4,
    4,
    'undulating',
    true,
    'wendler_531_v1'
  ),
  (
    'Starting Strength',
    'Beginner 3-day full-body program focused on linear progression for novice lifters',
    'strength',
    'beginner',
    12,
    3,
    'linear',
    true,
    'starting_strength_v1'
  ),
  (
    'StrongLifts 5x5',
    'Beginner-friendly 5x5 program alternating between two full-body workouts (A/B split)',
    'strength',
    'beginner',
    12,
    3,
    'linear',
    true,
    'stronglifts_5x5_v1'
  ),
  (
    'Push/Pull/Legs (PPL)',
    '6-day split organizing training by movement pattern: push (chest/shoulders/triceps), pull (back/biceps), legs',
    'hypertrophy',
    'intermediate',
    12,
    6,
    'linear',
    true,
    'push_pull_legs_v1'
  ),
  (
    'Bro Split',
    '5-day bodybuilding split dedicating one day to each major muscle group',
    'hypertrophy',
    'beginner',
    12,
    5,
    'linear',
    true,
    'bro_split_v1'
  ),
  (
    'GZCLP (GZCL Linear Progression)',
    '4-day program using tiered progression (T1: main compound, T2: supplemental, T3: accessory)',
    'strength',
    'beginner',
    12,
    4,
    'linear',
    true,
    'gzclp_v1'
  )
ON CONFLICT (app_program_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  goal = EXCLUDED.goal,
  difficulty = EXCLUDED.difficulty,
  duration_weeks = EXCLUDED.duration_weeks,
  days_per_week = EXCLUDED.days_per_week,
  periodization_type = EXCLUDED.periodization_type;

-- Verify
SELECT COUNT(*) as program_count FROM program_templates WHERE is_system = true;
