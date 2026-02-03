'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import { storage } from '../storage';
import { supabase } from '../supabase/client';
import type {
  WorkoutSession,
  SessionMetadata,
  SupabaseSetLogRow,
  SupabaseWorkoutSessionRow,
} from '../types';

// Convert null to undefined for optional fields
function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

// Parse weight unit with explicit handling
function parseWeightUnit(value: string | null): 'lbs' | 'kg' {
  if (value === 'kg') return 'kg';
  if (value === 'lbs') return 'lbs';
  return 'lbs'; // default
}

// Safe metadata parsing with validation
function parseSessionMetadata(raw: unknown): SessionMetadata {
  if (typeof raw !== 'object' || raw === null) return {};
  const obj = raw as Record<string, unknown>;
  return {
    programName: typeof obj.programName === 'string' ? obj.programName : undefined,
    programId: typeof obj.programId === 'string' ? obj.programId : undefined,
    cycleNumber: typeof obj.cycleNumber === 'number' ? obj.cycleNumber : undefined,
    weekNumber: typeof obj.weekNumber === 'number' ? obj.weekNumber : undefined,
    dayOfWeek: typeof obj.dayOfWeek === 'number' ? obj.dayOfWeek : undefined,
    dayName: typeof obj.dayName === 'string' ? obj.dayName : undefined,
  };
}

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
        const metadata = parseSessionMetadata(s.metadata);
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
            prescribedRPE: nullToUndefined(set.prescribed_rpe),
            prescribedRIR: nullToUndefined(set.prescribed_rir),
            prescribedPercentage: nullToUndefined(set.prescribed_percentage),
            actualWeight: nullToUndefined(set.actual_weight),
            weightUnit: parseWeightUnit(set.weight_unit),
            actualReps: nullToUndefined(set.actual_reps),
            actualRPE: nullToUndefined(set.actual_rpe),
            actualRIR: nullToUndefined(set.actual_rir),
            e1rm: nullToUndefined(set.e1rm),
            volumeLoad: nullToUndefined(set.volume_load),
            restTakenSeconds: nullToUndefined(set.rest_seconds),
            setDurationSeconds: nullToUndefined(set.actual_seconds),
            notes: set.notes ?? undefined,
            completed: set.completed === true, // Explicit: only true if actually true
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

  // Reload data when the page becomes visible (e.g., after navigation back from workout)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadWorkouts();
      }
    };

    const handleFocus = () => {
      loadWorkouts();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadWorkouts]);

  return {
    workoutHistory,
    loading,
    error,
    reload: loadWorkouts
  };
}
