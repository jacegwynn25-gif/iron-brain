'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import { storage } from '../storage';
import { supabase } from '../supabase/client';
import type { WorkoutSession } from '../types';
import type { Database } from '../supabase/database.types';

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

type SupabaseWorkoutSessionRow = Pick<
  Database['public']['Tables']['workout_sessions']['Row'],
  | 'id'
  | 'user_id'
  | 'date'
  | 'start_time'
  | 'end_time'
  | 'duration_minutes'
  | 'bodyweight'
  | 'notes'
  | 'name'
  | 'metadata'
  | 'created_at'
  | 'updated_at'
> & {
  set_logs?: SupabaseSetLogRow[];
};

type SessionMetadata = {
  programName?: string;
  programId?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: number;
  dayName?: string;
};

const getSortTime = (session: WorkoutSession) =>
  new Date(session.endTime || session.startTime || session.date).getTime();

export function useWorkoutData() {
  const { user, namespaceReady } = useAuth();
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadWorkouts = useCallback(async () => {
    // Wait for namespace to be ready before loading
    if (!namespaceReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get local workouts (namespace is now guaranteed to be set correctly)
      const localWorkouts = storage.getWorkoutHistory();
      const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

      // Step 2: If no user, use local only
      if (!user?.id) {
        setWorkoutHistory(sortedLocalWorkouts);
        setLoading(false);
        return;
      }

      // Step 3: Get Supabase workouts
      const { data: sessions, error: supabaseError } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          set_logs (*)
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (supabaseError) {
        console.error('Failed to load workouts from Supabase:', supabaseError);
        setWorkoutHistory(sortedLocalWorkouts);
        setLoading(false);
        return;
      }

      // Step 4: Transform Supabase sessions to WorkoutSession format
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

      // Step 5: Merge and deduplicate
      const stripPrefix = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
      const supabaseIds = new Set(supabaseWorkouts.map(w => w.id));
      const localOnlyWorkouts = localWorkouts.filter(w => !supabaseIds.has(stripPrefix(w.id)));

      const mergedWorkouts = [...supabaseWorkouts, ...localOnlyWorkouts].sort(
        (a, b) => getSortTime(b) - getSortTime(a)
      );

      setWorkoutHistory(mergedWorkouts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workouts';
      setError(new Error(errorMessage));
      console.error('Error loading workouts:', err);

      // Fallback to local workouts on error
      const localWorkouts = storage.getWorkoutHistory();
      const sortedLocal = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));
      setWorkoutHistory(sortedLocal);
    } finally {
      setLoading(false);
    }
  }, [user, namespaceReady]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  return {
    workoutHistory,
    loading,
    error,
    reload: loadWorkouts
  };
}
