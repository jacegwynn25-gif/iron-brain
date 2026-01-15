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
import type { WorkoutSession } from '../lib/types';
import { storage, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import type { Database } from '../lib/supabase/database.types';
import { parseLocalDate } from '../lib/dateUtils';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  rememberUntil?: number | null;
};

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
      if (user?.id) return user.id;
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
    { icon: Settings, label: 'Preferences', path: '/profile/settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Profile</h1>
        </div>

        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {user?.email?.split('@')[0] || profile?.name || 'Guest User'}
            </h2>
            <p className="text-gray-300 text-sm">
              {user ? user.email : profile?.email || 'Not signed in'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 sm:mb-8">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 text-center border border-white/10">
            <div className="text-2xl font-bold text-white">{workoutHistory.length}</div>
            <div className="text-xs text-gray-400">Workouts</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 text-center border border-white/10">
            <div className="text-2xl font-bold text-white">{weeklyStreak}</div>
            <div className="text-xs text-gray-400">Week Streak</div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 text-center border border-white/10">
            <div className="text-2xl font-bold text-white">{prCount}</div>
            <div className="text-xs text-gray-400">PRs</div>
          </div>
        </div>

        <div className="space-y-2 mb-6 sm:mb-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="w-full bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-gray-400" />
                  <span className="text-white font-semibold">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            );
          })}
        </div>

        {user && (
          <button
            onClick={() => signOut()}
            className="w-full bg-red-500/10 rounded-xl p-4 border border-red-500/20 flex items-center justify-center gap-2 text-red-400 font-medium hover:bg-red-500/20 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
