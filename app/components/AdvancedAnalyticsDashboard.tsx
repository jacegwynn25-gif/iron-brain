'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
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
import { useRecoveryState } from '../lib/hooks/useRecoveryState';
import { useWorkoutDataContext } from '../providers/WorkoutDataProvider';
import { trackUiEvent } from '../lib/analytics/ui-events';
import type { CustomExercise, ProgramScheduleEvent, WorkoutSession } from '../lib/types';
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
import {
  buildCanonicalAnalyticsAudit,
  buildCanonicalAnalyticsSets,
  isVerifiedStrengthSet,
  isVerifiedVolumeSet,
  type CanonicalAnalyticsAuditContributor,
} from '../lib/stats/canonical-sets';
import RecoveryOverview from './RecoveryOverview';
import { defaultExercises } from '../lib/programs';
import {
  buildExerciseCatalog,
} from '../lib/exercises/catalog';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import {
  confidenceFromDataSufficiency,
  dataSufficiencyFromSampleCount,
  type MetricExplanation,
} from '../lib/intelligence/explanations';

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

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
  dataQuality?: {
    strengthExcludedSetCount: number;
    anomalySetCount: number;
    anomalySummary: string | null;
  };
  dataAudit?: {
    totalSets: number;
    includedSets: number;
    excludedSets: number;
    includedStrengthSets: number;
    includedVolumeSets: number;
    excludedWarmupSets: number;
    excludedIncompleteSets: number;
    excludedInvalidSets: number;
    topVolumeContributors: Array<{
      exerciseKey: string;
      exerciseName: string;
      date?: string;
      rawWeight: number;
      rawWeightUnit: 'lbs' | 'kg';
      reps: number;
      rpe: number | null;
      volumeLoad: number;
      estimated1RM: number;
    }>;
  };
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
  explanations?: {
    trainingBalance?: MetricExplanation;
    loadPressure?: MetricExplanation;
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

const SECTION_CLASS = 'border-b border-white/8 pb-5 last:border-b-0';
const SUBSECTION_CARD_CLASS = 'border-b border-white/[0.07] px-1.5 py-3.5 last:border-b-0';
const SECTION_TITLE_CLASS = 'text-lg font-black italic tracking-tight text-zinc-100 sm:text-xl';
const METRIC_LABEL_CLASS = 'text-xs font-semibold text-zinc-500';

type Tone = 'emerald' | 'amber' | 'rose' | 'zinc';

const toneTextClass: Record<Tone, string> = {
  emerald: 'text-emerald-500',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  zinc: 'text-zinc-400',
};

const toneBgClass: Record<Tone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  zinc: 'bg-zinc-500',
};

