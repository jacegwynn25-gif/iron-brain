'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  HeartHandshake,
  Settings,
  Sparkles,
  X,
  Plus,
  User,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';
import { ReadinessCard } from './dashboard/ReadinessCard';
import { WeeklyConsistency } from './dashboard/WeeklyConsistency';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';
import { useWorkoutDataContext } from '@/app/providers/WorkoutDataProvider';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { useProgramContext } from '@/app/providers/ProgramProvider';
import { getProgramProgress, resolveProgramDay, type ProgramProgress } from '@/app/lib/programs/progress';
import { calculateSetVolumeLbs, isPerformedSetLog } from '@/app/lib/stats/set-metrics';
import { AuthModal } from './Auth';
import type { DayTemplate, ProgramTemplate, WorkoutSession } from '@/app/lib/types';

function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWorkoutTime(workout: WorkoutSession): number {
  const raw = workout.endTime || workout.startTime || workout.date;
  const parsed = raw ? Date.parse(raw.includes('T') ? raw : `${raw}T12:00:00`) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeDate(value?: string | null): string {
  const dateKey = toLocalDateKey(value);
  if (!dateKey) return 'No date';
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  const todayKey = toLocalDateKey(today.toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday.toISOString());

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return Math.round(value).toLocaleString();
}

function countDayWork(day: DayTemplate | null): { movementCount: number; setCount: number } {
  if (!day) return { movementCount: 0, setCount: 0 };

  const blockMovementCount = day.blocks?.reduce((sum, block) => sum + block.exercises.length, 0) ?? 0;
  const blockSetCount =
    day.blocks?.reduce(
      (sum, block) => sum + block.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0),
      0
    ) ?? 0;

  if (blockSetCount > 0 || blockMovementCount > 0) {
    return { movementCount: blockMovementCount, setCount: blockSetCount };
  }

  const legacySets = day.sets ?? [];
  const movementIds = new Set(legacySets.map((set) => set.exerciseId).filter(Boolean));
  return {
    movementCount: movementIds.size || (legacySets.length > 0 ? 1 : 0),
    setCount: legacySets.length,
  };
}

