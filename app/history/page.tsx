'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkoutHistory from '../components/WorkoutHistory';
import { storage, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth-context';
import type {
  WorkoutSession,
  UserProfile,
  SessionMetadata,
  SupabaseWorkoutSessionRow
} from '../lib/types';

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('iron_brain_profile');
    if (saved) {
      try {
        const parsed: UserProfile = JSON.parse(saved);
        if (parsed.rememberUntil && parsed.rememberUntil < Date.now()) {
          localStorage.removeItem('iron_brain_profile');
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const namespaceId = user?.id ?? profile?.id ?? null;

  useEffect(() => {
    setUserNamespace(namespaceId);
  }, [namespaceId]);

  const loadWorkoutsFromBothSources = useCallback(async () => {
    const localWorkouts = storage.getWorkoutHistory();
    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();
    const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

    const resolveUserId = async () => {
      // If we have a user from context, use it
      if (user?.id) return user.id;

      // If user is explicitly null (signed out), don't try to fetch from Supabase
      if (user === null) return null;

      // Only try to get user from Supabase if user state is undefined (initial load)
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Failed to resolve Supabase user:', error);
      }
      return data.user?.id ?? null;
    };

    const resolvedUserId = await resolveUserId();
    if (!resolvedUserId) {
      setWorkoutHistory(sortedLocalWorkouts);
      return;
    }

    try {
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
        setWorkoutHistory(sortedLocalWorkouts);
        return;
      }

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

      const stripPrefix = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
      const supabaseIds = new Set(supabaseWorkouts.map(w => w.id));
      const localOnlyWorkouts = localWorkouts.filter(w => !supabaseIds.has(stripPrefix(w.id)));

      const mergedWorkouts = [...supabaseWorkouts, ...localOnlyWorkouts].sort(
        (a, b) => getSortTime(b) - getSortTime(a)
      );

      setWorkoutHistory(mergedWorkouts);
    } catch (err) {
      console.error('Error loading workouts:', err);
      setWorkoutHistory(sortedLocalWorkouts);
    }
  }, [user]);

  useEffect(() => {
    loadWorkoutsFromBothSources();
  }, [loadWorkoutsFromBothSources, profile?.id]);

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Archive</p>
              <h1 className="mt-3 text-3xl font-black text-white">Workout History</h1>
              <p className="mt-2 text-sm text-zinc-400">Every session, all in one place.</p>
            </div>
            <button
              onClick={() => router.push('/start')}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              Start Workout
            </button>
          </div>
        </header>
        <WorkoutHistory
          workoutHistory={workoutHistory}
          onHistoryUpdate={loadWorkoutsFromBothSources}
        />
      </div>
    </div>
  );
}
