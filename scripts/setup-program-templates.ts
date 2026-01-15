#!/usr/bin/env tsx

/**
 * Complete setup for program templates:
 * 1. Add app_metadata column
 * 2. Seed all 10 built-in programs
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
    app_program_id: 'lifting_pro_bench_specialization_v1',
    author: 'Lifting Pro',
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
    app_program_id: 'bench_spec_5d_v1',
  },
  {
    name: 'PHUL (Power Hypertrophy Upper Lower)',
    description: '4-day split focusing on power (strength) and hypertrophy (size) across upper/lower days',
    goal: 'hypertrophy',
    difficulty: 'intermediate',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'custom',
    is_system: true,
    app_program_id: 'phul_4day_v1',
  },
  {
    name: 'Upper/Lower 4-Day Split',
    description: 'Classic 4-day upper/lower split for balanced strength and hypertrophy',
    goal: 'hypertrophy',
    difficulty: 'beginner',
    duration_weeks: 12,
    days_per_week: 4,
    periodization_type: 'linear',
    is_system: true,
    app_program_id: 'upper_lower_4day_v1',
  },
  {
    name: 'Wendler 5/3/1',
    description: 'Classic 4-week wave periodization for the big 4 lifts (squat, bench, deadlift, press)',
    goal: 'strength',
    difficulty: 'intermediate',
    duration_weeks: 4,
    days_per_week: 4,
    periodization_type: 'undulating',
    is_system: true,
    app_program_id: 'wendler_531_v1',
    author: 'Jim Wendler',
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
    app_program_id: 'starting_strength_v1',
    author: 'Mark Rippetoe',
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
    app_program_id: 'stronglifts_5x5_v1',
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
    app_program_id: 'push_pull_legs_v1',
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
    app_program_id: 'bro_split_v1',
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
    app_program_id: 'gzclp_v1',
    author: 'Cody Lefever',
  },
];

async function setup() {
  console.log('🔄 Step 1: Checking for app_program_id column...\n');

  // Check if column exists by trying to select it
  const { error: checkError } = await supabase
    .from('program_templates')
    .select('app_program_id')
    .limit(1);

  if (checkError && checkError.message.includes('column')) {
    console.log('⚠️  app_program_id column does not exist');
    console.log('📝 Please run this SQL in your Supabase SQL Editor:\n');
    console.log('ALTER TABLE program_templates ADD COLUMN app_program_id TEXT;');
    console.log('CREATE INDEX idx_program_templates_app_program_id ON program_templates(app_program_id);\n');
    console.log('Then run this script again.');
    process.exit(1);
  }

  console.log('✅ Column exists!\n');
  console.log('🔄 Step 2: Seeding program templates...\n');

  for (const program of programs) {
    const { error } = await supabase
      .from('program_templates')
      .upsert(
        {
          name: program.name,
          description: program.description,
          goal: program.goal,
          difficulty: program.difficulty,
          duration_weeks: program.duration_weeks,
          days_per_week: program.days_per_week,
          periodization_type: program.periodization_type,
          is_system: program.is_system,
          app_program_id: program.app_program_id,
        },
        {
          onConflict: 'app_program_id',
          ignoreDuplicates: false,
        }
      )
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
    .select('id, name, app_program_id')
    .eq('is_system', true);

  if (error) {
    console.error('\n❌ Could not verify templates:', error.message);
  } else {
    console.log(`\n📊 Total program templates in database: ${templates?.length || 0}`);
    if (templates && templates.length > 0) {
      console.log('\n✅ Setup complete! Program templates:');
      const templateRows = templates as Array<{ name: string; app_program_id?: string | null }>;
      templateRows.forEach((t) => {
        console.log(`  - ${t.name} (${t.app_program_id})`);
      });
    }
  }
}

setup().catch(console.error);
