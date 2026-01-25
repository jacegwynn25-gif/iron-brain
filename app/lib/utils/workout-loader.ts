/**
 * Shared utility for loading and merging workouts from localStorage and Supabase
 */

import { supabase } from '../supabase/client';
import { getWorkoutHistory } from '../storage';
import type {
  WorkoutSession,
  SessionMetadata,
  SupabaseWorkoutSessionRow
} from '../types';

const getSortTime = (w: WorkoutSession) => {
  if (w.startTime) return new Date(w.startTime).getTime();
  if (w.date) return new Date(w.date).getTime();
  return 0;
};

const stripPrefix = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);

/**
 * Loads workouts from both localStorage and Supabase, merging them intelligently
 * - Prefers Supabase data for workouts that exist in both places
 * - Keeps localStorage-only workouts (offline workouts not yet synced)
 * - Sorts by date (most recent first)
 */
export async function loadWorkoutsFromBothSources(
  userId: string | null,
  namespaceId: string | null
): Promise<WorkoutSession[]> {
  // Get localStorage workouts first (offline-first approach)
  const localWorkouts = getWorkoutHistory();
  const sortedLocalWorkouts = localWorkouts.sort(
    (a, b) => getSortTime(b) - getSortTime(a)
  );

  // If no user, return only localStorage workouts
  if (!userId || !namespaceId) {
    return sortedLocalWorkouts;
  }

  // If user is logged in, fetch from Supabase and merge
  try {
    const resolvedUserId = namespaceId;

    const { data: sessions, error } = await supabase
      .from('workout_sessions')
      .select(`
        *,
        set_logs (*)
      `)
      .eq('user_id', resolvedUserId)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (error) {
      console.error('Failed to load workouts from Supabase:', error);
      return sortedLocalWorkouts;
    }

    // Transform Supabase data to WorkoutSession format
    const sessionRows: SupabaseWorkoutSessionRow[] = sessions ?? [];
    const supabaseWorkouts: WorkoutSession[] = sessionRows.map((s) => {
      const metadata = (s.metadata ?? {}) as SessionMetadata;
      const resolvedProgramName = metadata.programName || s.name || 'Workout';

      return {
        id: s.id,
        date: s.date ?? (s.start_time ? s.start_time.split('T')[0] : new Date().toISOString().split('T')[0]),
        startTime: s.start_time ?? undefined,
        endTime: s.end_time ?? undefined,
        durationMinutes: s.duration_minutes ?? undefined,
        bodyweight: s.bodyweight ?? undefined,
        notes: s.notes ?? undefined,
        programId: metadata.programId || '',
        programName: resolvedProgramName,
        cycleNumber: metadata.cycleNumber || 0,
        weekNumber: metadata.weekNumber || 0,
        dayOfWeek: metadata.dayOfWeek != null ? String(metadata.dayOfWeek) : '',
        dayName: metadata.dayName || '',
        createdAt: s.created_at || new Date().toISOString(),
        updatedAt: s.updated_at || new Date().toISOString(),
        sets: (s.set_logs || []).map((set) => ({
          id: set.id ?? undefined,
          exerciseId: set.exercise_slug || set.exercise_id || '',
          setIndex: set.set_index ?? 0,
          prescribedReps: set.prescribed_reps != null ? String(set.prescribed_reps) : '0',
          prescribedRPE: set.prescribed_rpe,
          prescribedRIR: set.prescribed_rir,
          prescribedPercentage: set.prescribed_percentage,
          actualWeight: set.actual_weight,
          weightUnit: set.weight_unit === 'kg' ? 'kg' : 'lbs',
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
    });

    // Merge: Prefer Supabase for workouts with matching IDs, keep localStorage-only workouts
    const supabaseIds = new Set(supabaseWorkouts.map(w => w.id));
    const localOnlyWorkouts = localWorkouts.filter(w => !supabaseIds.has(stripPrefix(w.id)));

    // Combine and sort by date (most recent first)
    const mergedWorkouts = [...supabaseWorkouts, ...localOnlyWorkouts].sort(
      (a, b) => getSortTime(b) - getSortTime(a)
    );

    return mergedWorkouts;
  } catch (err) {
    console.error('Error loading workouts from Supabase:', err);
    return sortedLocalWorkouts;
  }
}
