'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Dumbbell, History, BarChart3, Wrench, ChevronDown, ChevronUp, Sparkles, X, Settings as SettingsIcon, Database } from 'lucide-react';
import { allPrograms, defaultExercises } from './lib/programs';
import { Exercise, SetTemplate, ProgramTemplate, WorkoutSession, WeekTemplate, DayTemplate } from './lib/types';
import WorkoutLogger from './components/WorkoutLogger';
import WorkoutHistory from './components/WorkoutHistory';
import ProgressCharts from './components/ProgressCharts';
import ProgramBuilder from './components/ProgramBuilder';
import ProgramSelector from './components/ProgramSelector';
import Utilities from './components/Utilities';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import Settings from './components/Settings';
import DataManagement from './components/DataManagement';
import Tooltip from './components/Tooltip';
import { storage, setUserNamespace } from './lib/storage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  rememberUntil?: number | null;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [hydrated, setHydrated] = useState(false);
  // Auth / profile
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    // If we already have a NextAuth session, map it to our profile shape
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
  const [viewMode, setViewMode] = useState<'program' | 'history' | 'analytics' | 'utilities' | 'data' | 'settings'>('program');
  const [todayKey, setTodayKey] = useState<string>(() =>
    typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  );
  const [userPinnedDay, setUserPinnedDay] = useState(false);

  // Workflow states
  const [isLogging, setIsLogging] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [editingProgramForBuilder, setEditingProgramForBuilder] = useState<ProgramTemplate | undefined>(undefined);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [rememberProfile, setRememberProfile] = useState(true);
  const userProgramsKey = useMemo(
    () => (profile ? `iron_brain_user_programs__${profile.id}` : 'iron_brain_user_programs_default'),
    [profile]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Keep a lightweight "today" clock so we can auto-advance the UI each day
  useEffect(() => {
    const updateToday = () => setTodayKey(new Date().toISOString().split('T')[0]);
    updateToday();
    const interval = setInterval(updateToday, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Onboarding hints
  const [showStartWorkoutHint, setShowStartWorkoutHint] = useState(false);
  const [showProgramCustomizationHint, setShowProgramCustomizationHint] = useState(false);

  // UI state for progressive disclosure
  // IMPORTANT: Week selector and day selector should be visible by default for better UX
  // Only hide program selector and advanced settings
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(true); // Changed to true - users need to see this!

  // Data
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);

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

    const history = storage.getWorkoutHistory();
    setWorkoutHistory(history);

    const savedPrograms = localStorage.getItem(userProgramsKey);
    if (savedPrograms) {
      const parsed: ProgramTemplate[] = JSON.parse(savedPrograms);
      setUserPrograms(parsed);
    } else {
      setUserPrograms([]);
    }

    // Onboarding hints only on first visit with no history
    const hasSeenKeyboardHint = localStorage.getItem('iron_brain_seen_keyboard_hint');
    if (!hasSeenKeyboardHint) {
      setTimeout(() => setShowKeyboardHint(true), 2000);
    }

    const hasSeenStartWorkoutHint = localStorage.getItem('iron_brain_seen_start_workout_hint');
    if (!hasSeenStartWorkoutHint && history.length === 0) {
      setTimeout(() => setShowStartWorkoutHint(true), 4000);
    }

    const hasSeenProgramHint = localStorage.getItem('iron_brain_seen_program_hint');
    if (!hasSeenProgramHint && history.length === 0) {
      setTimeout(() => setShowProgramCustomizationHint(true), 6000);
    }
  }, [profile, userProgramsKey]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'p', description: 'Open programs', action: () => setViewMode('program') },
    { key: 'h', description: 'View history', action: () => setViewMode('history') },
    { key: 'a', description: 'View analytics', action: () => setViewMode('analytics') },
    { key: 'u', description: 'Open utilities', action: () => setViewMode('utilities') },
    { key: 'd', description: 'Data management', action: () => setViewMode('data') },
    { key: 's', description: 'Settings', action: () => setViewMode('settings') },
    { key: '?', shiftKey: true, description: 'Show keyboard shortcuts', action: () => setShowShortcutsModal(true) },
    { key: 'Escape', description: 'Close modals', action: () => {
      setShowShortcutsModal(false);
      if (isLogging) setIsLogging(false);
      if (isBuilding) setIsBuilding(false);
    }},
  ], !isLogging && !isBuilding); // Disable when in logging or building mode

  const dayOrder: DayTemplate['dayOfWeek'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getSuggestedWeekAndDay = (program: ProgramTemplate, history: WorkoutSession[], todayIso: string) => {
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
  };

  const handleSelectProgram = (program: ProgramTemplate) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them and switch programs?')) {
        return;
      }
    }
    setSelectedProgram(program);
    setOriginalProgram(program);
    const suggestion = getSuggestedWeekAndDay(program, workoutHistory, todayKey);
    setSelectedWeek(suggestion.week);
    setSelectedDayIndex(suggestion.dayIndex);
    setShowProgramSelector(false);
  };

  const createId = (prefix: string) => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  };

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

  const handleDeleteProgram = (programId: string) => {
    const updatedUserPrograms = userPrograms.filter(p => p.id !== programId);
    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    if (selectedProgram?.id === programId) {
      setSelectedProgram(null);
      setOriginalProgram(null);
    }
  };

  const handleCreateNewFromBuilder = () => {
    setEditingProgramForBuilder(undefined);
    setIsBuilding(true);
  };

  const handleSaveProgramFromBuilder = (program: ProgramTemplate) => {
    const isUpdating = userPrograms.some(p => p.id === program.id);

    const updatedUserPrograms = isUpdating
      ? userPrograms.map(p => (p.id === program.id ? program : p))
      : [...userPrograms, program];

    setUserPrograms(updatedUserPrograms);
    localStorage.setItem(userProgramsKey, JSON.stringify(updatedUserPrograms));

    setIsBuilding(false);
    setEditingProgramForBuilder(undefined);
    handleSelectProgram(program);
  };

  const handleWorkoutComplete = (session: WorkoutSession) => {
    storage.saveWorkout(session);
    setWorkoutHistory(prev => [...prev, session]);
    setIsLogging(false);
  };

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

  const handleLogout = () => {
    localStorage.removeItem('iron_brain_profile');
    setProfile(null);
    signOut({ redirect: false });
  };

  // Map next-auth session to profile state on the fly
  useEffect(() => {
    if (session?.user) {
      const expiresAt = rememberProfile ? new Date().getTime() + 30 * 24 * 60 * 60 * 1000 : null;
      const mapped: UserProfile = {
        id: session.user.email || createId('user'),
        name: session.user.name || 'User',
        email: session.user.email || 'unknown@example.com',
        rememberUntil: expiresAt,
      };
      localStorage.setItem('iron_brain_profile', JSON.stringify(mapped));
      setProfile(mapped);
    }
  }, [session, rememberProfile]);

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

  // Avoid hydration mismatch while auth/session/profile initializes
  if (!hydrated || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-purple-50/30 to-zinc-100 dark:from-zinc-950 dark:via-purple-950/10 dark:to-zinc-900" />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0b1021] via-[#1b1f3a] to-[#28114a] relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 blur-3xl">
          <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-purple-500/40" />
          <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-pink-500/40" />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl bg-white/95 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-1 ring-white/40 dark:bg-zinc-900/90 dark:ring-white/10 border border-white/40 dark:border-white/5">
            <div className="mb-8 text-center space-y-2">
              <div className="inline-flex items-center gap-3 rounded-full bg-purple-100 px-4 py-2 text-sm font-bold text-purple-800 dark:bg-purple-900/40 dark:text-purple-100">
                <Sparkles className="h-4 w-4" />
                Welcome to Iron Brain
              </div>
              <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">Sign in to your space</h1>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Keep your programs and history separate for each user. Stay signed in for up to 30 days.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Name</label>
                <input
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="e.g., Jordan"
                />
              </div>

              <div className="space-y-2">
                <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-zinc-50 to-zinc-100 px-4 py-3 shadow-inner dark:from-zinc-800/60 dark:to-zinc-800/40">
                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={rememberProfile}
                    onChange={(e) => setRememberProfile(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  Keep me signed in for 30 days
                </label>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Local, per-user data
                </span>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-bold text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01]"
              >
                Enter Iron Brain
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">or continue with</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => signIn('google')}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-zinc-800 shadow-lg ring-1 ring-zinc-200 transition-all hover:shadow-xl hover:-translate-y-0.5 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4285F4] text-white text-sm font-black">G</span>
                Continue with Google
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">Stay Signed In</div>
              <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">Per-User Programs</div>
              <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">Secure & Local</div>
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
      />
    );
  }

  // Show logger if logging workout
  if (isLogging && selectedProgram && selectedDayIndex !== null) {
    return (
      <WorkoutLogger
        program={selectedProgram}
        weekNumber={selectedWeek}
        dayIndex={selectedDayIndex}
        onComplete={handleWorkoutComplete}
        onCancel={() => setIsLogging(false)}
      />
    );
  }

  // Main app view
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-purple-50/30 to-zinc-100 dark:from-zinc-950 dark:via-purple-950/20 dark:to-zinc-900 mesh-gradient">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="mb-3 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight gradient-text animate-float">
                Iron Brain
              </h1>
              <p className="text-sm sm:text-base md:text-lg font-semibold text-zinc-600 dark:text-zinc-400">
                Science-backed strength training with auto-regulation
              </p>
            </div>
            {/* Keyboard Shortcuts Button */}
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-md transition-all hover:scale-105 hover:bg-purple-500 hover:text-white hover:shadow-xl active:scale-95 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-purple-600"
              title="Keyboard shortcuts (Press ?)"
            >
              <span className="text-xl font-bold">?</span>
            </button>
          </div>
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 shadow-lg dark:border-amber-600 dark:bg-amber-900/30">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <svg className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="min-w-0">
                <p className="font-bold text-amber-900 dark:text-amber-100">Unsaved Changes</p>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                  You've modified this program. Save or discard.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleDiscardChanges}
                className="flex-1 sm:flex-none rounded-lg bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-md hover:bg-amber-100 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700"
              >
                Discard
              </button>
              <button
                onClick={handleSaveChanges}
                className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 sm:px-6 py-2 sm:py-2.5 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Hint Banner */}
        {showKeyboardHint && (
          <div className="mb-6 relative overflow-hidden rounded-xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 p-4 shadow-lg dark:border-purple-700 dark:from-purple-900/30 dark:via-pink-900/20 dark:to-purple-900/30 animate-slideDown">
            <button
              onClick={() => {
                setShowKeyboardHint(false);
                localStorage.setItem('iron_brain_seen_keyboard_hint', 'true');
              }}
              className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-200/50 text-purple-700 hover:bg-purple-300 dark:bg-purple-800/50 dark:text-purple-300 dark:hover:bg-purple-700 transition-all hover:scale-110 touch-manipulation text-xl font-bold"
              aria-label="Dismiss keyboard shortcuts hint"
            >
              ×
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 text-white shadow-lg flex-shrink-0">
                <span className="text-xl font-bold">⌨️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-purple-900 dark:text-purple-100 mb-1">
                  Pro tip: Use keyboard shortcuts!
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  Navigate faster with <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">P</kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">H</kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">A</kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">U</kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">D</kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">S</kbd>
                  or press <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white px-1.5 text-[10px] font-bold text-purple-700 shadow-sm mx-1">?</kbd> to see all shortcuts
                </p>
                <button
                  onClick={() => {
                    setShowShortcutsModal(true);
                    setShowKeyboardHint(false);
                    localStorage.setItem('iron_brain_seen_keyboard_hint', 'true');
                  }}
                  className="text-sm font-semibold text-purple-700 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100 underline"
                >
                  View all shortcuts
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="mb-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="flex gap-2 sm:gap-3 min-w-max sm:min-w-0">
            <button
              onClick={() => setViewMode('program')}
              className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation relative ${
                viewMode === 'program'
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              <Dumbbell className="h-5 w-5" />
              <span className="hidden xs:inline">Program</span>
              <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
                viewMode === 'program'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
              }`}>P</kbd>
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === 'history'
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              <History className="h-5 w-5" />
              <span className="hidden xs:inline">History</span>
              <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${
                viewMode === 'history'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
              }`}>
                {workoutHistory.length}
              </span>
              <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
                viewMode === 'history'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
              }`}>H</kbd>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === 'analytics'
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="hidden xs:inline">Analytics</span>
              <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
                viewMode === 'analytics'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
              }`}>A</kbd>
            </button>
            <button
              onClick={() => setViewMode('utilities')}
              className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === 'utilities'
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              <Wrench className="h-5 w-5" />
              <span className="hidden xs:inline">Utilities</span>
              <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
                viewMode === 'utilities'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
              }`}>U</kbd>
            </button>
            <button
              onClick={() => setViewMode('data')}
              className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === 'data'
                  ? 'gradient-purple text-white shadow-glow-purple'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              <Database className="h-5 w-5" />
              <span className="hidden xs:inline">Data</span>
              <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
                viewMode === 'data'
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
              }`}>D</kbd>
            </button>
        <button
          onClick={() => setViewMode('settings')}
          className={`group flex items-center gap-2 rounded-xl px-4 sm:px-6 py-3.5 font-semibold transition-all whitespace-nowrap active:scale-95 touch-manipulation ${
            viewMode === 'settings'
              ? 'gradient-purple text-white shadow-glow-purple'
              : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="hidden xs:inline">Settings</span>
          <kbd className={`hidden sm:inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1.5 text-[10px] font-bold transition-all ${
            viewMode === 'settings'
              ? 'bg-white/20 text-white'
              : 'bg-zinc-200 text-zinc-500 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-zinc-700 dark:text-zinc-500 dark:group-hover:bg-purple-900/50 dark:group-hover:text-purple-400'
          }`}>S</kbd>
        </button>
          </div>
        </div>

        {/* Analytics View */}
        {viewMode === 'analytics' && <ProgressCharts />}

        {/* Utilities View */}
        {viewMode === 'utilities' && <Utilities />}

        {/* Data Management View */}
        {viewMode === 'data' && <DataManagement />}

        {/* Settings View */}
        {viewMode === 'settings' && profile && (
          <Settings
            name={profile.name}
            email={profile.email}
            onLogout={handleLogout}
            onClearData={() => {
              if (!profile) return;
              if (!confirm('Clear all workout history and programs for this user?')) return;
              localStorage.removeItem(`iron_brain_workout_history__${profile.id}`);
              localStorage.removeItem(`iron_brain_user_programs__${profile.id}`);
              setWorkoutHistory([]);
              setUserPrograms([]);
              setSelectedProgram(null);
              setOriginalProgram(null);
            }}
            onExtendSession={() => {
              if (!profile) return;
              const updated: UserProfile = {
                ...profile,
                rememberUntil: new Date().getTime() + 30 * 24 * 60 * 60 * 1000,
              };
              localStorage.setItem('iron_brain_profile', JSON.stringify(updated));
              setProfile(updated);
              alert('Session extended for 30 days on this device.');
            }}
          />
        )}

        {/* History View */}
        {viewMode === 'history' && (
          <WorkoutHistory
            workoutHistory={workoutHistory}
            onHistoryUpdate={() => {
              const updatedHistory = storage.getWorkoutHistory();
              setWorkoutHistory(updatedHistory);
            }}
          />
        )}

        {/* Program View */}
        {viewMode === 'program' && (
          <>
            {/* HERO CARD - Current Day at the Top */}
            {selectedProgram && currentDay && (
              <div className="mb-8 rounded-2xl sm:rounded-3xl hero-gradient p-1 shadow-2xl animate-slideUp">
                <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-500/95 via-purple-600/95 to-pink-500/95 backdrop-blur-xl p-5 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-200 animate-sparkle" />
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-purple-200">
                          Today's Workout
                        </p>
                      </div>
                      <h2 className="text-3xl sm:text-5xl font-black text-white mb-3 leading-tight">
                        {currentDay.name}
                      </h2>
                      <div className="flex items-center gap-2 text-sm sm:text-lg font-medium text-purple-100 flex-wrap">
                        <span>{currentDay.dayOfWeek}</span>
                        <span className="text-purple-300">•</span>
                        <span>Week {selectedWeek}</span>
                        <span className="text-purple-300">•</span>
                        <span className="truncate">{selectedProgram.name}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsLogging(true)}
                      className="w-full sm:w-auto rounded-xl sm:rounded-2xl bg-white px-6 py-4 sm:px-10 sm:py-5 font-black text-purple-600 text-base sm:text-lg shadow-2xl transition-all hover:scale-105 active:scale-95 hover:shadow-[0_20px_60px_rgba(255,255,255,0.5)] relative overflow-hidden group animate-bounceSubtle"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-3">
                        <Dumbbell className="h-5 w-5 sm:h-6 sm:w-6" />
                        Start Workout
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer"></div>
                    </button>

                    {/* Start Workout Hint for First-Time Users */}
                    {showStartWorkoutHint && (
                      <div className="absolute -bottom-4 left-0 right-0 animate-slideDown z-50">
                        <div className="mx-4 sm:mx-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-4 shadow-2xl border-2 border-white/30">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-white/20 p-2 flex-shrink-0">
                              <Sparkles className="h-5 w-5 text-white animate-sparkle" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white mb-1 text-sm sm:text-base">
                                Ready to Train? 💪
                              </h4>
                              <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                                Click <strong>Start Workout</strong> above to log your sets and track your progress in real-time.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setShowStartWorkoutHint(false);
                                localStorage.setItem('iron_brain_seen_start_workout_hint', 'true');
                              }}
                              className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1 touch-target touch-manipulation"
                              aria-label="Dismiss hint"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Preview of Sets */}
                  <div className="flex items-center gap-4 text-purple-50 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-white/20 p-2">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-lg">
                        {currentDay.sets.length} sets
                      </span>
                    </div>
                    <span className="text-purple-200">•</span>
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-white/20 p-2">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-lg">
                        {Object.keys(groupedSets || {}).length} exercises
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Program Overview */}
            <div className="mb-6 animate-fadeIn">
              {selectedProgram ? (
                <div className="rounded-2xl bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 p-1 shadow-2xl">
                  <div className="rounded-[14px] bg-white/90 p-5 sm:p-6 dark:bg-zinc-900/90">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-left">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-600 dark:text-purple-200">
                          Current Program
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 leading-tight">
                          {selectedProgram.name}
                        </h2>
                        {selectedProgram.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                            {selectedProgram.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {selectedProgram.goal && (
                            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 dark:bg-purple-900/30 dark:text-purple-100">
                              Goal: {selectedProgram.goal}
                            </span>
                          )}
                          {selectedProgram.experienceLevel && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-900/30 dark:text-blue-100">
                              Level: {selectedProgram.experienceLevel}
                            </span>
                          )}
                          {selectedProgram.intensityMethod && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 dark:bg-green-900/30 dark:text-green-100">
                              Intensity: {selectedProgram.intensityMethod.toUpperCase()}
                            </span>
                          )}
                          {selectedProgram.daysPerWeek && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 dark:bg-orange-900/30 dark:text-orange-100">
                              {selectedProgram.daysPerWeek} days/week
                            </span>
                          )}
                          {selectedProgram.weekCount && (
                            <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-800 dark:bg-pink-900/30 dark:text-pink-100">
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
                          className="gradient-purple flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white shadow-glow-purple transition-all hover:scale-105 hover:shadow-xl"
                        >
                          Edit in Builder
                        </button>
                        <button
                          onClick={() => setShowProgramSelector(true)}
                          className="w-full sm:w-auto rounded-xl border-2 border-purple-200 bg-white px-5 py-3 text-sm font-bold text-purple-700 shadow-md transition-all hover:border-purple-300 hover:shadow-lg dark:border-purple-900 dark:bg-zinc-900 dark:text-purple-200 dark:hover:border-purple-700"
                        >
                          Choose Different
                        </button>
                        <button
                          onClick={handleCreateNewFromBuilder}
                          className="w-full sm:w-auto rounded-xl border-2 border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-800 shadow-md transition-all hover:border-green-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-green-600"
                        >
                          Create New
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-gradient-to-br from-zinc-900 via-purple-900 to-purple-700 p-1 shadow-2xl">
                  <div className="rounded-[14px] bg-white/90 p-6 text-center dark:bg-zinc-900/90">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-100">
                      <Database className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">No program selected</h2>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      Pick a built-in program or create your own to get started.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <button
                        onClick={() => setShowProgramSelector(true)}
                        className="w-full sm:w-auto rounded-xl bg-white px-5 py-3 text-sm font-bold text-purple-700 shadow-md transition-all hover:scale-105 hover:shadow-lg dark:bg-zinc-800 dark:text-purple-200"
                      >
                        Choose Program
                      </button>
                      <button
                        onClick={handleCreateNewFromBuilder}
                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-xl"
                      >
                        Create New
                      </button>
                    </div>
                  </div>
                </div>
              )}

            {showProgramCustomizationHint && selectedProgram && (
              <div className="mt-4 animate-slideDown">
                <div className="rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-4 shadow-2xl border-2 border-white/30 dark:border-white/20">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-white/20 p-2 flex-shrink-0">
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white mb-1 text-sm sm:text-base">
                          Customize Your Training 🎯
                        </h4>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                          Use the builder to adjust weeks, days, and exercises. You can always switch to a different program.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProgramCustomizationHint(false);
                          localStorage.setItem('iron_brain_seen_program_hint', 'true');
                        }}
                        className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1 touch-target touch-manipulation"
                        aria-label="Dismiss hint"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedProgram && (
              <>
                {/* Collapsible Week Selector */}
                <div className="mb-6 animate-fadeIn" style={{animationDelay: '0.2s'}}>
              <button
                onClick={() => setShowWeekSelector(!showWeekSelector)}
                className="w-full flex items-center justify-between rounded-xl bg-white p-5 shadow-md transition-all hover:shadow-xl hover:scale-[1.02] border-2 border-zinc-200 hover:border-green-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-green-600 group"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                    <History className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Current Week
                    </p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      Week {selectedWeek}
                    </p>
                  </div>
                </div>
                {showWeekSelector ? (
                  <ChevronUp className="h-6 w-6 text-zinc-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                ) : (
                  <ChevronDown className="h-6 w-6 text-zinc-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
                )}
              </button>

              {showWeekSelector && (
                <div className="mt-4 animate-fadeIn">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-1 gap-2 overflow-x-auto rounded-2xl bg-gradient-to-br from-white to-zinc-50/50 p-4 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:to-zinc-900/50 dark:border-zinc-800 depth-effect">
                      {availableWeeks.map((weekNum) => (
                        <button
                          key={weekNum}
                          onClick={() => setSelectedWeek(weekNum)}
                          className={`flex-shrink-0 rounded-xl px-5 py-2.5 font-bold transition-all hover:scale-105 ${
                            selectedWeek === weekNum
                              ? 'gradient-purple text-white shadow-md'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          Week {weekNum}
                        </button>
                      ))}
                    </div>

                    {/* Quick Save Button (appears when changes detected) */}
                    {hasUnsavedChanges && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleDiscardChanges}
                          className="flex items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white px-6 py-3 font-semibold text-zinc-700 shadow-md transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Discard
                        </button>
                        <button
                          onClick={handleSaveChanges}
                          className="flex items-center gap-2 gradient-green rounded-xl px-6 py-3 font-bold text-white shadow-glow-green transition-all hover:shadow-xl hover:scale-105"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save Program
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Day Selector */}
            <div className="mb-8 animate-fadeIn" style={{animationDelay: '0.3s'}}>
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
                  <Dumbbell className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  Select Training Day
                </h3>
              </div>
              <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 mb-10" style={{overflow: 'visible'}}>
                {/* Empty State - No Days */}
                {(!currentWeek?.days || currentWeek.days.length === 0) && (
                  <div className="col-span-full rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50 animate-fadeIn">
                    <div className="mx-auto max-w-md">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                        <Dumbbell className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="mb-2 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                        No Training Days Yet
                      </h3>
                      <p className="mb-6 text-base font-medium text-zinc-600 dark:text-zinc-400">
                        This program has no days in Week {selectedWeek}. Use the editor to add them.
                      </p>
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-500">
                        <span>Edit this program in the builder to add days.</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentWeek?.days.map((day, idx) => (
                  <div key={idx} className="group relative stagger-item" style={{isolation: 'isolate'}}>
                    <button
                      onClick={() => {
                        setSelectedDayIndex(idx);
                        setUserPinnedDay(true);
                        setShowExerciseDetails(true);
                      }}
                      className={`w-full rounded-2xl border-2 p-7 text-left transition-all hover:scale-[1.03] depth-effect shadow-md hover:shadow-xl ${
                        selectedDayIndex === idx
                          ? 'gradient-animated border-transparent text-white shadow-glow-purple'
                          : 'border-zinc-200 bg-gradient-to-br from-white to-zinc-50 hover:border-purple-300 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-900/50 dark:hover:border-purple-700'
                      }`}
                    >
                      <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${
                        selectedDayIndex === idx ? 'text-purple-200' : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {day.dayOfWeek}
                      </p>
                      <p className={`text-2xl font-black mb-3 ${
                        selectedDayIndex === idx ? 'text-white' : 'text-zinc-900 dark:text-zinc-50'
                      }`}>
                        {day.name}
                      </p>
                      <div className={`flex items-center gap-2 text-base font-bold ${
                        selectedDayIndex === idx ? 'text-purple-100' : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                        <div className={`rounded-lg p-1.5 ${
                          selectedDayIndex === idx ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'
                        }`}>
                          <Dumbbell className="h-4 w-4" />
                        </div>
                        <span>{day.sets.length} sets</span>
                      </div>
                      {selectedDayIndex === idx && !showExerciseDetails && (
                        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-purple-100">
                          <ChevronDown className="h-4 w-4 animate-bounce" />
                          <span>Click to view exercises</span>
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Exercise List */}
              {currentDay && selectedDayIndex !== null && showExerciseDetails && (
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-white via-zinc-50/30 to-white p-10 shadow-premium border-2 border-zinc-100 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900 dark:border-zinc-800 depth-effect animate-fadeIn" style={{animationDelay: '0.4s'}}>
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-purple-100 p-3 dark:bg-purple-900/30">
                        <Dumbbell className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                        Exercise Details
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowExerciseDetails(false)}
                      className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 font-semibold text-zinc-700 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <ChevronUp className="h-5 w-5" />
                      <span className="hidden sm:inline">Hide Details</span>
                    </button>
                  </div>

                  {/* Exercise List (inline editable) */}
                  <div className="space-y-6">
                    {/* Empty State - No Exercises */}
                    {(!groupedSets || Object.keys(groupedSets).length === 0) && (
                      <div className="rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 p-10 text-center dark:border-purple-700 dark:bg-purple-900/10 animate-fadeIn">
                        <div className="mx-auto max-w-md">
                          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                            <Dumbbell className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                          </div>
                          <h3 className="mb-2 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                            No Exercises Yet
                          </h3>
                          <p className="mb-6 text-base font-medium text-zinc-600 dark:text-zinc-400">
                            Build your perfect workout by adding exercises in the Program Builder.
                          </p>
                          <button
                            onClick={() => {
                              if (!selectedProgram) return;
                              setEditingProgramForBuilder(selectedProgram);
                              setIsBuilding(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Open Builder
                          </button>
                        </div>
                      </div>
                    )}

                    {groupedSets && Object.entries(groupedSets).map(([exerciseId, sets], idx) => {
                      const exercise = getExercise(exerciseId);
                      return (
                        <div key={exerciseId} className="group relative rounded-2xl border-2 border-zinc-200 bg-gradient-to-br from-white via-zinc-50/50 to-white p-6 shadow-md transition-all hover:shadow-xl hover:shadow-purple-500/20 hover:border-purple-400 dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-900 dark:hover:border-purple-600 depth-effect stagger-item" style={{animationDelay: `${idx * 0.05}s`, isolation: 'isolate'}}>
                          <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-md ${
                                exercise?.type === 'compound'
                                  ? 'gradient-purple text-white'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                <Dumbbell className="h-7 w-7" />
                              </div>
                              <div>
                                <h4 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-1">
                                  {exercise?.name}
                                </h4>
                                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 capitalize">
                                  {exercise?.type} • {exercise?.muscleGroups.slice(0, 2).join(', ')}
                                </p>
                              </div>
                            </div>
                            {/* Remove Exercise Button */}
                            <button
                              onClick={() => removeExerciseFromDay(exerciseId)}
                              className="rounded-lg bg-red-600 p-2.5 text-white opacity-0 transition-all hover:bg-red-700 hover:scale-110 group-hover:opacity-100 touch-manipulation"
                              title="Remove exercise"
                              aria-label="Remove exercise"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="space-y-4">
                            {/* Column Headers - Hidden on mobile */}
                            <div className="hidden md:grid grid-cols-[80px_100px_100px_120px_1fr] gap-3 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-800/50 rounded-lg p-3">
                              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Set</span>
                              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                                Reps
                                <Tooltip content="Number of repetitions to perform (e.g., 8-12 for a range, or 10 for an exact number)" />
                              </span>
                              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                                RPE
                                <Tooltip content="Rate of Perceived Exertion (1-10 scale). RPE 10 = maximum effort, RPE 7 = could do 3 more reps, RPE 8 = could do 2 more reps" />
                              </span>
                              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                                Rest
                                <Tooltip content="Rest time in seconds between sets (e.g., 90 for 90 seconds, 120 for 2 minutes)" />
                              </span>
                              <span className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Notes</span>
                            </div>

                            {sets.map((set, idx) => (
                              <div key={idx} className="rounded-lg border border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">Set {set.setIndex}</span>
                                  <div className="flex flex-wrap gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-purple-800 dark:bg-purple-900/40 dark:text-purple-100">
                                      Reps: {set.prescribedReps}
                                    </span>
                                    {set.targetRPE !== undefined && set.targetRPE !== null && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">
                                        RPE {set.targetRPE}
                                      </span>
                                    )}
                                    {set.restSeconds && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-800 dark:bg-green-900/40 dark:text-green-100">
                                        Rest {set.restSeconds}s
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {set.notes && (
                                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">“{set.notes}”</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 text-center">
                      To modify exercises or sets, edit this program in the builder.
                    </div>
                  </div>
                </div>
              )}

            </div>
              </>
            )}
          </>
        )}
      </div>

      {showProgramSelector && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowProgramSelector(false)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-slideUp dark:bg-zinc-900 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 border-b border-zinc-200 bg-gradient-to-r from-purple-50 to-white px-6 py-4 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">Program Library</p>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Select a program</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Pick a built-in template or one of your saved programs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCreateNewFromBuilder}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New
                  </button>
                  <button
                    onClick={() => setShowProgramSelector(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition-all hover:scale-105 hover:shadow-md dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                    aria-label="Close program selector"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-y-auto bg-zinc-50/60 px-6 py-5 dark:bg-zinc-950/40">
              <ProgramSelector
                builtInPrograms={allPrograms}
                userPrograms={userPrograms}
                selectedProgram={selectedProgram}
                onSelectProgram={handleSelectProgram}
                onCreateNew={handleCreateNewFromBuilder}
                onDeleteProgram={handleDeleteProgram}
              />
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
