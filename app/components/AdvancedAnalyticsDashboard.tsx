'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Battery,
  CalendarDays,
  Dumbbell,
  User,
  Shield,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';
import { useUnitPreference } from '../lib/hooks/useUnitPreference';
import { getWorkoutHistory, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { trackUiEvent } from '../lib/analytics/ui-events';
import type { ProgramScheduleEvent, SetType, WorkoutSession } from '../lib/types';
import { FEATURES } from '../lib/features';
import { listScheduleEvents } from '../lib/calendar/schedule-api';
import {
  calculateACWR,
  updateFitnessFatigueModel,
  type FitnessFatigueModel
} from '../lib/stats/adaptive-recovery';
import { getRecoveryProfiles, type RecoveryProfile } from '../lib/fatigue/cross-session';
import {
  calculate1RMLeaderboard,
  calculateVolumeLeaderboard,
  type Exercise1RM
} from '../lib/stats/one-rep-max';
import RecoveryOverview from './RecoveryOverview';
import type { Database } from '../lib/supabase/database.types';
import { defaultExercises } from '../lib/programs';

/**
 * Look up proper exercise name from defaultExercises
 * Falls back to formatting the ID as a readable name if not found
 */
function getExerciseName(exerciseId: string, providedName?: string): string {
  // First try exact match on ID
  let exercise = defaultExercises.find(ex => ex.id === exerciseId);

  // Try matching by slug (exerciseId might be a slug like "row_chest_supported")
  if (!exercise) {
    const slug = exerciseId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const underscoreSlug = exerciseId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    exercise = defaultExercises.find(ex =>
      ex.id.toLowerCase() === slug ||
      ex.id.toLowerCase() === underscoreSlug ||
      ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug ||
      ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') === underscoreSlug
    );
  }

  if (exercise) {
    return exercise.name;
  }

  // If provided name looks like a proper name (has spaces or proper capitalization), use it
  if (providedName && providedName.includes(' ')) {
    return providedName;
  }

  // Format the ID as a readable name: "row_chest_supported" → "Row Chest Supported"
  return exerciseId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'id' | 'exercise_id' | 'exercise_slug' | 'actual_weight' | 'weight_unit' | 'actual_reps' | 'actual_rpe' | 'completed' | 'set_type'
>;

const normalizeSetType = (value?: string | null): SetType => {
  const allowed: SetType[] = [
    'straight', 'superset', 'giant', 'drop', 'rest-pause',
    'cluster', 'warmup', 'amrap', 'backoff'
  ];
  return allowed.includes(value as SetType) ? (value as SetType) : 'straight';
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type SupabaseWorkoutRow = Pick<
  Database['public']['Tables']['workout_sessions']['Row'],
  'id' | 'start_time' | 'end_time' | 'total_volume_load' | 'notes' | 'date' | 'duration_minutes'
> & {
  set_logs?: SupabaseSetLogRow[] | null;
};

interface AnalyticsData {
  acwr?: {
    ratio: number;
    status: string;
    acuteLoad: number;
    chronicLoad: number;
    chronicWeeklyLoad: number;
    baselineConfidence: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  fitnessFatigue?: {
    currentFitness: number;
    currentFatigue: number;
    performance: number;
    readiness: 'excellent' | 'good' | 'moderate' | 'poor';
  };
  personalStats?: {
    totalWorkouts: number;
    totalSets: number;
  };
  recoveryProfiles?: RecoveryProfile[];
  strengthLeaderboard?: Exercise1RM[];
  volumeLeaderboard?: Array<{
    exerciseId: string;
    exerciseName: string;
    totalVolume: number;
    setCount: number;
    avgWeightPerSet: number;
  }>;
  adherence?: {
    windows: Record<
      '7' | '30' | '90',
      {
        plannedSessions: number;
        completedSessions: number;
        onTimeCompletedSessions: number;
        skippedSessions: number;
        rescheduledSessions: number;
        completionRate: number;
        onTimeRate: number;
        skipRate: number;
        rescheduleRate: number;
      }
    >;
    trend: Array<{
      label: string;
      startDate: string;
      endDate: string;
      plannedSessions: number;
      completedSessions: number;
      completionRate: number;
    }>;
    overdueCount: number;
    upcomingSession: ProgramScheduleEvent | null;
  };
}

type AdherenceSnapshot = NonNullable<AnalyticsData['adherence']>;

type ViewType = 'overview' | 'adherence' | 'recovery' | 'strength' | 'profile';

interface AdvancedAnalyticsDashboardProps {
  initialView?: string;
}

const VIEW_OPTIONS: ViewType[] = ['overview', 'adherence', 'recovery', 'strength', 'profile'];

const resolveInitialView = (value?: string): ViewType => {
  const resolved = VIEW_OPTIONS.includes(value as ViewType) ? (value as ViewType) : 'overview';
  if (resolved === 'adherence' && !FEATURES.adherenceAnalytics) return 'overview';
  return resolved;
};

const SECTION_CLASS = 'rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-4 sm:p-5';
const SUBSECTION_CARD_CLASS = 'rounded-xl border border-zinc-900 bg-zinc-950/70 p-3.5';
const SECTION_TITLE_CLASS = 'text-lg font-black italic tracking-tight text-zinc-100 sm:text-xl';
const METRIC_LABEL_CLASS = 'text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500';

type Tone = 'emerald' | 'amber' | 'rose' | 'zinc';

const toneTextClass: Record<Tone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  zinc: 'text-zinc-400',
};

const toneBgClass: Record<Tone, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  zinc: 'bg-zinc-500',
};

const toneBorderClass: Record<Tone, string> = {
  emerald: 'border-emerald-400/45',
  amber: 'border-amber-400/45',
  rose: 'border-rose-400/45',
  zinc: 'border-zinc-700',
};

function StatusReadout({
  label,
  value,
  tone,
}: {
  label?: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="shrink-0 text-right">
      {label && <p className={METRIC_LABEL_CLASS}>{label}</p>}
      <p className={`mt-0.5 text-sm font-black italic uppercase tracking-tight ${toneTextClass[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function RankDecal({ rank, tone = 'amber' }: { rank: number; tone?: Tone }) {
  const label = rank === 1 ? 'I' : rank === 2 ? 'II' : rank === 3 ? 'III' : String(rank);
  const isTopThree = rank <= 3;

  if (!isTopThree) {
    return (
      <span className="w-8 shrink-0 text-center text-xs font-black italic text-zinc-500">
        {rank}
      </span>
    );
  }

  return (
    <span
      className={`flex h-8 w-9 shrink-0 items-center justify-center border ${toneBorderClass[tone]} bg-zinc-950 text-[10px] font-black italic ${toneTextClass[tone]} shadow-[0_12px_30px_-22px_rgba(251,191,36,0.9)]`}
      style={{ clipPath: 'polygon(16% 0, 100% 0, 84% 100%, 0 100%)' }}
      aria-label={`Rank ${rank}`}
    >
      {label}
    </span>
  );
}

function RecoveryMeter({ score }: { score: number }) {
  const tone: Tone = score >= 8 ? 'emerald' : score >= 6 ? 'amber' : 'rose';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-1.5 overflow-hidden rounded-sm bg-zinc-800">
        <div
          className={`absolute bottom-0 left-0 right-0 ${toneBgClass[tone]}`}
          style={{ height: `${Math.min(100, Math.max(0, score * 10))}%` }}
        />
      </div>
      <span className={`text-sm font-black italic ${toneTextClass[tone]}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

const formatIsoDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
};

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

function withAnalyticsTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export default function AdvancedAnalyticsDashboard({ initialView }: AdvancedAnalyticsDashboardProps) {
  const { user, loading: authLoading, namespaceReady, isSyncing } = useAuth();
  const { unitSystem, setUnitSystem, weightUnit, lbsToKg, kgToLbs } = useUnitPreference();
  const [analytics, setAnalytics] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);
  const loadingInProgressRef = useRef(false);
  const [selectedView, setSelectedView] = useState<ViewType>(() => resolveInitialView(initialView));
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [loadingAdherence, setLoadingAdherence] = useState(false);
  const hasMinimumData = completedWorkouts.length >= 3;
  const adherencePlanned90 = analytics.adherence?.windows['90'].plannedSessions ?? 0;
  const canRenderAdherenceWithoutWorkoutMinimum =
    FEATURES.adherenceAnalytics && (adherencePlanned90 > 0 || loadingAdherence || selectedView === 'adherence');
  const hasRequiredDataset = hasMinimumData || canRenderAdherenceWithoutWorkoutMinimum;

  // Track previous user ID to detect actual user changes
  const prevUserIdRef = useRef<string | undefined | null>(null);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const currentUserId = user?.id;

    // Update ref for next render
    prevUserIdRef.current = currentUserId;

    // Skip reset on initial mount (prevUserId is null) or when auth is resolving (undefined → value)
    // Only reset when user explicitly changes or signs out
    if (prevUserId === null) {
      return;
    }

    if (prevUserId === undefined && currentUserId !== undefined) {
      return; // Auth just resolved, don't reset - let loadAnalytics handle it
    }

    if (prevUserId !== currentUserId) {
      setAnalytics({});
      setCompletedWorkouts([]);
      setCloudSyncing(false);
      setLoading(true);
      initialLoadRef.current = true;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!initialView) return;
    setSelectedView(resolveInitialView(initialView));
  }, [initialView]);

  const normalizeWorkoutId = useCallback(
    (value: string) => (value.startsWith('session_') ? value.substring(8) : value),
    []
  );

  const buildCompletedWorkouts = useCallback((workouts: WorkoutSession[]) => {
    const uniqueWorkouts = new Map<string, WorkoutSession>();
    workouts.forEach((workout) => {
      uniqueWorkouts.set(normalizeWorkoutId(workout.id), workout);
    });

    return Array.from(uniqueWorkouts.values()).filter((workout) => {
      const hasTimestamp = Boolean(workout.endTime || workout.startTime || workout.date);
      if (!hasTimestamp) return false;

      const hasValidSets = workout.sets.some((set) => {
        if (set.completed === false) return false;
        const weight = set.actualWeight || 0;
        const reps = set.actualReps || 0;
        const isWarmup = set.setType === 'warmup';
        if (isWarmup) return false;
        return weight > 0 && reps > 0 && !Number.isNaN(weight) && !Number.isNaN(reps);
      });

      if (hasValidSets) return true;

      const totalVolumeLoad = typeof workout.totalVolumeLoad === 'number'
        ? workout.totalVolumeLoad
        : Number(workout.totalVolumeLoad ?? 0);
      return Number.isFinite(totalVolumeLoad) && totalVolumeLoad > 0;
    });
  }, [normalizeWorkoutId]);

  const buildCoreAnalytics = useCallback((workouts: WorkoutSession[]) => {
    if (workouts.length < 3) return null;

    const toLbs = (value: number, fromUnit: 'lbs' | 'kg') =>
      fromUnit === 'lbs' ? value : kgToLbs(value);
    const toDisplay = (valueLbs: number) =>
      weightUnit === 'lbs' ? valueLbs : lbsToKg(valueLbs);
    const roundWeightDisplay = (value: number) => {
      const factor = weightUnit === 'kg' ? 100 : 10;
      return Math.round(value * factor) / factor;
    };

    const resolveSetWeight = (set: WorkoutSession['sets'][number]) => {
      const raw = typeof set.actualWeight === 'number' ? set.actualWeight : Number(set.actualWeight ?? 0);
      if (!Number.isFinite(raw)) return 0;
      const fromUnit = set.weightUnit ?? 'lbs';
      return toLbs(raw, fromUnit);
    };

    const resolveFallbackVolumeLoad = (workout: WorkoutSession) => {
      const fallback = typeof workout.totalVolumeLoad === 'number'
        ? workout.totalVolumeLoad
        : Number(workout.totalVolumeLoad ?? 0);
      if (!Number.isFinite(fallback)) return 0;
      return fallback;
    };

    const resolveWorkoutEffortLoad = (workout: WorkoutSession) => {
      const calculatedLoad = workout.sets.reduce((sum, set) => {
        if (set.completed === false || set.setType === 'warmup') return sum;
        const weight = resolveSetWeight(set);
        const reps = typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0);
        const rpe = Number(set.actualRPE ?? set.prescribedRPE ?? workout.averageRPE ?? workout.sessionRPE ?? 7);
        if (weight <= 0 || reps <= 0 || !Number.isFinite(weight) || !Number.isFinite(reps)) return sum;
        const effortFactor = clampValue(Number.isFinite(rpe) ? rpe / 10 : 0.7, 0.45, 1.05);
        return sum + (weight * reps * effortFactor);
      }, 0);
      if (calculatedLoad > 0) return calculatedLoad;
      const fallbackRpe = Number(workout.averageRPE ?? workout.sessionRPE ?? 7);
      return resolveFallbackVolumeLoad(workout) * clampValue(Number.isFinite(fallbackRpe) ? fallbackRpe / 10 : 0.7, 0.45, 1.05);
    };

    const workoutsWithLoad = workouts.map((workout) => ({
      date: new Date(workout.endTime || workout.startTime || workout.date),
      load: resolveWorkoutEffortLoad(workout),
    }));

    const acwrMetrics = calculateACWR(workoutsWithLoad);

    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(a.endTime || a.startTime || a.date).getTime()
        - new Date(b.endTime || b.startTime || b.date).getTime()
    );
    const recentWorkouts = sortedWorkouts.slice(-14);
    let fitnessFatigueModel: FitnessFatigueModel | null = null;
    let lastWorkoutDate = new Date(recentWorkouts[0]?.endTime || Date.now());

    for (const workout of recentWorkouts) {
      const workoutDate = new Date(workout.endTime || workout.startTime || workout.date);
      const daysSince = fitnessFatigueModel
        ? (workoutDate.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      const effortLoad = workout.sets.reduce((sum, set) => {
        if (set.completed === false || set.setType === 'warmup') return sum;
        const reps = typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0);
        if (!Number.isFinite(reps) || reps <= 0) return sum;
        const weight = resolveSetWeight(set);
        if (!Number.isFinite(weight) || weight <= 0) return sum;

        const volume = reps * weight;
        const rpe = set.actualRPE ?? set.prescribedRPE ?? 7;
        const intensity = Number.isFinite(rpe) ? (rpe / 10) : 0.7;
        const effortMultiplier = set.reachedFailure ? 1.5 : 1.0;
        return sum + (volume * intensity * effortMultiplier);
      }, 0);

      const fallbackVolume = resolveFallbackVolumeLoad(workout);
      const fallbackRpe = workout.averageRPE ?? workout.sessionRPE ?? 7;
      const fallbackIntensity = Number.isFinite(fallbackRpe) ? fallbackRpe / 10 : 0.7;
      const resolvedEffortLoad = effortLoad > 0 ? effortLoad : fallbackVolume * fallbackIntensity;
      const load = resolvedEffortLoad / 1000;

      fitnessFatigueModel = updateFitnessFatigueModel(
        fitnessFatigueModel,
        'full_body',
        load,
        daysSince
      );

      lastWorkoutDate = workoutDate;
    }

    let readiness: 'excellent' | 'good' | 'moderate' | 'poor' = 'moderate';
    if (fitnessFatigueModel) {
      const perf = fitnessFatigueModel.netPerformance;
      // Thresholds aligned with new normalization (neutral = 50)
      if (perf >= 75) readiness = 'excellent';
      else if (perf >= 60) readiness = 'good';
      else if (perf >= 40) readiness = 'moderate';
      else readiness = 'poor';
    }

    const totalSets = workouts.reduce((sum, workout) => {
      const eligibleSets = workout.sets.filter((set) => set.completed !== false && set.setType !== 'warmup');
      return sum + eligibleSets.length;
    }, 0);

    // Build strength data from all sets
    const allSets = workouts.flatMap((workout) =>
      workout.sets
        .filter((set) => set.completed !== false && set.setType !== 'warmup')
        .map((set) => ({
          weight: resolveSetWeight(set),
          reps: typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0),
          rpe: set.actualRPE ?? null,
          exerciseId: set.exerciseId,
          exerciseName: getExerciseName(set.exerciseId, set.exerciseName),
          date: workout.endTime || workout.startTime || workout.date,
        }))
    );

    const strengthLeaderboardLbs = calculate1RMLeaderboard(allSets, { minSets: 2 });
    const volumeLeaderboardLbs = calculateVolumeLeaderboard(allSets, { minSets: 2 });
    const strengthLeaderboard = strengthLeaderboardLbs.map((lift) => ({
      ...lift,
      estimated1RM: Math.round(toDisplay(lift.estimated1RM)),
      totalVolume: Math.round(toDisplay(lift.totalVolume)),
      bestSet: {
        ...lift.bestSet,
        weight: roundWeightDisplay(toDisplay(lift.bestSet.weight)),
      },
    }));
    const volumeLeaderboard = volumeLeaderboardLbs.map((exercise) => ({
      ...exercise,
      totalVolume: Math.round(toDisplay(exercise.totalVolume)),
      avgWeightPerSet: roundWeightDisplay(toDisplay(exercise.avgWeightPerSet)),
    }));

    return {
      acwr: {
        ratio: clampValue(acwrMetrics.acwr, 0, 5.0),
        status: acwrMetrics.status,
        acuteLoad: toDisplay(clampValue(acwrMetrics.acuteLoad, 0, 1000000)),
        chronicLoad: toDisplay(clampValue(acwrMetrics.chronicLoad, 0, 1000000)),
        chronicWeeklyLoad: toDisplay(clampValue(acwrMetrics.chronicWeeklyLoad, 0, 1000000)),
        baselineConfidence: acwrMetrics.baselineConfidence,
        recommendation: acwrMetrics.recommendation,
      },
      fitnessFatigue: fitnessFatigueModel
        ? {
          currentFitness: clampValue(fitnessFatigueModel.currentFitness, 0, 200),
          currentFatigue: clampValue(fitnessFatigueModel.currentFatigue, 0, 150),
          performance: clampValue(fitnessFatigueModel.netPerformance, 0, 100),
          readiness,
        }
        : undefined,
      personalStats: {
        totalWorkouts: workouts.length,
        totalSets,
      },
      strengthLeaderboard,
      volumeLeaderboard,
    } satisfies Pick<AnalyticsData, 'acwr' | 'fitnessFatigue' | 'personalStats' | 'strengthLeaderboard' | 'volumeLeaderboard'>;
  }, [kgToLbs, lbsToKg, weightUnit]);

  const updateCoreAnalytics = useCallback((workouts: WorkoutSession[]) => {
    setCompletedWorkouts(workouts);
    const core = buildCoreAnalytics(workouts);

    if (!core) {
      setAnalytics((prev) => ({
        ...prev,
        acwr: undefined,
        fitnessFatigue: undefined,
        personalStats: undefined,
        strengthLeaderboard: undefined,
        volumeLeaderboard: undefined,
      }));
      return;
    }

    setAnalytics((prev) => ({
      ...prev,
      ...core,
    }));
  }, [buildCoreAnalytics]);

  const buildAdherenceAnalytics = useCallback((events: ProgramScheduleEvent[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = formatIsoDateLocal(today);

    const getWindowMetrics = (days: number) => {
      const start = addDays(today, -(days - 1));
      const startIso = formatIsoDateLocal(start);
      const scoped = events.filter((event) => event.scheduledDate >= startIso && event.scheduledDate <= todayIso);

      const plannedSessions = scoped.length;
      const completedSessions = scoped.filter((event) => event.status === 'completed').length;
      const onTimeCompletedSessions = scoped.filter(
        (event) => event.status === 'completed' && !event.movedFromDate
      ).length;
      const skippedSessions = scoped.filter((event) => event.status === 'skipped').length;
      const rescheduledSessions = scoped.filter(
        (event) => event.status === 'moved' || Boolean(event.movedFromDate)
      ).length;

      return {
        plannedSessions,
        completedSessions,
        onTimeCompletedSessions,
        skippedSessions,
        rescheduledSessions,
        completionRate: pct(completedSessions, plannedSessions),
        onTimeRate: pct(onTimeCompletedSessions, plannedSessions),
        skipRate: pct(skippedSessions, plannedSessions),
        rescheduleRate: pct(rescheduledSessions, plannedSessions),
      };
    };

    const windows = {
      '7': getWindowMetrics(7),
      '30': getWindowMetrics(30),
      '90': getWindowMetrics(90),
    } satisfies AdherenceSnapshot['windows'];

    const currentWeekStart = startOfWeek(today);
    const trend = Array.from({ length: 12 }, (_, offset) => {
      const weekStart = addDays(currentWeekStart, -(11 - offset) * 7);
      const weekEnd = addDays(weekStart, 6);
      const weekStartIso = formatIsoDateLocal(weekStart);
      const weekEndIso = formatIsoDateLocal(weekEnd);
      const clampedEndIso = weekEndIso > todayIso ? todayIso : weekEndIso;
      const weekEvents = events.filter(
        (event) => event.scheduledDate >= weekStartIso && event.scheduledDate <= clampedEndIso
      );
      const plannedSessions = weekEvents.length;
      const completedSessions = weekEvents.filter((event) => event.status === 'completed').length;
      return {
        label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        startDate: weekStartIso,
        endDate: clampedEndIso,
        plannedSessions,
        completedSessions,
        completionRate: pct(completedSessions, plannedSessions),
      };
    });

    const upcomingSession =
      events
        .filter(
          (event) =>
            (event.status === 'scheduled' || event.status === 'moved') && event.scheduledDate >= todayIso
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;

    const overdueCount = events.filter(
      (event) =>
        (event.status === 'scheduled' || event.status === 'moved') && event.scheduledDate < todayIso
    ).length;

    return {
      windows,
      trend,
      overdueCount,
      upcomingSession,
    } satisfies AdherenceSnapshot;
  }, []);

  const loadAdherenceAnalytics = useCallback(async () => {
    if (!FEATURES.adherenceAnalytics || !user) {
      setAnalytics((prev) => ({ ...prev, adherence: undefined }));
      return;
    }

    setLoadingAdherence(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const from = formatIsoDateLocal(addDays(today, -89));
      const to = formatIsoDateLocal(addDays(today, 30));
      const events = await withAnalyticsTimeout(
        listScheduleEvents({ from, to }),
        6500,
        'adherence analytics'
      );
      const adherence = buildAdherenceAnalytics(events);
      setAnalytics((prev) => ({
        ...prev,
        adherence,
      }));
    } catch {
    } finally {
      setLoadingAdherence(false);
    }
  }, [buildAdherenceAnalytics, user]);

  const loadAnalytics = useCallback(async () => {
    // Check preconditions BEFORE acquiring lock - this allows proper retry when conditions change
    // If we acquire the lock first and then return early, subsequent calls get blocked unnecessarily
    if (authLoading || !namespaceReady) {
      return;
    }

    // Now acquire lock - only for actual loading operations
    if (loadingInProgressRef.current) {
      return;
    }
    loadingInProgressRef.current = true;

    try {
      setLoading(initialLoadRef.current);
      setCloudSyncing(Boolean(user) && isSyncing);
      setUserNamespace(user?.id || null);

      const localWorkouts = getWorkoutHistory();
      const localCompleted = buildCompletedWorkouts(localWorkouts);
      updateCoreAnalytics(localCompleted);
      setLoading(false);
      initialLoadRef.current = false;

      // If not logged in, show local data only
      if (!user) {
        return;
      }

      setCloudSyncing(true);
      try {
        const { data: supabaseWorkouts, error } = await withAnalyticsTimeout(
          supabase
            .from('workout_sessions')
            .select(`
              id,
              date,
              start_time,
              end_time,
              duration_minutes,
              total_volume_load,
              notes,
              set_logs (
                id,
                exercise_id,
                exercise_slug,
                actual_weight,
                weight_unit,
                actual_reps,
                actual_rpe,
                completed,
                set_type
              )
            `)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('start_time', { ascending: false })
            .limit(250),
          9000,
          'insights workout history'
        );

        if (error) {
          throw error;
        }

        const supabaseRows: SupabaseWorkoutRow[] = supabaseWorkouts ?? [];
        const converted: WorkoutSession[] = supabaseRows.map((sw) => ({
          id: sw.id,
          startTime: sw.start_time ?? undefined,
          endTime: sw.end_time ?? undefined,
          totalVolumeLoad: sw.total_volume_load ?? undefined,
          notes: sw.notes ?? undefined,
          programId: '',
          programName: '',
          cycleNumber: 0,
          weekNumber: 0,
          dayName: '',
          dayOfWeek: '',
          date: sw.date ?? (sw.start_time ? sw.start_time.split('T')[0] : new Date().toISOString().split('T')[0]),
          createdAt: sw.start_time ?? new Date().toISOString(),
          updatedAt: sw.end_time ?? sw.start_time ?? new Date().toISOString(),
          sets: (sw.set_logs || []).map((sl, idx) => {
            const exerciseId = sl.exercise_id || sl.exercise_slug || '';
            const exerciseName = sl.exercise_slug || sl.exercise_id || 'Unknown Exercise';
            return {
              id: sl.id ?? undefined,
              exerciseId,
              exerciseName,
              setIndex: idx + 1,
              prescribedReps: '0',
              actualWeight: sl.actual_weight ?? undefined,
              weightUnit: sl.weight_unit === 'kg' ? 'kg' : 'lbs',
              actualReps: sl.actual_reps ?? undefined,
              actualRPE: sl.actual_rpe ?? undefined,
              completed: sl.completed !== false,
              setType: normalizeSetType(sl.set_type),
              timestamp: sw.start_time ?? undefined,
            };
          }),
        }));

        const mergedWorkouts = converted.length === 0
          ? localWorkouts
          : (() => {
            const localById = new Map<string, WorkoutSession>();
            localWorkouts.forEach((workout) => {
              localById.set(normalizeWorkoutId(workout.id), workout);
            });

            const cloudIds = new Set(converted.map((workout) => normalizeWorkoutId(workout.id)));
            const mergedCloud = converted.map((workout) => localById.get(normalizeWorkoutId(workout.id)) ?? workout);
            const uniqueLocal = localWorkouts.filter((workout) => !cloudIds.has(normalizeWorkoutId(workout.id)));

            return [...mergedCloud, ...uniqueLocal];
          })();

        const mergedCompleted = buildCompletedWorkouts(mergedWorkouts);
        updateCoreAnalytics(mergedCompleted);
      } catch {
      } finally {
        setCloudSyncing(false);
        setLoading(false);
      }
    } catch {
    } finally {
      // Always release lock and reset loading states to prevent stuck UI
      loadingInProgressRef.current = false;
      setLoading(false);
      initialLoadRef.current = false;
    }
  }, [authLoading, namespaceReady, isSyncing, user, buildCompletedWorkouts, updateCoreAnalytics, normalizeWorkoutId]);

  const loadRecoveryProfiles = useCallback(async () => {
    if (!user || loadingRecovery || analytics.recoveryProfiles) return;
    setLoadingRecovery(true);
    try {
      const profiles = await withAnalyticsTimeout(
        getRecoveryProfiles(user.id),
        6500,
        'recovery profiles'
      );
      setAnalytics((prev) => ({
        ...prev,
        recoveryProfiles: profiles,
      }));
    } catch {
    } finally {
      setLoadingRecovery(false);
    }
  }, [user, loadingRecovery, analytics.recoveryProfiles]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAnalytics();
      }
    };
    const handleFocus = () => {
      loadAnalytics();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAnalytics]);

  // Recalculate analytics when weight unit changes so displayed values update
  useEffect(() => {
    if (completedWorkouts.length >= 3) {
      updateCoreAnalytics(completedWorkouts);
    }
    // Only run when weightUnit changes, not when completedWorkouts or updateCoreAnalytics change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightUnit]);

  useEffect(() => {
    if (!user) return;
    if (analytics.recoveryProfiles || loadingRecovery) return;
    if (selectedView === 'recovery' || selectedView === 'overview') {
      void loadRecoveryProfiles();
    }
  }, [selectedView, user, analytics.recoveryProfiles, loadingRecovery, loadRecoveryProfiles]);

  useEffect(() => {
    if (!FEATURES.adherenceAnalytics || !user) return;
    if (selectedView === 'adherence' || selectedView === 'overview') {
      void loadAdherenceAnalytics();
    }
  }, [selectedView, user, loadAdherenceAnalytics]);

  // Get load-pressure status from effort-weighted acute/chronic workload.
  const getLoadPressureStatus = () => {
    if (!analytics.acwr) return { tone: 'zinc' as Tone, label: 'Unknown' };
    if (analytics.acwr.baselineConfidence === 'low') {
      return { tone: 'zinc' as Tone, label: 'Building baseline' };
    }
    const ratio = analytics.acwr.ratio;
    if (ratio >= 0.8 && ratio <= 1.3) return { tone: 'emerald' as Tone, label: 'Steady' };
    if (ratio < 0.8) return { tone: 'amber' as Tone, label: 'Deloading' };
    if (ratio <= 1.5) return { tone: 'amber' as Tone, label: 'Building' };
    if (ratio <= 2.0) return { tone: 'rose' as Tone, label: 'Spike' };
    return { tone: 'rose' as Tone, label: 'Major spike' };
  };

  const loadPressure = getLoadPressureStatus();

  // Compute unified readiness score combining fitness-fatigue model with actual muscle recovery
  // Muscle recovery is weighted more heavily since it directly indicates training readiness
  const getUnifiedReadiness = () => {
    const hasRecoveryData = analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0;
    const hasFitnessFatigue = analytics.fitnessFatigue;

    // If we have muscle recovery data, use it as the primary signal
    if (hasRecoveryData) {
      const profiles = analytics.recoveryProfiles!;
      // Calculate average readiness score (1-10 scale) and convert to 0-100
      const avgMuscleReadiness = profiles.reduce((sum, p) => sum + p.readinessScore, 0) / profiles.length;
      const muscleReadinessScore = avgMuscleReadiness * 10; // Convert 1-10 to 0-100

      if (hasFitnessFatigue) {
        // Blend muscle recovery (70% weight) with fitness-fatigue (30% weight)
        // Muscle recovery is more important - it's what actually determines if you can train
        const fitnessFatigueScore = analytics.fitnessFatigue!.performance;
        const blendedScore = (muscleReadinessScore * 0.7) + (fitnessFatigueScore * 0.3);
        return Math.round(blendedScore);
      }
      return Math.round(muscleReadinessScore);
    }

    // Fall back to fitness-fatigue only if no muscle recovery data
    if (hasFitnessFatigue) {
      return Math.round(analytics.fitnessFatigue!.performance);
    }

    return 50; // Default neutral if no data
  };

  const getReadinessStatus = (score: number): 'excellent' | 'good' | 'moderate' | 'poor' => {
    if (score >= 75) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'moderate';
    return 'poor';
  };

  const unifiedReadiness = getUnifiedReadiness();
  const readinessStatus = getReadinessStatus(unifiedReadiness);
  const readinessTone: Tone =
    readinessStatus === 'excellent' || readinessStatus === 'good'
      ? 'emerald'
      : readinessStatus === 'moderate'
        ? 'amber'
        : 'rose';
  const hasMuscleRecoveryData = Boolean(analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0);
  const readinessTitle = hasMuscleRecoveryData ? 'READINESS' : 'TRAINING BALANCE';
  const fitnessFatigueDelta = analytics.fitnessFatigue
    ? analytics.fitnessFatigue.currentFitness - analytics.fitnessFatigue.currentFatigue
    : null;
  const trainingBalanceLabel = hasMuscleRecoveryData
    ? readinessStatus
    : fitnessFatigueDelta == null
      ? readinessStatus
      : fitnessFatigueDelta >= 8
        ? 'fitness leads'
        : fitnessFatigueDelta <= -8
          ? 'fatigue leads'
          : 'even';
  const trainingBalanceSummary = analytics.fitnessFatigue && fitnessFatigueDelta != null
    ? fitnessFatigueDelta >= 8
      ? `Fitness is ${Math.round(fitnessFatigueDelta)} points ahead of fatigue. Good day to train normally.`
      : fitnessFatigueDelta <= -8
        ? `Fatigue is ${Math.round(Math.abs(fitnessFatigueDelta))} points ahead. Keep the next session conservative.`
        : `Fitness and fatigue are nearly even (${Math.round(fitnessFatigueDelta)}). A score near 50 means balanced, not broken.`
    : readinessStatus === 'excellent' || readinessStatus === 'good'
      ? 'Great day for a hard workout'
      : readinessStatus === 'moderate'
        ? 'Moderate intensity recommended'
        : 'Consider a lighter session or rest';
  const adherence = analytics.adherence;
  const getRateToneClass = (rate: number) => {
    if (rate >= 80) return 'text-emerald-300';
    if (rate >= 60) return 'text-amber-300';
    return 'text-rose-300';
  };

  const adherenceActionItems = (() => {
    if (!adherence) return [] as string[];
    const actions: string[] = [];
    if (adherence.overdueCount > 0) {
      actions.push(
        `${adherence.overdueCount} overdue session${adherence.overdueCount === 1 ? '' : 's'} pending. Clear one overdue session first.`
      );
    }
    if (adherence.upcomingSession) {
      const upcomingDate = parseIsoDate(adherence.upcomingSession.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayDelta = Math.round((upcomingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const relativeLabel =
        dayDelta <= 0 ? 'today' : dayDelta === 1 ? 'tomorrow' : `in ${dayDelta} days`;
      const base = `${adherence.upcomingSession.sessionName} (${adherence.upcomingSession.programName}) is scheduled ${relativeLabel}.`;
      if (readinessStatus === 'poor') {
        actions.push(`${base} Readiness is low, so run a lighter variant or reschedule proactively.`);
      } else {
        actions.push(`${base} Readiness is ${readinessStatus}, so keep this as your next priority.`);
      }
    } else {
      actions.push('No upcoming scheduled session. Add one from Programs → Calendar to keep momentum.');
    }
    return actions;
  })();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center pb-24 p-6">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
            <BarChart3 className="h-7 w-7 text-emerald-300" />
          </div>
          <div className="text-xl font-black italic tracking-tight text-white">LOADING INSIGHTS</div>
          <div className="text-xs text-zinc-500">Calculating your stats</div>
        </div>
      </div>
    );
  }

  if (!hasRequiredDataset) {
    const awaitingSync = cloudSyncing && completedWorkouts.length === 0;
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10 px-1">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
            <BarChart3 className="h-8 w-8 text-emerald-300" />
          </div>
          <h2 className="mb-2 text-xl font-black italic tracking-tight text-white">
            {awaitingSync ? 'SYNCING WORKOUTS...' : 'NOT ENOUGH DATA YET'}
          </h2>
          <p className="mb-6 text-[10px] text-zinc-500 sm:text-xs">
            {awaitingSync
              ? 'Pulling your workout history from the cloud.'
              : FEATURES.adherenceAnalytics
                ? 'Complete at least 3 workouts or schedule sessions in Programs to unlock full Insights.'
                : 'Complete at least 3 workouts to unlock Insights.'}
          </p>
          {cloudSyncing && (
            <div className="mb-4 rounded-lg border border-zinc-900 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
              Syncing...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      {/* Header */}
      <header className="stagger-item px-1">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5 sm:space-y-1">
            <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">INSIGHTS</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cloudSyncing && (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Syncing...
              </span>
            )}
            <div className="grid min-h-10 grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => unitSystem !== 'imperial' && setUnitSystem('imperial')}
                className={`rounded-lg px-3 uppercase tracking-[0.12em] transition-colors ${unitSystem === 'imperial' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'
                  }`}
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => unitSystem !== 'metric' && setUnitSystem('metric')}
                className={`rounded-lg px-3 uppercase tracking-[0.12em] transition-colors ${unitSystem === 'metric' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'
                  }`}
              >
                kg
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div
        className="stagger-item -mx-1 mb-6 flex gap-1 overflow-x-auto rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {([
          { id: 'overview' as ViewType, label: 'Overview', Icon: BarChart3 },
          ...(FEATURES.adherenceAnalytics
            ? [{ id: 'adherence' as ViewType, label: 'Adherence', Icon: CalendarDays }]
            : []),
          { id: 'recovery' as ViewType, label: 'Recovery', Icon: Battery },
          { id: 'strength' as ViewType, label: 'Strength', Icon: Dumbbell },
          { id: 'profile' as ViewType, label: 'Profile', Icon: User }
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (selectedView === id) return;
              void trackUiEvent(
                { name: 'insights_view_change', source: 'insights', properties: { from: selectedView, to: id } },
                user?.id
              );
              setSelectedView(id);
            }}
            className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[11px] font-black uppercase tracking-[0.14em] transition-colors ${selectedView === id
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Readiness Score - Hero Card */}
          {(analytics.fitnessFatigue || hasMuscleRecoveryData) && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={SECTION_TITLE_CLASS}>{readinessTitle}</h2>
                <StatusReadout label="Signal" value={trainingBalanceLabel} tone={readinessTone} />
              </div>
              <div className="mb-2 text-6xl font-black italic tracking-tight text-white">
                {unifiedReadiness}
              </div>
              <p className="text-sm text-zinc-400">
                {trainingBalanceSummary}
              </p>
              {analytics.fitnessFatigue && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={SUBSECTION_CARD_CLASS}>
                      <div className={METRIC_LABEL_CLASS}>Fitness</div>
                      <div className="mt-1 text-2xl font-black italic text-emerald-300">
                        {Math.round(analytics.fitnessFatigue.currentFitness)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">Training adaptations</div>
                    </div>
                    <div className={SUBSECTION_CARD_CLASS}>
                      <div className={METRIC_LABEL_CLASS}>Fatigue</div>
                      <div className="mt-1 text-2xl font-black italic text-rose-300">
                        {Math.round(analytics.fitnessFatigue.currentFatigue)}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">Accumulated strain</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2 text-center text-[10px] text-zinc-500">
                    50 is neutral. Above 50 means fitness leads; below 50 means fatigue leads.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Load Pressure Card */}
          {analytics.acwr && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${toneTextClass[loadPressure.tone]}`} />
                  <h2 className={SECTION_TITLE_CLASS}>LOAD PRESSURE</h2>
                </div>
                <StatusReadout label="Signal" value={loadPressure.label} tone={loadPressure.tone} />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black italic tracking-tight text-white">{analytics.acwr.ratio.toFixed(2)}</span>
                <span className="text-sm text-zinc-400">7d / baseline</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${toneBgClass[loadPressure.tone]}`}
                  style={{ width: `${Math.min(100, (analytics.acwr.ratio / 2) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>0</span>
                <span className="text-emerald-500">Steady: 0.8-1.3</span>
                <span>2.0</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                {analytics.acwr.recommendation}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                Effort-weighted load. Baseline confidence: {analytics.acwr.baselineConfidence}.
              </p>
            </div>
          )}

          {/* Quick Recovery Status */}
          {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={SECTION_TITLE_CLASS}>MUSCLE RECOVERY</h2>
                <button
                  onClick={() => setSelectedView('recovery')}
                  className="text-xs text-emerald-300 hover:text-emerald-200"
                >
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {analytics.recoveryProfiles.slice(0, 4).map((profile) => (
                  <div
                    key={profile.muscleGroup}
                    className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between`}
                  >
                    <span className="text-sm text-zinc-300 capitalize">{profile.muscleGroup}</span>
                    <RecoveryMeter score={profile.readinessScore} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Lifts Preview */}
          {analytics.strengthLeaderboard && analytics.strengthLeaderboard.length > 0 && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={SECTION_TITLE_CLASS}>TOP LIFTS</h2>
                <button
                  onClick={() => setSelectedView('strength')}
                  className="text-xs text-emerald-300 hover:text-emerald-200"
                >
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {analytics.strengthLeaderboard.slice(0, 3).map((lift, i) => (
                  <div
                    key={lift.exerciseId}
                    className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <RankDecal rank={i + 1} tone={i === 1 ? 'zinc' : 'amber'} />
                      <span className="text-sm text-white truncate max-w-[150px]">{lift.exerciseName}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-300">
                      {lift.estimated1RM} {weightUnit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adherence Tab */}
      {selectedView === 'adherence' && FEATURES.adherenceAnalytics && (
        <div className="space-y-6">
          <div className={SECTION_CLASS}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={SECTION_TITLE_CLASS}>PLAN ADHERENCE</h2>
              {loadingAdherence && (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  Syncing...
                </span>
              )}
            </div>

            {adherence ? (
              <div className="grid gap-3 md:grid-cols-3">
                {(['7', '30', '90'] as const).map((window) => {
                  const metrics = adherence.windows[window];
                  return (
                    <div key={window} className={SUBSECTION_CARD_CLASS}>
                      <p className={METRIC_LABEL_CLASS}>{window} day</p>
                      <p className={`mt-2 text-3xl font-black italic ${getRateToneClass(metrics.completionRate)}`}>
                        {metrics.completionRate}%
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        {metrics.completedSessions}/{metrics.plannedSessions} completed
                      </p>
                      <div className="mt-3 space-y-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        <p>On-time: {metrics.onTimeRate}%</p>
                        <p>Skip rate: {metrics.skipRate}%</p>
                        <p>Reschedule rate: {metrics.rescheduleRate}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No schedule history yet. Add scheduled sessions in Programs.</p>
            )}
          </div>

          {adherence && (
            <div className={SECTION_CLASS}>
              <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>CONSISTENCY TREND</h2>
              <div className="space-y-2">
                {adherence.trend.map((point) => (
                  <div
                    key={`${point.startDate}-${point.endDate}`}
                    className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between gap-4`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">{point.label}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        {point.completedSessions}/{point.plannedSessions} sessions completed
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${getRateToneClass(point.completionRate)}`}>
                      {point.completionRate}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={SECTION_CLASS}>
            <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>NEXT ACTION</h2>
            <div className="space-y-2">
              {adherenceActionItems.map((action, index) => (
                <div key={`${action}-${index}`} className={SUBSECTION_CARD_CLASS}>
                  <p className="text-sm text-zinc-200">{action}</p>
                </div>
              ))}
              {adherenceActionItems.length === 0 && (
                <p className="text-sm text-zinc-500">No recommendations available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recovery Tab */}
      {selectedView === 'recovery' && (
        <RecoveryOverview
          profiles={analytics.recoveryProfiles || []}
          loading={loadingRecovery}
        />
      )}

      {/* Strength Tab */}
      {selectedView === 'strength' && (
        <div className="space-y-6">
          {/* Estimated 1RMs */}
          <div className={SECTION_CLASS}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-amber-300" />
              <h2 className={SECTION_TITLE_CLASS}>ESTIMATED 1RMS</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Adjusted for RPE - accounts for reps in reserve
            </p>
            {analytics.strengthLeaderboard && analytics.strengthLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {analytics.strengthLeaderboard.slice(0, 10).map((lift, i) => (
                  <div
                    key={lift.exerciseId}
                    className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RankDecal rank={i + 1} tone={i === 1 ? 'zinc' : 'amber'} />
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{lift.exerciseName}</div>
                        <div className="text-xs text-zinc-500">
                          Best: {lift.bestSet.weight}{weightUnit} × {lift.bestSet.reps}
                          {lift.bestSet.rpe && ` @ RPE ${lift.bestSet.rpe}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-xl font-black italic text-emerald-300">
                        {lift.estimated1RM}
                      </div>
                      <div className="text-xs text-zinc-500">{weightUnit}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Complete more workouts to see your estimated 1RMs.</p>
            )}
          </div>

          {/* Volume Leaders */}
          <div className={SECTION_CLASS}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
              <h2 className={SECTION_TITLE_CLASS}>VOLUME LEADERS</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Total weight moved (reps × weight)
            </p>
            {analytics.volumeLeaderboard && analytics.volumeLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {analytics.volumeLeaderboard.slice(0, 10).map((exercise, i) => (
                  <div
                    key={exercise.exerciseId}
                    className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RankDecal rank={i + 1} tone={i === 1 ? 'zinc' : 'emerald'} />
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{exercise.exerciseName}</div>
                        <div className="text-xs text-zinc-500">
                          {exercise.setCount} sets · avg {exercise.avgWeightPerSet}{weightUnit}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-xl font-black italic text-emerald-300">
                        {exercise.totalVolume.toLocaleString()}
                      </div>
                      <div className="text-xs text-zinc-500">{weightUnit}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Complete more workouts to see your volume leaders.</p>
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {selectedView === 'profile' && (
        <div className="space-y-6">
          <div className={SECTION_CLASS}>
            <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>YOUR STATS</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                <div className="text-3xl font-black italic text-white">
                  {analytics.personalStats?.totalWorkouts || 0}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Workouts</div>
              </div>
              <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                <div className="text-3xl font-black italic text-white">
                  {analytics.personalStats?.totalSets || 0}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Total Sets</div>
              </div>
              <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                <div className="text-3xl font-black italic text-white">
                  {analytics.strengthLeaderboard?.length || 0}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Exercises</div>
              </div>
              <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                <div className="text-3xl font-black italic text-white">
                  {analytics.acwr ? analytics.acwr.ratio.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-zinc-400 mt-1">Load Ratio</div>
              </div>
            </div>
          </div>

          {/* Training Load Details */}
          {analytics.acwr && (
            <div className={SECTION_CLASS}>
              <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>TRAINING LOAD</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Last 7 days</span>
                  <span className="text-sm font-semibold text-white">
                    {Math.round(analytics.acwr.acuteLoad).toLocaleString()} load
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">28-day weekly baseline</span>
                  <span className="text-sm font-semibold text-white">
                    {Math.round(analytics.acwr.chronicWeeklyLoad).toLocaleString()} load
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">28-day total</span>
                  <span className="text-sm font-semibold text-white">
                    {Math.round(analytics.acwr.chronicLoad).toLocaleString()} load
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/55 p-4">
            <h3 className="mb-3 text-sm font-black italic tracking-tight text-zinc-100">METRIC NOTES</h3>
            <ul className="text-xs text-zinc-400 space-y-2">
              <li><span className="text-zinc-200">Training Balance</span> - 50 is neutral; above means fitness leads, below means fatigue leads</li>
              <li><span className="text-zinc-200">Load Pressure</span> - Compares effort-weighted 7-day load to your recent weekly baseline</li>
              <li><span className="text-zinc-200">1RM Estimates</span> - Adjusted for RPE (effort level)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