function buildPlannedSessionHref(program: ProgramTemplate, progress: ProgramProgress): string {
  return `/workout/new?program_id=${encodeURIComponent(program.id)}&week=${progress.weekIndex}&day=${progress.dayIndex}&cycle=${progress.cycleNumber}`;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { readiness, loading: readinessLoading, error, lastUpdated } = useRecoveryState();
  const { isReady: activeSessionReady, isSessionActive } = useActiveSession();
  const { workouts, loading: workoutsLoading } = useWorkoutDataContext();
  const { selectedProgram, loading: programsLoading } = useProgramContext();
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const [localProfileResolved, setLocalProfileResolved] = useState(false);
  const [hasPriorLocalUse, setHasPriorLocalUse] = useState(false);
  const namespaceId = user?.id ?? 'guest';

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    workouts.forEach((workout) => {
      const dateKey = toLocalDateKey(workout.date) ?? toLocalDateKey(workout.startTime) ?? toLocalDateKey(workout.endTime);
      if (dateKey) dates.add(dateKey);
    });
    return Array.from(dates);
  }, [workouts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const localOnboardingComplete = localStorage.getItem('iron_brain_onboarding_complete') === 'true';
      const localCoachMarksComplete = localStorage.getItem('iron_brain_coach_marks_complete') === 'true';

      setHasPriorLocalUse(localOnboardingComplete || localCoachMarksComplete || workouts.length > 0);
    } catch {
    } finally {
      setLocalProfileResolved(true);
    }
  }, [workouts.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('iron_brain_last_pr_hits');
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | PersonalRecordHit[]
        | { hits?: PersonalRecordHit[]; createdAt?: string };
      const hits = Array.isArray(parsed) ? parsed : parsed.hits ?? [];
      if (hits.length > 0) setRecentPrHits(hits);
    } catch {
    }
  }, []);

  const prSummary = useMemo(() => {
    if (recentPrHits.length === 0) return [];
    const labels: Record<PersonalRecordHit['recordType'], string> = {
      max_weight: 'Max Weight',
      max_reps: 'Max Reps',
      max_e1rm: 'Max e1RM',
      max_volume: 'Max Volume',
    };
    const grouped = new Map<string, number>();
    recentPrHits.forEach((hit) => {
      const label = labels[hit.recordType];
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    });
    return Array.from(grouped.entries()).map(([label, count]) => ({ label, count }));
  }, [recentPrHits]);

  const selectedProgramProgress = useMemo(() => {
    if (!selectedProgram) return null;
    return getProgramProgress(selectedProgram, namespaceId);
  }, [namespaceId, selectedProgram]);

  const nextProgramSession = useMemo(() => {
    if (!selectedProgram || !selectedProgramProgress) return null;
    const resolved = resolveProgramDay(selectedProgram, selectedProgramProgress);
    const work = countDayWork(resolved.day);

    return {
      program: selectedProgram,
      progress: selectedProgramProgress,
      resolved,
      work,
      href: buildPlannedSessionHref(selectedProgram, selectedProgramProgress),
    };
  }, [selectedProgram, selectedProgramProgress]);

  const latestWorkout = useMemo(
    () => [...workouts].sort((a, b) => getWorkoutTime(b) - getWorkoutTime(a))[0] ?? null,
    [workouts]
  );

  const trainingPulse = useMemo(() => {
    const now = Date.now();
    const windowMs = 14 * 24 * 60 * 60 * 1000;
    const recent = workouts.filter((workout) => {
      const time = getWorkoutTime(workout);
      return time > 0 && now - time <= windowMs;
    });
    const completedSets = recent.flatMap((workout) =>
      workout.sets.filter((set) => isPerformedSetLog(set, { allowWarmup: true }))
    );
    const volume = completedSets.reduce((sum, set) => sum + (calculateSetVolumeLbs(set) ?? 0), 0);
    const lastCompletedSets =
      latestWorkout?.sets.filter((set) => isPerformedSetLog(set, { allowWarmup: true })).length ?? 0;

    return {
      sessions: recent.length,
      completedSets: completedSets.length,
      volume,
      lastWorkoutName: latestWorkout?.dayName || latestWorkout?.programName || 'No workout yet',
      lastWorkoutDate: formatRelativeDate(latestWorkout?.endTime || latestWorkout?.date),
      lastCompletedSets,
      prCount: recentPrHits.length,
    };
  }, [latestWorkout, recentPrHits.length, workouts]);

  const smartAction = useMemo(() => {
    if (activeSessionReady && isSessionActive) {
      return {
        eyebrow: 'Active Session',
        title: 'Resume the workout in progress',
        detail: 'Continue the current log.',
        href: '/workout/new',
        label: 'RESUME',
        tone: 'amber' as const,
      };
    }

    if (readiness?.hasRecoveryInput && readiness.score <= 45) {
      return {
        eyebrow: 'Recovery Guardrail',
        title: 'Review readiness before loading up',
        detail: readiness.recommendation || 'Check readiness before pushing volume.',
        href: '/checkin',
        label: 'CHECK',
        tone: 'rose' as const,
      };
    }

    if (nextProgramSession) {
      const dayName = nextProgramSession.resolved.day?.name ?? 'planned session';
      return {
        eyebrow: 'Planned Training',
        title: dayName,
        detail: `${nextProgramSession.program.name} / Week ${nextProgramSession.resolved.weekNumber}, Day ${nextProgramSession.resolved.dayIndex + 1}`,
        href: nextProgramSession.href,
        label: 'START',
        tone: 'emerald' as const,
      };
    }

    if (!readinessLoading && !readiness?.hasRecoveryInput) {
      return {
        eyebrow: 'Missing Readiness',
        title: 'Check in',
        detail: 'Add readiness so targets get better guardrails.',
        href: '/checkin',
        label: 'CHECK',
        tone: 'zinc' as const,
      };
    }

    return {
      eyebrow: 'Open Session',
      title: 'Start training',
      detail: 'Pick a program day or begin an empty log.',
      href: '/start',
      label: 'START',
      tone: 'emerald' as const,
    };
  }, [activeSessionReady, isSessionActive, nextProgramSession, readiness, readinessLoading]);

  const dismissPrSummary = () => {
    setRecentPrHits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iron_brain_last_pr_hits');
    }
  };

  const showReadiness = readinessLoading || Boolean(readiness);
  const showSystemFooter = lastUpdated && !readinessLoading && Boolean(readiness?.hasRecoveryInput);
  const showFreshUserAuthPrompt =
    localProfileResolved &&
    !authLoading &&
    !workoutsLoading &&
    !user &&
    !hasPriorLocalUse;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2 pb-0 pt-1 sm:space-y-5 sm:pt-8">
      {showFreshUserAuthPrompt && (
        <AuthModal
          hideClose
          onSuccess={() => setHasPriorLocalUse(true)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-2xl font-black italic tracking-normal text-zinc-100 sm:text-4xl">
            IRON BRAIN
          </h1>
          <Link
            href="/upgrade"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/85 transition-colors hover:text-amber-200"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Support Iron Brain
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:h-10 sm:w-10"
          >
            <User className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
          <Link
            href="/profile/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:h-10 sm:w-10"
          >
            <Settings className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </header>

      {/* PR Alert */}
      {prSummary.length > 0 && (
        <section className="animate-fadeIn rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:rounded-3xl sm:p-6 mx-1">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 sm:h-10 sm:w-10">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 sm:text-xs">New Personal Records</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {prSummary.map((entry) => (
                    <span
                      key={entry.label}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-300 sm:text-[10px]"
                    >
                      {entry.label} {entry.count > 1 ? `x${entry.count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrSummary}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-200 sm:h-8 sm:w-8"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </section>
      )}

      <section data-testid="dashboard-command-center" className="surface-card stagger-item mx-1 overflow-hidden">
        <div className="p-3 sm:p-5">
          <div data-testid="dashboard-smart-action" className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                smartAction.tone === 'rose'
                  ? 'text-rose-300'
                  : smartAction.tone === 'amber'
                    ? 'text-amber-300'
                    : smartAction.tone === 'zinc'
                      ? 'text-zinc-400'
                      : 'text-emerald-300'
              }`}>
                Next Action
              </p>
              <h2 className="mt-0.5 truncate text-xl font-black italic leading-tight text-zinc-100 sm:text-2xl">
                {smartAction.title}
              </h2>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500 sm:text-sm">
                {smartAction.detail}
              </p>
            </div>
            <Link
              href={smartAction.href}
              className={`group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-black uppercase tracking-normal text-white transition-all hover:scale-[1.01] active:scale-[0.99] sm:h-11 sm:px-4 sm:text-xs ${
                smartAction.tone === 'rose'
                  ? 'bg-rose-500 shadow-lg shadow-rose-500/15'
                  : smartAction.tone === 'amber'
                    ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/15'
                    : smartAction.tone === 'zinc'
                      ? 'border border-zinc-700 bg-zinc-900 text-zinc-100'
                      : 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/15'
              }`}
            >
              {smartAction.label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            <Link
              href={nextProgramSession?.href ?? '/start'}
              className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950/65 px-2.5 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 sm:px-3 sm:py-3"
            >
              <CalendarDays className="h-4 w-4 text-emerald-300" />
              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">Plan</p>
              <p className="mt-0.5 truncate text-[11px] font-black text-zinc-100 sm:text-xs">
                {nextProgramSession?.resolved.day?.dayOfWeek ?? (programsLoading ? 'Wait' : 'Pick')}
              </p>
            </Link>
            <Link
              href="/workout/new?type=empty"
              className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950/65 px-2.5 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 sm:px-3 sm:py-3"
            >
              <Plus className="h-4 w-4 text-zinc-300" />
              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">Log</p>
              <p className="mt-0.5 truncate text-[11px] font-black text-zinc-100 sm:text-xs">Empty</p>
            </Link>
            <Link
              href="/checkin"
              className="min-w-0 rounded-xl border border-zinc-900 bg-zinc-950/65 px-2.5 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 sm:px-3 sm:py-3"
            >
              <ClipboardCheck className="h-4 w-4 text-cyan-300" />
              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">Ready</p>
              <p className="mt-0.5 truncate text-[11px] font-black text-zinc-100 sm:text-xs">
                {readiness?.hasRecoveryInput ? `${Math.round(readiness.score)}` : 'Check'}
              </p>
            </Link>
          </div>
        </div>

        <div data-testid="dashboard-next-session" className="grid grid-cols-[minmax(0,1.4fr)_0.65fr_0.65fr] divide-x divide-zinc-900 border-t border-zinc-900/80">
          <div className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <p className="truncate text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600">Next</p>
            </div>
            <p className="mt-0.5 truncate text-sm font-black italic text-zinc-100 sm:text-base">
              {nextProgramSession?.resolved.day?.name ?? selectedProgram?.name ?? (programsLoading ? 'Loading' : 'No Plan')}
            </p>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600">Moves</p>
            <p className="mt-0.5 text-sm font-black text-zinc-100">
              {nextProgramSession ? nextProgramSession.work.movementCount : '--'}
            </p>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600">Sets</p>
            <p className="mt-0.5 text-sm font-black text-zinc-100">
              {nextProgramSession ? nextProgramSession.work.setCount : '--'}
            </p>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-training-pulse" className="surface-card stagger-item mx-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-900/80 px-3 py-2.5 sm:p-5">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Training Pulse</p>
            <h2 className="mt-0.5 truncate text-sm font-black italic text-zinc-100 sm:text-lg">
              Last: {trainingPulse.lastWorkoutName}
            </h2>
          </div>
          <Link
            href="/history"
            className="inline-flex h-8 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:h-9"
          >
            History
          </Link>
        </div>
        <div className="grid grid-cols-4 divide-x divide-zinc-900">
          <div className="min-w-0 px-3 py-2.5 sm:p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:tracking-[0.2em]">
              <span className="sm:hidden">Sess</span>
              <span className="hidden sm:inline">Sessions</span>
            </p>
            <p className="mt-1 text-lg font-black italic text-zinc-100 sm:text-xl">{trainingPulse.sessions}</p>
          </div>
          <div className="min-w-0 px-3 py-2.5 sm:p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:tracking-[0.2em]">
              <span className="sm:hidden">Sets</span>
              <span className="hidden sm:inline">Completed Sets</span>
            </p>
            <p className="mt-1 text-lg font-black italic text-zinc-100 sm:text-xl">{trainingPulse.completedSets}</p>
          </div>
          <div className="min-w-0 px-3 py-2.5 sm:p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:tracking-[0.2em]">
              <span className="sm:hidden">Vol</span>
              <span className="hidden sm:inline">Volume</span>
            </p>
            <p className="mt-1 text-lg font-black italic text-zinc-100 sm:text-xl">{formatCompactNumber(trainingPulse.volume)}</p>
          </div>
          <div className="min-w-0 px-3 py-2.5 sm:p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:tracking-[0.2em]">
              <span className="sm:hidden">PR</span>
              <span className="hidden sm:inline">Recent PR</span>
            </p>
            <p className="mt-1 text-lg font-black italic text-zinc-100 sm:text-xl">{trainingPulse.prCount}</p>
          </div>
        </div>
        <div className="truncate border-t border-zinc-900/80 px-3 py-2 text-[11px] font-semibold text-zinc-500 sm:px-4 sm:py-3 sm:text-xs">
          {trainingPulse.lastWorkoutDate}
          <span className="text-zinc-700"> / </span>
          {trainingPulse.lastCompletedSets} sets
        </div>
      </section>

      {/* Readiness Section */}
      {showReadiness && (
        <section className="stagger-item mx-1 hidden sm:block">
          <ReadinessCard readiness={readiness} loading={readinessLoading} />
        </section>
      )}

      {/* Consistency Chart */}
      <section className="stagger-item mx-1 hidden sm:block">
        <WeeklyConsistency workoutDates={workoutDates} loading={workoutsLoading && workoutDates.length === 0} />
      </section>

      {/* Status Footer */}
      {showSystemFooter && (
        <footer className="hidden flex-col items-center justify-center gap-4 pt-4 opacity-50 pb-8 sm:flex">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              System Active • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="h-px w-12 bg-zinc-900" />
        </footer>
      )}

      {error && (
        <p className="text-center text-xs text-rose-400/50">
          Analytics server currently unreachable. Some data may be local.
        </p>
      )}
    </div>
  );
}
