'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, TrendingUp, Flame, ChevronRight, Dumbbell } from 'lucide-react';
import type { ProgramTemplate, DayTemplate } from './lib/types';
import { useAuth } from './lib/supabase/auth-context';
import { parseLocalDate } from './lib/dateUtils';
import { useWorkoutData } from './lib/hooks/useWorkoutData';
import { AuthGuard } from './components/Auth';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  rememberUntil?: number | null;
};

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { workoutHistory } = useWorkoutData();
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
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);
  const namespaceId = user?.id ?? profile?.id ?? null;

  const userProgramsKey = useMemo(
    () => (namespaceId ? `iron_brain_user_programs__${namespaceId}` : 'iron_brain_user_programs_default'),
    [namespaceId]
  );
  const selectedProgramKey = useMemo(
    () => (namespaceId ? `iron_brain_selected_program__${namespaceId}` : 'iron_brain_selected_program__guest'),
    [namespaceId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPrograms = localStorage.getItem(userProgramsKey);
    const localPrograms: ProgramTemplate[] = storedPrograms ? JSON.parse(storedPrograms) : [];

    const storedId = localStorage.getItem(selectedProgramKey);
    if (storedId) {
      const program = localPrograms.find(p => p.id === storedId) || null;
      setSelectedProgram(program);
    } else {
      setSelectedProgram(null);
    }
  }, [userProgramsKey, selectedProgramKey]);

  const todayWorkout = useMemo(() => {
    if (!selectedProgram) return null;

    // Get today's actual day of the week
    const dayOrder: DayTemplate['dayOfWeek'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayLabel = dayOrder[new Date().getDay()] as DayTemplate['dayOfWeek'];

    // Search all weeks for a day matching today
    for (const week of selectedProgram.weeks) {
      const matchingDay = week.days.find(d => d.dayOfWeek === todayLabel);
      if (matchingDay) {
        return {
          name: matchingDay.name || 'Training Day',
          weekNumber: week.weekNumber || 1,
          dayLabel: todayLabel,  // Use actual today's day
          setCount: matchingDay.sets.length,
          exerciseCount: new Set(matchingDay.sets.map(s => s.exerciseId)).size,
        };
      }
    }

    // Fallback: if no day matches today, show first available day
    const firstWeek = selectedProgram.weeks?.[0];
    const firstDay = firstWeek?.days?.[0];
    if (!firstDay) return null;

    return {
      name: firstDay.name || 'Training Day',
      weekNumber: firstWeek.weekNumber || 1,
      dayLabel: firstDay.dayOfWeek,
      setCount: firstDay.sets.length,
      exerciseCount: new Set(firstDay.sets.map(s => s.exerciseId)).size,
    };
  }, [selectedProgram]);

  const workoutsThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return workoutHistory.filter(session => {
      const date = parseLocalDate(session.date);
      return date >= startOfWeek;
    });
  }, [workoutHistory]);

  const weeklyVolume = useMemo(() => {
    return workoutsThisWeek.reduce((sum, session) => {
      const sessionVolume = session.sets.reduce((setSum, set) => {
        return setSum + ((set.actualWeight || 0) * (set.actualReps || 0));
      }, 0);
      return sum + sessionVolume;
    }, 0);
  }, [workoutsThisWeek]);

  const recentWorkouts = workoutHistory.slice(0, 2);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <p className="text-gray-500 text-sm">Welcome back</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Iron Brain</h1>
        </div>

        <section className="mb-6 sm:mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-2">
              <Calendar className="w-4 h-4" />
              Today&apos;s Workout
            </div>
            {todayWorkout ? (
              <>
                <h2 className="text-xl font-bold text-white mb-1">{todayWorkout.name}</h2>
                <p className="text-gray-300 text-sm mb-4">
                  Week {todayWorkout.weekNumber} • {todayWorkout.dayLabel} • {todayWorkout.exerciseCount} exercises
                </p>
                <button
                  onClick={() => router.push('/start')}
                  className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-500 rounded-xl py-3 px-4 text-white font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                >
                  Start Workout
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-1">No program selected</h2>
                <p className="text-gray-300 text-sm mb-4">
                  Choose a program to get today&apos;s workout.
                </p>
                <button
                  onClick={() => router.push('/programs')}
                  className="w-full bg-white/10 rounded-xl py-3 px-4 text-white font-semibold border border-white/10 transition-all active:scale-[0.98]"
                >
                  Select Program
                </button>
              </>
            )}
          </div>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            This Week
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium">Workouts</span>
              </div>
              <div className="text-2xl font-bold text-white">{workoutsThisWeek.length}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Volume</span>
              </div>
              <div className="text-2xl font-bold text-white">{Math.round(weeklyVolume / 1000)}k</div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Recent Activity
            </h2>
            <button
              onClick={() => router.push('/history')}
              className="rounded-lg px-3 py-2 text-purple-400 text-sm font-medium hover:bg-purple-500/10 transition-all"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentWorkouts.length === 0 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Dumbbell className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">No workouts yet</div>
                    <div className="text-gray-500 text-sm">Start your first session from the Start tab.</div>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/start')}
                  className="mt-3 w-full rounded-xl bg-white/10 border border-white/10 py-3 px-4 text-white font-medium transition-all active:scale-[0.98]"
                >
                  Start a Workout
                </button>
              </div>
            )}
            {recentWorkouts.map(session => (
              <div key={session.id} className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{session.dayName || session.programName || 'Workout'}</div>
                    <div className="text-gray-500 text-sm">
                      {parseLocalDate(session.date).toLocaleDateString()} • {session.durationMinutes || '--'} min
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      </div>
    </AuthGuard>
  );
}
