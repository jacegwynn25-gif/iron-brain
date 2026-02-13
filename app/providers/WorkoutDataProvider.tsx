'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, ReactNode, useRef } from 'react';
import { useDataReady } from '../lib/hooks/useDataReady';
import { useAsyncLock } from '../lib/hooks/useAsyncLock';
import { storage } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { defaultExercises } from '../lib/programs';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { buildExerciseCatalog, resolveExerciseDisplayName, type ExerciseCatalog } from '../lib/exercises/catalog';
import type { WorkoutSession } from '../lib/types';

interface WorkoutDataContextValue {
  /** All workout sessions (merged from local + cloud) */
  workouts: WorkoutSession[];
  /** Loading state */
  loading: boolean;
  /** Error if any occurred during loading */
  error: Error | null;
  /** Whether cloud sync is in progress */
  isSyncing: boolean;
  /** Manually trigger a reload */
  reload: () => Promise<WorkoutSession[] | null | void>;
  /** Whether the data layer is ready (auth + namespace initialized) */
  isReady: boolean;
  /** Whether initialization is in progress */
  isInitializing: boolean;
}

const WorkoutDataContext = createContext<WorkoutDataContextValue | null>(null);

const getSortTime = (session: WorkoutSession) =>
  new Date(session.endTime || session.startTime || session.date).getTime();

type WorkoutSet = WorkoutSession['sets'][number];

const normalizeSetKey = (set: WorkoutSet): string => {
  if (set.id) return `id:${set.id}`;
  return `fallback:${set.exerciseId}:${set.setIndex}`;
};

function enrichWorkoutSetNames(workout: WorkoutSession, catalog: ExerciseCatalog): WorkoutSession {
  return {
    ...workout,
    sets: workout.sets.map((set) => ({
      ...set,
      exerciseName: resolveExerciseDisplayName(set.exerciseId, {
        catalog,
        cachedName: set.exerciseName,
      }),
    })),
  };
}

function mergeCloudWorkoutNames(
  localWorkout: WorkoutSession,
  cloudWorkout: WorkoutSession,
  catalog: ExerciseCatalog
): WorkoutSession {
  const localNameByKey = new Map<string, string>();
  localWorkout.sets.forEach((set) => {
    const name = (set.exerciseName ?? '').trim();
    if (!name) return;
    localNameByKey.set(normalizeSetKey(set), name);
  });

  return {
    ...cloudWorkout,
    sets: cloudWorkout.sets.map((set) => {
      const localName = localNameByKey.get(normalizeSetKey(set));
      return {
        ...set,
        exerciseName: resolveExerciseDisplayName(set.exerciseId, {
          catalog,
          cachedName: set.exerciseName || localName,
        }),
      };
    }),
  };
}

interface WorkoutDataProviderProps {
  children: ReactNode;
}

export function WorkoutDataProvider({ children }: WorkoutDataProviderProps) {
  const { isReady, isInitializing, userId, waitForReady } = useDataReady();
  const { withLock } = useAsyncLock();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const initialLoadDone = useRef(false);

  const loadWorkouts = useCallback(async () => {
    // Gate: wait for data layer to be ready
    if (!isReady) {
      await waitForReady();
    }

    // withLock guarantees cleanup even on errors/early returns
    const result = await withLock(async () => {
      setLoading(true);
      setError(null);

      try {
        const customExercises = await getCustomExercises(userId ?? null).catch((catalogError) => {
          console.error('[WorkoutData] Failed to load custom exercise catalog:', catalogError);
          return [];
        });
        const exerciseCatalog = buildExerciseCatalog(defaultExercises, customExercises);

        // Step 1: Local data (instant)
        const localWorkouts = storage
          .getWorkoutHistory()
          .map((workout) => enrichWorkoutSetNames(workout, exerciseCatalog));
        const sortedLocal = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

        // Show local data immediately
        setWorkouts(sortedLocal);

        // Step 2: If no user, use local only
        if (!userId) {
          return sortedLocal;
        }

        // Step 3: Cloud sync
        setIsSyncing(true);

        const { data: sessions, error: cloudError } = await supabase
          .from('workout_sessions')
          .select(`
            id,
            date,
            start_time,
            end_time,
            duration_minutes,
            bodyweight,
            notes,
            name,
            metadata,
            created_at,
            updated_at,
            set_logs (
              id,
              exercise_slug,
              exercise_id,
              set_index,
              prescribed_reps,
              actual_weight,
              weight_unit,
              actual_reps,
              actual_rpe,
              completed
            )
          `)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('date', { ascending: false });

        if (cloudError) {
          console.error('[WorkoutData] Cloud sync error:', cloudError);
          // Continue with local data
          return sortedLocal;
        }

        // Step 4: Transform and merge
        const cloudWorkouts = transformCloudWorkouts(sessions ?? [], exerciseCatalog);
        const merged = mergeWorkouts(localWorkouts, cloudWorkouts, exerciseCatalog);
        setWorkouts(merged);

        return merged;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to load workouts');
        setError(errorObj);
        console.error('[WorkoutData] Load error:', err);

        // Fallback to local
        const localWorkouts = storage.getWorkoutHistory();
        const sortedLocal = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));
        setWorkouts(sortedLocal);
        return sortedLocal;
      } finally {
        setLoading(false);
        setIsSyncing(false);
        initialLoadDone.current = true;
      }
    });

    return result;
  }, [isReady, waitForReady, withLock, userId]);

  // Initial load when ready
  useEffect(() => {
    if (isReady && !initialLoadDone.current) {
      loadWorkouts();
    }
  }, [isReady, loadWorkouts]);

  // Reload on user change
  useEffect(() => {
    if (isReady && initialLoadDone.current) {
      loadWorkouts();
    }
  }, [userId, isReady, loadWorkouts]);

  // Reload on visibility/focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isReady) {
        loadWorkouts();
      }
    };

    const handleFocus = () => {
      if (isReady) {
        loadWorkouts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isReady, loadWorkouts]);

  // Listen for sync status changes (e.g., after saving a workout)
  useEffect(() => {
    const handleSyncChange = () => {
      if (isReady) {
        loadWorkouts();
      }
    };

    window.addEventListener('syncStatusChanged', handleSyncChange);
    window.addEventListener('workoutSaved', handleSyncChange);

    return () => {
      window.removeEventListener('syncStatusChanged', handleSyncChange);
      window.removeEventListener('workoutSaved', handleSyncChange);
    };
  }, [isReady, loadWorkouts]);

  const value: WorkoutDataContextValue = {
    workouts,
    loading: loading || isInitializing,
    error,
    isSyncing,
    reload: loadWorkouts,
    isReady,
    isInitializing,
  };

  return (
    <WorkoutDataContext.Provider value={value}>
      {children}
    </WorkoutDataContext.Provider>
  );
}

