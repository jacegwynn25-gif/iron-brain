'use client';

import { supabase } from './supabase/client';
import { storage } from './storage';
import { logger } from './logger';
import type { WorkoutSession } from './types';

/**
 * Workout Trash Management System
 *
 * Implements soft-delete with recovery:
 * - Deleted workouts go to trash (marked with deleted_at timestamp)
 * - Users can restore within 30 days
 * - Auto-purge after 30 days
 */

const TRASH_KEY = 'iron-brain:trash';
const TRASH_RETENTION_DAYS = 30;

export interface DeletedWorkout {
  workout: WorkoutSession;
  deletedAt: string; // ISO timestamp
}

/**
 * Get all workouts in trash (not yet permanently deleted)
 */
export function getTrash(): DeletedWorkout[] {
  try {
    const data = localStorage.getItem(TRASH_KEY);
    if (!data) return [];

    const trash: DeletedWorkout[] = JSON.parse(data);

    // Auto-purge old items (older than 30 days)
    const now = new Date();
    const retentionMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const filtered = trash.filter(item => {
      const deletedTime = new Date(item.deletedAt).getTime();
      const age = now.getTime() - deletedTime;
      return age < retentionMs;
    });

    // Save filtered list if anything was purged
    if (filtered.length !== trash.length) {
      localStorage.setItem(TRASH_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch (err) {
    logger.debug('Failed to load trash:', err);
    return [];
  }
}

/**
 * Soft delete: Move workout to trash
 *
 * @param workoutId - ID of workout to delete
 * @returns true if successful
 */
export async function moveToTrash(workoutId: string): Promise<boolean> {
  try {
    // Get the workout before deleting
    const workout = storage.getWorkoutById(workoutId);
    if (!workout) {
      logger.debug('Workout not found:', workoutId);
      return false;
    }

    // Add to trash
    const trash = getTrash();
    trash.push({
      workout,
      deletedAt: new Date().toISOString()
    });
    localStorage.setItem(TRASH_KEY, JSON.stringify(trash));

    // Remove from history
    const history = storage.getWorkoutHistory();
    const filtered = history.filter(w => w.id !== workoutId);
    storage.setWorkoutHistory(filtered);

    // Soft delete in Supabase (mark with deleted_at timestamp)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase
        .from('workout_sessions') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', workoutId)
        .eq('user_id', user.id);

      logger.debug(`✅ Moved workout ${workoutId} to trash`);
    }

    return true;
  } catch (err) {
    logger.debug('Failed to move workout to trash:', err);
    return false;
  }
}

/**
 * Restore workout from trash
 *
 * @param workoutId - ID of workout to restore
 * @returns true if successful
 */
export async function restoreFromTrash(workoutId: string): Promise<boolean> {
  try {
    const trash = getTrash();
    const item = trash.find(t => t.workout.id === workoutId);

    if (!item) {
      logger.debug('Workout not found in trash:', workoutId);
      return false;
    }

    // Remove from trash
    const updatedTrash = trash.filter(t => t.workout.id !== workoutId);
    localStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));

    // Add back to history
    const history = storage.getWorkoutHistory();
    history.push(item.workout);
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    storage.setWorkoutHistory(history);

    // Restore in Supabase (clear deleted_at)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase
        .from('workout_sessions') as any)
        .update({ deleted_at: null })
        .eq('id', workoutId)
        .eq('user_id', user.id);

      logger.debug(`✅ Restored workout ${workoutId} from trash`);
    }

    return true;
  } catch (err) {
    logger.debug('Failed to restore workout from trash:', err);
    return false;
  }
}

/**
 * Permanently delete workout from trash
 *
 * @param workoutId - ID of workout to permanently delete
 * @returns true if successful
 */
export async function permanentlyDelete(workoutId: string): Promise<boolean> {
  try {
    const trash = getTrash();
    const item = trash.find(t => t.workout.id === workoutId);

    if (!item) {
      logger.debug('Workout not found in trash:', workoutId);
      return false;
    }

    // Remove from trash
    const updatedTrash = trash.filter(t => t.workout.id !== workoutId);
    localStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));

    // Permanently delete from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Delete set logs first (foreign key constraint)
      await (supabase
        .from('set_logs') as any)
        .delete()
        .eq('workout_session_id', workoutId);

      // Delete workout session
      await (supabase
        .from('workout_sessions') as any)
        .delete()
        .eq('id', workoutId)
        .eq('user_id', user.id);

      logger.debug(`✅ Permanently deleted workout ${workoutId}`);
    }

    return true;
  } catch (err) {
    logger.debug('Failed to permanently delete workout:', err);
    return false;
  }
}

/**
 * Empty entire trash (permanently delete all)
 */
export async function emptyTrash(): Promise<number> {
  try {
    const trash = getTrash();
    const count = trash.length;

    if (count === 0) return 0;

    // Permanently delete all
    for (const item of trash) {
      await permanentlyDelete(item.workout.id);
    }

    // Clear trash
    localStorage.removeItem(TRASH_KEY);

    logger.debug(`✅ Emptied trash: ${count} workouts permanently deleted`);
    return count;
  } catch (err) {
    logger.debug('Failed to empty trash:', err);
    return 0;
  }
}

/**
 * Get count of items in trash
 */
export function getTrashCount(): number {
  return getTrash().length;
}
