#!/usr/bin/env node

/**
 * Seed Test Data for Recovery System
 * Automatically seeds demographics, context data, and workout history
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedTestData() {
  console.log('🌱 Seeding test data for recovery system...\n');

  // Step 1: Get or create test user
  console.log('👤 Step 1: Finding test user...');
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users || users.users.length === 0) {
    console.error('❌ No users found. Please create a user account first.');
    console.log('   Go to: https://supabase.com/dashboard and create a test user\n');
    process.exit(1);
  }

  const testUser = users.users[0];
  const userId = testUser.id;
  console.log(`✅ Using user: ${testUser.email} (${userId})\n`);

  // Step 2: Seed demographics
  console.log('📊 Step 2: Seeding user demographics...');
  const { error: demoError } = await supabase
    .from('user_demographics')
    .upsert({
      user_id: userId,
      age: 28,
      sex: 'male',
      training_age: 3,
      athletic_background: 'intermediate',
      bodyweight: 75,
      height: 178,
      current_injuries: [],
      chronic_conditions: []
    }, {
      onConflict: 'user_id'
    });

  if (demoError) {
    console.error('❌ Failed to seed demographics:', demoError.message);
    process.exit(1);
  }
  console.log('✅ Demographics seeded\n');

  // Step 3: Seed context data (last 7 days)
  console.log('🛏️  Step 3: Seeding context data (last 7 days)...');
  const today = new Date();
  const contextData = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    contextData.push({
      user_id: userId,
      date: date.toISOString().split('T')[0],
      sleep_hours: 7 + Math.random() * 2, // 7-9 hours
      sleep_quality: ['good', 'excellent', 'fair'][Math.floor(Math.random() * 3)],
      sleep_interruptions: Math.floor(Math.random() * 2),
      protein_intake: 1.8 + Math.random() * 0.4, // 1.8-2.2 g/kg
      carb_intake: 3.5 + Math.random() * 1.0, // 3.5-4.5 g/kg
      calorie_balance: 'maintenance',
      hydration_level: ['good', 'excellent'][Math.floor(Math.random() * 2)],
      meal_timing: 'good',
      work_stress: 3 + Math.floor(Math.random() * 3), // 3-5
      life_stress: 2 + Math.floor(Math.random() * 3), // 2-4
      perceived_stress: 3 + Math.floor(Math.random() * 3) // 3-5
    });
  }

  const { error: contextError } = await supabase
    .from('user_context_data')
    .upsert(contextData, {
      onConflict: 'user_id,date'
    });

  if (contextError) {
    console.error('❌ Failed to seed context data:', contextError.message);
    process.exit(1);
  }
  console.log(`✅ ${contextData.length} days of context data seeded\n`);

  // Step 4: Seed workout history
  console.log('💪 Step 4: Seeding workout history (last 7 days)...');

  const workouts = [
    // Day 1: Chest/Triceps (Yesterday)
    { daysAgo: 1, exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: 8, weight: 225, rpe: 8, volume: 7200, effective: 5040, fatigue: 60 },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10, weight: 70, rpe: 7, volume: 2100, effective: 1470, fatigue: 50 },
      { name: 'Cable Flyes', sets: 3, reps: 12, weight: 30, rpe: 6, volume: 1080, effective: 324, fatigue: 30 },
      { name: 'Tricep Pushdowns', sets: 3, reps: 12, weight: 60, rpe: 7, volume: 2160, effective: 1512, fatigue: 45 }
    ]},
    // Day 3: Legs (3 days ago)
    { daysAgo: 3, exercises: [
      { name: 'Barbell Back Squat', sets: 5, reps: 6, weight: 315, rpe: 9, volume: 9450, effective: 9450, fatigue: 90 },
      { name: 'Romanian Deadlift', sets: 4, reps: 8, weight: 225, rpe: 8, volume: 7200, effective: 5040, fatigue: 70 },
      { name: 'Leg Press', sets: 3, reps: 12, weight: 400, rpe: 7, volume: 14400, effective: 10080, fatigue: 55 },
      { name: 'Hamstring Curls', sets: 3, reps: 12, weight: 90, rpe: 6, volume: 3240, effective: 972, fatigue: 35 }
    ]},
    // Day 5: Back/Biceps (5 days ago)
    { daysAgo: 5, exercises: [
      { name: 'Conventional Deadlift', sets: 4, reps: 5, weight: 405, rpe: 9, volume: 8100, effective: 8100, fatigue: 85 },
      { name: 'Barbell Rows', sets: 4, reps: 8, weight: 185, rpe: 8, volume: 5920, effective: 4144, fatigue: 65 },
      { name: 'Pull-Ups', sets: 4, reps: 10, weight: 0, rpe: 7, volume: 0, effective: 0, fatigue: 50 },
      { name: 'Barbell Curls', sets: 3, reps: 10, weight: 80, rpe: 6, volume: 2400, effective: 720, fatigue: 35 }
    ]},
    // Day 7: Shoulders (7 days ago)
    { daysAgo: 7, exercises: [
      { name: 'Barbell Overhead Press', sets: 4, reps: 6, weight: 135, rpe: 8, volume: 3240, effective: 2268, fatigue: 70 },
      { name: 'Dumbbell Lateral Raises', sets: 3, reps: 12, weight: 25, rpe: 6, volume: 900, effective: 270, fatigue: 30 },
      { name: 'Face Pulls', sets: 3, reps: 15, weight: 50, rpe: 5, volume: 2250, effective: 450, fatigue: 25 }
    ]}
  ];

  const fatigueEvents = [];
  for (const workout of workouts) {
    const workoutDate = new Date(today);
    workoutDate.setDate(workoutDate.getDate() - workout.daysAgo);

    for (const exercise of workout.exercises) {
      fatigueEvents.push({
        user_id: userId,
        timestamp: workoutDate.toISOString(),
        exercise_name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rpe: exercise.rpe,
        volume: exercise.volume,
        effective_volume: exercise.effective,
        initial_fatigue: exercise.fatigue
      });
    }
  }

  const { error: fatigueError } = await supabase
    .from('fatigue_events')
    .insert(fatigueEvents);

  if (fatigueError) {
    console.error('❌ Failed to seed fatigue events:', fatigueError.message);
    process.exit(1);
  }
  console.log(`✅ ${fatigueEvents.length} fatigue events seeded\n`);

  // Step 5: Verify data
  console.log('🔍 Step 5: Verifying seeded data...');

  const { data: acwr } = await supabase.rpc('calculate_acwr', { p_user_id: userId });
  console.log(`   ACWR: ${acwr ? acwr.toFixed(2) : 'N/A'}`);

  const { data: workoutHistory } = await supabase.rpc('get_workout_history_for_recovery', {
    p_user_id: userId,
    p_days_back: 30
  });
  console.log(`   Workout history: ${workoutHistory?.length || 0} events`);

  const { data: contextRows } = await supabase
    .from('user_context_data')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  console.log(`   Context data: ${contextRows?.length || 0} days\n`);

  console.log('🎉 TEST DATA SEEDING COMPLETE!\n');
  console.log('Next steps:');
  console.log('1. Run dev server: npm run dev');
  console.log('2. Sign in with:', testUser.email);
  console.log('3. Navigate to workout and check PreWorkoutReadiness\n');
}

seedTestData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
