'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  HeartHandshake,
  LineChart,
  type LucideIcon,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Timer,
  User,
  X,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';
import { ReadinessCard } from './dashboard/ReadinessCard';
import { WeeklyConsistency } from './dashboard/WeeklyConsistency';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';
import { useWorkoutDataContext } from '@/app/providers/WorkoutDataProvider';
import { useProgramContext } from '@/app/providers/ProgramProvider';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { AuthModal } from './Auth';
import { getProgramProgress, resolveProgramDay } from '@/app/lib/programs/progress';
import { convertWeight } from '@/app/lib/units';
import { useUnitPreference } from '@/app/lib/hooks/useUnitPreference';
import type { DayTemplate, WeightUnit, WorkoutSession } from '@/app/lib/types';

function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortWorkoutTime(workout: WorkoutSession): number {
  return new Date(workout.endTime || workout.startTime || workout.date).getTime();
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function formatTimeAgo(workout: WorkoutSession | null): string {
  if (!workout) return 'No sessions yet';
  const timestamp = sortWorkoutTime(workout);
  if (!Number.isFinite(timestamp)) return 'Recent session';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function countDayWork(day: DayTemplate | null | undefined) {
  if (!day) return { movementCount: 0, setCount: 0 };

  const blockMovementCount = day.blocks?.reduce((total, block) => total + block.exercises.length, 0) ?? 0;
  const blockSetCount =
    day.blocks?.reduce(
      (total, block) => total + block.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      0
    ) ?? 0;
  const legacySetCount = day.sets?.length ?? 0;

  return {
    movementCount: blockMovementCount || (legacySetCount > 0 ? 1 : 0),
    setCount: blockSetCount || legacySetCount,
  };
}

function isPerformedSet(set: WorkoutSession['sets'][number]) {
  return set.completed && !set.skipped;
}

function calculateRecentPulse(workouts: WorkoutSession[], unit: WeightUnit) {
  const sorted = [...workouts].sort((a, b) => sortWorkoutTime(b) - sortWorkoutTime(a));
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recent = sorted.filter((workout) => {
    const time = sortWorkoutTime(workout);
    return Number.isFinite(time) && now - time <= sevenDaysMs;
  });
  const scope = recent.length > 0 ? recent : sorted.slice(0, 3);
  const performedSets = scope.flatMap((workout) => workout.sets.filter(isPerformedSet));
  const skippedSets = scope.flatMap((workout) => workout.sets.filter((set) => set.skipped));
  const totalVolume = performedSets.reduce((sum, set) => {
    const weight = Number(set.actualWeight) || 0;
    const reps = Number(set.actualReps) || 0;
    if (weight <= 0 || reps <= 0) return sum;
    const displayWeight = convertWeight(weight, set.weightUnit ?? 'lbs', unit);
    return sum + displayWeight * reps;
  }, 0);
  const rpeValues = performedSets
    .map((set) => Number(set.actualRPE))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageRpe =
    rpeValues.length > 0 ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : null;

  return {
    lastWorkout: sorted[0] ?? null,
    sessions: scope.length,
    completedSets: performedSets.length,
    skippedSets: skippedSets.length,
    totalVolume,
    averageRpe,
    usingFallbackScope: recent.length === 0 && sorted.length > 0,
  };
}

function ActionLink({
  href,
  label,
  detail,
  icon: Icon,
  primary = false,
}: {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-14 items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.99] sm:min-h-16 sm:px-4 ${
        primary
          ? 'border-emerald-300/40 bg-emerald-400 text-zinc-950 shadow-[0_18px_42px_-28px_rgba(52,211,153,0.9)] hover:bg-emerald-300'
          : 'border-zinc-800 bg-zinc-950/75 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900/75'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            primary ? 'bg-zinc-950/10 text-zinc-950' : 'bg-zinc-900 text-emerald-300'
          }`}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-black uppercase tracking-[0.16em]">{label}</span>
          <span className={`mt-0.5 block truncate text-[10px] font-semibold ${primary ? 'text-zinc-950/65' : 'text-zinc-500'}`}>
            {detail}
          </span>
        </span>
      </span>
      <ArrowRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${primary ? 'text-zinc-950/50' : 'text-zinc-600'}`} />
    </Link>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 px-3 py-3">
      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-xl font-black uppercase tracking-tight text-zinc-100">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-500">{detail}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { readiness, loading, error, lastUpdated } = useRecoveryState();
  const { isReady: activeSessionReady, isSessionActive } = useActiveSession();
  const { workouts, loading: workoutsLoading } = useWorkoutDataContext();
  const { selectedProgram, loading: programsLoading } = useProgramContext();
  const { weightUnit } = useUnitPreference();
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const [localProfileResolved, setLocalProfileResolved] = useState(false);
  const [hasPriorLocalUse, setHasPriorLocalUse] = useState(false);

  const namespaceId = user?.id ?? 'guest';
  const selectedProgress = useMemo(() => {
    if (!selectedProgram) return null;
    return getProgramProgress(selectedProgram, namespaceId);
  }, [namespaceId, selectedProgram]);
  const selectedProgramDay = useMemo(() => {
    if (!selectedProgram || !selectedProgress) return null;
    return resolveProgramDay(selectedProgram, selectedProgress);
  }, [selectedProgram, selectedProgress]);
  const selectedDayWork = useMemo(() => countDayWork(selectedProgramDay?.day), [selectedProgramDay?.day]);

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

  const pulse = useMemo(() => calculateRecentPulse(workouts, weightUnit), [weightUnit, workouts]);
  const nextSessionHref =
    selectedProgram?.id && selectedProgress
      ? `/workout/new?program_id=${encodeURIComponent(selectedProgram.id)}&week=${selectedProgress.weekIndex}&day=${selectedProgress.dayIndex}&cycle=${selectedProgress.cycleNumber}`
      : '/start';
  const mainHref = activeSessionReady && isSessionActive ? '/workout/new' : nextSessionHref;
  const mainLabel = activeSessionReady && isSessionActive ? 'Resume Session' : selectedProgramDay?.day ? 'Start Next Session' : 'Start Training';
  const mainDetail = activeSessionReady && isSessionActive
    ? 'Workout in progress'
    : selectedProgramDay?.day
      ? `${selectedProgramDay.day.dayOfWeek} / ${selectedProgramDay.day.name}`
      : 'Pick a plan or quick log';
  const smartAction =
    activeSessionReady && isSessionActive
      ? { label: 'Resume active workout', detail: 'Finish what is already running', href: '/workout/new', icon: Timer }
      : !readiness?.hasRecoveryInput
        ? { label: 'Run today check-in', detail: 'Improve target confidence', href: '/checkin', icon: ClipboardCheck }
        : selectedProgramDay?.day
          ? { label: 'Start programmed day', detail: `${selectedDayWork.setCount || '--'} sets ready`, href: nextSessionHref, icon: Play }
          : { label: 'Open start screen', detail: 'Choose program or quick log', href: '/start', icon: Dumbbell };
  const nextSessionTitle = programsLoading
    ? 'Loading program'
    : selectedProgram?.name ?? 'No program selected';
  const nextSessionSubtitle = selectedProgramDay?.day
    ? `${selectedProgramDay.day.dayOfWeek} / ${selectedProgramDay.day.name}`
    : selectedProgram
      ? 'Select a training day from Start'
      : 'Quick log or choose a program';
  const showReadiness = loading || Boolean(readiness);
  const showSystemFooter = lastUpdated && !loading && Boolean(readiness?.hasRecoveryInput);
  const showFreshUserAuthPrompt =
    localProfileResolved &&
    !authLoading &&
    !workoutsLoading &&
    !user &&
    !hasPriorLocalUse;
  const SmartActionIcon = smartAction.icon;

  const dismissPrSummary = () => {
    setRecentPrHits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iron_brain_last_pr_hits');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-4 pt-2 sm:space-y-5 sm:pt-7">
      {showFreshUserAuthPrompt && (
        <AuthModal
          hideClose
          onSuccess={() => setHasPriorLocalUse(true)}
        />
      )}

      <header className="flex items-center justify-between px-1">
        <div className="min-w-0 space-y-0.5 sm:space-y-1">
          <h1 className="truncate text-2xl font-black italic tracking-normal text-zinc-100 sm:text-4xl">
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
            aria-label="Open profile"
          >
            <User className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
          <Link
            href="/profile/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:h-10 sm:w-10"
            aria-label="Open settings"
          >
            <Settings className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </header>

      {prSummary.length > 0 && (
        <section className="animate-fadeIn mx-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">New Personal Records</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {prSummary.map((entry) => (
                    <span
                      key={entry.label}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-300"
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
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-200"
              aria-label="Dismiss personal record summary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-3 px-1 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-900/80 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-400/80">Command</p>
                <h2 className="mt-1 truncate text-xl font-black italic leading-tight text-zinc-100 sm:text-2xl">
                  {mainLabel}
                </h2>
                <p className="mt-1 truncate text-xs font-semibold text-zinc-500">{mainDetail}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            <ActionLink
              href={mainHref}
              label={mainLabel}
              detail={mainDetail}
              icon={activeSessionReady && isSessionActive ? Timer : Play}
              primary
            />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ActionLink href="/workout/new?type=empty" label="Quick Log" detail="Empty session" icon={RotateCcw} />
              <ActionLink href="/checkin" label="Check-In" detail={readiness?.hasRecoveryInput ? 'Update readiness' : 'Set today signal'} icon={ClipboardCheck} />
            </div>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">Next Up</p>
              <h2 className="mt-1 truncate text-lg font-black italic text-zinc-100">{nextSessionTitle}</h2>
              <p className="mt-1 truncate text-xs font-semibold text-zinc-500">{nextSessionSubtitle}</p>
            </div>
            <Link
              href="/programs"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              aria-label="Open programs"
            >
              <CalendarDays className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-900 rounded-2xl border border-zinc-900 bg-zinc-950/70">
            <div className="px-3 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-zinc-600">Cycle</p>
              <p className="mt-1 text-sm font-black italic text-zinc-100">{selectedProgramDay?.cycleNumber ?? '--'}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-zinc-600">Week</p>
              <p className="mt-1 text-sm font-black italic text-zinc-100">{selectedProgramDay?.weekNumber ?? '--'}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-zinc-600">Work</p>
              <p className="mt-1 truncate text-sm font-black italic text-zinc-100">
                {selectedDayWork.setCount > 0 ? `${selectedDayWork.setCount} sets` : '--'}
              </p>
            </div>
          </div>

          <Link
            href={smartAction.href}
            className="mt-3 flex min-h-12 items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <span className="flex min-w-0 items-center gap-3">
              <SmartActionIcon className="h-4.5 w-4.5 shrink-0 text-emerald-300" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-black uppercase tracking-[0.14em] text-zinc-100">
                  {smartAction.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-zinc-500">
                  {smartAction.detail}
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
          </Link>
        </div>
      </section>

      {showReadiness && (
        <section className="mx-1">
          <ReadinessCard readiness={readiness} loading={loading} />
        </section>
      )}

      <section className="grid gap-3 px-1 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-emerald-300" />
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">Training Pulse</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">
              {pulse.usingFallbackScope ? 'Recent' : '7 days'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Sessions" value={`${pulse.sessions}`} detail={formatTimeAgo(pulse.lastWorkout)} />
            <MetricTile label="Sets" value={`${pulse.completedSets}`} detail={pulse.skippedSets > 0 ? `${pulse.skippedSets} skipped` : 'Performed'} />
            <MetricTile label="Volume" value={formatCompactNumber(pulse.totalVolume)} detail={weightUnit} />
            <MetricTile label="Effort" value={pulse.averageRpe == null ? '--' : pulse.averageRpe.toFixed(1)} detail="Avg RPE" />
          </div>
        </div>

        <WeeklyConsistency workoutDates={workoutDates} loading={workoutsLoading && workoutDates.length === 0} />
      </section>

      {showSystemFooter && (
        <footer className="flex flex-col items-center justify-center gap-4 pt-3 opacity-50 pb-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              System Active - {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
