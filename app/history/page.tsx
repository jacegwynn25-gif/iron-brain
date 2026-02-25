'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkoutHistory from '../components/WorkoutHistory';
import { storage, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth-context';
import { defaultExercises } from '../lib/programs';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { buildExerciseCatalog, resolveExerciseDisplayName, type ExerciseCatalog } from '../lib/exercises/catalog';
import type {
  WorkoutSession,
  SessionMetadata
} from '../lib/types';

const HISTORY_CLOUD_LIMIT = 180;

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
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [cloudFetchFailed, setCloudFetchFailed] = useState(false);
  const namespaceId = user?.id ?? null;
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!namespaceReady) return;
    setUserNamespace(namespaceId);
  }, [namespaceId, namespaceReady]);

  const loadWorkoutsFromBothSources = useCallback(async () => {
    if (!namespaceReady || authLoading) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    const loadStartedAt = performance.now();
    setHistoryLoading(true);

    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();

    const resolveUserId = async () => {
      // If we have a user from context, use it
      if (user?.id) return user.id;

      // If user is explicitly null (signed out), don't try to fetch from Supabase
      if (user === null) return null;

      // Only try to get user from Supabase if user state is undefined (initial load)
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Failed to resolve Supabase user:', error);
        return null;
      }
      return data.user?.id ?? null;
    };

    try {
      const resolvedUserId = await resolveUserId();
      const customExercises = await getCustomExercises(resolvedUserId ?? namespaceId).catch((error) => {
        console.error('Failed to load custom exercise catalog for history page:', error);
        return [];
      });
      const exerciseCatalog = buildExerciseCatalog(defaultExercises, customExercises);
      const localWorkouts = storage
        .getWorkoutHistoryForNamespace(resolvedUserId ?? namespaceId)
        .map((workout) => enrichWorkoutSetNames(workout, exerciseCatalog));
      const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

      if (!resolvedUserId) {
        setWorkoutHistory(sortedLocalWorkouts);
        return;
      }

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
      // Increased from 10s to 30s to prevent false-positives under heavy payload
      const timeoutPromise: Promise<never> = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('History cloud fetch timed out')), 30000)
      );
      const { data: sessions, error }: SessionsResponse = await Promise.race([
        sessionsQuery,
        timeoutPromise,
      ]);

      if (error) {
        console.error('Failed to load workouts from Supabase:', error);
        setCloudFetchFailed(true);
        setWorkoutHistory(sortedLocalWorkouts);
        return;
      }
      setCloudFetchFailed(false);

      const sessionRows = sessions ?? [];
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

      const normalizeWorkoutId = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
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
        (a, b) => getSortTime(b) - getSortTime(a)
      );

      setWorkoutHistory(mergedWorkouts);
    } catch (err) {
      console.error('Error loading workouts:', err);
      setCloudFetchFailed(true);
      const fallbackLocal = storage
        .getWorkoutHistoryForNamespace(namespaceId)
        .sort((a, b) => getSortTime(b) - getSortTime(a));
      setWorkoutHistory(fallbackLocal);
    } finally {
      loadingRef.current = false;
      setHistoryLoading(false);
      console.debug('[HistoryPage] load completed', {
        durationMs: Math.round(performance.now() - loadStartedAt),
      });
    }
  }, [authLoading, namespaceId, namespaceReady, user]);

  useEffect(() => {
    if (!namespaceReady || authLoading) return;
    void loadWorkoutsFromBothSources();
  }, [authLoading, loadWorkoutsFromBothSources, namespaceReady]);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10 space-y-8">
        <header className="flex flex-col gap-6 border-b border-zinc-900 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-500">
              Archive
            </p>
            <h1 className="mt-3 text-4xl font-black text-white">Workout History</h1>
            <p className="mt-2 text-sm text-zinc-400">Every session, all in one place.</p>
          </div>
          <button
            onClick={() => router.push('/start')}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
          >
            Start Workout
          </button>
        </header>
        {cloudFetchFailed && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <span>Showing local history only — cloud sync unavailable.</span>
            <button
              onClick={() => { setCloudFetchFailed(false); void loadWorkoutsFromBothSources(); }}
              className="ml-auto text-xs font-semibold underline underline-offset-2 hover:text-amber-300"
            >
              Retry
            </button>
          </div>
        )}
        <WorkoutHistory
          workoutHistory={workoutHistory}
          onHistoryUpdate={loadWorkoutsFromBothSources}
          compactHeader
          isLoading={historyLoading}
        />
      </div>
    </div>
  );
}
