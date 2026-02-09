'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Battery,
  Dumbbell,
  User,
  AlertTriangle,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';
import { useUnitPreference } from '../lib/hooks/useUnitPreference';
import { getWorkoutHistory, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import { trackUiEvent } from '../lib/analytics/ui-events';
import type { SetType, WorkoutSession } from '../lib/types';
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
}

type ViewType = 'overview' | 'recovery' | 'strength' | 'profile';

interface AdvancedAnalyticsDashboardProps {
  initialView?: string;
}

const VIEW_OPTIONS: ViewType[] = ['overview', 'recovery', 'strength', 'profile'];

const resolveInitialView = (value?: string): ViewType =>
  VIEW_OPTIONS.includes(value as ViewType) ? (value as ViewType) : 'overview';

const SECTION_CLASS = 'border-b border-zinc-900 pb-6';
const SUBSECTION_CARD_CLASS = 'rounded-xl border border-zinc-900/80 bg-zinc-950/45 p-3';

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
  const hasMinimumData = completedWorkouts.length >= 3;

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

    const convertWeight = (value: number, fromUnit: 'lbs' | 'kg', toUnit: 'lbs' | 'kg') => {
      if (fromUnit === toUnit) return value;
      return fromUnit === 'lbs' ? lbsToKg(value) : kgToLbs(value);
    };

    const resolveSetWeight = (set: WorkoutSession['sets'][number]) => {
      const raw = typeof set.actualWeight === 'number' ? set.actualWeight : Number(set.actualWeight ?? 0);
      if (!Number.isFinite(raw)) return 0;
      const fromUnit = set.weightUnit ?? 'lbs';
      return convertWeight(raw, fromUnit, weightUnit);
    };

    const resolveFallbackVolumeLoad = (workout: WorkoutSession) => {
      const fallback = typeof workout.totalVolumeLoad === 'number'
        ? workout.totalVolumeLoad
        : Number(workout.totalVolumeLoad ?? 0);
      if (!Number.isFinite(fallback)) return 0;
      return convertWeight(fallback, 'lbs', weightUnit);
    };

    const resolveWorkoutVolumeLoad = (workout: WorkoutSession) => {
      const calculatedLoad = workout.sets.reduce((sum, set) => {
        if (set.completed === false || set.setType === 'warmup') return sum;
        const weight = resolveSetWeight(set);
        const reps = typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0);
        if (weight > 0 && reps > 0 && !Number.isNaN(weight) && !Number.isNaN(reps) && weight < 2000 && reps < 200) {
          return sum + (weight * reps);
        }
        return sum;
      }, 0);
      return calculatedLoad > 0 ? calculatedLoad : resolveFallbackVolumeLoad(workout);
    };

    const workoutsWithLoad = workouts.map((workout) => ({
      date: new Date(workout.endTime || workout.startTime || workout.date),
      load: resolveWorkoutVolumeLoad(workout),
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

    const strengthLeaderboard = calculate1RMLeaderboard(allSets, { minSets: 2 });
    const volumeLeaderboard = calculateVolumeLeaderboard(allSets, { minSets: 2 });

    return {
      acwr: {
        ratio: clampValue(acwrMetrics.acwr, 0, 5.0),
        status: acwrMetrics.status,
        acuteLoad: clampValue(acwrMetrics.acuteLoad, 0, 1000000),
        chronicLoad: clampValue(acwrMetrics.chronicLoad, 0, 1000000),
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

  const loadAnalytics = useCallback(async () => {
    // Check preconditions BEFORE acquiring lock - this allows proper retry when conditions change
    // If we acquire the lock first and then return early, subsequent calls get blocked unnecessarily
    if (authLoading || !namespaceReady) {
      return;
    }

    if (isSyncing) {
      return;
    }

    // Now acquire lock - only for actual loading operations
    if (loadingInProgressRef.current) {
      return;
    }
    loadingInProgressRef.current = true;

    try {
      setLoading(initialLoadRef.current);
      setCloudSyncing(false);
      setUserNamespace(user?.id || null);

      const localWorkouts = getWorkoutHistory();
      const localCompleted = buildCompletedWorkouts(localWorkouts);
      updateCoreAnalytics(localCompleted);

      // If not logged in, show local data only
      if (!user) {
        setLoading(false);
        initialLoadRef.current = false;
        return;
      }

      setCloudSyncing(true);
      try {
        const { data: supabaseWorkouts, error } = await supabase
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
          .order('start_time', { ascending: false });

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
        initialLoadRef.current = false;
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
      } finally {
        setCloudSyncing(false);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
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
      const profiles = await getRecoveryProfiles(user.id);
      setAnalytics((prev) => ({
        ...prev,
        recoveryProfiles: profiles,
      }));
    } catch (err) {
      console.error('Failed to load recovery profiles:', err);
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

  // Get injury risk status
  const getInjuryRiskStatus = () => {
    if (!analytics.acwr) return { color: 'gray', label: 'Unknown' };
    const ratio = analytics.acwr.ratio;
    if (ratio >= 0.8 && ratio <= 1.3) return { color: 'green', label: 'Low Risk' };
    if (ratio < 0.8) return { color: 'yellow', label: 'Undertraining' };
    if (ratio <= 1.5) return { color: 'yellow', label: 'Elevated' };
    if (ratio <= 2.0) return { color: 'red', label: 'High Risk' };
    return { color: 'red', label: 'Danger' };
  };

  const injuryRisk = getInjuryRiskStatus();

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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center app-gradient safe-top pb-24 p-6">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <BarChart3 className="h-8 w-8 text-emerald-300" />
          </div>
          <div className="text-lg font-semibold text-white">Loading insights...</div>
          <div className="text-sm text-zinc-400">Calculating your stats</div>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    const awaitingSync = cloudSyncing && completedWorkouts.length === 0;
    return (
      <div className="min-h-dvh app-gradient safe-top px-6 pb-24 pt-10">
        <div className="mx-auto max-w-md border-b border-zinc-900 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
            <BarChart3 className="h-10 w-10 text-cyan-300" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">
            {awaitingSync ? 'Syncing workouts...' : 'Not enough data yet'}
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            {awaitingSync
              ? 'Pulling your workout history from the cloud.'
              : 'Complete at least 3 workouts to unlock Insights.'}
          </p>
          {cloudSyncing && (
            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
              Syncing...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh app-gradient px-4 pb-28 pt-6 safe-top">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 border-b border-zinc-900 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Insights</p>
              <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Analytics</h1>
              <p className="mt-3 text-sm text-zinc-500">Your training at a glance.</p>
            </div>
            <div className="flex items-center gap-2">
              {cloudSyncing && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Syncing...
                </span>
              )}
              <div className="flex rounded-full border border-zinc-800 bg-zinc-950/70 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => unitSystem !== 'imperial' && setUnitSystem('imperial')}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    unitSystem === 'imperial' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400'
                  }`}
                >
                  lbs
                </button>
                <button
                  type="button"
                  onClick={() => unitSystem !== 'metric' && setUnitSystem('metric')}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    unitSystem === 'metric' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400'
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
          className="mb-6 flex gap-2 overflow-x-auto pb-1 -mx-2 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {([
            { id: 'overview' as ViewType, label: 'Overview', Icon: BarChart3 },
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all text-sm ${
                selectedView === id
                  ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
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
            {(analytics.fitnessFatigue || (analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0)) && (
              <div className={SECTION_CLASS}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Readiness</h2>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    readinessStatus === 'excellent' ? 'bg-green-500/20 text-green-400' :
                    readinessStatus === 'good' ? 'bg-green-500/20 text-green-400' :
                    readinessStatus === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {readinessStatus}
                  </span>
                </div>
                <div className="text-5xl font-bold text-white mb-2">
                  {unifiedReadiness}
                </div>
                <p className="text-sm text-zinc-400">
                  {readinessStatus === 'excellent' || readinessStatus === 'good'
                    ? 'Great day for a hard workout'
                    : readinessStatus === 'moderate'
                    ? 'Moderate intensity recommended'
                    : 'Consider a lighter session or rest'}
                </p>
                {analytics.fitnessFatigue && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className={SUBSECTION_CARD_CLASS}>
                        <div className="text-xs text-zinc-400 mb-1">Fitness</div>
                        <div className="text-lg font-semibold text-green-400">
                          {Math.round(analytics.fitnessFatigue.currentFitness)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">Training adaptations</div>
                      </div>
                      <div className={SUBSECTION_CARD_CLASS}>
                        <div className="text-xs text-zinc-400 mb-1">Fatigue</div>
                        <div className="text-lg font-semibold text-red-400">
                          {Math.round(analytics.fitnessFatigue.currentFatigue)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">Accumulated strain</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2 text-center text-[10px] text-zinc-500">
                      Readiness = how much fitness exceeds fatigue. Train when Fitness &gt; Fatigue.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Injury Risk Card */}
            {analytics.acwr && (
              <div className={SECTION_CLASS}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-5 w-5 ${
                      injuryRisk.color === 'green' ? 'text-green-400' :
                      injuryRisk.color === 'yellow' ? 'text-yellow-400' :
                      'text-red-400'
                    }`} />
                    <h2 className="text-xl font-bold text-white">Injury Risk</h2>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    injuryRisk.color === 'green' ? 'bg-green-500/20 text-green-400' :
                    injuryRisk.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {injuryRisk.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-white">{analytics.acwr.ratio.toFixed(2)}</span>
                  <span className="text-sm text-zinc-400">load ratio</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      injuryRisk.color === 'green' ? 'bg-green-500' :
                      injuryRisk.color === 'yellow' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (analytics.acwr.ratio / 2) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>0</span>
                  <span className="text-green-500">Sweet spot: 0.8-1.3</span>
                  <span>2.0</span>
                </div>
              </div>
            )}

            {/* Quick Recovery Status */}
            {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
              <div className={SECTION_CLASS}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Muscle Recovery</h2>
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
                      <div className={`w-3 h-3 rounded-full ${
                        profile.readinessScore >= 8 ? 'bg-green-400' :
                        profile.readinessScore >= 6 ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Lifts Preview */}
            {analytics.strengthLeaderboard && analytics.strengthLeaderboard.length > 0 && (
              <div className={SECTION_CLASS}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Top Lifts</h2>
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
                        <span className={`text-sm font-bold ${
                          i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-400' : 'text-orange-400'
                        }`}>
                          #{i + 1}
                        </span>
                        <span className="text-sm text-white truncate max-w-[150px]">{lift.exerciseName}</span>
                      </div>
                      <span className="text-sm font-semibold text-cyan-300">
                        {lift.estimated1RM} {weightUnit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                <h2 className="text-xl font-bold text-white">Estimated 1RMs</h2>
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
                        <span className={`text-sm font-bold w-6 ${
                          i === 0 ? 'text-yellow-400' :
                          i === 1 ? 'text-zinc-400' :
                          i === 2 ? 'text-orange-400' :
                          'text-zinc-500'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{lift.exerciseName}</div>
                          <div className="text-xs text-zinc-500">
                            Best: {lift.bestSet.weight}{weightUnit} × {lift.bestSet.reps}
                            {lift.bestSet.rpe && ` @ RPE ${lift.bestSet.rpe}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-lg font-bold text-cyan-300">
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
                <h2 className="text-xl font-bold text-white">Volume Leaders</h2>
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
                        <span className={`text-sm font-bold w-6 ${
                          i === 0 ? 'text-green-400' :
                          i === 1 ? 'text-green-500/70' :
                          i === 2 ? 'text-green-600/70' :
                          'text-zinc-500'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{exercise.exerciseName}</div>
                          <div className="text-xs text-zinc-500">
                            {exercise.setCount} sets · avg {exercise.avgWeightPerSet}{weightUnit}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-lg font-bold text-green-400">
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
              <h2 className="text-xl font-bold text-white mb-4">Your Stats</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                  <div className="text-3xl font-bold text-white">
                    {analytics.personalStats?.totalWorkouts || 0}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">Workouts</div>
                </div>
                <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                  <div className="text-3xl font-bold text-white">
                    {analytics.personalStats?.totalSets || 0}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">Total Sets</div>
                </div>
                <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                  <div className="text-3xl font-bold text-white">
                    {analytics.strengthLeaderboard?.length || 0}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">Exercises</div>
                </div>
                <div className={`${SUBSECTION_CARD_CLASS} text-center`}>
                  <div className="text-3xl font-bold text-white">
                    {analytics.acwr ? analytics.acwr.ratio.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">Load Ratio</div>
                </div>
              </div>
            </div>

            {/* Training Load Details */}
            {analytics.acwr && (
              <div className={SECTION_CLASS}>
                <h2 className="text-xl font-bold text-white mb-4">Training Load</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Last 7 days</span>
                    <span className="text-sm font-semibold text-white">
                      {Math.round(analytics.acwr.acuteLoad).toLocaleString()} {weightUnit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">28-day average</span>
                    <span className="text-sm font-semibold text-white">
                      {Math.round(analytics.acwr.chronicLoad).toLocaleString()} {weightUnit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 to-emerald-950/20 p-5">
              <h3 className="mb-3 text-sm font-semibold text-cyan-200">How This Works</h3>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li><span className="text-cyan-300">Readiness</span> - Based on your fitness vs fatigue balance</li>
                <li><span className="text-cyan-300">Injury Risk</span> - Compares recent load to your baseline</li>
                <li><span className="text-cyan-300">1RM Estimates</span> - Adjusted for RPE (effort level)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
