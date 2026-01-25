'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { allPrograms } from '../lib/programs';
import type {
  ProgramTemplate,
  WorkoutSession,
  WeekTemplate,
  DayTemplate,
  SessionMetadata,
  SupabaseSetLogRow,
  SupabaseWorkoutSessionRow,
} from '../lib/types';
import ProgramBuilder from '../components/ProgramBuilder';
import ProgramCreationChoice, { CreationChoice } from '../components/ProgramCreationChoice';
import IntelligentProgramBuilder from '../components/IntelligentProgramBuilder';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { storage, setUserNamespace } from '../lib/storage';
import { useAuth } from '../lib/supabase/auth-context';
import { supabase } from '../lib/supabase/client';
import {
  loadProgramsFromCloudWithCleanup,
  saveProgramToCloud,
  mergeProgramsWithCloud,
  deleteProgramFromCloud,
} from '../lib/supabase/program-sync';
import { buildLoginUrl, getReturnToFromLocation } from '../lib/auth/redirects';
import { normalizePrograms } from '../lib/programs/normalize';
import ActiveProgramHero from '../components/programs/ActiveProgramHero';
import ProgramGrid from '../components/programs/ProgramGrid';
import ProgramCard from '../components/programs/ProgramCard';
import ProgramDetailModal from '../components/programs/ProgramDetailModal';
import { flushUiEvents, trackUiEvent } from '../lib/analytics/ui-events';

