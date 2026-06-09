'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  History,
  Info,
  LogIn,
  Settings,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';
import { WeeklyConsistency } from './dashboard/WeeklyConsistency';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';
import { useWorkoutDataContext } from '@/app/providers/WorkoutDataProvider';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { useProgramContext } from '@/app/providers/ProgramProvider';
import { getProgramProgress, resolveProgramDay, type ProgramProgress } from '@/app/lib/programs/progress';
import { calculateSetVolumeLbs, isPerformedSetLog } from '@/app/lib/stats/set-metrics';
import { AuthModal } from './Auth';
import {
  ActionSheet,
  IconButton,
  LiquidSurface,
  cn,
  liquidButtonClass,
} from '@/app/components/ui/liquid';
import type { DayTemplate, ProgramTemplate, WorkoutSession } from '@/app/lib/types';

type Tone = 'emerald' | 'amber' | 'rose' | 'zinc';

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

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-3.5">
      <p className="text-sm font-medium text-zinc-100">{title}</p>
      <div className="mt-2 text-sm leading-5 text-zinc-400">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { readiness, loading: readinessLoading, error, lastUpdated } = useRecoveryState();
  const { isReady: activeSessionReady, isSessionActive } = useActiveSession();
  const { workouts, loading: workoutsLoading } = useWorkoutDataContext();
  const { selectedProgram, loading: programsLoading } = useProgramContext();
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
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

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const prSummary = useMemo(() => {
    if (recentPrHits.length === 0) return [];
    const labels: Record<PersonalRecordHit['recordType'], string> = {
      max_weight: 'Max weight',
      max_reps: 'Max reps',
      max_e1rm: 'Max e1RM',
      max_volume: 'Max volume',
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
    const windowMs = 14 * 24 * 60 * 60 * 1000;
    const recent =
      nowMs == null
        ? []
        : workouts.filter((workout) => {
            const time = getWorkoutTime(workout);
            return time > 0 && nowMs - time <= windowMs;
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
  }, [latestWorkout, nowMs, recentPrHits.length, workouts]);

  const smartAction = useMemo(() => {
    if (activeSessionReady && isSessionActive) {
      return {
        eyebrow: 'Active session',
        title: 'Resume workout',
        detail: 'Continue the current log.',
        href: '/workout/new',
        label: 'Resume',
        tone: 'emerald' as Tone,
      };
    }

    if (readiness?.hasRecoveryInput && readiness.score <= 45) {
      return {
        eyebrow: 'Recovery guardrail',
        title: 'Review readiness',
        detail: readiness.recommendation || 'Check readiness before pushing volume.',
        href: '/checkin',
        label: 'Check',
        tone: 'rose' as Tone,
      };
    }

    if (nextProgramSession) {
      const dayName = nextProgramSession.resolved.day?.name ?? 'Planned session';
      return {
        eyebrow: 'Planned training',
        title: dayName,
        detail: `${nextProgramSession.program.name} / Week ${nextProgramSession.resolved.weekNumber}, Day ${nextProgramSession.resolved.dayIndex + 1}`,
        href: nextProgramSession.href,
        label: 'Start',
        tone: 'emerald' as Tone,
      };
    }

    return {
      eyebrow: 'Open session',
      title: 'Start training',
      detail: 'Pick a program day or begin an empty log.',
      href: '/start',
      label: 'Start',
      tone: 'emerald' as Tone,
    };
  }, [activeSessionReady, isSessionActive, nextProgramSession, readiness]);

  const readinessSignal = useMemo(() => {
    if (readinessLoading) {
      return {
        value: '...',
        label: 'Readiness',
        detail: 'Syncing recovery signal',
        tone: 'zinc' as Tone,
        progress: 0,
      };
    }

    if (!readiness) {
      return {
        value: '--',
        label: 'Readiness',
        detail: "Set today's guardrails before loading up",
        tone: 'zinc' as Tone,
        progress: 0,
      };
    }

    const score = Math.round(readiness.score);
    const tone =
      score >= 80
        ? 'emerald'
        : score >= 50
          ? 'amber'
          : 'rose';
    const detail =
      readiness.recommendation ||
      (score >= 80
        ? 'Good window for planned work'
        : score >= 50
          ? 'Keep jumps conservative'
          : 'Hold back on load and volume');

    return {
      value: String(score),
      label: readiness.hasRecoveryInput ? 'Readiness' : 'Training estimate',
      detail,
      tone: tone as Tone,
      progress: score,
    };
  }, [readiness, readinessLoading]);

  const nextSessionTitle =
    nextProgramSession?.resolved.day?.name ?? selectedProgram?.name ?? (programsLoading ? 'Loading' : 'No plan');
  const planChipValue = nextSessionTitle;
  const workChipValue = nextProgramSession
    ? `${nextProgramSession.work.movementCount} moves / ${nextProgramSession.work.setCount} sets`
    : '--';
  const sessionContext = [
    readinessSignal.value !== '--' && !readinessLoading ? `${readinessSignal.value} readiness` : null,
    planChipValue && planChipValue !== 'No plan' && planChipValue !== 'Loading' ? planChipValue : null,
    workChipValue !== '--' ? workChipValue : null,
  ].filter((item): item is string => Boolean(item));
  const actionSubtitle =
    smartAction.tone === 'emerald' && nextProgramSession ? nextProgramSession.program.name : null;
  const primaryButtonVariant = smartAction.tone === 'rose' ? 'danger' : smartAction.tone === 'zinc' ? 'neutral' : 'action';
  const primaryActionLabel =
    smartAction.label === 'Start'
      ? 'Start training'
      : smartAction.label === 'Resume'
        ? 'Resume session'
        : smartAction.label === 'Check'
          ? 'Open readiness check-in'
          : smartAction.label;
  const hiddenPrimaryActionText = smartAction.label === 'Resume' ? primaryActionLabel : null;
  const showSyncPrompt = !authLoading && !user;

  const dismissPrSummary = () => {
    setRecentPrHits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iron_brain_last_pr_hits');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8 pt-3 sm:space-y-5 sm:pt-8">
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
        />
      )}

      <header className="flex items-center justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">Today</p>
          <h1 className="mt-0.5 truncate text-3xl font-medium tracking-tight text-zinc-50 sm:text-4xl">
            Iron Brain
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/upgrade"
            aria-label="Support Iron Brain"
            title="Support Iron Brain"
            className="hidden h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 sm:inline-flex"
          >
            <HeartHandshake className="h-4 w-4" />
            Support
          </Link>
          {showSyncPrompt && (
            <IconButton label="Sync account" onClick={() => setAuthOpen(true)}>
              <LogIn className="h-4 w-4" />
            </IconButton>
          )}
          <Link
            href="/profile"
            aria-label="Open profile"
            title="Open profile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <User className="h-4.5 w-4.5" />
          </Link>
          <Link
            href="/profile/settings"
            aria-label="Open settings"
            title="Open settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>
        </div>
      </header>

      {prSummary.length > 0 && (
        <LiquidSurface density="compact" className="mx-1 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(119,224,169,0.22)] bg-[rgba(67,201,135,0.075)] text-[rgb(137,226,178)]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-100">New personal records</p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {prSummary.map((entry) => `${entry.label}${entry.count > 1 ? ` x${entry.count}` : ''}`).join(' / ')}
                </p>
              </div>
            </div>
            <IconButton label="Dismiss PR summary" onClick={dismissPrSummary} className="h-8 w-8">
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </LiquidSurface>
      )}

      <LiquidSurface
        data-testid="dashboard-command-center"
        variant="elevated"
        className="mx-1 overflow-hidden p-0"
      >
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[rgba(67,201,135,0.045)] blur-3xl" />
          <div data-testid="dashboard-smart-action" className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-medium tracking-tight text-zinc-50 sm:text-5xl">
                  {smartAction.title}
                </h2>
                {actionSubtitle && (
                  <p className="mt-2 truncate text-sm text-zinc-500 sm:text-base">
                    {actionSubtitle}
                  </p>
                )}
              </div>

              <IconButton label="Open today details" onClick={() => setDetailsOpen(true)} className="mt-0.5">
                <Info className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <Link
                href={smartAction.href}
                aria-label={primaryActionLabel}
                className={liquidButtonClass({
                  variant: primaryButtonVariant,
                  className: 'w-full justify-between px-5 sm:min-w-56',
                })}
              >
                <span>{smartAction.label}</span>
                {hiddenPrimaryActionText && <span className="sr-only">{hiddenPrimaryActionText}</span>}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="grid grid-cols-3 gap-1 sm:flex sm:gap-1.5">
                <Link
                  href={nextProgramSession?.href ?? '/start'}
                  aria-label="Open plan"
                  title="Open plan"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Plan</span>
                </Link>
                <Link
                  href="/workout/new?type=empty"
                  aria-label="Start quick log"
                  title="Start quick log"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"
                >
                  <Zap className="h-4 w-4" />
                  <span>Log</span>
                </Link>
                <Link
                  href="/checkin"
                  aria-label="Open check-in"
                  title="Open check-in"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Check</span>
                </Link>
              </div>
            </div>
          </div>

          {sessionContext.length > 0 ? (
            <div
              data-testid="dashboard-next-session"
              className="relative mt-5 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 pt-4 text-sm text-zinc-500"
            >
              {sessionContext.map((item) => (
                <span key={item} className="truncate">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <div data-testid="dashboard-next-session" className="sr-only">
              No planned session
            </div>
          )}
        </div>
      </LiquidSurface>

      <section data-testid="dashboard-readiness-strip" className="sr-only">
        {readinessSignal.label}: {readinessSignal.value}. {readinessSignal.detail}
      </section>

      <section
        data-testid="dashboard-training-pulse"
        className="mx-1 px-1 py-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">Training pulse</p>
            {trainingPulse.sessions > 0 && (
              <p className="mt-0.5 truncate text-xs text-zinc-600">
                Last: {trainingPulse.lastWorkoutName}
              </p>
            )}
          </div>
          <Link
            href="/history"
            aria-label="Open history"
            title="Open history"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"
          >
            <History className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-white/8 pt-3">
          <div>
            <p className="text-base font-medium text-zinc-100">{trainingPulse.sessions}</p>
            <p className="text-xs text-zinc-600">Sessions</p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-100">{trainingPulse.completedSets}</p>
            <p className="text-xs text-zinc-600">Sets</p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-100">{formatCompactNumber(trainingPulse.volume)}</p>
            <p className="text-xs text-zinc-600">Volume</p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-100">{trainingPulse.prCount}</p>
            <p className="text-xs text-zinc-600">PRs</p>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-activity-mobile" className="mx-1">
        <WeeklyConsistency compact workoutDates={workoutDates} loading={workoutsLoading && workoutDates.length === 0} />
      </section>

      {error && (
        <p className="text-center text-xs text-rose-300/70">
          Analytics server currently unreachable. Some data may be local.
        </p>
      )}

      <ActionSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Today details"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Link href="/checkin" className={liquidButtonClass({ variant: 'neutral', density: 'compact' })}>
              Check-in
            </Link>
            <Link href="/history" className={liquidButtonClass({ variant: 'neutral', density: 'compact' })}>
              History
            </Link>
          </div>
        }
      >
        <div className="space-y-3">
          <DetailBlock title="Primary action">
            <p>{smartAction.detail}</p>
          </DetailBlock>
          <DetailBlock title="Readiness">
            <p>{readinessSignal.detail}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  'h-full rounded-full',
                  readinessSignal.tone === 'emerald'
                    ? 'bg-[rgb(67,201,135)]'
                    : readinessSignal.tone === 'amber'
                      ? 'bg-amber-300'
                      : readinessSignal.tone === 'rose'
                        ? 'bg-rose-300'
                        : 'bg-zinc-600'
                )}
                style={{ width: `${Math.max(0, Math.min(100, readinessSignal.progress))}%` }}
              />
            </div>
            {lastUpdated && (
              <p className="mt-2 text-xs text-zinc-500">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </DetailBlock>
          <DetailBlock title="Plan">
            <p>{nextSessionTitle}</p>
            {nextProgramSession && (
              <p className="mt-1 text-zinc-500">
                Week {nextProgramSession.resolved.weekNumber}, day {nextProgramSession.resolved.dayIndex + 1} /{' '}
                {nextProgramSession.work.movementCount} movements / {nextProgramSession.work.setCount} sets
              </p>
            )}
          </DetailBlock>
          <DetailBlock title="Training pulse">
            <p>
              {trainingPulse.sessions} sessions / {trainingPulse.completedSets} sets /{' '}
              {formatCompactNumber(trainingPulse.volume)} volume over the last 14 days.
            </p>
            <p className="mt-1 text-zinc-500">
              Last: {trainingPulse.lastWorkoutDate} / {trainingPulse.lastCompletedSets} sets
            </p>
          </DetailBlock>
        </div>
      </ActionSheet>
    </div>
  );
}