/**
 * Hook to access workout data context.
 * Must be used within a WorkoutDataProvider.
 */
export function useWorkoutDataContext(): WorkoutDataContextValue {
  const context = useContext(WorkoutDataContext);
  if (!context) {
    throw new Error('useWorkoutDataContext must be used within WorkoutDataProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if not in a WorkoutDataProvider.
 */
export function useWorkoutDataContextOptional(): WorkoutDataContextValue | null {
  return useContext(WorkoutDataContext);
}

// Helper: transform cloud data to app format
type SessionMetadata = {
  programName?: string;
  programId?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: number;
  dayName?: string;
};

function transformCloudWorkouts(sessions: Array<{
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  bodyweight: number | null;
  notes: string | null;
  name: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  set_logs?: Array<{
    id: string;
    exercise_slug: string | null;
    exercise_id: string | null;
    set_index: number | null;
    prescribed_reps: string | null;
    actual_weight: number | null;
    weight_unit: string | null;
    actual_reps: number | null;
    actual_rpe: number | null;
    completed: boolean | null;
  }>;
}>, catalog: ExerciseCatalog): WorkoutSession[] {
  return sessions.map((s) => {
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
      sets: (s.set_logs || []).map((set) => {
        const exerciseId = set.exercise_slug || set.exercise_id || '';
        return {
          id: set.id ?? undefined,
          exerciseId,
          exerciseName: resolveExerciseDisplayName(exerciseId, { catalog }),
          setIndex: set.set_index ?? 0,
          prescribedReps: set.prescribed_reps ?? '0',
          actualWeight: set.actual_weight ?? undefined,
          weightUnit: (set.weight_unit === 'kg' ? 'kg' : 'lbs') as 'lbs' | 'kg',
          actualReps: set.actual_reps ?? undefined,
          actualRPE: set.actual_rpe ?? undefined,
          completed: set.completed !== false,
        };
      }),
    };
  });
}

// Helper: merge cloud and local workouts.
// Cloud wins for duplicates unless cloud session has no set logs and local does.
function mergeWorkouts(
  local: WorkoutSession[],
  cloud: WorkoutSession[],
  catalog: ExerciseCatalog
): WorkoutSession[] {
  const normalizeWorkoutId = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
  const mergedById = new Map<string, WorkoutSession>();

  cloud.forEach((workout) => {
    mergedById.set(normalizeWorkoutId(workout.id), workout);
  });

  local.forEach((workout) => {
    const normalizedId = normalizeWorkoutId(workout.id);
    const cloudWorkout = mergedById.get(normalizedId);
    if (!cloudWorkout) {
      mergedById.set(normalizedId, workout);
      return;
    }

    if ((cloudWorkout.sets?.length ?? 0) === 0 && (workout.sets?.length ?? 0) > 0) {
      mergedById.set(normalizedId, workout);
      return;
    }

    mergedById.set(normalizedId, mergeCloudWorkoutNames(workout, cloudWorkout, catalog));
  });

  return Array.from(mergedById.values()).sort((a, b) => getSortTime(b) - getSortTime(a));
}