export default function ProgramsPage() {
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const namespaceId = user?.id ?? 'guest';

  const [userPrograms, setUserPrograms] = useState<ProgramTemplate[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingProgramForBuilder, setEditingProgramForBuilder] = useState<ProgramTemplate | undefined>(undefined);
  const [showCreationChoice, setShowCreationChoice] = useState(false);
  const [showIntelligentBuilder, setShowIntelligentBuilder] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [programDetail, setProgramDetail] = useState<ProgramTemplate | null>(null);
  const [pendingAction, setPendingAction] = useState<'builder' | 'detail' | null>(null);
  const [todayKey, setTodayKey] = useState<string>(() =>
    typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  );
  const builtInProgramIds = useMemo(
    () => new Set(allPrograms.map((program) => program.id)),
    []
  );

  const userProgramsKey = useMemo(
    () => (namespaceId ? `iron_brain_user_programs__${namespaceId}` : 'iron_brain_user_programs_default'),
    [namespaceId]
  );
  const selectedProgramKey = useMemo(
    () => (namespaceId ? `iron_brain_selected_program__${namespaceId}` : 'iron_brain_selected_program__guest'),
    [namespaceId]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    void flushUiEvents(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateNavVisibility = (hidden: boolean) => {
      localStorage.setItem('iron_brain_hide_bottom_nav', hidden ? 'true' : 'false');
      window.dispatchEvent(new Event('iron_brain_nav_visibility'));
    };
    updateNavVisibility(isBuilding);
    return () => updateNavVisibility(false);
  }, [isBuilding]);

  useEffect(() => {
    const updateToday = () => setTodayKey(new Date().toISOString().split('T')[0]);
    updateToday();
    const interval = setInterval(updateToday, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    if (pendingAction) return;
    const openBuilder = localStorage.getItem('iron_brain_open_program_builder') === 'true';
    const focusDayPicker = localStorage.getItem('iron_brain_focus_day_picker') === 'true';

    if (openBuilder) {
      localStorage.removeItem('iron_brain_open_program_builder');
      setPendingAction('builder');
      return;
    }
    if (focusDayPicker) {
      localStorage.removeItem('iron_brain_focus_day_picker');
      setPendingAction('detail');
    }
  }, [hydrated, pendingAction]);

  const loadWorkoutsFromBothSources = useCallback(async () => {
    const localWorkouts = storage.getWorkoutHistory();
    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();
    const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

    if (!user) {
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
        .eq('user_id', user.id)
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
          sets: (s.set_logs || []).map((set: SupabaseSetLogRow) => ({
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
      const supabaseIds = new Set(supabaseWorkouts.map((w) => w.id));
      const localOnlyWorkouts = localWorkouts.filter((w) => !supabaseIds.has(stripPrefix(w.id)));

      const mergedWorkouts = [...supabaseWorkouts, ...localOnlyWorkouts].sort(
        (a, b) => getSortTime(b) - getSortTime(a)
      );

      setWorkoutHistory(mergedWorkouts);
    } catch (err) {
      console.error('Error loading from Supabase:', err);
      setWorkoutHistory(sortedLocalWorkouts);
    }
  }, [user]);

  useEffect(() => {
    loadWorkoutsFromBothSources();
  }, [loadWorkoutsFromBothSources]);

  const loadProgramsFromBothSources = useCallback(async () => {
    const savedPrograms = localStorage.getItem(userProgramsKey);
    const localPrograms: ProgramTemplate[] = savedPrograms ? JSON.parse(savedPrograms) : [];
    const localNormalized = normalizePrograms(localPrograms);
    const normalizedLocalPrograms = localNormalized.programs;
    if (localNormalized.changedPrograms.length > 0) {
      localStorage.setItem(userProgramsKey, JSON.stringify(normalizedLocalPrograms));
    }

    if (!user) {
      setUserPrograms(normalizedLocalPrograms);
      return;
    }

    try {
      const { programs: cloudPrograms, changedPrograms: cloudChanged } =
        await loadProgramsFromCloudWithCleanup(user.id);

      const mergedPrograms = mergeProgramsWithCloud(normalizedLocalPrograms, cloudPrograms);
      const mergedNormalized = normalizePrograms(mergedPrograms);
      const finalPrograms = mergedNormalized.programs;

      setUserPrograms(finalPrograms);
      localStorage.setItem(userProgramsKey, JSON.stringify(finalPrograms));

      if (cloudChanged.length > 0) {
        cloudChanged.forEach((program) => {
          void saveProgramToCloud(program, user.id);
        });
      }
    } catch (err) {
      console.error('Error loading programs from cloud:', err);
      setUserPrograms(normalizedLocalPrograms);
    }
  }, [user, userProgramsKey]);

  useEffect(() => {
    setUserNamespace(user?.id ?? null);
    loadProgramsFromBothSources();
  }, [loadProgramsFromBothSources, user]);

  const getSuggestedWeekAndDay = useCallback((program: ProgramTemplate, history: WorkoutSession[], todayIso: string) => {
    const dayOrder: DayTemplate['dayOfWeek'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayLabel = dayOrder[new Date().getDay()] as DayTemplate['dayOfWeek'];
    const weeks = [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
    const findDayIndex = (week: WeekTemplate | undefined, day: DayTemplate['dayOfWeek']) =>
      week ? week.days.findIndex((d) => d.dayOfWeek === day) : -1;
    const findWeek = (weekNumber: number) => program.weeks.find((w) => w.weekNumber === weekNumber);
    const nextWeekNumber = (current: number) => {
      const idx = weeks.findIndex((w) => w.weekNumber === current);
      return weeks[Math.min(idx + 1, weeks.length - 1)]?.weekNumber ?? current;
    };

    const historyForProgram = [...history]
      .filter((h) => h.programId === program.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historyForProgram.length === 0) {
      const weekWithToday = weeks.find((w) => findDayIndex(w, todayLabel) !== -1) ?? weeks[0];
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
  }, []);

  const createId = useCallback((prefix: string) => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const resolveProgramSelection = useCallback((program: ProgramTemplate) => {
    const isBuiltIn = builtInProgramIds.has(program.id);
    if (!isBuiltIn) return program;

    const existingClone = userPrograms.find((p) =>
      p.name === program.name && p.id.startsWith('userprog_')
    );
    if (existingClone) {
      return existingClone;
    }

    const clone: ProgramTemplate = {
      ...program,
      id: `userprog_${createId('prog')}`,
    };
    const updatedUserPrograms = [...userPrograms, clone];
    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));
    return clone;
  }, [userPrograms, userProgramsKey, createId, builtInProgramIds]);

  const trackProgramEvent = useCallback(
    (name: string, program: ProgramTemplate, origin: string) => {
      void trackUiEvent(
        {
          name,
          source: 'programs',
          properties: {
            programId: program.id,
            programName: program.name,
            origin,
            isBuiltIn: builtInProgramIds.has(program.id),
          },
        },
        user?.id ?? null
      );
    },
    [builtInProgramIds, user?.id]
  );

  useEffect(() => {
    if (!pendingAction || isBuilding) return;
    if (pendingAction === 'builder') {
      setEditingProgramForBuilder(undefined);
      setIsBuilding(true);
      setPendingAction(null);
      return;
    }
    if (pendingAction === 'detail' && selectedProgram) {
      trackProgramEvent('program_view_schedule', selectedProgram, 'start_redirect');
      setProgramDetail(selectedProgram);
      setPendingAction(null);
    }
  }, [pendingAction, isBuilding, selectedProgram, trackProgramEvent]);

  const handleSelectProgram = useCallback((program: ProgramTemplate) => {
    const resolved = resolveProgramSelection(program);
    localStorage.setItem(selectedProgramKey, resolved.id);
    setSelectedProgram(resolved);
  }, [resolveProgramSelection, selectedProgramKey]);

  useEffect(() => {
    if (!hydrated || selectedProgram) return;
    if (typeof window === 'undefined') return;
    const storedId = localStorage.getItem(selectedProgramKey);
    if (!storedId) return;
    const program =
      userPrograms.find((p) => p.id === storedId) ||
      allPrograms.find((p) => p.id === storedId) ||
      null;
    if (program) {
      handleSelectProgram(program);
    }
  }, [hydrated, selectedProgram, selectedProgramKey, userPrograms, handleSelectProgram]);

  const handleDeleteProgram = useCallback(async (programId: string) => {
    const updatedUserPrograms = userPrograms.filter((p) => p.id !== programId);
    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    if (user) {
      await deleteProgramFromCloud(programId, user.id);
    }

    if (selectedProgram?.id === programId) {
      setSelectedProgram(null);
      localStorage.removeItem(selectedProgramKey);
    }
    if (programDetail?.id === programId) {
      setProgramDetail(null);
    }
  }, [userPrograms, userProgramsKey, user, selectedProgram?.id, selectedProgramKey, programDetail?.id]);

  const handleCreateNewFromBuilder = () => {
    setEditingProgramForBuilder(undefined);
    setShowCreationChoice(true);
  };

  const handleCreationChoice = (choice: CreationChoice) => {
    setShowCreationChoice(false);
    switch (choice) {
      case 'template':
        if (typeof window !== 'undefined') {
          document.getElementById('standard-issue')?.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'manual':
        setIsBuilding(true);
        break;
      case 'intelligent':
        setShowIntelligentBuilder(true);
        break;
    }
  };

  const handleIntelligentBuilderComplete = async (program: ProgramTemplate) => {
    setShowIntelligentBuilder(false);

    const updatedUserPrograms = [...userPrograms, program];
    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    if (user) {
      await saveProgramToCloud(program, user.id);
      console.log(`Saved generated program "${program.name}" to cloud`);
    }

    localStorage.setItem(selectedProgramKey, program.id);
    setSelectedProgram(program);
  };

  const handleSaveProgramFromBuilder = async (program: ProgramTemplate) => {
    const isUpdating = userPrograms.some((p) => p.id === program.id);

    const updatedUserPrograms = isUpdating
      ? userPrograms.map((p) => (p.id === program.id ? program : p))
      : [...userPrograms, program];

    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    if (user) {
      await saveProgramToCloud(program, user.id);
      console.log(`Saved program "${program.name}" to cloud`);
    }

    setIsBuilding(false);
    setEditingProgramForBuilder(undefined);
    localStorage.setItem(selectedProgramKey, program.id);
    setSelectedProgram(program);
  };

  const handleOpenProgramDetail = useCallback(
    (program: ProgramTemplate, origin: string) => {
      trackProgramEvent('program_card_opened', program, origin);
      setProgramDetail(program);
    },
    [trackProgramEvent]
  );

  const handleEditProgram = useCallback(
    (program: ProgramTemplate) => {
      const resolved = resolveProgramSelection(program);
      setProgramDetail(null);
      setEditingProgramForBuilder(resolved);
      setIsBuilding(true);
    },
    [resolveProgramSelection]
  );

  const handleSetActiveProgram = useCallback(
    (program: ProgramTemplate, origin: string) => {
      trackProgramEvent('program_set_active', program, origin);
      handleSelectProgram(program);
      setProgramDetail(null);
    },
    [handleSelectProgram, trackProgramEvent]
  );

  const handleBrowseLibrary = useCallback(() => {
    if (typeof window === 'undefined') return;
    document.getElementById('program-library')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleViewSchedule = useCallback(() => {
    if (!selectedProgram) return;
    trackProgramEvent('program_view_schedule', selectedProgram, 'hero');
    setProgramDetail(selectedProgram);
  }, [selectedProgram, trackProgramEvent]);

  const normalizedLibraryQuery = libraryQuery.trim().toLowerCase();
  const filterPrograms = useCallback(
    (programs: ProgramTemplate[]) => {
      if (!normalizedLibraryQuery) return programs;
      return programs.filter((program) => {
        const haystack = [
          program.name,
          program.description,
          program.goal,
          program.experienceLevel,
          program.intensityMethod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedLibraryQuery);
      });
    },
    [normalizedLibraryQuery]
  );

  const filteredBuiltInPrograms = useMemo(
    () => filterPrograms(allPrograms),
    [filterPrograms]
  );
  const filteredUserPrograms = useMemo(
    () => filterPrograms(userPrograms),
    [userPrograms, filterPrograms]
  );

  const activeProgramMeta = useMemo(() => {
    if (!selectedProgram) return null;
    const suggestion = getSuggestedWeekAndDay(selectedProgram, workoutHistory, todayKey);
    const sortedWeeks = [...selectedProgram.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
    const activeWeek = sortedWeeks.find((week) => week.weekNumber === suggestion.week) ?? sortedWeeks[0];
    if (!activeWeek) return null;

    const weekIndex = sortedWeeks.findIndex((week) => week.weekNumber === activeWeek.weekNumber);
    const daysTotal = activeWeek.days.length;
    const completedDays = daysTotal > 0
      ? new Set(
          workoutHistory
            .filter((session) =>
              session.programId === selectedProgram.id
              && session.weekNumber === activeWeek.weekNumber
              && session.dayOfWeek
            )
            .map((session) => session.dayOfWeek)
        ).size
      : 0;

    const safeCompleted = Math.min(completedDays, daysTotal);
    const progress = daysTotal ? safeCompleted / daysTotal : 0;
    const nextDay = activeWeek.days[suggestion.dayIndex];
    const nextSession = nextDay
      ? {
          dayOfWeek: nextDay.dayOfWeek,
          name: nextDay.name,
          exerciseCount: new Set(nextDay.sets.map((set) => set.exerciseId)).size,
          setCount: nextDay.sets.length,
        }
      : null;
    const lastSession = workoutHistory.find((session) => session.programId === selectedProgram.id);
    const lastSessionDate = lastSession
      ? new Date(lastSession.endTime || lastSession.startTime || lastSession.date).toLocaleDateString()
      : null;
    const cadenceLabel = `${activeWeek.days.length || selectedProgram.daysPerWeek || 0} days/week`;

    return {
      weekNumber: activeWeek.weekNumber,
      weekPosition: weekIndex >= 0 ? weekIndex + 1 : 1,
      weekTotal: sortedWeeks.length || 1,
      daysTotal,
      daysCompleted: safeCompleted,
      progress,
      nextSession,
      lastSessionDate,
      cadenceLabel,
    };
  }, [selectedProgram, workoutHistory, todayKey, getSuggestedWeekAndDay]);

  if (!hydrated) {
    return (
      <div className="min-h-screen safe-top app-gradient" />
    );
  }

  const detailIsBuiltIn = programDetail
    ? builtInProgramIds.has(programDetail.id)
    : false;
  const detailIsActive = programDetail && selectedProgram
    ? programDetail.id === selectedProgram.id
    : false;

  return (
    <div className="min-h-screen safe-top app-gradient">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-10">
          <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.45em] text-zinc-500">Programs</p>
                <h1 className="mt-3 text-3xl font-black text-white">Programs</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Build, review, and manage your training programs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden sm:flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-4 text-xs text-zinc-300">
                  {user ? <SyncStatusIndicator /> : <span>Local-only storage</span>}
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewFromBuilder}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition-all hover:bg-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  Create Program
                </button>
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <ActiveProgramHero
              program={selectedProgram}
              weekPosition={activeProgramMeta?.weekPosition}
              weekTotal={activeProgramMeta?.weekTotal}
              daysCompleted={activeProgramMeta?.daysCompleted}
              daysTotal={activeProgramMeta?.daysTotal}
              progress={activeProgramMeta?.progress}
              cadenceLabel={activeProgramMeta?.cadenceLabel}
              lastSessionLabel={activeProgramMeta?.lastSessionDate}
              nextSession={activeProgramMeta?.nextSession ?? null}
              onViewSchedule={handleViewSchedule}
              onEdit={() => selectedProgram && handleEditProgram(selectedProgram)}
              onCreate={handleCreateNewFromBuilder}
              onBrowseLibrary={handleBrowseLibrary}
            />
          </section>

          <section id="program-library" className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Program Library</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Your programs</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Saved and in-progress programs. Tap to view or set active.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                <input
                  type="text"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder="Filter programs"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateNewFromBuilder}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
                >
                  <Plus className="h-4 w-4" />
                  New
                </button>
              </div>
            </div>

            {!user && (
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                <span>Backup your programs with cloud sync.</span>
                <button
                  type="button"
                  onClick={() => router.push(buildLoginUrl(getReturnToFromLocation()))}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-all hover:bg-amber-500/30"
                >
                  Enable
                </button>
              </div>
            )}

            <ProgramGrid
              programs={filteredUserPrograms}
              activeProgramId={selectedProgram?.id}
              onOpenProgram={(program) => handleOpenProgramDetail(program, 'library')}
              onSetActive={(program) => handleSetActiveProgram(program, 'library_quick')}
              onCreate={handleCreateNewFromBuilder}
            />
          </section>

          <section id="standard-issue" className="space-y-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Templates</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Built-in templates</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Read-only templates. Clone to customize.
              </p>
            </div>
            {filteredBuiltInPrograms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-6 text-sm text-zinc-400">
                No templates match that filter.
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {filteredBuiltInPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    variant="template"
                    onOpen={(value) => handleOpenProgramDetail(value, 'standard_issue')}
                    onSetActive={(value) => handleSetActiveProgram(value, 'standard_issue_quick')}
                    setActiveLabel="Use"
                  />
                ))}
              </div>
            )}
          </section>
      </div>

      {programDetail && (
        <ProgramDetailModal
          program={programDetail}
          activeWeekNumber={detailIsActive ? activeProgramMeta?.weekNumber : undefined}
          isActive={detailIsActive}
          isBuiltIn={detailIsBuiltIn}
          onClose={() => setProgramDetail(null)}
          onSetActive={() => handleSetActiveProgram(programDetail, 'detail_modal')}
          onEdit={() => handleEditProgram(programDetail)}
          onDelete={
            detailIsBuiltIn
              ? undefined
              : () => {
                  const confirmed = window.confirm('Delete this program? This cannot be undone.');
                  if (!confirmed) return;
                  void handleDeleteProgram(programDetail.id);
                }
          }
        />
      )}

      {showCreationChoice && (
        <ProgramCreationChoice
          onSelect={handleCreationChoice}
          onClose={() => setShowCreationChoice(false)}
        />
      )}

      {showIntelligentBuilder && (
        <IntelligentProgramBuilder
          onComplete={handleIntelligentBuilderComplete}
          onCancel={() => setShowIntelligentBuilder(false)}
        />
      )}

      {isBuilding && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-0 overflow-y-auto">
            <ProgramBuilder
              existingProgram={editingProgramForBuilder}
              onSave={handleSaveProgramFromBuilder}
              onCancel={() => {
                setIsBuilding(false);
                setEditingProgramForBuilder(undefined);
              }}
              userId={user?.id || null}
            />
          </div>
        </div>
      )}
    </div>
  );
}
