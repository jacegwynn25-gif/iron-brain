'use client';

import { supabase } from './client';
import { storage } from '../storage';
import { logger } from '../logger';
import type { WorkoutSession } from '../types';
import { isMissingPrescribedWeightColumn, stripPrescribedWeight } from './set-log-schema';
import { calculateSetE1RMLbs, calculateSetVolumeLbs } from '../stats/set-metrics';

/**
 * Automatic Cloud Sync System
 *
 * Handles:
 * - Retroactive sync of old localStorage workouts when user logs in
 * - Automatic sync of new workouts
 * - Sync status tracking
 * - Conflict resolution (Supabase wins)
 */

interface SyncStatus {
  totalWorkouts: number;
  syncedWorkouts: number;
  pendingWorkouts: number;
  lastSyncTime: string | null;
  isSyncing: boolean;
  errors: string[];
}

const SYNC_STATUS_KEY = 'iron-brain:sync-status';
const SYNCED_WORKOUT_IDS_KEY = 'iron-brain:synced-workout-ids';

/**
 * Get current sync status
 */
function getSyncStatus(): SyncStatus {
  try {
    const stored = localStorage.getItem(SYNC_STATUS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    logger.debug('Failed to load sync status:', err);
  }

  return {
    totalWorkouts: 0,
    syncedWorkouts: 0,
    pendingWorkouts: 0,
    lastSyncTime: null,
    isSyncing: false,
    errors: []
  };
}

/**
 * Update sync status
 */
function updateSyncStatus(updates: Partial<SyncStatus>) {
  const current = getSyncStatus();
  const updated = { ...current, ...updates };
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));

  // Dispatch event so UI can update
  window.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: updated }));
}

/**
 * Get set of workout IDs that have been synced to Supabase
 */
