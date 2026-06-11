'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  LogOut,
  ChevronRight,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';
import { buildLoginUrl, getReturnToFromLocation } from '../lib/auth/redirects';
import { useDialog } from '@/app/providers/DialogProvider';
import { liquidButtonClass } from '../components/ui/liquid';

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
  const { alert } = useDialog();
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
            actualWeight: set.skipped === true ? null : set.actual_weight,
            weightUnit: set.weight_unit === 'kg' ? 'kg' : 'lbs',
            actualReps: set.skipped === true ? null : set.actual_reps,
            actualRPE: set.skipped === true ? null : set.actual_rpe,
            actualRIR: set.skipped === true ? null : set.actual_rir,
            e1rm: set.skipped === true ? null : set.e1rm,
            volumeLoad: set.skipped === true ? null : set.volume_load,
            restTakenSeconds: set.rest_seconds,
            setDurationSeconds: set.actual_seconds,
            notes: set.notes ?? undefined,
            completed: set.completed === true && set.skipped !== true,
            skipped: set.skipped === true,
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
    } catch {
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
    { icon: Sparkles, label: 'Coach export', path: '/profile/coach' },
    { icon: Scale, label: '1RMs & maxes', path: '/profile/maxes' },
    { icon: Settings, label: 'Settings', path: '/profile/settings' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <div className="flex items-center gap-4">
          <div className="liquid-icon-button flex h-16 w-16 items-center justify-center rounded-full">
            <User className="h-8 w-8 text-zinc-300" />
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <p className="iron-label">Profile</p>
            <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">
              {user?.email?.split('@')[0] || 'Guest user'}
            </h1>
            <p className="text-[10px] text-zinc-500 sm:text-xs">
              {user?.email || 'Offline mode'}
            </p>
          </div>
        </div>
      </header>

      <section className="stagger-item grid grid-cols-3 gap-2.5 border-y border-white/8 px-1 py-4 sm:gap-4">
        <div>
          <div className="iron-display text-2xl text-white">{workoutHistory.length}</div>
          <div className="text-xs text-zinc-500">Workouts</div>
        </div>
        <div>
          <div className="iron-display text-2xl text-white">{weeklyStreak}</div>
          <div className="text-xs text-zinc-500">Week streak</div>
        </div>
        <div>
          <div className="iron-display text-2xl text-white">{prCount}</div>
          <div className="text-xs text-zinc-500">PRs</div>
        </div>
      </section>

      {user && (
        <section className="stagger-item px-1">
          <button
            onClick={() => router.push('/upgrade')}
            className="group flex w-full items-center justify-between gap-4 border-y border-white/8 py-4 text-left text-zinc-100 transition-colors hover:text-white"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="liquid-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="h-4 w-4 text-zinc-300" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-medium tracking-tight">Support Iron Brain</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
          </button>
        </section>
      )}

      <section className="stagger-item space-y-3 px-1">
        <h2 className="iron-display text-xl text-zinc-100">Preferences</h2>
        <div className="divide-y divide-white/8 border-y border-white/8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="flex w-full items-center justify-between py-4 transition-all hover:text-white active:bg-white/[0.035] sm:py-5"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-100">{item.label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-500" />
              </button>
            );
          })}
        </div>
      </section>

      {user ? (
        <section className="stagger-item space-y-3 px-1">
          <div className="border-y border-white/8 py-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <User className="w-4 h-4" />
              <span>Signed in as {user.email}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await signOut();
                router.push('/');
              } catch {
                await alert(
                  'Sign Out Error',
                  'Failed to sign out. Please check your connection and try again.'
                );

              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] border border-rose-400/25 bg-rose-500/[0.055] p-4 font-medium text-rose-300 transition-all hover:bg-rose-500/[0.08] active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </section>
      ) : (
        <section className="stagger-item space-y-3 px-1">
          <button
            onClick={() => router.push(buildLoginUrl(getReturnToFromLocation()))}
            className={liquidButtonClass({
              variant: 'action',
              className: 'w-full rounded-[1rem] p-4',
            })}
          >
            <User className="w-5 h-5" />
            Sign in
          </button>
        </section>
      )}
    </div>
  );
}