const toneBorderClass: Record<Tone, string> = {
  emerald: 'border-emerald-500/45',
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
      <p className={`mt-0.5 text-sm font-black italic tracking-tight ${toneTextClass[tone]}`}>
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
  const { user, loading: authLoading } = useAuth();
  const {
    workouts: sharedWorkouts,
    loading: workoutsLoading,
    error: workoutDataError,
    isReady: workoutDataReady,
    isSyncing: workoutSyncing,
  } = useWorkoutDataContext();
  const { readiness, loading: readinessLoading } = useRecoveryState();
  const { unitSystem, setUnitSystem, weightUnit, lbsToKg, kgToLbs } = useUnitPreference();
  const [analytics, setAnalytics] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<ViewType>(() => resolveInitialView(initialView));
  const [showDataAudit, setShowDataAudit] = useState(false);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [loadingAdherence, setLoadingAdherence] = useState(false);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const hasMinimumData = completedWorkouts.length >= 1;
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
    }
  }, [user?.id]);

  useEffect(() => {
    if (!initialView) return;
    const nextView = resolveInitialView(initialView);
    setSelectedView(nextView);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [initialView]);

  const selectInsightsView = useCallback((id: ViewType) => {
    if (selectedView === id) return;
    void trackUiEvent(
      { name: 'insights_view_change', source: 'insights', properties: { from: selectedView, to: id } },
      user?.id
    );
    setSelectedView(id);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [selectedView, user?.id]);

  useEffect(() => {
    let active = true;
    getCustomExercises(user?.id ?? null)
      .then((exercises) => {
        if (active) setCustomExercises(exercises);
      })
      .catch(() => {
        if (active) setCustomExercises([]);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const exerciseCatalog = useMemo(
    () => buildExerciseCatalog(defaultExercises, customExercises),
    [customExercises]
  );

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
        if (set.completed === false || set.skipped === true) return false;
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
    if (workouts.length < 1) return null;

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
        if (set.completed === false || set.skipped === true || set.setType === 'warmup') return sum;
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
        if (set.completed === false || set.skipped === true || set.setType === 'warmup') return sum;
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
      const eligibleSets = workout.sets.filter((set) => set.completed === true && set.skipped !== true && set.setType !== 'warmup');
      return sum + eligibleSets.length;
    }, 0);

    const canonicalSets = buildCanonicalAnalyticsSets(workouts, { catalog: exerciseCatalog });
    const canonicalAudit = buildCanonicalAnalyticsAudit(canonicalSets);
    const strengthSets = canonicalSets.filter(isVerifiedStrengthSet).map((set) => ({
      weight: set.weightLbs,
      reps: set.reps,
      rpe: set.rpe,
      exerciseId: set.exerciseKey,
      exerciseName: set.exerciseName,
      date: set.date,
    }));
    const volumeSets = canonicalSets.filter(isVerifiedVolumeSet).map((set) => ({
      weight: set.weightLbs,
      reps: set.reps,
      rpe: set.rpe,
      exerciseId: set.exerciseKey,
      exerciseName: set.exerciseName,
      date: set.date,
    }));

    const strengthLeaderboardLbs = calculate1RMLeaderboard(strengthSets, { minSets: 1 });
    const volumeLeaderboardLbs = calculateVolumeLeaderboard(volumeSets, { minSets: 1 });
    const formatAuditContributor = (contributor: CanonicalAnalyticsAuditContributor) => ({
      exerciseKey: contributor.exerciseKey,
      exerciseName: contributor.exerciseName,
      date: contributor.date,
      rawWeight: roundWeightDisplay(contributor.rawWeight),
      rawWeightUnit: contributor.rawWeightUnit,
      reps: contributor.reps,
      rpe: contributor.rpe,
      volumeLoad: Math.round(toDisplay(contributor.volumeLoadLbs)),
      estimated1RM: Math.round(toDisplay(contributor.estimated1RMLbs)),
    });
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
    const strengthExcludedSetCount = canonicalAudit.totalSets - canonicalAudit.verifiedStrengthSets;
    const anomalySummary = canonicalAudit.anomalousSets > 0
      ? `${canonicalAudit.anomalousSets} questionable set${canonicalAudit.anomalousSets === 1 ? '' : 's'} excluded`
      : null;
    const loadSampleCount = workoutsWithLoad.filter((workout) => workout.load > 0).length;
    const loadDataSufficiency = dataSufficiencyFromSampleCount(loadSampleCount);
    const loadConfidence = acwrMetrics.baselineConfidence === 'high'
      ? 'high'
      : acwrMetrics.baselineConfidence === 'medium'
        ? 'medium'
        : confidenceFromDataSufficiency(loadDataSufficiency);
    const trainingDataSufficiency = dataSufficiencyFromSampleCount(recentWorkouts.length);
    const trainingConfidence = confidenceFromDataSufficiency(trainingDataSufficiency);
    const fitnessFatigueDelta = fitnessFatigueModel
      ? fitnessFatigueModel.currentFitness - fitnessFatigueModel.currentFatigue
      : null;

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
      dataQuality: {
        strengthExcludedSetCount,
        anomalySetCount: canonicalAudit.anomalousSets,
        anomalySummary,
      },
      dataAudit: {
        totalSets: canonicalAudit.totalSets,
        includedSets: canonicalAudit.includedSets,
        excludedSets: canonicalAudit.excludedSets,
        includedStrengthSets: canonicalAudit.includedStrengthSets,
        includedVolumeSets: canonicalAudit.includedVolumeSets,
        excludedWarmupSets: canonicalAudit.excludedWarmupSets,
        excludedIncompleteSets: canonicalAudit.excludedIncompleteSets,
        excludedInvalidSets: canonicalAudit.excludedInvalidSets,
        topVolumeContributors: canonicalAudit.topVolumeContributors.map(formatAuditContributor),
      },
      volumeLeaderboard,
      explanations: {
        loadPressure: {
          metric: 'load_pressure',
          value: Number(acwrMetrics.acwr.toFixed(2)),
          label: acwrMetrics.baselineConfidence === 'low' ? 'Building baseline' : acwrMetrics.status,
          confidence: loadConfidence,
          dataSufficiency: loadDataSufficiency,
          inputs: [
            `${loadSampleCount} loaded workouts`,
            `${Math.round(toDisplay(acwrMetrics.acuteLoad)).toLocaleString()} 7d load`,
            `${Math.round(toDisplay(acwrMetrics.chronicWeeklyLoad)).toLocaleString()} weekly baseline`,
          ],
          reason: acwrMetrics.recommendation,
          nextAction: acwrMetrics.baselineConfidence === 'low'
            ? 'Log more sessions before treating this as a risk verdict.'
            : acwrMetrics.acwr > 1.5
              ? 'Hold load, add rest, or trim sets until load returns closer to baseline.'
              : acwrMetrics.acwr < 0.8
                ? 'Build back gradually if this was not a planned deload.'
                : 'Stay near the current weekly workload range.',
        },
        trainingBalance: {
          metric: 'training_balance',
          value: fitnessFatigueDelta == null ? 'baseline' : Math.round(fitnessFatigueDelta),
          label: fitnessFatigueDelta == null
            ? 'Building baseline'
            : fitnessFatigueDelta >= 8
              ? 'Fitness leads'
              : fitnessFatigueDelta <= -8
                ? 'Fatigue leads'
                : 'Even',
          confidence: trainingConfidence,
          dataSufficiency: trainingDataSufficiency,
          inputs: [
            `${recentWorkouts.length} recent workouts`,
            fitnessFatigueModel ? `${Math.round(fitnessFatigueModel.currentFitness)} fitness` : 'no fitness model yet',
            fitnessFatigueModel ? `${Math.round(fitnessFatigueModel.currentFatigue)} fatigue` : 'no fatigue model yet',
          ],
          reason: fitnessFatigueDelta == null
            ? 'Not enough completed work to separate fitness from fatigue yet.'
            : fitnessFatigueDelta >= 8
              ? 'Fitness is currently ahead of fatigue.'
              : fitnessFatigueDelta <= -8
                ? 'Fatigue is currently ahead of fitness.'
                : 'Fitness and fatigue are close together.',
          nextAction: fitnessFatigueDelta == null
            ? 'Complete more sessions to build the model.'
            : fitnessFatigueDelta <= -8
              ? 'Use conservative targets next session.'
              : 'Use normal targets and let set RPE guide adjustments.',
        },
      },
    } satisfies Pick<
      AnalyticsData,
      'acwr' | 'fitnessFatigue' | 'personalStats' | 'strengthLeaderboard' | 'dataQuality' | 'dataAudit' | 'volumeLeaderboard' | 'explanations'
    >;
  }, [exerciseCatalog, kgToLbs, lbsToKg, weightUnit]);

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
        dataQuality: undefined,
        dataAudit: undefined,
        volumeLeaderboard: undefined,
        explanations: undefined,
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

  useEffect(() => {
    if (authLoading || !workoutDataReady) {
      setLoading(true);
      return;
    }

    const completed = buildCompletedWorkouts(sharedWorkouts);
    updateCoreAnalytics(completed);
    setCloudSyncing(Boolean(user) && workoutSyncing);
    setLoading(workoutsLoading && completed.length === 0);
  }, [
    authLoading,
    workoutDataReady,
    sharedWorkouts,
    buildCompletedWorkouts,
    updateCoreAnalytics,
    user,
    workoutSyncing,
    workoutsLoading,
  ]);

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

  // Recalculate analytics when weight unit changes so displayed values update
  useEffect(() => {
    if (completedWorkouts.length >= 1) {
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

  const getReadinessStatus = (score: number): 'excellent' | 'good' | 'moderate' | 'poor' => {
    if (score >= 75) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'moderate';
    return 'poor';
  };

  const hasMuscleRecoveryData = Boolean(analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0);
  const primaryReadinessScore = readiness?.score ?? Math.round(analytics.fitnessFatigue?.performance ?? 50);
  const readinessStatus = getReadinessStatus(primaryReadinessScore);
  const readinessTone: Tone =
    readinessStatus === 'excellent' || readinessStatus === 'good'
      ? 'emerald'
      : readinessStatus === 'moderate'
        ? 'amber'
        : 'rose';
  const readinessTitle = 'TRAINING ESTIMATE';
  const fitnessFatigueDelta = analytics.fitnessFatigue
    ? analytics.fitnessFatigue.currentFitness - analytics.fitnessFatigue.currentFatigue
    : null;
  const trainingBalanceLabel = readinessLoading && !readiness ? 'syncing' : readinessStatus;
  const trainingBalanceSummary = readiness?.reason
    ?? (analytics.fitnessFatigue && fitnessFatigueDelta != null
      ? fitnessFatigueDelta >= 8
        ? `Training balance: fitness is ${Math.round(fitnessFatigueDelta)} points ahead of fatigue.`
        : fitnessFatigueDelta <= -8
          ? `Training balance: fatigue is ${Math.round(Math.abs(fitnessFatigueDelta))} points ahead.`
          : `Training balance is near neutral (${Math.round(fitnessFatigueDelta)}).`
      : readinessStatus === 'excellent' || readinessStatus === 'good'
        ? 'Training estimate supports a normal session.'
        : readinessStatus === 'moderate'
          ? 'Training estimate supports conservative load jumps.'
          : 'Training estimate supports a lighter session.');
  const dataAuditSourceLabel = workoutDataError
    ? 'Shared workout data fallback'
    : workoutSyncing
      ? 'Shared workout data syncing'
      : user
        ? 'Shared local + cloud workouts'
        : 'Shared local workouts';
  const adherence = analytics.adherence;
  const strengthDataQualityNote = analytics.dataQuality?.anomalySummary ?? null;
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
          <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-xl border border-white/8 bg-white/[0.035]">
            <BarChart3 className="h-7 w-7 text-emerald-300" />
          </div>
          <div className="iron-display text-xl text-white">Loading insights</div>
          <div className="text-xs text-zinc-500">Calculating your stats</div>
        </div>
      </div>
    );
  }

  if (!hasRequiredDataset) {
    const awaitingSync = cloudSyncing && completedWorkouts.length === 0;
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-1 pb-12 pt-4 sm:space-y-8 sm:pt-10">
        <header className="stagger-item">
          <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Insights</h1>
        </header>
        <div className="mx-auto max-w-md pt-16 text-center sm:pt-20">
          <BarChart3 className="mx-auto mb-5 h-10 w-10 text-emerald-400" />
          <h2 className="mb-2 text-xl font-black italic tracking-tight text-white">
            {awaitingSync ? 'Syncing workouts...' : 'Not enough data yet'}
          </h2>
          <p className="mx-auto mb-6 max-w-xs text-xs leading-5 text-zinc-500">
            {awaitingSync
              ? 'Pulling your workout history from the cloud.'
              : FEATURES.adherenceAnalytics
                ? 'Complete a workout or schedule sessions in Programs to unlock full Insights.'
                : 'Complete a workout to unlock Insights.'}
          </p>
          {!awaitingSync && (
            <Link
              href="/start"
              className="liquid-action-button inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-4 text-xs font-black italic tracking-tight text-zinc-950 transition-all active:scale-[0.98]"
            >
              <span>Start workout</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {cloudSyncing && (
            <div className="mb-4 border-y border-white/8 py-2 text-xs text-zinc-500">
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
            <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Insights</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cloudSyncing && (
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
                Syncing...
              </span>
            )}
            <div className="liquid-segmented grid min-h-10 grid-cols-2 gap-1 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => unitSystem !== 'imperial' && setUnitSystem('imperial')}
                data-active={unitSystem === 'imperial' ? 'true' : 'false'}
                className="liquid-segmented-item px-3"
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => unitSystem !== 'metric' && setUnitSystem('metric')}
                data-active={unitSystem === 'metric' ? 'true' : 'false'}
                className="liquid-segmented-item px-3"
              >
                kg
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div
        className={`liquid-segmented stagger-item mb-6 grid gap-1 p-1 ${FEATURES.adherenceAnalytics ? 'grid-cols-5' : 'grid-cols-4'}`}
      >
        {([
          { id: 'overview' as ViewType, label: 'Overview', Icon: BarChart3 },
          ...(FEATURES.adherenceAnalytics
            ? [{ id: 'adherence' as ViewType, label: 'Plan', Icon: CalendarDays }]
            : []),
          { id: 'recovery' as ViewType, label: 'Recovery', Icon: Battery },
          { id: 'strength' as ViewType, label: 'Lifts', Icon: Dumbbell },
          { id: 'profile' as ViewType, label: 'Profile', Icon: User }
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => selectInsightsView(id)}
            data-active={selectedView === id ? 'true' : 'false'}
            className="liquid-segmented-item flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[9px] font-black uppercase tracking-[0.08em] sm:min-h-11 sm:flex-row sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="min-w-0 truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Readiness Score - Hero Card */}
          {(readiness || readinessLoading || analytics.fitnessFatigue || hasMuscleRecoveryData) && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={SECTION_TITLE_CLASS}>{readinessTitle}</h2>
                <StatusReadout label="Signal" value={trainingBalanceLabel} tone={readinessTone} />
              </div>
              <div className="mb-2 text-6xl font-black italic tracking-tight text-white">
                {primaryReadinessScore}
              </div>
              <p className="text-sm text-zinc-400">
                {trainingBalanceSummary}
              </p>
              {(readiness?.explanation || analytics.explanations?.trainingBalance) && (
                <details className="mt-3 border-t border-white/8 pt-3">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Details
                  </summary>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                    {(readiness?.explanation ?? analytics.explanations?.trainingBalance)?.confidence} confidence / {(readiness?.explanation ?? analytics.explanations?.trainingBalance)?.dataSufficiency} data
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {(readiness?.explanation ?? analytics.explanations?.trainingBalance)?.reason} {(readiness?.explanation ?? analytics.explanations?.trainingBalance)?.nextAction}
                  </p>
                </details>
              )}
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
                  <h2 className={SECTION_TITLE_CLASS}>Load pressure</h2>
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
              {analytics.explanations?.loadPressure && (
                <details className="mt-3 border-t border-white/8 pt-3">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Details
                  </summary>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                    {analytics.explanations.loadPressure.confidence} confidence / {analytics.explanations.loadPressure.dataSufficiency} data
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {analytics.explanations.loadPressure.reason} {analytics.explanations.loadPressure.nextAction}
                  </p>
                </details>
              )}
            </div>
          )}

          {analytics.dataAudit && (
            <div className={SECTION_CLASS}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={SECTION_TITLE_CLASS}>Data audit</h2>
                <button
                  type="button"
                  onClick={() => setShowDataAudit((current) => !current)}
                  className="liquid-icon-button min-h-9 rounded-full px-3 text-xs font-semibold text-zinc-300"
                  aria-expanded={showDataAudit}
                >
                  {showDataAudit ? 'Hide' : 'Show'}
                </button>
              </div>
              {showDataAudit ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs leading-relaxed text-zinc-400">
                      {dataAuditSourceLabel}. Metrics use completed, non-warmup raw set rows only.
                    </p>
                    <StatusReadout label="Source" value={workoutSyncing ? 'Syncing' : 'Current'} tone={workoutDataError ? 'amber' : 'zinc'} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={SUBSECTION_CARD_CLASS}>
                      <p className={METRIC_LABEL_CLASS}>Raw Sets</p>
                      <p className="mt-1 text-2xl font-black italic text-white">{analytics.dataAudit.totalSets}</p>
                    </div>
                    <div className={SUBSECTION_CARD_CLASS}>
                      <p className={METRIC_LABEL_CLASS}>Included</p>
                      <p className="mt-1 text-2xl font-black italic text-emerald-500">{analytics.dataAudit.includedSets}</p>
                    </div>
                    <div className={SUBSECTION_CARD_CLASS}>
                      <p className={METRIC_LABEL_CLASS}>Excluded</p>
                      <p className="mt-1 text-2xl font-black italic text-amber-300">{analytics.dataAudit.excludedSets}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <p className="border-y border-white/8 py-2 text-[10px] uppercase tracking-[0.13em] text-zinc-500">
                      Warmups: {analytics.dataAudit.excludedWarmupSets}
                    </p>
                    <p className="border-y border-white/8 py-2 text-[10px] uppercase tracking-[0.13em] text-zinc-500">
                      Incomplete: {analytics.dataAudit.excludedIncompleteSets}
                    </p>
                    <p className="border-y border-white/8 py-2 text-[10px] uppercase tracking-[0.13em] text-zinc-500">
                      Invalid: {analytics.dataAudit.excludedInvalidSets}
                    </p>
                  </div>
                  {analytics.dataAudit.topVolumeContributors.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className={METRIC_LABEL_CLASS}>Top raw set contributors</p>
                      {analytics.dataAudit.topVolumeContributors.slice(0, 3).map((set, index) => (
                        <div
                          key={`${set.exerciseKey}-${set.date ?? 'unknown'}-${index}`}
                          className={`${SUBSECTION_CARD_CLASS} flex items-center justify-between gap-3`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-100">{set.exerciseName}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {set.rawWeight}{set.rawWeightUnit} x {set.reps}{set.rpe ? ` @ RPE ${set.rpe}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-black text-emerald-500">
                              {set.volumeLoad.toLocaleString()} {weightUnit}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-500">e1RM {set.estimated1RM}{weightUnit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  {analytics.dataAudit.includedSets} usable sets from {analytics.dataAudit.totalSets} logged sets.
                </p>
              )}
            </div>
          )}

          {/* Quick Recovery Status */}
          {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
            <div className={SECTION_CLASS}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={SECTION_TITLE_CLASS}>Muscle recovery</h2>
                <button
                  onClick={() => selectInsightsView('recovery')}
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
                <h2 className={SECTION_TITLE_CLASS}>Top lifts</h2>
                <button
                  onClick={() => selectInsightsView('strength')}
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
              <h2 className={SECTION_TITLE_CLASS}>Plan adherence</h2>
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
              <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>Consistency trend</h2>
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
            <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>Next action</h2>
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
              <h2 className={SECTION_TITLE_CLASS}>Estimated 1RMs</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Uses normal Epley when RPE is missing; adjusts for reps in reserve when actual RPE is logged.
            </p>
            {strengthDataQualityNote && (
              <div className="mb-4 border-y border-amber-400/25 py-2 text-xs text-amber-200">
                {strengthDataQualityNote}
              </div>
            )}
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
              <p className="text-sm text-zinc-400">
                {analytics.dataQuality?.anomalySetCount
                  ? 'Need verified sets. Questionable rows were excluded from max estimates.'
                  : 'Complete verified working sets to see your estimated 1RMs.'}
              </p>
            )}
          </div>

          {/* Volume Leaders */}
          <div className={SECTION_CLASS}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
              <h2 className={SECTION_TITLE_CLASS}>Volume leaders</h2>
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
            <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>Your stats</h2>
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
              <h2 className={`${SECTION_TITLE_CLASS} mb-4`}>Training load</h2>
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
          <details className="border-y border-white/8 py-4">
            <summary className="cursor-pointer text-sm font-black italic tracking-tight text-zinc-100">Metric notes</summary>
            <ul className="mt-3 space-y-2 text-xs text-zinc-400">
              <li><span className="text-zinc-200">Training Balance</span> - 50 is neutral; above means fitness leads, below means fatigue leads</li>
              <li><span className="text-zinc-200">Load Pressure</span> - Compares effort-weighted 7-day load to your recent weekly baseline</li>
              <li><span className="text-zinc-200">1RM Estimates</span> - Adjusted for RPE (effort level)</li>
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
