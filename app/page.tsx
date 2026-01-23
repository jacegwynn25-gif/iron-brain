'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, TrendingUp, Flame, ChevronRight, Dumbbell } from 'lucide-react';
import type { ProgramTemplate, DayTemplate } from './lib/types';
import { normalizePrograms } from './lib/programs/normalize';
import { useAuth } from './lib/supabase/auth-context';
import { parseLocalDate } from './lib/dateUtils';
import { useWorkoutData } from './lib/hooks/useWorkoutData';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { workoutHistory } = useWorkoutData();
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);

  // Unified namespace: user ID if authenticated, 'guest' for offline mode
  const namespaceId = user?.id ?? 'guest';

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
    const localNormalized = normalizePrograms(localPrograms);
    if (localNormalized.changedPrograms.length > 0) {
      localStorage.setItem(userProgramsKey, JSON.stringify(localNormalized.programs));
    }

    const storedId = localStorage.getItem(selectedProgramKey);
    if (storedId) {
      const program = localNormalized.programs.find(p => p.id === storedId) || null;
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
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <p className="section-label">Dashboard</p>
          <h1 className="mt-3 text-3xl font-black text-white">Iron Brain</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Your training status and next session at a glance.
          </p>
        </header>

        <section className="space-y-4">
          <div>
            <p className="section-label">Next Session</p>
            <h2 className="mt-2 text-xl font-bold text-white">Workout</h2>
          </div>
          <div className="surface-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              <Calendar className="w-4 h-4 text-zinc-500" />
              Scheduled Session
            </div>
            {todayWorkout ? (
              <>
                <h3 className="text-xl font-bold text-white mb-1">{todayWorkout.name}</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Week {todayWorkout.weekNumber} • {todayWorkout.dayLabel} • {todayWorkout.exerciseCount} exercises
                </p>
                <button
                  onClick={() => router.push('/start')}
                  className="w-full btn-primary rounded-xl py-3 px-4 text-white font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                >
                  Start Workout
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-1">No program selected</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Choose a program to generate today&apos;s workout.
                </p>
                <button
                  onClick={() => router.push('/programs')}
                  className="w-full btn-secondary rounded-xl py-3 px-4 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Select Program
                </button>
              </>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="section-label">This Week</p>
            <h2 className="mt-2 text-xl font-bold text-white">Training Load</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-panel p-4 sm:p-5">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium text-zinc-300">Workouts</span>
              </div>
              <div className="text-2xl font-bold text-white">{workoutsThisWeek.length}</div>
            </div>
            <div className="surface-panel p-4 sm:p-5">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium text-zinc-300">Volume</span>
              </div>
              <div className="text-2xl font-bold text-white">{Math.round(weeklyVolume / 1000)}k</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">Recent Activity</p>
              <h2 className="mt-2 text-xl font-bold text-white">Latest sessions</h2>
            </div>
            <button
              onClick={() => router.push('/history')}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentWorkouts.length === 0 && (
              <div className="surface-panel p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Dumbbell className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">No workouts yet</div>
                    <div className="text-zinc-500 text-sm">Start your first session from the Start tab.</div>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/start')}
                  className="mt-3 w-full btn-secondary rounded-xl py-3 px-4 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Start a Workout
                </button>
              </div>
            )}
            {recentWorkouts.map(session => (
              <div key={session.id} className="surface-panel p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{session.dayName || session.programName || 'Workout'}</div>
                    <div className="text-zinc-500 text-sm">
                      {parseLocalDate(session.date).toLocaleDateString()} • {session.durationMinutes || '--'} min
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-500" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