function getSyncedWorkoutIds(): Set<string> {
  try {
    const stored = localStorage.getItem(SYNCED_WORKOUT_IDS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (err) {
    logger.debug('Failed to load synced IDs:', err);
  }
  return new Set();
}

function normalizeWorkoutId(workoutId: string): string {
  return workoutId.startsWith('session_') ? workoutId.substring(8) : workoutId;
}

/**
 * Mark workout as synced
 */
function markWorkoutAsSynced(workoutId: string) {
  const syncedIds = getSyncedWorkoutIds();
  syncedIds.add(workoutId);
  syncedIds.add(normalizeWorkoutId(workoutId));
  localStorage.setItem(SYNCED_WORKOUT_IDS_KEY, JSON.stringify([...syncedIds]));
}

import { resolveExerciseIds } from './workouts';

/**
 * Upload a single workout to Supabase
 */
async function uploadWorkout(workout: WorkoutSession, userId: string): Promise<boolean> {
  try {
    // Extract UUID from app ID (remove "session_" prefix if present)
    const workoutUuid = workout.id.startsWith('session_')
      ? workout.id.substring(8) // Remove "session_" prefix
      : workout.id;

    // Prepare workout data
    const workoutName = workout.dayName || workout.programName || 'Workout';
    const workoutData = {
      id: workoutUuid, // Use UUID without prefix for Postgres
      user_id: userId,
      name: workoutName,
      date: workout.date,
      start_time: workout.startTime,
      end_time: workout.endTime,
      duration_minutes: workout.durationMinutes,
      bodyweight: workout.bodyweight,
      notes: workout.notes,
      status: 'completed',
      metadata: {
        programId: workout.programId,
        programName: workout.programName,
        cycleNumber: workout.cycleNumber,
        weekNumber: workout.weekNumber,
        dayOfWeek: workout.dayOfWeek,
        dayName: workout.dayName,
      }
    };

    logger.debug('Uploading workout data:', workoutData);

    // Insert workout session
    const { error: sessionError } = await supabase
      .from('workout_sessions')
      .upsert(workoutData)
      .select()
      .single();

    if (sessionError) {
      console.error(`Failed to sync workout ${workout.id}:`, {
        error: sessionError,
        workout: workoutData,
        message: sessionError.message,
        details: sessionError.details,
        hint: sessionError.hint,
        code: sessionError.code
      });
      logger.debug(`Failed to sync workout ${workout.id}:`, sessionError);
      return false;
    }

    // Delete existing set logs for this workout (in case of re-sync)
    await supabase
      .from('set_logs')
      .delete()
      .eq('workout_session_id', workoutUuid);

    // Resolve exercise UUIDs for Sets
    const exerciseRefs = Array.from(new Set(workout.sets?.map(s => s.exerciseId).filter(Boolean)));
    const exerciseIdByRef = await resolveExerciseIds(supabase, exerciseRefs as string[]);

    // Insert set logs
    if (workout.sets && workout.sets.length > 0) {
      const setLogs = workout.sets.map((set, index) => {
        const skipped = set.skipped === true || set.completed === false;
        return {
          workout_session_id: workoutUuid,
          exercise_id: exerciseIdByRef.get(set.exerciseId) || null, // correctly assign resolved UUID
          exercise_slug: set.exerciseId,
          order_index: index, // Position in workout (required NOT NULL field)
          set_index: set.setIndex ? Math.round(Number(set.setIndex)) : index + 1,
          // Prescribed values - reps is string in DB, RPE/RIR are decimals
          prescribed_reps: set.prescribedReps != null ? Math.round(Number(set.prescribedReps)).toString() : null,
          prescribed_rpe: set.prescribedRPE != null ? Number(set.prescribedRPE) : null,
          prescribed_rir: set.prescribedRIR != null ? Number(set.prescribedRIR) : null,
          prescribed_percentage: set.prescribedPercentage,
          prescribed_weight: set.prescribedWeight != null ? Number(set.prescribedWeight) : null,
          // Actual values - reps is integer, RPE/RIR are decimals
          actual_weight: skipped ? null : set.actualWeight,
          weight_unit: set.weightUnit === 'kg' ? 'kg' : 'lbs',
          actual_reps: skipped || set.actualReps == null ? null : Math.round(Number(set.actualReps)),
          actual_rpe: skipped || set.actualRPE == null ? null : Number(set.actualRPE),
          actual_rir: skipped || set.actualRIR == null ? null : Number(set.actualRIR),
          tempo: set.tempo,
          completed: set.completed === true && !skipped,
          skipped,
          e1rm: skipped ? null : calculateSetE1RMLbs(set),
          volume_load: (() => {
            if (skipped) return null;
            const volume = calculateSetVolumeLbs(set);
            return volume == null ? null : Math.round(volume);
          })(),
          rest_seconds: set.restTakenSeconds != null ? Math.round(Number(set.restTakenSeconds)) : null,
          actual_seconds: set.setDurationSeconds != null ? Math.round(Number(set.setDurationSeconds)) : null,
          notes: set.notes,
          set_type: set.setType || 'straight',
        };
      });

      let { error: setsError } = await supabase
        .from('set_logs')
        .insert(setLogs);

      if (isMissingPrescribedWeightColumn(setsError)) {
        const retry = await supabase
          .from('set_logs')
          .insert(stripPrescribedWeight(setLogs));
        setsError = retry.error;
      }

      if (setsError) {
        console.error(`Failed to sync sets for workout ${workout.id}:`, setsError);
        logger.debug(`Failed to sync sets for workout ${workout.id}:`, setsError);
        return false;
      }
    }

    markWorkoutAsSynced(workout.id);
    logger.debug(`✅ Synced workout ${workout.id} to Supabase`);
    return true;

  } catch (err) {
    logger.debug(`Error syncing workout ${workout.id}:`, err);
    return false;
  }
}

/**
 * Sync all unsynced workouts to Supabase
 * Called automatically when user logs in
 */
export async function syncPendingWorkouts(userId: string): Promise<void> {
  const localWorkouts = storage.getWorkoutHistory();
  const syncedIds = getSyncedWorkoutIds();

  const pendingWorkouts = localWorkouts.filter(w => !syncedIds.has(w.id) && !syncedIds.has(normalizeWorkoutId(w.id)));

  if (pendingWorkouts.length === 0) {
    logger.debug('No pending workouts to sync');
    updateSyncStatus({
      totalWorkouts: localWorkouts.length,
      syncedWorkouts: localWorkouts.length,
      pendingWorkouts: 0,
      lastSyncTime: new Date().toISOString(),
    });
    return;
  }

  logger.debug(`Syncing ${pendingWorkouts.length} pending workouts...`);

  updateSyncStatus({
    isSyncing: true,
    totalWorkouts: localWorkouts.length,
    pendingWorkouts: pendingWorkouts.length,
  });

  let successCount = 0;
  const errors: string[] = [];

  for (const workout of pendingWorkouts) {
    try {
      const success = await uploadWorkout(workout, userId);
      if (success) {
        successCount++;
      } else {
        const errorMsg = `Failed to sync workout from ${workout.date} (${workout.programName})`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const errorMsg = `Error syncing workout from ${workout.date}: ${message}`;
      errors.push(errorMsg);
      console.error(errorMsg, err);
    }

    // Update progress
    updateSyncStatus({
      syncedWorkouts: syncedIds.size + successCount,
      pendingWorkouts: pendingWorkouts.length - successCount,
    });
  }

  updateSyncStatus({
    isSyncing: false,
    syncedWorkouts: syncedIds.size + successCount,
    pendingWorkouts: pendingWorkouts.length - successCount,
    lastSyncTime: new Date().toISOString(),
    errors,
  });

  logger.debug(`✅ Sync complete: ${successCount}/${pendingWorkouts.length} successful`);
}
