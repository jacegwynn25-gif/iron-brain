'use client';

import { supabase } from './supabase/client';
import { storage } from './storage';
import { logger } from './logger';
import type { WorkoutSession } from './types';
import type { Database } from './supabase/database.types';

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

type SessionMetadata = {
  programName?: string;
  programId?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: number;
  dayName?: string;
};

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  | 'id'
  | 'exercise_slug'
  | 'exercise_id'
  | 'set_index'
  | 'prescribed_reps'
  | 'prescribed_rpe'
  | 'prescribed_rir'
  | 'prescribed_percentage'
  | 'actual_weight'
  | 'actual_reps'
  | 'actual_rpe'
  | 'actual_rir'
  | 'e1rm'
  | 'volume_load'
  | 'rest_seconds'
  | 'actual_seconds'
  | 'notes'
  | 'completed'
>;

type SupabaseWorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'] & {
  set_logs?: SupabaseSetLogRow[] | null;
};

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

const normalizeWorkoutId = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
const matchesWorkoutId = (candidate: string, target: string) =>
  normalizeWorkoutId(candidate) === normalizeWorkoutId(target);

const transformSupabaseWorkout = (session: SupabaseWorkoutSessionRow): WorkoutSession => {
  const metadata = (session.metadata ?? {}) as SessionMetadata;
  const resolvedProgramName = metadata.programName || session.name || 'Workout';
  return {
    id: session.id,
    date: session.date ?? (session.start_time ? session.start_time.split('T')[0] : new Date().toISOString().split('T')[0]),
    startTime: session.start_time ?? undefined,
    endTime: session.end_time ?? undefined,
    durationMinutes: session.duration_minutes ?? undefined,
    bodyweight: session.bodyweight ?? undefined,
    notes: session.notes ?? undefined,
    programId: metadata.programId || '',
    programName: resolvedProgramName,
    cycleNumber: metadata.cycleNumber || 0,
    weekNumber: metadata.weekNumber || 0,
    dayOfWeek: metadata.dayOfWeek != null ? String(metadata.dayOfWeek) : '',
    dayName: metadata.dayName || '',
    createdAt: session.created_at || new Date().toISOString(),
    updatedAt: session.updated_at || new Date().toISOString(),
    sets: (session.set_logs || []).map((set) => ({
      id: set.id ?? undefined,
      exerciseId: set.exercise_slug || set.exercise_id || '',
      setIndex: set.set_index ?? 0,
      prescribedReps: set.prescribed_reps != null ? String(set.prescribed_reps) : '0',
      prescribedRPE: set.prescribed_rpe,
      prescribedRIR: set.prescribed_rir,
      prescribedPercentage: set.prescribed_percentage,
      actualWeight: set.actual_weight,
      actualReps: set.actual_reps,
      actualRPE: set.actual_rpe,
      actualRIR: set.actual_rir,
      e1rm: set.e1rm,
      volumeLoad: set.volume_load,
      restTakenSeconds: set.rest_seconds,
      setDurationSeconds: set.actual_seconds,
      notes: set.notes ?? undefined,
      completed: set.completed !== false,
    })),
  };
};

const fetchWorkoutFromSupabase = async (workoutId: string): Promise<WorkoutSession | undefined> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      set_logs (*)
    `)
    .eq('id', workoutId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    logger.debug('Failed to fetch workout from Supabase:', error);
    return undefined;
  }

  return transformSupabaseWorkout(data as SupabaseWorkoutSessionRow);
};

/**
 * Soft delete: Move workout to trash
 *
 * @param workoutId - ID of workout to delete
 * @returns true if successful
 */
export async function moveToTrash(workoutId: string): Promise<boolean> {
  try {
    const normalizedId = normalizeWorkoutId(workoutId);
    const history = storage.getWorkoutHistory();
    let workout = history.find(w => matchesWorkoutId(w.id, workoutId));

    if (!workout) {
      workout = await fetchWorkoutFromSupabase(normalizedId);
    }

    if (!workout) {
      logger.debug('Workout not found:', workoutId);
      return false;
    }

    // Add to trash
    const trash = getTrash();
    const filteredTrash = trash.filter(item => !matchesWorkoutId(item.workout.id, workout.id));
    filteredTrash.push({
      workout,
      deletedAt: new Date().toISOString()
    });
    localStorage.setItem(TRASH_KEY, JSON.stringify(filteredTrash));

    // Remove from history
    const filteredHistory = history.filter(w => !matchesWorkoutId(w.id, workout.id));
    storage.setWorkoutHistory(filteredHistory);

    // Soft delete in Supabase (mark with deleted_at timestamp)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('workout_sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', normalizedId)
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
    const item = trash.find(t => matchesWorkoutId(t.workout.id, workoutId));

    if (!item) {
      logger.debug('Workout not found in trash:', workoutId);
      return false;
    }

    // Remove from trash
    const updatedTrash = trash.filter(t => !matchesWorkoutId(t.workout.id, workoutId));
    localStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));

    // Add back to history
    const history = storage.getWorkoutHistory();
    const restoredHistory = [
      item.workout,
      ...history.filter(h => !matchesWorkoutId(h.id, item.workout.id)),
    ].sort((a, b) => {
      const aTime = new Date(a.endTime || a.startTime || a.date).getTime();
      const bTime = new Date(b.endTime || b.startTime || b.date).getTime();
      return bTime - aTime;
    });
    storage.setWorkoutHistory(restoredHistory);

    // Restore in Supabase (clear deleted_at)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('workout_sessions')
        .update({ deleted_at: null })
        .eq('id', normalizeWorkoutId(item.workout.id))
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
    const item = trash.find(t => matchesWorkoutId(t.workout.id, workoutId));

    if (!item) {
      logger.debug('Workout not found in trash:', workoutId);
      return false;
    }

    // Remove from trash
    const updatedTrash = trash.filter(t => !matchesWorkoutId(t.workout.id, workoutId));
    localStorage.setItem(TRASH_KEY, JSON.stringify(updatedTrash));

    // Permanently delete from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const normalizedId = normalizeWorkoutId(item.workout.id);
      // Delete set logs first (foreign key constraint)
      await supabase
        .from('set_logs')
        .delete()
        .eq('workout_session_id', normalizedId);

      // Delete workout session
      await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', normalizedId)
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
