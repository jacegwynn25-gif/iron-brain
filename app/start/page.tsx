'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Zap, Calendar, Dumbbell } from 'lucide-react';
import type {
  DayTemplate,
  ProgramTemplate,
  WeekTemplate,
  WorkoutSession,
  UserProfile,
  SessionMetadata,
  SupabaseWorkoutSessionRow
} from '../lib/types';
import { storage, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth-context';
import { parseLocalDate } from '../lib/dateUtils';
import WorkoutLogger from '../components/WorkoutLogger';
import PreWorkoutReadiness from '../components/PreWorkoutReadiness';
import { normalizePrograms } from '../lib/programs/normalize';
import { loadProgramsFromCloudWithCleanup, saveProgramToCloud } from '../lib/supabase/program-sync';

export default function StartWorkoutPage() {
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
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);
  const [activeProgram, setActiveProgram] = useState<ProgramTemplate | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [stage, setStage] = useState<'select' | 'readiness' | 'workout'>('select');
  const namespaceId = user?.id ?? profile?.id ?? null;
  const quickStartProgram = useMemo<ProgramTemplate>(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const today = dayLabels[new Date().getDay()] ?? 'Mon';
    return {
      id: 'quick_start',
      name: 'Quick Start',
      description: 'Freestyle workout',
      isCustom: true,
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              dayOfWeek: today,
              name: 'Quick Workout',
              sets: [],
            },
          ],
        },
      ],
    };
  }, []);

  const userProgramsKey = useMemo(
    () => (namespaceId ? `iron_brain_user_programs__${namespaceId}` : 'iron_brain_user_programs_default'),
    [namespaceId]
  );
  const selectedProgramKey = useMemo(
    () => (namespaceId ? `iron_brain_selected_program__${namespaceId}` : 'iron_brain_selected_program__guest'),
    [namespaceId]
  );

  useEffect(() => {
    setUserNamespace(namespaceId);
  }, [namespaceId]);

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

  useEffect(() => {
    if (!user?.id) return;
    if (selectedProgram) return;
    let active = true;

    const loadPrograms = async () => {
      try {
        const { programs: cloudPrograms, changedPrograms } =
          await loadProgramsFromCloudWithCleanup(user.id);

        if (!active || cloudPrograms.length === 0) return;

        if (changedPrograms.length > 0) {
          await Promise.all(changedPrograms.map((program) => saveProgramToCloud(program, user.id)));
        }

        if (!active) return;

        localStorage.setItem(userProgramsKey, JSON.stringify(cloudPrograms));
        const storedId = localStorage.getItem(selectedProgramKey);
        const resolved =
          cloudPrograms.find((program) => program.id === storedId) ?? cloudPrograms[0] ?? null;
        if (resolved) {
          setSelectedProgram(resolved);
        }
      } catch (error) {
        console.error('Failed to load programs from cloud:', error);
      }
    };

    loadPrograms();

    return () => {
      active = false;
    };
  }, [user?.id, selectedProgram, selectedProgramKey, userProgramsKey]);

  const todayKey = useMemo(
    () => (typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''),
    []
  );

  const getSuggestedWeekAndDay = useCallback(
    (program: ProgramTemplate, history: WorkoutSession[], todayIso: string) => {
      const dayOrder: DayTemplate['dayOfWeek'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const todayLabel = dayOrder[new Date().getDay()] as DayTemplate['dayOfWeek'];
      const weeks = [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
      const findDayIndex = (week: WeekTemplate | undefined, day: DayTemplate['dayOfWeek']) =>
        week ? week.days.findIndex(d => d.dayOfWeek === day) : -1;
      const findWeek = (weekNumber: number) => program.weeks.find(w => w.weekNumber === weekNumber);
      const nextWeekNumber = (current: number) => {
        const idx = weeks.findIndex(w => w.weekNumber === current);
        return weeks[Math.min(idx + 1, weeks.length - 1)]?.weekNumber ?? current;
      };

      const historyForProgram = [...history]
        .filter(h => h.programId === program.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (historyForProgram.length === 0) {
        const weekWithToday = weeks.find(w => findDayIndex(w, todayLabel) !== -1) ?? weeks[0];
        const dayIdx = findDayIndex(weekWithToday, todayLabel);
        return {
          week: weekWithToday.weekNumber,
          dayIndex: dayIdx !== -1 ? dayIdx : 0,
        };
      }

      const lastSession = historyForProgram[0];
      const lastWeek = findWeek(lastSession.weekNumber) ?? weeks[0];
      const lastDayIdx = findDayIndex(lastWeek, lastSession.dayOfWeek as DayTemplate['dayOfWeek']);
      const todayIdxInLastWeek = findDayIndex(lastWeek, todayLabel);
      const todayAfterLast = todayIso > lastSession.date;

      if (todayIdxInLastWeek !== -1) {
        const wrappedToNewCalendarWeek = todayAfterLast && lastDayIdx !== -1 && todayIdxInLastWeek < lastDayIdx;
        if (wrappedToNewCalendarWeek) {
          const nextWeekNum = nextWeekNumber(lastWeek.weekNumber);
          const nextWeek = findWeek(nextWeekNum) ?? lastWeek;
          const dayIdx = findDayIndex(nextWeek, todayLabel);
          return { week: nextWeek.weekNumber, dayIndex: dayIdx !== -1 ? dayIdx : 0 };
        }

        if (todayAfterLast || todayIdxInLastWeek >= lastDayIdx) {
          return { week: lastWeek.weekNumber, dayIndex: todayIdxInLastWeek };
        }
        const nextWeekNum = nextWeekNumber(lastWeek.weekNumber);
        const nextWeek = findWeek(nextWeekNum) ?? lastWeek;
        const dayIdx = findDayIndex(nextWeek, todayLabel);
        return { week: nextWeek.weekNumber, dayIndex: dayIdx !== -1 ? dayIdx : 0 };
      }

      if (lastDayIdx !== -1 && lastDayIdx < lastWeek.days.length - 1 && todayAfterLast) {
        return { week: lastWeek.weekNumber, dayIndex: lastDayIdx + 1 };
      }

      const nextWeekNum = nextWeekNumber(lastWeek.weekNumber);
      const nextWeek = findWeek(nextWeekNum) ?? lastWeek;
      const dayIdx = findDayIndex(nextWeek, todayLabel);
      return { week: nextWeek.weekNumber, dayIndex: dayIdx !== -1 ? dayIdx : 0 };
    },
    []
  );

  const suggestedDay = useMemo(() => {
    if (!selectedProgram) return null;
    const suggestion = getSuggestedWeekAndDay(selectedProgram, workoutHistory, todayKey);
    const week = selectedProgram.weeks.find(w => w.weekNumber === suggestion.week) ?? selectedProgram.weeks[0];
    const day = week?.days[suggestion.dayIndex];
    if (!day) return null;
    return {
      ...suggestion,
      name: day.name,
      dayLabel: day.dayOfWeek,
      setCount: day.sets.length,
      exerciseCount: new Set(day.sets.map(s => s.exerciseId)).size,
    };
  }, [selectedProgram, workoutHistory, todayKey, getSuggestedWeekAndDay]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hidden = stage !== 'select';
    localStorage.setItem('iron_brain_hide_bottom_nav', hidden ? 'true' : 'false');
    window.dispatchEvent(new Event('iron_brain_nav_visibility'));
    return () => {
      localStorage.setItem('iron_brain_hide_bottom_nav', 'false');
      window.dispatchEvent(new Event('iron_brain_nav_visibility'));
    };
  }, [stage]);

  const handleContinue = () => {
    if (!selectedProgram || !suggestedDay) {
      router.push('/programs');
      return;
    }
    setActiveProgram(selectedProgram);
    setSelectedWeek(suggestedDay.week);
    setSelectedDayIndex(suggestedDay.dayIndex);
    // Skip readiness check for now - goes straight to workout
    setStage('workout');
  };

  const handleQuickStart = () => {
    setActiveProgram(quickStartProgram);
    setSelectedWeek(1);
    setSelectedDayIndex(0);
    setStage('workout');
  };

  const handleChooseDay = () => {
    localStorage.setItem('iron_brain_focus_day_picker', 'true');
    router.push('/programs');
  };

  if (stage === 'readiness' && activeProgram && selectedDayIndex !== null) {
    const week = activeProgram.weeks.find(w => w.weekNumber === selectedWeek);
    const day = week?.days[selectedDayIndex];
    return (
      <PreWorkoutReadiness
        userId={user?.id || null}
        plannedExerciseIds={day ? Array.from(new Set(day.sets.map(s => s.exerciseId))) : undefined}
        onContinue={() => setStage('workout')}
        onCancel={() => {
          setStage('select');
          setSelectedDayIndex(null);
          setActiveProgram(null);
        }}
      />
    );
  }

  if (stage === 'workout' && activeProgram && selectedDayIndex !== null) {
    return (
      <WorkoutLogger
        program={activeProgram}
        weekNumber={selectedWeek}
        dayIndex={selectedDayIndex}
        onComplete={(session) => {
          void storage.saveWorkout(session, user?.id);
        }}
        showSummaryOnComplete
        onSummaryClose={() => {
          setStage('select');
          setSelectedDayIndex(null);
          setActiveProgram(null);
          router.push('/');
        }}
        onCancel={() => {
          setStage('select');
          setSelectedDayIndex(null);
          setActiveProgram(null);
        }}
      />
    );
  }

  const recentWorkouts = workoutHistory.slice(0, 3);

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <p className="section-label">Start</p>
          <h1 className="mt-3 text-3xl font-black text-white">Start Workout</h1>
          <p className="mt-2 text-sm text-zinc-400">Choose how you want to train today.</p>
        </header>

        <section className="space-y-4 max-w-3xl mx-auto">
          <button
            onClick={handleContinue}
            className="w-full btn-primary rounded-xl p-4 sm:p-5 text-left shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-lg">Continue Program</div>
                <div className="text-gray-200 text-sm">
                  {suggestedDay
                    ? `Week ${suggestedDay.week}, ${suggestedDay.dayLabel} - ${suggestedDay.name}`
                    : 'No active program selected'}
                </div>
              </div>
              <Play className="w-8 h-8 text-white" fill="white" />
            </div>
          </button>

          <button
            onClick={handleQuickStart}
            className="w-full surface-panel rounded-xl p-4 sm:p-5 text-left hover:border-white/20 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/20">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">Quick Start</div>
                <div className="text-gray-400 text-sm">Build a workout on the fly</div>
              </div>
            </div>
          </button>

          <button
            onClick={handleChooseDay}
            className="w-full surface-panel rounded-xl p-4 sm:p-5 text-left hover:border-white/20 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20">
                <Dumbbell className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">Choose Different Day</div>
                <div className="text-gray-400 text-sm">Pick from your program</div>
              </div>
            </div>
          </button>
        </section>

        <section className="space-y-4 max-w-3xl mx-auto">
          <div>
            <p className="section-label">Recent</p>
            <h2 className="mt-2 text-xl font-bold text-white">Recent Workouts</h2>
          </div>
          <div className="space-y-2">
            {recentWorkouts.length === 0 && (
              <div className="surface-panel rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Play className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">No recent sessions</div>
                    <div className="text-zinc-500 text-sm">Start your first workout now.</div>
                  </div>
                </div>
                <button
                  onClick={handleQuickStart}
                  className="mt-3 w-full btn-secondary rounded-xl py-3 px-4 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Quick Start
                </button>
              </div>
            )}
            {recentWorkouts.map(session => (
              <div key={session.id} className="surface-panel rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-semibold">{session.dayName || session.programName || 'Workout'}</div>
                    <div className="text-zinc-500 text-xs">{parseLocalDate(session.date).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={handleContinue}
                    className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
                  >
                    Repeat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
