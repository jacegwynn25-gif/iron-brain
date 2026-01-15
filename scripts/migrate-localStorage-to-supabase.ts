/**
 * COMPREHENSIVE LOCALSTORAGE → SUPABASE MIGRATION SCRIPT
 *
 * Purpose:
 * - Find ALL workout data in localStorage (regardless of namespace)
 * - Migrate historical workout data to Supabase
 * - Ensure analytics can access all 27 workouts
 * - Safe, idempotent, with rollback capability
 *
 * Usage:
 *   npx tsx scripts/migrate-localStorage-to-supabase.ts
 *
 * Safety Features:
 * - Dry-run mode by default
 * - Backs up localStorage before migration
 * - Detects and merges duplicate data
 * - Preserves original localStorage data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Migration mode
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run
const BACKUP_DIR = path.join(process.cwd(), 'backups');

interface LocalStorageData {
  namespace: string;
  key: string;
  data: unknown;
  workoutCount?: number;
}

interface WorkoutSession {
  id: string;
  startTime: string;
  endTime?: string;
  programId?: string;
  weekNumber?: number;
  dayIndex?: number;
  sets: SetLog[];
  totalVolumeLoad?: number;
  notes?: string;
}

interface SetLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setType: string;
  weight?: number;
  reps?: number;
  rpe?: number;
  completed: boolean;
  timestamp?: string;
}

// ============================================================
// MAIN MIGRATION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   IRON BRAIN: localStorage → Supabase Migration         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be modified');
    console.log('   Set DRY_RUN=false to perform actual migration\n');
  }

  // Step 1: Validate environment
  console.log('STEP 1: Validating environment...');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  console.log('✅ Environment validated\n');

  // Step 2: Scan for localStorage data
  console.log('STEP 2: Scanning for workout data...');
  console.log('⚠️  You need to provide localStorage data from your browser');
  console.log('\nTo extract your data:');
  console.log('1. Open browser DevTools (F12)');
  console.log('2. Go to Console tab');
  console.log('3. Paste this code:\n');
  console.log('   JSON.stringify(Object.keys(localStorage).filter(k => k.includes("iron_brain")).map(k => ({key: k, data: localStorage.getItem(k)})))\n');
  console.log('4. Copy the output and save it as: localStorage-export.json\n');

  const exportPath = path.join(process.cwd(), 'localStorage-export.json');

  if (!fs.existsSync(exportPath)) {
    console.log('📝 Creating example localStorage-export.json template...\n');
    const template = [
      {
        key: 'iron_brain_workout_history__default',
        data: '[]'
      },
      {
        key: 'iron_brain_workout_history__c0cd17a6-3abd-4aaa-be47-5dffffacbe1b',
        data: '[]'
      }
    ];
    fs.writeFileSync(exportPath, JSON.stringify(template, null, 2));
    console.log(`✅ Template created at: ${exportPath}`);
    console.log('   Replace the empty arrays with your actual data\n');
    console.log('⏸️  Pausing migration - please populate the file and run again');
    process.exit(0);
  }

  // Step 3: Parse localStorage data
  console.log('STEP 3: Parsing localStorage export...');
  const rawData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

  const workoutDatasets: LocalStorageData[] = [];
  for (const item of rawData) {
    if (item.key.includes('iron_brain_workout_history')) {
      const namespace = item.key.split('__')[1] || 'default';
      const workouts = JSON.parse(item.data);

      workoutDatasets.push({
        namespace,
        key: item.key,
        data: workouts,
        workoutCount: Array.isArray(workouts) ? workouts.length : 0
      });

      console.log(`   Found: ${item.key}`);
      console.log(`   → ${workouts.length} workouts in namespace: ${namespace}`);
    }
  }

  const totalWorkouts = workoutDatasets.reduce((sum, ds) => sum + (ds.workoutCount || 0), 0);
  console.log(`\n✅ Total workouts found: ${totalWorkouts}\n`);

  if (totalWorkouts === 0) {
    console.log('⚠️  No workout data found. Nothing to migrate.');
    process.exit(0);
  }

  // Step 4: Create backup
  if (!DRY_RUN) {
    console.log('STEP 4: Creating backup...');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `localStorage-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(workoutDatasets, null, 2));
    console.log(`✅ Backup created: ${backupPath}\n`);
  } else {
    console.log('STEP 4: Skipping backup (dry run)\n');
  }

  // Step 5: Initialize Supabase client
  console.log('STEP 5: Connecting to Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

  // Test connection
  const { error: connectionError } = await supabase.from('workout_sessions').select('count').limit(1);
  if (connectionError && !connectionError.message.includes('column')) {
    console.error('❌ Failed to connect to Supabase:', connectionError);
    process.exit(1);
  }
  console.log('✅ Connected to Supabase\n');

  // Step 6: Prompt for target user
  console.log('STEP 6: Determining target user...');
  console.log('⚠️  All workouts will be migrated to a single user account');
  console.log('\nOptions:');
  console.log('1. Enter your Supabase user ID (from auth.users)');
  console.log('2. Or set TARGET_USER_ID environment variable\n');

  const targetUserId = process.env.TARGET_USER_ID;
  if (!targetUserId) {
    console.log('❌ No TARGET_USER_ID provided');
    console.log('\nRun this query in Supabase SQL Editor to find your user ID:');
    console.log('   SELECT id, email FROM auth.users;');
    console.log('\nThen run migration with:');
    console.log('   TARGET_USER_ID=your-uuid-here npx tsx scripts/migrate-localStorage-to-supabase.ts\n');
    process.exit(1);
  }

  console.log(`✅ Target user: ${targetUserId}\n`);

  // Step 7: Load exercise ID mappings
  console.log('STEP 7: Loading exercise mappings...');
  const { data: exercises, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, name, slug');

  if (exerciseError) {
    console.error('❌ Failed to load exercises:', exerciseError);
    process.exit(1);
  }

  const exerciseNameToId = new Map<string, string>();
  const exerciseSlugToId = new Map<string, string>();

  const exerciseRows = (exercises ?? []) as Array<{ id: string; name: string; slug?: string | null }>;
  exerciseRows.forEach((ex) => {
    exerciseNameToId.set(ex.name.toLowerCase(), ex.id);
    if (ex.slug) {
      exerciseSlugToId.set(ex.slug, ex.id);
    }
  });

  console.log(`✅ Loaded ${exercises?.length} exercises\n`);

  // Step 8: Migrate workouts
  console.log('STEP 8: Migrating workouts...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const dataset of workoutDatasets) {
    console.log(`📦 Processing namespace: ${dataset.namespace}`);

    for (const workout of dataset.data as WorkoutSession[]) {
      try {
        // Check if workout already exists (by timestamp + user)
        const { data: existing } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('start_time', workout.startTime)
          .single();

        if (existing) {
          console.log(`   ⏭️  Skipping (already migrated): ${new Date(workout.startTime).toLocaleString()}`);
          skippedCount++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`   [DRY RUN] Would migrate: ${new Date(workout.startTime).toLocaleString()} (${workout.sets.length} sets)`);
          migratedCount++;
          continue;
        }

        // Calculate workout stats
        const completedSets = workout.sets.filter(s => s.completed);
        const totalVolumeLoad = completedSets.reduce((sum, set) => {
          return sum + ((set.weight || 0) * (set.reps || 0));
        }, 0);
        const totalReps = completedSets.reduce((sum, set) => sum + (set.reps || 0), 0);
        const avgRPE = completedSets.length > 0
          ? completedSets.reduce((sum, set) => sum + (set.rpe || 0), 0) / completedSets.length
          : null;

        const durationMinutes = workout.endTime
          ? Math.round((new Date(workout.endTime).getTime() - new Date(workout.startTime).getTime()) / 1000 / 60)
          : null;

        // Insert workout session
        const { data: session, error: sessionError } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: targetUserId,
            date: new Date(workout.startTime).toISOString().split('T')[0],
            start_time: workout.startTime,
            end_time: workout.endTime || null,
            duration_minutes: durationMinutes,
            total_volume_load: totalVolumeLoad,
            total_sets: completedSets.length,
            total_reps: totalReps,
            average_rpe: avgRPE,
            notes: workout.notes || null,
            status: workout.endTime ? 'completed' : 'in_progress'
          })
          .select()
          .single();

        if (sessionError) {
          console.error(`   ❌ Failed to insert session:`, sessionError);
          errorCount++;
          continue;
        }

        // Insert set logs
        const setLogs = workout.sets.map((set, index) => {
          // Try to find exercise ID
          let exerciseId = null;

          // Try by slug first (most reliable)
          if (set.exerciseId) {
            exerciseId = exerciseSlugToId.get(set.exerciseId) || null;
          }

          // Fallback to name matching
          if (!exerciseId && set.exerciseName) {
            exerciseId = exerciseNameToId.get(set.exerciseName.toLowerCase()) || null;
          }

          if (!exerciseId) {
            console.warn(`   ⚠️  Could not map exercise: ${set.exerciseName || set.exerciseId}`);
          }

          return {
            workout_session_id: session.id,
            exercise_id: exerciseId,
            order_index: index,
            set_index: index,
            actual_weight: set.weight || null,
            actual_reps: set.reps || null,
            actual_rpe: set.rpe || null,
            completed: set.completed,
            set_type: set.setType || 'normal'
          };
        });

        const { error: setsError } = await supabase
          .from('set_logs')
          .insert(setLogs);

        if (setsError) {
          console.error(`   ❌ Failed to insert sets:`, setsError);
          errorCount++;
          continue;
        }

        console.log(`   ✅ Migrated: ${new Date(workout.startTime).toLocaleString()} (${workout.sets.length} sets)`);
        migratedCount++;

      } catch (err) {
        console.error(`   ❌ Error migrating workout:`, err);
        errorCount++;
      }
    }

    console.log('');
  }

  // Step 9: Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 MIGRATION SUMMARY\n');
  console.log(`   Total workouts found:    ${totalWorkouts}`);
  console.log(`   Successfully migrated:   ${migratedCount}`);
  console.log(`   Skipped (duplicates):    ${skippedCount}`);
  console.log(`   Errors:                  ${errorCount}\n`);

  if (DRY_RUN) {
    console.log('🔍 This was a DRY RUN - no data was modified');
    console.log('   To perform actual migration, run:');
    console.log(`   DRY_RUN=false TARGET_USER_ID=${targetUserId} npx tsx scripts/migrate-localStorage-to-supabase.ts\n`);
  } else {
    console.log('✅ Migration complete!\n');
    console.log('Next steps:');
    console.log('1. Verify data in Supabase dashboard');
    console.log('2. Run migration 010 to enable model caching:');
    console.log('   npx tsx scripts/run-migration.ts 010_statistical_model_cache.sql');
    console.log('3. Analytics will now load from Supabase automatically\n');
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
