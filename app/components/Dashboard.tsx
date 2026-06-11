'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  HeartHandshake,
  LogIn,
  MoreHorizontal,
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

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { readiness, loading: readinessLoading, error } = useRecoveryState();
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
      title: 'No program selected',
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
  const displayTitle = nextProgramSession ? nextProgramSession.program.name : smartAction.title;
  const displaySubtitle = nextProgramSession
    ? nextProgramSession.resolved.day?.name ?? 'Planned session'
    : smartAction.label === 'Resume'
      ? 'Active workout in progress'
      : smartAction.tone === 'rose'
        ? 'Check readiness before you load up'
        : 'Pick a program or freestyle session';
  const dayDisplayValue = nextProgramSession
    ? nextProgramSession.resolved.day?.dayOfWeek?.trim() || `Day ${nextProgramSession.resolved.dayIndex + 1}`
    : trainingPulse.lastWorkoutDate;
  const sessionFacts = nextProgramSession
    ? [
        { value: String(nextProgramSession.work.movementCount), label: 'Movements' },
        { value: String(nextProgramSession.work.setCount), label: 'Sets' },
        { value: `Week ${nextProgramSession.resolved.weekNumber}`, label: 'Program week' },
        { value: dayDisplayValue, label: dayDisplayValue.startsWith('Day') ? 'Training day' : 'Scheduled day' },
      ]
    : [
        { value: String(trainingPulse.sessions), label: '14-day sessions' },
        { value: formatCompactNumber(trainingPulse.volume), label: '14-day volume' },
        { value: String(trainingPulse.prCount), label: 'PRs' },
        { value: dayDisplayValue, label: 'Last lift' },
      ];
  const primaryButtonVariant = smartAction.tone === 'rose' ? 'danger' : smartAction.tone === 'zinc' ? 'neutral' : 'action';
  const primaryButtonText =
    smartAction.label === 'Resume'
      ? 'Resume session'
      : smartAction.label === 'Check'
        ? 'Check readiness'
        : 'Start training';
  const primaryActionLabel = primaryButtonText;
  const showSyncPrompt = !authLoading && !user;

  const dismissPrSummary = () => {
    setRecentPrHits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iron_brain_last_pr_hits');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 overflow-hidden pb-0 pt-2 sm:space-y-6 sm:pt-8">
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
        />
      )}

      <header className="flex items-center justify-between gap-4 px-1">
        <div className="min-w-0">
          <h1 className="iron-display truncate text-3xl text-zinc-50 sm:text-4xl">
            Iron Brain
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/upgrade"
            aria-label="Support Iron Brain"
            title="Support Iron Brain"
            className="liquid-icon-button hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-zinc-300 transition-colors hover:text-zinc-100 sm:inline-flex"
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
            className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <User className="h-4.5 w-4.5" />
          </Link>
          <Link
            href="/profile/settings"
            aria-label="Open settings"
            title="Open settings"
            className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>
        </div>
      </header>

      {prSummary.length > 0 && (
        <LiquidSurface density="compact" className="mx-1 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/[0.075] text-emerald-300">
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

      <section
        data-testid="dashboard-command-center"
        className="liquid-primary-card mx-1 p-4 sm:p-5"
      >
        <div data-testid="dashboard-smart-action" className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="iron-label">Today</p>
              <h2 className="iron-display mt-2 break-words text-[2rem] leading-[0.95] text-zinc-50 sm:text-5xl">
                {displayTitle}
              </h2>
              <p className="mt-2 truncate text-sm font-semibold text-zinc-400 sm:text-base">
                {displaySubtitle}
              </p>
            </div>

            <IconButton label="Open session options" onClick={() => setDetailsOpen(true)} className="mt-0.5">
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
          </div>

          <div data-testid="dashboard-next-session" className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {sessionFacts.map((fact) => (
              <div key={fact.label} className="iron-metric-tile">
                <p className="iron-display truncate text-xl leading-none text-zinc-50">{fact.value}</p>
                <p className="mt-2 truncate text-[10px] font-bold text-zinc-500">{fact.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Link
              href={smartAction.href}
              aria-label={primaryActionLabel}
              className={liquidButtonClass({
                variant: primaryButtonVariant,
                className: 'min-h-14 w-full justify-between px-5 text-sm sm:min-w-60',
              })}
            >
              <span>{primaryButtonText}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/workout/new?type=empty"
              aria-label="Start freestyle workout"
              className={liquidButtonClass({
                variant: 'elevated',
                className: 'min-h-14 justify-center px-5 sm:min-w-32',
              })}
            >
              <Zap className="h-4 w-4" />
              <span>Freestyle</span>
            </Link>
          </div>
        </div>
      </section>

      <section data-testid="dashboard-readiness-strip" className="sr-only">
        {readinessSignal.label}: {readinessSignal.value}. {readinessSignal.detail}
      </section>

      <section
        data-testid="dashboard-training-pulse"
        className="mx-1 px-1 py-1"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-100">Last 14 days</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          <div className="iron-metric-tile">
            <p className="iron-display text-xl leading-none text-zinc-100">{trainingPulse.sessions}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-500">Sessions</p>
          </div>
          <div className="iron-metric-tile">
            <p className="iron-display text-xl leading-none text-zinc-100">{trainingPulse.completedSets}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-500">Sets</p>
          </div>
          <div className="iron-metric-tile">
            <p className="iron-display text-xl leading-none text-zinc-100">{formatCompactNumber(trainingPulse.volume)}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-500">Volume</p>
          </div>
          <div className="iron-metric-tile">
            <p className="iron-display text-xl leading-none text-zinc-100">{trainingPulse.prCount}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-500">PRs</p>
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
        title="Details"
      >
        <div className="space-y-3">
          <div>
            <p className="truncate text-sm font-semibold text-zinc-50">{nextSessionTitle}</p>
            {nextProgramSession ? (
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Week {nextProgramSession.resolved.weekNumber}, day {nextProgramSession.resolved.dayIndex + 1}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-zinc-500">{smartAction.detail}</p>
            )}
          </div>

          {nextProgramSession && (
            <div className="grid grid-cols-2 gap-2 border-y border-white/[0.07] py-2 text-xs">
              <div>
                <p className="font-semibold text-zinc-200">{nextProgramSession.work.movementCount}</p>
                <p className="mt-0.5 text-zinc-500">Movements</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-200">{nextProgramSession.work.setCount}</p>
                <p className="mt-0.5 text-zinc-500">Sets</p>
              </div>
            </div>
          )}

          <Link href="/checkin" className="liquid-menu-row">
            <span>Check in</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ActionSheet>
    </div>
  );
}
