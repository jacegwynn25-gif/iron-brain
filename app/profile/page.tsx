'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  Dumbbell,
  Bell,
  Moon,
  LogOut,
  ChevronRight,
  Scale
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';
import { buildLoginUrl, getReturnToFromLocation } from '../lib/auth/redirects';
import type {
  WorkoutSession,
  SessionMetadata,
  SupabaseWorkoutSessionRow
} from '../lib/types';
import { storage, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { parseLocalDate } from '../lib/dateUtils';

const getIsoWeekKey = (date: Date) => {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getFullYear()}-W${weekNo}`;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);

  // Unified namespace: user ID if authenticated, 'guest' for offline mode
  const namespaceId = user?.id ?? 'guest';

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

    if (!user && namespaceId !== resolvedUserId) {
      setUserNamespace(resolvedUserId);
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
      console.error('Error loading workouts from Supabase:', err);
      setWorkoutHistory(sortedLocalWorkouts);
    }
  }, [user, namespaceId]);

  useEffect(() => {
    loadWorkoutsFromBothSources();
  }, [loadWorkoutsFromBothSources]);

  const weeklyStreak = useMemo(() => {
    if (workoutHistory.length === 0) return 0;
    const weekSet = new Set(workoutHistory.map(session => getIsoWeekKey(parseLocalDate(session.date))));
    const currentWeek = getIsoWeekKey(new Date());

    let streak = 0;
    const cursor = new Date();

    while (true) {
      const key = getIsoWeekKey(cursor);
      if (!weekSet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }

    return weekSet.has(currentWeek) ? streak : 0;
  }, [workoutHistory]);

  const prCount = useMemo(() => {
    const exerciseIds = new Set<string>();
    workoutHistory.forEach(session => {
      session.sets.forEach(set => {
        if (set.exerciseId) exerciseIds.add(set.exerciseId);
      });
    });

    let count = 0;
    exerciseIds.forEach(id => {
      if (storage.getPersonalRecords(id)) {
        count += 1;
      }
    });
    return count;
  }, [workoutHistory]);

  const menuItems = [
    { icon: Scale, label: 'My Maxes (1RMs)', path: '/profile/maxes' },
    { icon: Dumbbell, label: 'Custom Exercises', path: '/profile/exercises' },
    { icon: Bell, label: 'Notifications', path: '/profile/notifications' },
    { icon: Moon, label: 'Appearance', path: '/profile/appearance' },
    { icon: Settings, label: 'Settings', path: '/profile/settings' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Profile</p>
            <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">
              {(user?.email?.split('@')[0] || 'Guest User').toUpperCase()}
            </h1>
            <p className="text-[10px] text-zinc-500 sm:text-xs">
              {user?.email || 'Offline Mode'}
            </p>
          </div>
        </div>
      </header>

      <section className="stagger-item grid grid-cols-3 gap-2.5 px-1 sm:gap-4">
        <div className="surface-card p-4 sm:p-5 text-center">
          <div className="text-2xl font-black text-white">{workoutHistory.length}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">Workouts</div>
        </div>
        <div className="surface-card p-4 sm:p-5 text-center">
          <div className="text-2xl font-black text-white">{weeklyStreak}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">Week Streak</div>
        </div>
        <div className="surface-card p-4 sm:p-5 text-center">
          <div className="text-2xl font-black text-white">{prCount}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">PRs</div>
        </div>
      </section>

      <section className="stagger-item space-y-3 px-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.3em]">Configuration</p>
        <h2 className="text-xl font-black italic text-zinc-100">PREFERENCES</h2>
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="surface-card w-full flex items-center justify-between p-4 sm:p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900/50 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-black italic text-zinc-100">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500" />
              </button>
            );
          })}
        </div>
      </section>

      {user ? (
        <section className="stagger-item space-y-3 px-1">
          <div className="surface-card p-4 border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <User className="w-4 h-4" />
              <span>Signed in as {user.email}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await signOut();
                router.push('/');
              } catch (error) {
                console.error('❌ Failed to sign out:', error);
                alert('Failed to sign out. Please try again.');
              }
            }}
            className="w-full surface-card p-4 flex items-center justify-center gap-2 text-rose-300 font-black italic border-rose-500/30 hover:bg-rose-500/10 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            SIGN OUT
          </button>
        </section>
      ) : (
        <section className="stagger-item space-y-3 px-1">
          <div className="surface-card p-4 border-blue-500/20">
            <div className="text-sm text-blue-300">
              <strong>Guest Mode</strong> — Your data is stored locally on this device. Sign in to sync across devices and backup to the cloud.
            </div>
          </div>
          <button
            onClick={() => router.push(buildLoginUrl(getReturnToFromLocation()))}
            className="w-full group relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-emerald-500 to-teal-600 p-4 flex items-center justify-center gap-2 text-white font-black italic shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <User className="w-5 h-5" />
            SIGN IN / CREATE ACCOUNT
          </button>
        </section>
      )}
    </div>
  );
}
