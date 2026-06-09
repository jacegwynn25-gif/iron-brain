'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkoutHistory from '../components/WorkoutHistory';
import { storage, setUserNamespace } from '../lib/storage';
import { getTrash } from '../lib/trash';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth-context';
import { useWorkoutDataContext } from '../providers/WorkoutDataProvider';
import { defaultExercises } from '../lib/programs';
import { getCustomExercises, getLocalCustomExercises } from '../lib/exercises/custom-exercises';
import { buildExerciseCatalog, resolveExerciseDisplayName, type ExerciseCatalog } from '../lib/exercises/catalog';
import type {
  WorkoutSession,
  SessionMetadata
} from '../lib/types';

const HISTORY_CLOUD_LIMIT = 90;

type WorkoutSet = WorkoutSession['sets'][number];

const normalizeWorkoutId = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
const getWorkoutSortTime = (session: WorkoutSession) =>
  new Date(session.endTime || session.startTime || session.date).getTime();

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
      const key = normalizeSetKey(set);
      const localName = localNameByKey.get(key);
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

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading, namespaceReady } = useAuth();
  const { workouts: sharedWorkouts } = useWorkoutDataContext();
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [cloudFetchFailed, setCloudFetchFailed] = useState(false);
  const namespaceId = user?.id ?? null;
  const loadingRef = useRef(false);
  const sharedVisibleWorkouts = useMemo(() => {
    const trashedWorkoutIds = new Set(
      getTrash().map((item) => normalizeWorkoutId(item.workout.id))
    );
    return sharedWorkouts
      .filter((workout) => !trashedWorkoutIds.has(normalizeWorkoutId(workout.id)))
      .sort((a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a));
  }, [sharedWorkouts]);

  useEffect(() => {
    if (!namespaceReady) return;
    setUserNamespace(namespaceId);
  }, [namespaceId, namespaceReady]);

  useEffect(() => {
    if (!namespaceReady || authLoading || sharedVisibleWorkouts.length === 0) return;
    setWorkoutHistory(sharedVisibleWorkouts);
    setHistoryLoading(false);
    setCloudFetchFailed(false);
  }, [authLoading, namespaceReady, sharedVisibleWorkouts]);

  const loadWorkoutsFromBothSources = useCallback(async () => {
    if (!namespaceReady || authLoading) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    const loadStartedAt = performance.now();
    const hasWarmSharedHistory = sharedVisibleWorkouts.length > 0;
    setHistoryLoading(!hasWarmSharedHistory);

    const resolveUserId = async () => {
      // If we have a user from context, use it
      if (user?.id) return user.id;

      // If user is explicitly null (signed out), don't try to fetch from Supabase
      if (user === null) return null;

      // Only try to get user from Supabase if user state is undefined (initial load)
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        
        return null;
      }
      return data.user?.id ?? null;
    };

    try {
      const resolvedUserId = await resolveUserId();
      const localCustomExercises = getLocalCustomExercises();
      const localExerciseCatalog = buildExerciseCatalog(defaultExercises, localCustomExercises);
      const trashedWorkoutIds = new Set(
        getTrash().map((item) => normalizeWorkoutId(item.workout.id))
      );
      const localWorkouts = storage
        .getWorkoutHistoryForNamespace(resolvedUserId ?? namespaceId)
        .filter((workout) => !trashedWorkoutIds.has(normalizeWorkoutId(workout.id)))
        .map((workout) => enrichWorkoutSetNames(workout, localExerciseCatalog));
      const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a));

      // Render local cache immediately. If there is no cache, keep loading
      // until the cloud payload arrives so users do not see a false empty state.
      if (sortedLocalWorkouts.length > 0 || !hasWarmSharedHistory) {
        setWorkoutHistory(sortedLocalWorkouts);
      }
      setHistoryLoading(sortedLocalWorkouts.length === 0 && Boolean(resolvedUserId) && !hasWarmSharedHistory);

      if (!resolvedUserId) {
        setHistoryLoading(false);
        return;
      }

      // Background cloud sync
      const sessionsQuery = supabase
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
            prescribed_rpe,
            prescribed_rir,
            prescribed_percentage,
            prescribed_weight,
            actual_weight,
            weight_unit,
            actual_reps,
            actual_rpe,
            actual_rir,
            e1rm,
            volume_load,
            rest_seconds,
            actual_seconds,
            notes,
            completed
          )
        `)
        .eq('user_id', resolvedUserId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(HISTORY_CLOUD_LIMIT);

      type SessionsResponse = Awaited<typeof sessionsQuery>;
      const timeoutPromise: Promise<never> = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('History cloud fetch timed out')), 12000)
      );
      const [customExercises, sessionsResult] = await Promise.all([
        getCustomExercises(resolvedUserId).catch(() => []),
        Promise.race([sessionsQuery, timeoutPromise]) as Promise<SessionsResponse>,
      ]);
      const exerciseCatalog = buildExerciseCatalog(defaultExercises, customExercises);
      const { data: sessions, error } = sessionsResult;

      if (error) {
        
        setCloudFetchFailed(true);
        setWorkoutHistory(sortedLocalWorkouts);
        return;
      }
      setCloudFetchFailed(false);

      const sessionRows = (sessions ?? []).filter(
        (session) => !trashedWorkoutIds.has(normalizeWorkoutId(session.id))
      );
      const supabaseWorkouts: WorkoutSession[] = sessionRows.map((s) => {
        const metadata = (s.metadata ?? {}) as SessionMetadata;
        const resolvedProgramName = metadata.programName || s.name || 'Workout';

        return enrichWorkoutSetNames({
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
            prescribedWeight: set.prescribed_weight,
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
        }, exerciseCatalog);
      });

      const mergedById = new Map<string, WorkoutSession>();

      supabaseWorkouts.forEach((workout) => {
        mergedById.set(normalizeWorkoutId(workout.id), workout);
      });

      localWorkouts.forEach((workout) => {
        const normalizedId = normalizeWorkoutId(workout.id);
        const cloudWorkout = mergedById.get(normalizedId);
        if (!cloudWorkout) {
          mergedById.set(normalizedId, workout);
          return;
        }

        // Guard against partial cloud writes that created a session row without set logs.
        if ((cloudWorkout.sets?.length ?? 0) === 0 && (workout.sets?.length ?? 0) > 0) {
          mergedById.set(normalizedId, workout);
          return;
        }

        mergedById.set(normalizedId, mergeCloudWorkoutNames(workout, cloudWorkout, exerciseCatalog));
      });

      const mergedWorkouts = Array.from(mergedById.values()).sort(
        (a, b) => getWorkoutSortTime(b) - getWorkoutSortTime(a)
      );

      storage.setWorkoutHistory(mergedWorkouts);
      setWorkoutHistory(mergedWorkouts);
    } catch {
      setCloudFetchFailed(true);
      // Already rendered local state immediately
    } finally {
      loadingRef.current = false;
      setHistoryLoading(false);
      console.debug('[HistoryPage] load completed', {
        durationMs: Math.round(performance.now() - loadStartedAt),
      });
    }
  }, [authLoading, namespaceId, namespaceReady, sharedVisibleWorkouts.length, user]);

  useEffect(() => {
    if (!namespaceReady || authLoading) return;
    void loadWorkoutsFromBothSources();
  }, [authLoading, loadWorkoutsFromBothSources, namespaceReady]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item flex items-start justify-between px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-3xl font-medium tracking-tight text-zinc-100 sm:text-4xl">Workout history</h1>
        </div>
        <button
          onClick={() => router.push('/start')}
          className="liquid-action-button stagger-item flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition-all active:scale-[0.98]"
        >
          Start workout
        </button>
      </header>
      {cloudFetchFailed && (
        <div className="stagger-item mx-1 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          <span>Showing local history only — cloud sync unavailable.</span>
          <button
            onClick={() => { setCloudFetchFailed(false); void loadWorkoutsFromBothSources(); }}
            className="ml-auto text-xs font-semibold underline underline-offset-2 hover:text-amber-300"
          >
            Retry
          </button>
        </div>
      )}
      <section className="stagger-item mx-1">
        <WorkoutHistory
          workoutHistory={workoutHistory}
          onHistoryUpdate={loadWorkoutsFromBothSources}
          compactHeader
          isLoading={historyLoading}
        />
      </section>
    </div>
  );
}
