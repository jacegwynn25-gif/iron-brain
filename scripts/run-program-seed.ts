#!/usr/bin/env tsx

/**
 * Seed program templates into Supabase
 * Programmatic version of migration 007
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const programs = [
  {
    name: 'Lifting Pro: Bench Specialization',
    description: '12-week progressive bench press program focused on building max strength through volume, intensity, and specificity',
    goal: 'strength',
    difficulty: 'intermediate',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'lifting_pro_bench_specialization_v1', author: 'Lifting Pro' },
  },
  {
    name: '5-Day Bench Specialization',
    description: '4-week bench-focused training block with high frequency (3x/week bench)',
    goal: 'strength',
    difficulty: 'intermediate',
    duration_weeks: 4,
    days_per_week: 5,
    periodization_type: 'block',
    is_system: true,
    app_metadata: { app_program_id: 'bench_spec_5d_v1' },
  },
  {
    name: 'PHUL (Power Hypertrophy Upper Lower)',
    description: '4-day split focusing on power (strength) and hypertrophy (size) across upper/lower days',
    goal: 'hypertrophy',
    difficulty: 'intermediate',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'dualfactor',
    is_system: true,
    app_metadata: { app_program_id: 'phul_4day_v1' },
  },
  {
    name: 'Upper/Lower 4-Day Split',
    description: 'Classic 4-day upper/lower split for balanced strength and hypertrophy',
    goal: 'general',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'upper_lower_4day_v1' },
  },
  {
    name: 'Wendler 5/3/1',
    description: 'Classic 4-week wave periodization for the big 4 lifts (squat, bench, deadlift, press)',
    goal: 'strength',
    difficulty: 'intermediate',
    duration_weeks: 4,
    days_per_week: 4,
    periodization_type: 'wave',
    is_system: true,
    app_metadata: { app_program_id: 'wendler_531_v1', author: 'Jim Wendler' },
  },
  {
    name: 'Starting Strength',
    description: 'Beginner 3-day full-body program focused on linear progression for novice lifters',
    goal: 'strength',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 3,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'starting_strength_v1', author: 'Mark Rippetoe' },
  },
  {
    name: 'StrongLifts 5x5',
    description: 'Beginner-friendly 5x5 program alternating between two full-body workouts (A/B split)',
    goal: 'strength',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 3,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'stronglifts_5x5_v1' },
  },
  {
    name: 'Push/Pull/Legs (PPL)',
    description: '6-day split organizing training by movement pattern: push (chest/shoulders/triceps), pull (back/biceps), legs',
    goal: 'hypertrophy',
    difficulty: 'intermediate',
    duration_weeks: 12,
    days_per_week: 6,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'push_pull_legs_v1' },
  },
  {
    name: 'Bro Split',
    description: '5-day bodybuilding split dedicating one day to each major muscle group',
    goal: 'hypertrophy',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 5,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'bro_split_v1' },
  },
  {
    name: 'GZCLP (GZCL Linear Progression)',
    description: '4-day program using tiered progression (T1: main compound, T2: supplemental, T3: accessory)',
    goal: 'strength',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'linear',
    is_system: true,
    app_metadata: { app_program_id: 'gzclp_v1', author: 'Cody Lefever' },
  },
];

async function seedPrograms() {
  console.log('🔄 Seeding program templates...\n');

  for (const program of programs) {
    const { error } = await supabase
      .from('program_templates')
      .upsert(program, {
        onConflict: 'name',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error(`❌ Failed to seed ${program.name}:`, error.message);
    } else {
      console.log(`✅ Seeded: ${program.name}`);
    }
  }

  // Verify
  const { data: templates, error } = await supabase
    .from('program_templates')
    .select('id, name, app_metadata')
    .eq('is_system', true);

  if (error) {
    console.error('\n❌ Could not verify templates:', error.message);
  } else {
    console.log(`\n📊 Total program templates in database: ${templates?.length || 0}`);
  }
}

seedPrograms().catch(console.error);
