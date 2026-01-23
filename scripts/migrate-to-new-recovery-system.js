#!/usr/bin/env node

/**
 * Data Migration: Old Recovery System → New Recovery System
 *
 * Migrates existing workout data to populate fatigue_events table
 * This makes historical data available to the new recovery system
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrateData() {
  console.log('🔄 Migrating workout data to new recovery system...\\n');

  try {
    // Step 1: Get all workout sessions with their sets
    console.log('📊 Fetching workout sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select(`
        id,
        user_id,
        end_time,
        set_logs (
          exercise_id,
          actual_weight,
          actual_reps,
          actual_rpe,
          volume_load,
          actual_seconds,
          rest_seconds,
          completed
        )
      `)
      .not('end_time', 'is', null)
      .order('end_time', { ascending: false })
      .limit(100); // Last 100 sessions

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }

    console.log(`✅ Found ${sessions.length} sessions to migrate\\n`);

    let totalEvents = 0;
    let migratedSessions = 0;

    // Step 2: For each session, create fatigue events
    for (const session of sessions) {
      const completedSets = session.set_logs.filter(s => s.completed);

      if (completedSets.length === 0) {
        console.log(`⏭️  Skipping session ${session.id} (no completed sets)`);
        continue;
      }

      // Group sets by exercise (skip sets with null exercise_id)
      const exerciseMap = new Map();
      for (const set of completedSets) {
        if (!set.exercise_id) {
          console.log(`  ⚠️  Skipping set with null exercise_id in session ${session.id}`);
          continue;
        }
        if (!exerciseMap.has(set.exercise_id)) {
          exerciseMap.set(set.exercise_id, []);
        }
        exerciseMap.get(set.exercise_id).push(set);
      }

      // Skip session if no valid exercises after filtering
      if (exerciseMap.size === 0) {
        console.log(`⏭️  Skipping session ${session.id} (no valid exercise data)`);
        continue;
      }

      // Create fatigue events for each exercise
      const fatigueEvents = [];
      for (const [exerciseId, sets] of exerciseMap.entries()) {
        const totalSets = sets.length;
        const totalReps = sets.reduce((sum, s) => sum + (s.actual_reps || 0), 0);
        const avgWeight = sets.reduce((sum, s) => sum + (s.actual_weight || 0), 0) / totalSets;
        const avgRpe = sets.reduce((sum, s) => sum + (s.actual_rpe || 0), 0) / totalSets;
        const totalVolume = sets.reduce((sum, s) => (s.volume_load || 0) + sum, 0);

        // Calculate effective volume (RPE-weighted)
        const effectiveVolume = sets.reduce((sum, s) => {
          const rpe = s.actual_rpe || 7;
          const rpeMultiplier = rpe >= 9 ? 1.0 : rpe >= 7 ? 0.7 : 0.4;
          return sum + (s.volume_load || 0) * rpeMultiplier;
        }, 0);

        // Estimate initial fatigue from RPE
        const initialFatigue = avgRpe >= 9 ? 80 : avgRpe >= 7 ? 50 : 30;

        // Use exercise_id as exercise_name (it's the actual name in the old system)
        const exerciseName = exerciseId || 'Unknown Exercise';

        fatigueEvents.push({
          user_id: session.user_id,
          timestamp: session.end_time,
          exercise_name: exerciseName,
          sets: totalSets,
          reps: Math.round(totalReps / totalSets),
          weight: Math.round(avgWeight),
          rpe: Math.round(avgRpe * 10) / 10,
          volume: Math.round(totalVolume),
          effective_volume: Math.round(effectiveVolume),
          initial_fatigue: Math.round(initialFatigue),
          set_duration: sets[0]?.actual_seconds || null,
          rest_interval: sets[0]?.rest_seconds || null,
          is_eccentric: false,
          is_ballistic: false
        });
      }

      // Insert events for this session
      if (fatigueEvents.length > 0) {
        const { error: insertError } = await supabase
          .from('fatigue_events')
          .insert(fatigueEvents);

        if (insertError) {
          console.error(`❌ Error inserting events for session ${session.id}:`, insertError.message);
        } else {
          totalEvents += fatigueEvents.length;
          migratedSessions++;
          console.log(`✅ Session ${session.id}: ${fatigueEvents.length} events`);
        }
      }
    }

    console.log('\\n═══════════════════════════════════════════════════════');
    console.log(`🎉 Migration complete!`);
    console.log(`  Sessions migrated: ${migratedSessions}/${sessions.length}`);
    console.log(`  Total fatigue events: ${totalEvents}`);
    console.log('═══════════════════════════════════════════════════════\\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\\nFull error:', error);
    process.exit(1);
  }
}

migrateData();
