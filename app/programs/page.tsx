'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BarChart3, ChevronUp, Database as DatabaseIcon, Dumbbell, History, Plus, Sparkles, X } from 'lucide-react';
import { allPrograms, defaultExercises } from '../lib/programs';
import { Exercise, SetTemplate, ProgramTemplate, WorkoutSession, WeekTemplate, DayTemplate } from '../lib/types';
import WorkoutLogger from '../components/WorkoutLogger';
import ProgramBuilder from '../components/ProgramBuilder';
import ProgramSelector from '../components/ProgramSelector';
import PreWorkoutReadiness from '../components/PreWorkoutReadiness';
import ResumeWorkoutModal from '../components/ResumeWorkoutModal';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { storage, setUserNamespace } from '../lib/storage';
import { useAuth } from '../lib/supabase/auth-context';
import { supabase } from '../lib/supabase/client';
import { loadProgramsFromCloud, saveProgramToCloud, mergeProgramsWithCloud, deleteProgramFromCloud } from '../lib/supabase/program-sync';
import { calculateMuscleFatigue, FatigueScore } from '../lib/fatigueModel';
import { calculateWorkoutSFR } from '../lib/fatigue/sfr';
import { getActiveSession, clearActiveSession, type ActiveSessionState } from '../lib/workout/active-session';
import type { Database } from '../lib/supabase/database.types';

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

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth(); // Supabase auth
  const router = useRouter();

  // Ref to prevent auto-resume after workout completion
  const justCompletedWorkout = React.useRef(false);

  // Auth / profile
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    // Load saved profile from localStorage
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

  // Program management
  const [userPrograms, setUserPrograms] = useState<ProgramTemplate[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);
  const [originalProgram, setOriginalProgram] = useState<ProgramTemplate | null>(null);
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedProgram && !originalProgram) return false;
    if (!selectedProgram || !originalProgram) return true;
    return JSON.stringify(selectedProgram) !== JSON.stringify(originalProgram);
  }, [selectedProgram, originalProgram]);

  // Navigation state
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [todayKey, setTodayKey] = useState<string>(() =>
    typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  );
  const [userPinnedDay, setUserPinnedDay] = useState(false);

  // Workflow states
  const [isLogging, setIsLogging] = useState(false);
  const [showPreWorkoutReadiness, setShowPreWorkoutReadiness] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingProgramForBuilder, setEditingProgramForBuilder] = useState<ProgramTemplate | undefined>(undefined);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [rememberProfile, setRememberProfile] = useState(true);
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
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateNavVisibility = (hidden: boolean) => {
      localStorage.setItem('iron_brain_hide_bottom_nav', hidden ? 'true' : 'false');
      window.dispatchEvent(new Event('iron_brain_nav_visibility'));
    };
    updateNavVisibility(isLogging || showPreWorkoutReadiness);
    return () => {
      updateNavVisibility(false);
    };
  }, [isLogging, showPreWorkoutReadiness]);

  // Keep a lightweight "today" clock so we can auto-advance the UI each day
  useEffect(() => {
    const updateToday = () => setTodayKey(new Date().toISOString().split('T')[0]);
    updateToday();
    const interval = setInterval(updateToday, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // UI state for progressive disclosure
  // IMPORTANT: Week selector and day selector should be visible by default for better UX
  // Only hide program selector and advanced settings
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'builder' | 'day' | null>(null);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    if (pendingAction) return;
    const openBuilder = localStorage.getItem('iron_brain_open_program_builder') === 'true';
    const startWorkout = localStorage.getItem('iron_brain_start_workout') === 'true';
    const focusDayPicker = localStorage.getItem('iron_brain_focus_day_picker') === 'true';

    if (openBuilder) {
      localStorage.removeItem('iron_brain_open_program_builder');
      setPendingAction('builder');
      return;
    }
    if (startWorkout) {
      localStorage.removeItem('iron_brain_start_workout');
      setPendingAction('start');
      return;
    }
    if (focusDayPicker) {
      localStorage.removeItem('iron_brain_focus_day_picker');
      setPendingAction('day');
    }
  }, [hydrated, pendingAction]);

  // Data
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [summarySession, setSummarySession] = useState<WorkoutSession | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Calculate fatigue and SFR for completed workout summary
  const summaryFatigue = useMemo(() => {
    if (!summarySession || !summarySession.sets.length) return [];

    // Extract unique muscle groups from exercises in the session
    const muscleGroupsSet = new Set<string>();
    summarySession.sets.forEach(set => {
      const exercise = defaultExercises.find(ex => ex.id === set.exerciseId);
      if (exercise) {
        exercise.muscleGroups.forEach(mg => muscleGroupsSet.add(mg.toLowerCase()));
      }
    });
    const targetMuscles = Array.from(muscleGroupsSet);

    return calculateMuscleFatigue(summarySession.sets, targetMuscles);
  }, [summarySession]);

  const summarySFR = useMemo(() => {
    if (!summarySession || !summarySession.sets.length) return null;
    return calculateWorkoutSFR(summarySession.sets);
  }, [summarySession]);
  const [pendingSession, setPendingSession] = useState<ActiveSessionState | null>(null);
  const [resumePromptDismissed, setResumePromptDismissed] = useState(false);

  useEffect(() => {
    setResumePromptDismissed(false);
    setPendingSession(null);
  }, [profile?.id]);

  // Reusable function to load and merge workouts from both sources
  const loadWorkoutsFromBothSources = React.useCallback(async () => {
    // Always get localStorage workouts (offline-first)
    const localWorkouts = storage.getWorkoutHistory();
    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();
    const sortedLocalWorkouts = [...localWorkouts].sort((a, b) => getSortTime(b) - getSortTime(a));

    // If no user, just use localStorage
    if (!user) {
      setWorkoutHistory(sortedLocalWorkouts);
      return;
    }

    // If user is logged in, fetch from Supabase and merge
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
        // Fallback to localStorage on error
        setWorkoutHistory(sortedLocalWorkouts);
        return;
      }

      // Transform Supabase data to WorkoutSession format
      const sessionRows: SupabaseWorkoutSessionRow[] = sessions ?? [];
      const supabaseWorkouts: WorkoutSession[] = sessionRows.map((s) => {
        // Extract program metadata from JSONB column
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
          // Program metadata from JSONB column
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

      // Merge: Prefer Supabase for workouts with matching IDs, keep localStorage-only workouts
      // Strip "session_" prefix for comparison since localStorage has it but Supabase doesn't
      const stripPrefix = (id: string) => id.startsWith('session_') ? id.substring(8) : id;
      const supabaseIds = new Set(supabaseWorkouts.map(w => w.id));
      const localOnlyWorkouts = localWorkouts.filter(w => !supabaseIds.has(stripPrefix(w.id)));

      // Combine and sort by date (most recent first)
      const mergedWorkouts = [...supabaseWorkouts, ...localOnlyWorkouts].sort(
        (a, b) => getSortTime(b) - getSortTime(a)
      );

      setWorkoutHistory(mergedWorkouts);
      console.log('✅ Merged workouts:', {
        supabase: supabaseWorkouts.length,
        localOnly: localOnlyWorkouts.length,
        total: mergedWorkouts.length
      });
    } catch (err) {
      console.error('Error loading from Supabase:', err);
      // Fallback to localStorage on error
      setWorkoutHistory(localWorkouts);
    }
  }, [user]);

  // Load workouts on mount and when user changes
  useEffect(() => {
    loadWorkoutsFromBothSources();
  }, [loadWorkoutsFromBothSources]);

  // Reusable function to load and merge programs from both sources
  const loadProgramsFromBothSources = React.useCallback(async () => {
    // Always get localStorage programs (offline-first)
    const savedPrograms = localStorage.getItem(userProgramsKey);
    const localPrograms: ProgramTemplate[] = savedPrograms ? JSON.parse(savedPrograms) : [];

    // If no user, just use localStorage
    if (!user) {
      setUserPrograms(localPrograms);
      return;
    }

    // If user is logged in, fetch from Supabase and merge
    try {
      const cloudPrograms = await loadProgramsFromCloud(user.id);

      // Merge: prefer cloud for conflicts, keep local-only programs
      const mergedPrograms = mergeProgramsWithCloud(localPrograms, cloudPrograms);

      // Update state
      setUserPrograms(mergedPrograms);

      // Update localStorage with merged data
      localStorage.setItem(userProgramsKey, JSON.stringify(mergedPrograms));

      console.log('✅ Merged programs:', {
        cloud: cloudPrograms.length,
        localOnly: mergedPrograms.length - cloudPrograms.length,
        total: mergedPrograms.length,
      });
    } catch (err) {
      console.error('Error loading programs from cloud:', err);
      // Fallback to localStorage on error
      setUserPrograms(localPrograms);
    }
  }, [user, userProgramsKey]);

  // Load programs on mount and when user changes
  useEffect(() => {
    if (user) {
      loadProgramsFromBothSources();
    }
  }, [loadProgramsFromBothSources, user]);

  // Load user-scoped data when profile changes
  useEffect(() => {
    setUserNamespace(profile?.id ?? null);

    if (!profile) {
      setWorkoutHistory([]);
      setUserPrograms([]);
      setSelectedProgram(null);
      setOriginalProgram(null);
      return;
    }

    // Note: Workout history is loaded by loadWorkoutsFromBothSources (merges localStorage + Supabase)
    // Note: Programs are loaded by loadProgramsFromBothSources (merges localStorage + Supabase)

    loadProgramsFromBothSources();
  }, [profile, userProgramsKey, loadProgramsFromBothSources]);

  // ============================================================
  // PROGRAM SELECTION & DAY SUGGESTION
  // ============================================================

  const getSuggestedWeekAndDay = useCallback((program: ProgramTemplate, history: WorkoutSession[], todayIso: string) => {
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

    // First-time users: default to today's matching day if available
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

      // If today exists in this week, show it unless we've already passed it (same-day re-open keeps today)
      if (todayAfterLast || todayIdxInLastWeek >= lastDayIdx) {
        return { week: lastWeek.weekNumber, dayIndex: todayIdxInLastWeek };
      }
      const nextWeekNum = nextWeekNumber(lastWeek.weekNumber);
      const nextWeek = findWeek(nextWeekNum) ?? lastWeek;
      const dayIdx = findDayIndex(nextWeek, todayLabel);
      return { week: nextWeek.weekNumber, dayIndex: dayIdx !== -1 ? dayIdx : 0 };
    }

    // If the program doesn't schedule this weekday, advance to the next programmed day
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

  useEffect(() => {
    if (!pendingAction || isLogging || isBuilding) return;
    if (pendingAction === 'builder') {
      setEditingProgramForBuilder(undefined);
      setIsBuilding(true);
      setPendingAction(null);
      return;
    }
    if (!selectedProgram) {
      setShowProgramSelector(true);
      return;
    }
    const suggestion = getSuggestedWeekAndDay(selectedProgram, workoutHistory, todayKey);
    setSelectedWeek(suggestion.week);
    setSelectedDayIndex(suggestion.dayIndex);

    if (pendingAction === 'start') {
      setShowPreWorkoutReadiness(true);
    }
    if (pendingAction === 'day') {
      setShowExerciseDetails(true);
      setUserPinnedDay(true);
    }
    setPendingAction(null);
  }, [
    pendingAction,
    selectedProgram,
    workoutHistory,
    todayKey,
    getSuggestedWeekAndDay,
    isLogging,
    isBuilding,
  ]);

  // Resume active logging session if present (prompt user)
  useEffect(() => {
    if (isLogging || isBuilding) return;
    if (typeof window === 'undefined') return;
    if (!profile) return;
    if (pendingSession) return;
    if (resumePromptDismissed) return;

    // Don't prompt if we just completed a workout
    if (justCompletedWorkout.current) {
      console.log('⏸️ Skipping resume prompt - just completed workout');
      return;
    }

    const active = getActiveSession(profile.id);
    if (!active) return;

    const program =
      userPrograms.find(p => p.id === active.programId) ||
      allPrograms.find(p => p.id === active.programId) ||
      null;

    if (!program) {
      console.warn('⚠️ Program not found for active session, clearing...');
      clearActiveSession(profile.id);
      return;
    }

    setPendingSession(active);
  }, [isLogging, isBuilding, pendingSession, resumePromptDismissed, userPrograms, profile]);

  const handleSelectProgram = useCallback((program: ProgramTemplate) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them and switch programs?')) {
        return;
      }
    }
    const isBuiltIn = allPrograms.some(p => p.id === program.id);
    let programToUse = program;

    if (isBuiltIn) {
      const clone: ProgramTemplate = {
        ...program,
        id: `userprog_${createId('prog')}`,
      };
      const updatedUserPrograms = [...userPrograms, clone];
      setUserPrograms(updatedUserPrograms);
      localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));
      programToUse = clone;
    }

    localStorage.setItem(selectedProgramKey, programToUse.id);

    setSelectedProgram(programToUse);
    setOriginalProgram(programToUse);
    const suggestion = getSuggestedWeekAndDay(programToUse, workoutHistory, todayKey);
    setSelectedWeek(suggestion.week);
    setSelectedDayIndex(suggestion.dayIndex);
    setShowProgramSelector(false);
  }, [createId, hasUnsavedChanges, userPrograms, userProgramsKey, workoutHistory, todayKey, selectedProgramKey, getSuggestedWeekAndDay]);

  const handleSaveChanges = () => {
    if (!selectedProgram) return;
    // Check if this is a built-in program or already in user library
    const isBuiltIn = allPrograms.some(p => p.id === selectedProgram.id);
    const existsInUserLibrary = userPrograms.some(p => p.id === selectedProgram.id);

    if (isBuiltIn && !existsInUserLibrary) {
      // Saving changes to a built-in program -> Create customized version in user library
      const customizedProgram: ProgramTemplate = {
        ...selectedProgram,
        id: `user_${selectedProgram.id}_${createId('custom')}`,
        name: `${selectedProgram.name} (Customized)`,
      };

      const updatedUserPrograms = [...userPrograms, customizedProgram];
      setUserPrograms(updatedUserPrograms);
      localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

      setSelectedProgram(customizedProgram);
      setOriginalProgram(customizedProgram);

      alert(`✅ Saved as "${customizedProgram.name}" in your library!`);
    } else {
      // Updating existing user program
      const updatedUserPrograms = userPrograms.map(p =>
        p.id === selectedProgram.id ? selectedProgram : p
      );
      setUserPrograms(updatedUserPrograms);
      localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

      setOriginalProgram(selectedProgram);

      alert('✅ Changes saved!');
    }
  };

  const handleDiscardChanges = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      setSelectedProgram(originalProgram);
    }
  };

  // Restore selected program from storage if available
  useEffect(() => {
    if (!hydrated || isLogging || selectedProgram) return;
    if (typeof window === 'undefined') return;
    const storedId = localStorage.getItem(selectedProgramKey);
    if (!storedId) return;
    const program =
      userPrograms.find(p => p.id === storedId) ||
      allPrograms.find(p => p.id === storedId) ||
      null;
    if (program) {
      handleSelectProgram(program);
    }
  }, [hydrated, isLogging, selectedProgram, selectedProgramKey, userPrograms, handleSelectProgram]);

  const handleDeleteProgram = async (programId: string) => {
    const updatedUserPrograms = userPrograms.filter(p => p.id !== programId);
    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    // Delete from cloud if user is logged in
    if (user) {
      await deleteProgramFromCloud(programId, user.id);
    }

    if (selectedProgram?.id === programId) {
      setSelectedProgram(null);
      setOriginalProgram(null);
    }
  };

  const handleCreateNewFromBuilder = () => {
    setEditingProgramForBuilder(undefined);
    setIsBuilding(true);
  };

  const handleSaveProgramFromBuilder = async (program: ProgramTemplate) => {
    const isUpdating = userPrograms.some(p => p.id === program.id);

    const updatedUserPrograms = isUpdating
      ? userPrograms.map(p => (p.id === program.id ? program : p))
      : [...userPrograms, program];

    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    // Save to cloud if user is logged in
    if (user) {
      await saveProgramToCloud(program, user.id);
      console.log(`✅ Saved program "${program.name}" to cloud`);
    }

    setIsBuilding(false);
    setEditingProgramForBuilder(undefined);
    handleSelectProgram(program);
  };

  const handleWorkoutComplete = (session: WorkoutSession) => {
    console.log('🎯 handleWorkoutComplete CALLED');

    // Set flag to prevent auto-resume
    justCompletedWorkout.current = true;

    // CRITICAL: Clear session IMMEDIATELY to prevent auto-resume
    if (profile) {
      clearActiveSession(profile.id);
    }
    setPendingSession(null);
    setIsLogging(false);
    console.log('🛑 Session cleared and logging stopped');

    // Reset flag after a short delay (after React re-renders)
    setTimeout(() => {
      justCompletedWorkout.current = false;
    }, 1000);

    // Update UI
    setWorkoutHistory(prev => {
      const stripPrefix = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);
      const sessionKey = stripPrefix(session.id);
      const next = [
        session,
        ...prev.filter(item => stripPrefix(item.id) !== sessionKey),
      ];
      return next.sort((a, b) => {
        const aTime = new Date(a.endTime || a.startTime || a.date).getTime();
        const bTime = new Date(b.endTime || b.startTime || b.date).getTime();
        return bTime - aTime;
      });
    });
    setSummarySession(session);
    setShowCelebration(true);

    // Start save in background
    storage.saveWorkout(session).catch(err => console.error('Failed to save workout:', err));
  };

  const handleResumeWorkout = useCallback(() => {
    if (!pendingSession) return;

    const program =
      userPrograms.find(p => p.id === pendingSession.programId) ||
      allPrograms.find(p => p.id === pendingSession.programId) ||
      null;

    if (!program) {
      console.warn('⚠️ Program not found for resume session, clearing...');
      if (profile) {
        clearActiveSession(profile.id);
      }
      setPendingSession(null);
      return;
    }

    setSelectedProgram(program);
    setOriginalProgram(program);
    localStorage.setItem(selectedProgramKey, program.id);

    const resumeWeek = pendingSession.weekNumber ?? program.weeks[0]?.weekNumber ?? 1;
    const resumeDay = pendingSession.dayIndex ?? 0;

    setSelectedWeek(resumeWeek);
    setSelectedDayIndex(resumeDay);
    setShowPreWorkoutReadiness(false);
    setIsLogging(true);
  }, [pendingSession, userPrograms, profile, selectedProgramKey]);

  const handleDiscardResume = useCallback(() => {
    if (profile) {
      clearActiveSession(profile.id);
    }
    setPendingSession(null);
  }, [profile]);

  const handleCloseResumePrompt = useCallback(() => {
    setResumePromptDismissed(true);
    setPendingSession(null);
  }, []);

  const handleCancelLogging = () => {
    if (profile) {
      clearActiveSession(profile.id);
    }
    setPendingSession(null);
    setIsLogging(false);
  };

  const activeSessionForLogger = useMemo(() => {
    if (!pendingSession || !selectedProgram || selectedDayIndex === null) return null;
    if (pendingSession.programId !== selectedProgram.id) return null;
    const sessionWeek = pendingSession.weekNumber ?? selectedWeek;
    const sessionDay = pendingSession.dayIndex ?? selectedDayIndex;
    if (sessionWeek !== selectedWeek || sessionDay !== selectedDayIndex) return null;
    return pendingSession;
  }, [pendingSession, selectedProgram, selectedWeek, selectedDayIndex]);

  const initialSessionForLogger = activeSessionForLogger?.session ?? null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName.trim() || !authEmail.trim()) {
      alert('Please enter your name and email');
      return;
    }
    const expiresAt = rememberProfile ? new Date().getTime() + 30 * 24 * 60 * 60 * 1000 : null;
    const newProfile: UserProfile = {
      id: createId('user'),
      name: authName.trim(),
      email: authEmail.trim(),
      rememberUntil: expiresAt,
    };
    localStorage.setItem('iron_brain_profile', JSON.stringify(newProfile));
    setProfile(newProfile);
  };

  const getExercise = (exerciseId: string): Exercise | undefined => {
    return defaultExercises.find(ex => ex.id === exerciseId);
  };

  // Helper function to remove an exercise from current day
  const removeExerciseFromDay = (exerciseId: string) => {
    if (!selectedProgram || selectedDayIndex === null) return;
    if (!confirm('Remove this exercise and all its sets?')) return;

    const updatedProgram = { ...selectedProgram };
    const week = updatedProgram.weeks.find(w => w.weekNumber === selectedWeek);
    if (!week) return;

    const day = week.days[selectedDayIndex];
    if (!day) return;

    // Remove all sets for this exercise
    day.sets = day.sets.filter(set => set.exerciseId !== exerciseId);

    setSelectedProgram(updatedProgram);
  };

  const currentWeek = selectedProgram?.weeks.find(w => w.weekNumber === selectedWeek);
  const currentDay = selectedDayIndex !== null ? currentWeek?.days[selectedDayIndex] : undefined;

  const groupedSets = currentDay?.sets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) {
      acc[set.exerciseId] = [];
    }
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<string, SetTemplate[]>);

  const availableWeeks = selectedProgram ? selectedProgram.weeks.map(w => w.weekNumber).sort((a, b) => a - b) : [];

  // Auto-align the visible day/week with today's weekday and the user's last logged session
  useEffect(() => {
    if (!selectedProgram || isLogging || userPinnedDay) return;
    const suggestion = getSuggestedWeekAndDay(selectedProgram, workoutHistory, todayKey);
    setSelectedWeek(suggestion.week);
    setSelectedDayIndex(suggestion.dayIndex);
  }, [selectedProgram, workoutHistory, todayKey, isLogging, userPinnedDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset manual pin when switching programs or rolling to a new day
  useEffect(() => {
    setUserPinnedDay(false);
  }, [selectedProgram?.id, todayKey]);

  // Avoid hydration mismatch while profile initializes
  if (!hydrated) {
    return (
      <div className="min-h-screen safe-top bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950" />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen safe-top bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 sm:p-8">
            <div className="mb-6 text-center space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-purple-300">
                <Sparkles className="h-4 w-4" />
                Welcome to Iron Brain
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Sign in to your space</h1>
              <p className="text-sm text-gray-300">
                Keep your programs and history separate for each user. Stay signed in for up to 30 days.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label className="mb-1 block text-sm font-semibold text-gray-300">Name</label>
                <input
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g., Jordan"
                />
              </div>

              <div className="space-y-2">
                <label className="mb-1 block text-sm font-semibold text-gray-300">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <input
                    type="checkbox"
                    checked={rememberProfile}
                    onChange={(e) => setRememberProfile(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                  Keep me signed in for 30 days
                </label>
                <span className="text-xs font-medium text-gray-500">
                  Local, per-user data
                </span>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
              >
                Enter Iron Brain
              </button>
            </form>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-gray-400">
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">Stay Signed In</div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">Per-User Programs</div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">Secure & Local</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Show builder if in building mode
  if (isBuilding) {
    return (
      <ProgramBuilder
        existingProgram={editingProgramForBuilder}
        onSave={handleSaveProgramFromBuilder}
        onCancel={() => {
          setIsBuilding(false);
          setEditingProgramForBuilder(undefined);
        }}
        userId={user?.id || null}
      />
    );
  }

  if (isLogging && selectedProgram && selectedDayIndex !== null) {
    return (
      <WorkoutLogger
        program={selectedProgram}
        weekNumber={selectedWeek}
        dayIndex={selectedDayIndex}
        onComplete={handleWorkoutComplete}
        onCancel={handleCancelLogging}
        initialSession={initialSessionForLogger}
        initialActiveState={activeSessionForLogger}
      />
    );
  }

  // Main app view
  return (
      <div className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 overflow-y-auto safe-x">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-20 min-h-full safe-top">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Programs</h1>
            <p className="text-sm text-gray-400">
              Science-backed strength training with auto-regulation
            </p>
          </div>
          {user && (
            <div className="hidden sm:block">
              <SyncStatusIndicator />
            </div>
          )}
        </div>

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-300" />
              <div className="min-w-0">
                <p className="font-semibold text-amber-200">Unsaved Changes</p>
                <p className="text-xs sm:text-sm text-amber-200/80">
                  You&apos;ve modified this program. Save or discard.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleDiscardChanges}
                className="flex-1 sm:flex-none rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white border border-white/10 hover:bg-white/20 transition-all active:scale-[0.98]"
              >
                Discard
              </button>
              <button
                onClick={handleSaveChanges}
                className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 sm:px-6 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Program View */}
            {/* HERO CARD - Current Day at the Top */}
            {selectedProgram && currentDay && (
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-purple-600/20 to-fuchsia-600/20 border border-purple-500/20 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-purple-300" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                        Today&apos;s Workout
                      </p>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                      {currentDay.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                      <span>{currentDay.dayOfWeek}</span>
                      <span className="text-purple-300">•</span>
                      <span>Week {selectedWeek}</span>
                      <span className="text-purple-300">•</span>
                      <span className="truncate">{selectedProgram.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPreWorkoutReadiness(true)}
                    className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Dumbbell className="h-5 w-5" />
                      Start Workout
                    </span>
                  </button>
                </div>

                {/* Quick Preview of Sets */}
                <div className="flex flex-wrap items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-200">
                    <div className="rounded-lg bg-white/10 p-2">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold">
                      {currentDay.sets.length} sets
                    </span>
                  </div>
                  <span className="text-purple-300">•</span>
                  <div className="flex items-center gap-2 text-gray-200">
                    <div className="rounded-lg bg-white/10 p-2">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold">
                      {Object.keys(groupedSets || {}).length} exercises
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Program Overview */}
            <div className="mb-6 animate-fadeIn">
              {selectedProgram ? (
                <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Current Program
                      </p>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                        {selectedProgram.name}
                      </h2>
                      {selectedProgram.description && (
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {selectedProgram.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedProgram.goal && (
                          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                            Goal: {selectedProgram.goal}
                          </span>
                        )}
                        {selectedProgram.experienceLevel && (
                          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                            Level: {selectedProgram.experienceLevel}
                          </span>
                        )}
                        {selectedProgram.intensityMethod && (
                          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                            Intensity: {selectedProgram.intensityMethod.toUpperCase()}
                          </span>
                        )}
                        {selectedProgram.daysPerWeek && (
                          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                            {selectedProgram.daysPerWeek} days/week
                          </span>
                        )}
                        {selectedProgram.weekCount && (
                          <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                            {selectedProgram.weekCount} weeks
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <button
                        onClick={() => {
                          setEditingProgramForBuilder(selectedProgram);
                          setIsBuilding(true);
                        }}
                        className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-5 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                      >
                        Edit in Builder
                      </button>
                      <button
                        onClick={() => setShowProgramSelector(true)}
                        className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                      >
                        Choose Different
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-6 text-center border border-white/10">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-purple-300">
                    <DatabaseIcon className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">No program selected</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    Pick a built-in program or create your own to get started.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      onClick={() => setShowProgramSelector(true)}
                      className="w-full sm:w-auto rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white border border-white/10 transition-all active:scale-[0.98]"
                    >
                      Choose Program
                    </button>
                    <button
                      onClick={handleCreateNewFromBuilder}
                      className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                    >
                      Create New
                    </button>
                  </div>
                </div>
              )}

            {selectedProgram && (
              <div className="mb-6 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 backdrop-blur-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/10 p-3">
                      <History className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-400">Select Week</p>
                      <p className="text-xl font-semibold text-white">Week {selectedWeek}</p>
                    </div>
                  </div>
                  {hasUnsavedChanges && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDiscardChanges}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white transition-all active:scale-[0.98]"
                      >
                        Discard
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition-all active:scale-[0.98]"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 animate-fadeIn">
                  <div className="flex flex-wrap gap-2">
                    {availableWeeks.map((weekNum) => (
                      <button
                        key={weekNum}
                        onClick={() => setSelectedWeek(weekNum)}
                        className={`flex-shrink-0 rounded-xl px-4 py-2 font-semibold transition-all active:scale-[0.98] ${
                          selectedWeek === weekNum
                            ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        Week {weekNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Day Selector */}
            <div className="mb-8 animate-fadeIn" style={{animationDelay: '0.3s'}}>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-white/10 p-2">
                  <Dumbbell className="h-5 w-5 text-purple-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white">
                  Select Training Day
                </h3>
              </div>

              {/* Empty State - No Days */}
              {(!currentWeek?.days || currentWeek.days.length === 0) && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl animate-fadeIn">
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                      <Dumbbell className="h-6 w-6 text-purple-300" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-white">
                      No Training Days Yet
                    </h3>
                    <p className="mb-4 text-sm text-gray-400">
                      This program has no days in Week {selectedWeek}. Use the editor to add them.
                    </p>
                    <div className="text-sm text-gray-400">
                      Edit this program in the builder to add days.
                    </div>
                  </div>
                </div>
              )}

              <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" style={{overflow: 'visible'}}>
                {currentWeek?.days.map((day, idx) => (
                  <React.Fragment key={idx}>
                    {/* Day Card */}
                    <div className="group relative stagger-item" style={{ isolation: 'isolate' }}>
                      <button
                        onClick={() => {
                          if (selectedDayIndex === idx && showExerciseDetails) {
                            setShowExerciseDetails(false);
                            setUserPinnedDay(false);
                          } else {
                            setSelectedDayIndex(idx);
                            setUserPinnedDay(true);
                            setShowExerciseDetails(true);
                          }
                        }}
                        className={`w-full rounded-2xl border p-5 text-left transition-all active:scale-[0.98] ${
                          selectedDayIndex === idx
                            ? 'border-purple-500/40 bg-white/10 text-white'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                          selectedDayIndex === idx ? 'text-purple-200' : 'text-gray-500'
                        }`}>
                          {day.dayOfWeek}
                        </p>
                        <p className={`text-lg sm:text-xl font-semibold mb-3 ${
                          selectedDayIndex === idx ? 'text-white' : 'text-white'
                        }`}>
                          {day.name}
                        </p>
                        <div className={`flex items-center gap-2 text-sm ${
                          selectedDayIndex === idx ? 'text-gray-200' : 'text-gray-400'
                        }`}>
                          <div className="rounded-lg p-1.5 bg-white/10">
                            <Dumbbell className="h-4 w-4" />
                          </div>
                          <span>{day.sets.length} sets</span>
                        </div>
                        {selectedDayIndex === idx && showExerciseDetails && (
                          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-purple-200">
                            <ChevronUp className="h-4 w-4" />
                            <span>Click to collapse</span>
                          </div>
                        )}
                      </button>

                      {/* Exercise Details - Appears right below the selected day */}
                      {selectedDayIndex === idx && (
                      <div
                        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
                          showExerciseDetails
                            ? 'grid-rows-[1fr] opacity-100 mt-5'
                            : 'grid-rows-[0fr] opacity-0 mt-0'
                        }`}
                        style={{ willChange: showExerciseDetails ? 'grid-template-rows, opacity' : 'auto' }}
                      >
                        <div className="overflow-hidden">
                          <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
                          <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-white/10 p-3">
                                <Dumbbell className="h-6 w-6 text-purple-300" />
                              </div>
                              <h3 className="text-lg sm:text-xl font-semibold text-white">
                                Exercise Details
                              </h3>
                            </div>
                            <button
                              onClick={() => {
                                setShowExerciseDetails(false);
                                setUserPinnedDay(false);
                              }}
                              className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 font-semibold text-white border border-white/10 transition-all active:scale-[0.98]"
                            >
                              <ChevronUp className="h-4 w-4" />
                              <span className="hidden sm:inline">Collapse</span>
                            </button>
                          </div>

                          {/* Exercise List */}
                          <div className="space-y-4 sm:space-y-6">
                            {/* Empty State - No Exercises */}
                            {(!groupedSets || Object.keys(groupedSets).length === 0) && (
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl animate-fadeIn">
                                <div className="mx-auto max-w-md">
                                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                                    <Dumbbell className="h-6 w-6 text-purple-300" />
                                  </div>
                                  <h3 className="mb-2 text-lg sm:text-xl font-semibold text-white">
                                    No Exercises Yet
                                  </h3>
                                  <p className="mb-4 text-sm text-gray-400">
                                    Build your perfect workout by adding exercises in the Program Builder.
                                  </p>
                                  <button
                                    onClick={() => {
                                      if (!selectedProgram) return;
                                      setEditingProgramForBuilder(selectedProgram);
                                      setIsBuilding(true);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] text-sm"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Open Builder
                                  </button>
                                </div>
                              </div>
                            )}

                            {groupedSets && Object.entries(groupedSets).map(([exerciseId, sets], exerciseIdx) => {
                              const exercise = getExercise(exerciseId);
                              return (
                                <div key={exerciseId} className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-xl transition-all hover:bg-white/10 stagger-item" style={{animationDelay: `${exerciseIdx * 0.05}s`, isolation: 'isolate'}}>
                                  <div className="mb-4 sm:mb-5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                      <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl flex-shrink-0 ${
                                        exercise?.type === 'compound'
                                          ? 'bg-purple-500/20 text-purple-200'
                                          : 'bg-blue-500/20 text-blue-200'
                                      }`}>
                                        <Dumbbell className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-lg sm:text-xl font-semibold text-white mb-0.5 sm:mb-1 truncate">
                                          {exercise?.name}
                                        </h4>
                                        <p className="text-xs sm:text-sm font-semibold text-gray-400 capitalize truncate">
                                          {exercise?.type} • {exercise?.muscleGroups.slice(0, 2).join(', ')}
                                        </p>
                                      </div>
                                    </div>
                                    {/* Remove Exercise Button */}
                                    <button
                                      onClick={() => removeExerciseFromDay(exerciseId)}
                                      className="rounded-lg bg-red-500/20 p-2 text-red-200 opacity-0 transition-all hover:bg-red-500/30 group-hover:opacity-100 touch-manipulation flex-shrink-0 active:scale-[0.98]"
                                      title="Remove exercise"
                                      aria-label="Remove exercise"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="space-y-3 sm:space-y-4">
                                    {sets.map((set, setIdx) => (
                                      <div key={setIdx} className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                                          <span className="text-sm sm:text-base font-semibold text-white">Set {set.setIndex}</span>
                                          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-300">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 sm:px-3 py-1 text-gray-200">
                                              Reps: {set.prescribedReps}
                                            </span>
                                            {set.targetRPE !== undefined && set.targetRPE !== null && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 sm:px-3 py-1 text-blue-200">
                                                RPE {set.targetRPE}
                                              </span>
                                            )}
                                            {set.restSeconds && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 sm:px-3 py-1 text-emerald-200">
                                                Rest {set.restSeconds}s
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {set.notes && (
                                          <p className="mt-2 text-xs sm:text-sm text-gray-400">&quot;{set.notes}&quot;</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-400 text-center">
                              To modify exercises or sets, edit this program in the builder.
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
        </div>
      </div>

      {summarySession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setSummarySession(null); setShowCelebration(false); }} />
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-amber-500 shadow-2xl ring-4 ring-white/40">
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.25),transparent_45%)]" />
            {showCelebration && (
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 26 }).map((_, idx) => (
                  <span
                    key={idx}
                    className="absolute inline-block h-2 w-2 rounded-sm opacity-80"
                    style={{
                      left: `${(idx * 37) % 100}%`,
                      top: '-10%',
                      background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a855f7'][idx % 5],
                      transform: `rotate(${idx * 13}deg)`,
                      animation: `confetti-fall 1.6s ease-out forwards`,
                      animationDelay: `${idx * 0.03}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <div className="relative flex-1 overflow-y-auto p-6 sm:p-8 text-white space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Workout Complete</p>
                  <h3 className="text-3xl sm:text-4xl font-black leading-tight drop-shadow">Great job, {profile?.name || 'athlete'}!</h3>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-center shadow-lg backdrop-blur">
                  <p className="text-sm font-semibold text-white/80">Total Volume</p>
                  <p className="text-2xl sm:text-3xl font-black">{Math.round(summarySession.totalVolumeLoad || 0)} lbs</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white/15 p-4 shadow-inner backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/70 font-semibold">Duration</p>
                  <p className="text-lg sm:text-xl font-black">{summarySession.durationMinutes ? `${summarySession.durationMinutes} min` : '—'}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 shadow-inner backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/70 font-semibold">Sets Logged</p>
                  <p className="text-lg sm:text-xl font-black">{summarySession.sets.length}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 shadow-inner backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/70 font-semibold">Avg RPE</p>
                  <p className="text-lg sm:text-xl font-black">{summarySession.averageRPE ? summarySession.averageRPE.toFixed(1) : '—'}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 shadow-inner backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/70 font-semibold">Day</p>
                  <p className="text-lg sm:text-xl font-black">{summarySession.dayName || summarySession.dayOfWeek}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 shadow-lg backdrop-blur">
                <p className="text-sm font-semibold text-white/80 mb-2">Session Highlights</p>
                <ul className="text-sm sm:text-base space-y-1 text-white/90">
                  <li>• Program: {summarySession.programName}</li>
                  <li>• Date: {summarySession.date}</li>
                  {summarySession.totalVolumeLoad !== undefined && <li>• Volume: {Math.round(summarySession.totalVolumeLoad)} lbs</li>}
                  {summarySession.averageRPE !== undefined && <li>• Average RPE: {summarySession.averageRPE.toFixed(1)}</li>}
                </ul>
              </div>

              {/* Fatigue Impact */}
              {summaryFatigue.length > 0 && (
                <div className="rounded-2xl bg-white/10 p-4 shadow-lg backdrop-blur">
                  <p className="text-sm font-semibold text-white/80 mb-3">Fatigue Impact</p>
                  <div className="grid grid-cols-2 gap-2">
                    {summaryFatigue.slice(0, 6).map((fa: FatigueScore) => {
                      const severity = fa.fatigueLevel >= 80 ? 'critical' :
                                       fa.fatigueLevel >= 60 ? 'high' :
                                       fa.fatigueLevel >= 30 ? 'moderate' : 'mild';
                      const recoveryHours = severity === 'critical' ? 72 :
                                           severity === 'high' ? 60 :
                                           severity === 'moderate' ? 48 : 36;
                      return (
                        <div key={fa.muscleGroup} className="rounded-xl bg-white/10 p-2">
                          <p className="text-xs text-white/60 capitalize">{fa.muscleGroup}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${
                              severity === 'critical' ? 'text-red-300' :
                              severity === 'high' ? 'text-orange-300' :
                              severity === 'moderate' ? 'text-yellow-300' :
                              'text-green-300'
                            }`}>
                              {Math.round(fa.fatigueLevel)}/100
                            </span>
                            <span className="text-xs text-white/50">
                              ~{recoveryHours}h
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Training Efficiency (SFR) */}
              {summarySFR && summarySFR.exerciseAnalyses.length > 0 && (
                <div className="rounded-2xl bg-white/10 p-4 shadow-lg backdrop-blur">
                  <p className="text-sm font-semibold text-white/80 mb-3">Training Efficiency</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {summarySFR.exerciseAnalyses.map((analysis, idx) => (
                      <div key={idx} className="rounded-xl bg-white/10 p-2 flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-white/90 truncate flex-1">
                          {analysis.exerciseName}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ml-2 ${
                          analysis.interpretation === 'excellent' ? 'bg-green-500/30 text-green-200' :
                          analysis.interpretation === 'good' ? 'bg-blue-500/30 text-blue-200' :
                          analysis.interpretation === 'moderate' ? 'bg-yellow-500/30 text-yellow-200' :
                          analysis.interpretation === 'poor' ? 'bg-orange-500/30 text-orange-200' :
                          'bg-red-500/30 text-red-200'
                        }`}>
                          {analysis.interpretation === 'excellent' ? '⭐ Excellent' :
                           analysis.interpretation === 'good' ? '✓ Good' :
                           analysis.interpretation === 'moderate' ? '~ OK' :
                           analysis.interpretation === 'poor' ? '⚠ Poor' :
                           '✕ Excessive'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {summarySFR.insights.length > 0 && (
                    <p className="text-xs text-white/70 mt-2">
                      {summarySFR.insights[0]}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-white/80">
                  Keep the streak alive tomorrow!
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      setSummarySession(null);
                      setShowCelebration(false);
                    }}
                    className="rounded-xl bg-white/10 text-white font-semibold px-5 py-3 border border-white/20 shadow-lg transition-all active:scale-[0.98] hover:bg-white/20"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSummarySession(null);
                      setShowCelebration(false);
                      router.push('/history');
                    }}
                    className="rounded-xl border border-white/30 bg-white/5 text-white font-semibold px-5 py-3 shadow-lg transition-all active:scale-[0.98] hover:bg-white/10"
                  >
                    View History
                  </button>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes confetti-fall {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                80% { opacity: 1; }
                100% { transform: translateY(140vh) rotate(360deg); opacity: 0; }
              }
            `}</style>
          </div>
        </div>
      )}

      {showProgramSelector && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowProgramSelector(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 border-b border-white/10 bg-white/5 px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Program Library</p>
                  <h3 className="text-xl font-semibold text-white">Select a program</h3>
                  <p className="text-sm text-gray-400">Pick a built-in template or one of your saved programs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCreateNewFromBuilder}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New
                  </button>
                  <button
                    onClick={() => setShowProgramSelector(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white border border-white/10 transition-all active:scale-[0.98]"
                    aria-label="Close program selector"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
              <ProgramSelector
                builtInPrograms={allPrograms}
                userPrograms={userPrograms}
                selectedProgram={selectedProgram}
                onSelectProgram={handleSelectProgram}
                onDeleteProgram={handleDeleteProgram}
              />
            </div>
          </div>
        </div>
      )}

      {pendingSession && !isLogging && !isBuilding && (
        <ResumeWorkoutModal
          activeSession={pendingSession}
          onResume={handleResumeWorkout}
          onDiscard={handleDiscardResume}
          onClose={handleCloseResumePrompt}
        />
      )}

      {/* Pre-Workout Readiness Modal */}
      {showPreWorkoutReadiness && selectedProgram && selectedDayIndex !== null && (
        <PreWorkoutReadiness
          userId={user?.id || null}
          plannedExerciseIds={(() => {
            const week = selectedProgram.weeks.find(w => w.weekNumber === selectedWeek);
            const day = week?.days[selectedDayIndex];
            if (!day) return undefined;
            return Array.from(new Set(day.sets.map(s => s.exerciseId)));
          })()}
          onContinue={() => {
            setShowPreWorkoutReadiness(false);
            setIsLogging(true);
          }}
          onCancel={() => setShowPreWorkoutReadiness(false)}
        />
      )}

    </div>
  );
}
