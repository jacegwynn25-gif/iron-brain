'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Zap,
  Battery,
  Target,
  User,
  Star,
  AlertTriangle,
  AlertCircle,
  Activity
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
import {
  buildHierarchicalFatigueModel,
  type HierarchicalFatigueModel
} from '../lib/stats/hierarchical-models';
import { getRecoveryProfiles, type RecoveryProfile } from '../lib/fatigue/cross-session';
import { getExerciseEfficiencyLeaderboard } from '../lib/fatigue/sfr';
import RecoveryOverview from './RecoveryOverview';
import SFRInsightsTable from './SFRInsightsTable';
import type { Database } from '../lib/supabase/database.types';

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'id' | 'exercise_id' | 'exercise_slug' | 'actual_weight' | 'actual_reps' | 'actual_rpe' | 'completed' | 'set_type'
>;

const normalizeSetType = (value?: string | null): SetType => {
  const allowed: SetType[] = [
    'straight',
    'superset',
    'giant',
    'drop',
    'rest-pause',
    'cluster',
    'warmup',
    'amrap',
    'backoff'
  ];
  return allowed.includes(value as SetType) ? (value as SetType) : 'straight';
};

const interpretSfr = (avgSFR: number): SfrInsight['interpretation'] => {
  if (avgSFR > 200) return 'excellent';
  if (avgSFR > 150) return 'good';
  if (avgSFR > 100) return 'moderate';
  if (avgSFR > 50) return 'poor';
  return 'excessive';
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type SupabaseWorkoutRow = Pick<
  Database['public']['Tables']['workout_sessions']['Row'],
  'id' | 'start_time' | 'end_time' | 'total_volume_load' | 'notes' | 'date' | 'duration_minutes'
> & {
  set_logs?: SupabaseSetLogRow[] | null;
};

type SfrInsight = {
  exerciseId: string;
  exerciseName: string;
  avgSFR: number;
  timesPerformed: number;
  bestSFR: number;
  worstSFR: number;
  interpretation: 'excellent' | 'good' | 'moderate' | 'poor' | 'excessive';
};

interface AnalyticsData {
  // ACWR Metrics
  acwr?: {
    ratio: number;
    status: string;
    acuteLoad: number;
    chronicLoad: number;
    monotony: number;
    strain: number;
  };

  // Fitness-Fatigue
  fitnessFatigue?: {
    currentFitness: number;
    currentFatigue: number;
    performance: number;
    readiness: 'excellent' | 'good' | 'moderate' | 'poor';
  };

  // Hierarchical Model
  hierarchicalModel?: HierarchicalFatigueModel;

  // Personal Stats
  personalStats?: {
    fatigueResistance: number;
    recoveryRate: number;
    totalWorkouts: number;
    totalSets: number;
  };

  // Exercise-Specific Rates
  exerciseRates?: Array<{
    exerciseId: string;
    exerciseName?: string;
    fatigueRate: number;
    variance: number;
    sampleSize: number;
  }>;

  // Recovery profiles
  recoveryProfiles?: RecoveryProfile[];

  // SFR insights
  sfrInsights?: Array<{
    exerciseId: string;
    exerciseName: string;
    avgSFR: number;
    timesPerformed: number;
    bestSFR: number;
    worstSFR: number;
    interpretation: 'excellent' | 'good' | 'moderate' | 'poor' | 'excessive';
  }>;
}

type ViewType = 'overview' | 'training-load' | 'recovery' | 'efficiency' | 'personal';

interface AdvancedAnalyticsDashboardProps {
  initialView?: string;
}

const VIEW_OPTIONS: ViewType[] = ['overview', 'training-load', 'recovery', 'efficiency', 'personal'];

const resolveInitialView = (value?: string): ViewType =>
  VIEW_OPTIONS.includes(value as ViewType) ? (value as ViewType) : 'overview';

export default function AdvancedAnalyticsDashboard({ initialView }: AdvancedAnalyticsDashboardProps) {
  const { user, loading: authLoading, namespaceReady } = useAuth();
  const { unitSystem, setUnitSystem, weightUnit, lbsToKg, kgToLbs } = useUnitPreference();
  const [analytics, setAnalytics] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);
  const [selectedView, setSelectedView] = useState<ViewType>(() => resolveInitialView(initialView));
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [loadingEfficiency, setLoadingEfficiency] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [includeWarmupSets, setIncludeWarmupSets] = useState(false);
  const pinnedStorageKey = useMemo(
    () => `iron_brain_insights_pinned_exercises_v1::${user?.id ?? 'guest'}`,
    [user?.id]
  );
  const [pinnedExerciseIds, setPinnedExerciseIds] = useState<string[]>([]);
  const pinnedExerciseSet = useMemo(() => new Set(pinnedExerciseIds), [pinnedExerciseIds]);
  const hasMinimumData = completedWorkouts.length >= 3;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('iron_brain_insights_include_warmups_v1');
    if (raw === '1' || raw === 'true') {
      setIncludeWarmupSets(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('iron_brain_insights_include_warmups_v1', includeWarmupSets ? '1' : '0');
  }, [includeWarmupSets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(pinnedStorageKey);
    if (!raw) {
      setPinnedExerciseIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setPinnedExerciseIds([]);
        return;
      }
      setPinnedExerciseIds(parsed.filter((value): value is string => typeof value === 'string').slice(0, 12));
    } catch {
      setPinnedExerciseIds([]);
    }
  }, [pinnedStorageKey]);

  useEffect(() => {
    setAnalytics({});
    setCompletedWorkouts([]);
    setCloudSyncing(false);
    setLoading(true);
    initialLoadRef.current = true;
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(pinnedStorageKey, JSON.stringify(pinnedExerciseIds.slice(0, 12)));
  }, [pinnedExerciseIds, pinnedStorageKey]);

  const togglePinnedExercise = useCallback((exerciseId: string) => {
    const willPin = !pinnedExerciseSet.has(exerciseId);
    setPinnedExerciseIds((prev) => {
      if (willPin) return [...prev, exerciseId].slice(0, 12);
      return prev.filter((id) => id !== exerciseId);
    });
    void trackUiEvent(
      {
        name: willPin ? 'insights_pin_exercise' : 'insights_unpin_exercise',
        source: 'insights',
        properties: { exerciseId },
      },
      user?.id
    );
  }, [pinnedExerciseSet, user?.id]);

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
      const fromUnit = set.weightUnit ?? weightUnit;
      return convertWeight(raw, fromUnit, weightUnit);
    };

    const resolveFallbackVolumeLoad = (workout: WorkoutSession) => {
      const fallback = typeof workout.totalVolumeLoad === 'number'
        ? workout.totalVolumeLoad
        : Number(workout.totalVolumeLoad ?? 0);
      return Number.isFinite(fallback) ? fallback : 0;
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
      if (perf >= 70) readiness = 'excellent';
      else if (perf >= 60) readiness = 'good';
      else if (perf >= 40) readiness = 'moderate';
      else readiness = 'poor';
    }

    const totalSets = workouts.reduce((sum, workout) => {
      const eligibleSets = includeWarmupSets
        ? workout.sets.filter((set) => set.completed !== false)
        : workout.sets.filter((set) => set.completed !== false && set.setType !== 'warmup');
      return sum + eligibleSets.length;
    }, 0);

    return {
      acwr: {
        ratio: clampValue(acwrMetrics.acwr, 0, 5.0),
        status: acwrMetrics.status,
        acuteLoad: clampValue(acwrMetrics.acuteLoad, 0, 1000000),
        chronicLoad: clampValue(acwrMetrics.chronicLoad, 0, 1000000),
        monotony: clampValue(acwrMetrics.trainingMonotony, 0, 10),
        strain: clampValue(acwrMetrics.trainingStrain, 0, 10000000),
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
        fatigueResistance: 50,
        recoveryRate: 1.0,
        totalWorkouts: workouts.length,
        totalSets,
      },
    } satisfies Pick<AnalyticsData, 'acwr' | 'fitnessFatigue' | 'personalStats'>;
  }, [includeWarmupSets, kgToLbs, lbsToKg, weightUnit]);

  const updateCoreAnalytics = useCallback((workouts: WorkoutSession[]) => {
    setCompletedWorkouts(workouts);
    const core = buildCoreAnalytics(workouts);

    if (!core) {
      setAnalytics((prev) => ({
        ...prev,
        acwr: undefined,
        fitnessFatigue: undefined,
        personalStats: undefined,
        hierarchicalModel: undefined,
        exerciseRates: undefined,
      }));
      return;
    }

    setAnalytics((prev) => ({
      ...prev,
      ...core,
      hierarchicalModel: undefined,
      exerciseRates: undefined,
    }));
  }, [buildCoreAnalytics]);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(initialLoadRef.current);
      setCloudSyncing(false);
      if (namespaceReady || user) {
        setUserNamespace(user?.id || null);
      }

      const localWorkouts = getWorkoutHistory();
      const localCompleted = buildCompletedWorkouts(localWorkouts);
      updateCoreAnalytics(localCompleted);
      setLoading(false);
      initialLoadRef.current = false;

      if (authLoading || !namespaceReady || !user) {
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
      } catch (err) {
        console.error('Failed to load analytics from Supabase:', err);
      } finally {
        setCloudSyncing(false);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [authLoading, namespaceReady, user, buildCompletedWorkouts, updateCoreAnalytics, normalizeWorkoutId]);

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
      console.error('Error loading recovery profiles:', err);
    } finally {
      setLoadingRecovery(false);
    }
  }, [user, loadingRecovery, analytics.recoveryProfiles]);

  const loadSfrInsights = useCallback(async () => {
    if (!user || loadingEfficiency || analytics.sfrInsights) return;
    setLoadingEfficiency(true);
    try {
      const leaderboard = await getExerciseEfficiencyLeaderboard(user.id, 20);
      setAnalytics((prev) => ({
        ...prev,
        sfrInsights: leaderboard.map((entry) => ({
          ...entry,
          interpretation: interpretSfr(entry.avgSFR),
        })),
      }));
    } catch (err) {
      console.error('Error loading SFR insights:', err);
    } finally {
      setLoadingEfficiency(false);
    }
  }, [user, loadingEfficiency, analytics.sfrInsights]);

  const loadHierarchicalModel = useCallback(async () => {
    if (loadingModel || analytics.hierarchicalModel || completedWorkouts.length < 3) return;
    setLoadingModel(true);
    try {
      const historicalForModel = completedWorkouts.map((workout) => ({
        date: new Date(workout.endTime || workout.startTime || workout.date),
        exercises: workout.sets
          .filter((set) => set.completed !== false && set.setType !== 'warmup')
          .reduce((acc, set) => {
            const existing = acc.find((exercise) => exercise.exerciseId === set.exerciseId);
          if (existing) {
            existing.sets.push(set);
          } else {
            acc.push({ exerciseId: set.exerciseId, sets: [set] });
          }
          return acc;
        }, [] as Array<{ exerciseId: string; sets: typeof workout.sets }>),
      }));

      let hierarchicalModel: HierarchicalFatigueModel;
      if (user) {
        try {
          const { getOrBuildHierarchicalModel } = await import('../lib/supabase/model-cache');
          hierarchicalModel = await getOrBuildHierarchicalModel(user.id, historicalForModel);
        } catch (err) {
          console.error('Cache load failed, building from scratch:', err);
          hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
        }
      } else {
        hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
      }

      const exerciseRates = Array.from(hierarchicalModel.exerciseSpecificFactors.entries()).map(([id, data]) => {
        const set = completedWorkouts
          .flatMap((workout) => workout.sets.filter((item) => item.completed !== false && item.setType !== 'warmup'))
          .find((item) => item.exerciseId === id);

        return {
          exerciseId: id,
          exerciseName: set?.exerciseName || id,
          fatigueRate: data.baselineFatigueRate,
          variance: data.variance,
          sampleSize: data.sampleSize,
        };
      });

      const totalSets = completedWorkouts.reduce(
        (sum, workout) => sum + workout.sets.filter((set) => set.completed !== false && set.setType !== 'warmup').length,
        0
      );

      setAnalytics((prev) => ({
        ...prev,
        hierarchicalModel,
        exerciseRates,
        personalStats: {
          fatigueResistance: clampValue(hierarchicalModel.userFatigueResistance || 50, 0, 100),
          recoveryRate: clampValue(hierarchicalModel.userRecoveryRate || 1.0, 0, 3),
          totalWorkouts: prev.personalStats?.totalWorkouts ?? completedWorkouts.length,
          totalSets: prev.personalStats?.totalSets ?? totalSets,
        },
      }));
    } catch (err) {
      console.error('Failed to build hierarchical model:', err);
    } finally {
      setLoadingModel(false);
    }
  }, [analytics.hierarchicalModel, completedWorkouts, loadingModel, user]);

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

  useEffect(() => {
    if (!user) return;
    if (analytics.recoveryProfiles || loadingRecovery) return;
    if (selectedView === 'recovery' || selectedView === 'overview') {
      void loadRecoveryProfiles();
    }
  }, [selectedView, user, analytics.recoveryProfiles, loadingRecovery, loadRecoveryProfiles]);

  useEffect(() => {
    if (!user) return;
    if (analytics.sfrInsights || loadingEfficiency) return;
    if (selectedView === 'efficiency' || selectedView === 'overview') {
      void loadSfrInsights();
    }
  }, [selectedView, user, analytics.sfrInsights, loadingEfficiency, loadSfrInsights]);

  useEffect(() => {
    if (selectedView === 'personal' || selectedView === 'efficiency') {
      void loadHierarchicalModel();
    }
  }, [selectedView, loadHierarchicalModel]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient safe-top p-6">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full btn-primary flex items-center justify-center animate-pulse">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <div className="text-white text-lg font-semibold">Loading insights...</div>
          <div className="text-zinc-400 text-sm">Syncing workouts and calculating metrics</div>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    const awaitingSync = cloudSyncing && completedWorkouts.length === 0;
    return (
      <div className="flex min-h-screen items-center justify-center app-gradient safe-top p-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 max-w-md text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center">
            <BarChart3 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {awaitingSync ? 'Syncing your workouts…' : 'Not enough data yet'}
          </h2>
          <p className="text-zinc-300 text-sm sm:text-base mb-6">
            {awaitingSync
              ? 'Pulling your workout history. This can take a minute on the first sync.'
              : 'Log at least 3 workouts with working sets (weight + reps) to unlock Insights.'}
          </p>
          {cloudSyncing && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
              Syncing cloud workouts…
            </div>
          )}
          <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 text-sm text-zinc-400 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>ACWR injury risk monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Fitness-fatigue performance tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Exercise efficiency analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Recovery recommendations</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generate smart insights
  const getSmartInsights = () => {
    const insights: Array<{ type: 'good' | 'warning' | 'danger' | 'info'; message: string; action?: string }> = [];

    // ACWR-based insights
    if (analytics.acwr) {
      if (analytics.acwr.ratio > 2.0) {
        insights.push({
          type: 'danger',
          message: `High injury risk. ACWR is ${analytics.acwr.ratio.toFixed(1)}× above baseline.`,
          action: 'Reduce volume or take a rest day'
        });
      } else if (analytics.acwr.ratio > 1.5) {
        insights.push({
          type: 'warning',
          message: `Load elevated (ACWR ${analytics.acwr.ratio.toFixed(2)}). Monitor fatigue.`,
          action: 'Plan recovery within 1-2 weeks'
        });
      } else if (analytics.acwr.ratio >= 0.8 && analytics.acwr.ratio <= 1.3) {
        insights.push({
          type: 'good',
          message: `Load is in the target range (ACWR ${analytics.acwr.ratio.toFixed(2)}).`,
          action: 'Maintain current load'
        });
      } else if (analytics.acwr.ratio < 0.5) {
        insights.push({
          type: 'warning',
          message: 'Training load is below baseline.',
          action: 'Increase volume gradually'
        });
      }

      if (analytics.acwr.monotony > 2.5) {
        insights.push({
          type: 'info',
          message: 'Training monotony is high.',
          action: 'Add variety in exercises or rep ranges'
        });
      }
    }

    // Fitness-Fatigue insights
    if (analytics.fitnessFatigue) {
      if (analytics.fitnessFatigue.readiness === 'excellent') {
        insights.push({
          type: 'good',
          message: 'Readiness is high.',
          action: 'Good day for intensity'
        });
      } else if (analytics.fitnessFatigue.readiness === 'poor') {
        insights.push({
          type: 'warning',
          message: 'Readiness is low.',
          action: 'Prioritize recovery or reduce intensity'
        });
      }

      const fatigueRatio = analytics.fitnessFatigue.currentFatigue / analytics.fitnessFatigue.currentFitness;
      if (fatigueRatio > 1.2) {
        insights.push({
          type: 'warning',
          message: 'Fatigue is outpacing fitness.',
          action: 'Consider a deload week'
        });
      }
    }

    // Recovery insights
    if (analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0) {
      const worstMuscle = analytics.recoveryProfiles.reduce((worst, curr) =>
        curr.readinessScore < worst.readinessScore ? curr : worst
      );

      if (worstMuscle.readinessScore < 6) {
        insights.push({
          type: 'warning',
          message: `${worstMuscle.muscleGroup.charAt(0).toUpperCase() + worstMuscle.muscleGroup.slice(1)} still recovering.`,
          action: 'Avoid heavy training for this muscle group'
        });
      }
    }

    return insights.slice(0, 3); // Show top 3
  };

  const smartInsights = getSmartInsights();
  const pinnedSfrInsights = analytics.sfrInsights && pinnedExerciseIds.length > 0
    ? analytics.sfrInsights.filter((insight) => pinnedExerciseSet.has(insight.exerciseId))
    : [];

  return (
    <div className="min-h-screen app-gradient px-4 py-6 sm:px-6 sm:py-8 pb-24 safe-top">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 sm:mb-8 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Insights</p>
              <h1 className="mt-3 text-3xl font-black text-white">Insights</h1>
              <p className="mt-2 text-sm text-zinc-400">Training metrics and recovery insights.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {cloudSyncing && (
                <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200">
                  Syncing workouts
                </span>
              )}
              <div className="flex items-center rounded-full border border-white/10 bg-white/10 p-1 text-xs font-semibold text-zinc-200">
                <button
                  type="button"
                  onClick={() => {
                    if (unitSystem === 'imperial') return;
                    setUnitSystem('imperial');
                    void trackUiEvent(
                      { name: 'insights_unit_change', source: 'insights', properties: { unit: 'lbs' } },
                      user?.id
                    );
                  }}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    unitSystem === 'imperial' ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white'
                  }`}
                  aria-pressed={unitSystem === 'imperial'}
                >
                  lbs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (unitSystem === 'metric') return;
                    setUnitSystem('metric');
                    void trackUiEvent(
                      { name: 'insights_unit_change', source: 'insights', properties: { unit: 'kg' } },
                      user?.id
                    );
                  }}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    unitSystem === 'metric' ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white'
                  }`}
                  aria-pressed={unitSystem === 'metric'}
                >
                  kg
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !includeWarmupSets;
                  setIncludeWarmupSets(next);
                  void trackUiEvent(
                    { name: 'insights_warmups_toggle', source: 'insights', properties: { enabled: next } },
                    user?.id
                  );
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  includeWarmupSets
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-white/10 text-zinc-200 hover:bg-white/15'
                }`}
                title="Warm-up sets are always excluded from fatigue/readiness. This toggle only affects totals and summaries."
                aria-pressed={includeWarmupSets}
              >
                Warmups: {includeWarmupSets ? 'Included' : 'Hidden'}
              </button>
            </div>
          </div>
        </header>

        {/* Smart Insights Banner - Only show most critical alert */}
        {smartInsights.length > 0 && selectedView === 'overview' && (() => {
          // Show only the most critical insight (danger > warning > info > good)
          const priorityOrder = { danger: 1, warning: 2, info: 3, good: 4 };
          const mostCritical = smartInsights.reduce((prev, current) =>
            priorityOrder[prev.type] < priorityOrder[current.type] ? prev : current
          );

          // Only show if it's danger or warning
          if (mostCritical.type !== 'danger' && mostCritical.type !== 'warning') return null;

          const Icon = mostCritical.type === 'danger' ? AlertCircle : AlertTriangle;

          return (
            <div className="mb-6 sm:mb-8">
              <div
                className={`rounded-2xl p-4 sm:p-5 border backdrop-blur-xl ${
                  mostCritical.type === 'danger' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 ${
                    mostCritical.type === 'danger' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm sm:text-base font-medium mb-1 ${
                      mostCritical.type === 'danger' ? 'text-red-300' : 'text-amber-300'
                    }`}>
                      {mostCritical.message}
                    </p>
                    {mostCritical.action && (
                      <p className="text-xs sm:text-sm text-gray-400">
                        Recommended: {mostCritical.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Navigation Tabs - Always show labels for clarity */}
        <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {([
            { id: 'overview' as ViewType, label: 'Overview', Icon: BarChart3 },
            { id: 'training-load' as ViewType, label: 'Load', Icon: Zap },
            { id: 'recovery' as ViewType, label: 'Recovery', Icon: Battery },
            { id: 'efficiency' as ViewType, label: 'Efficiency', Icon: Target },
            { id: 'personal' as ViewType, label: 'Profile', Icon: User }
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
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all text-sm touch-manipulation active:scale-[0.98] ${
                selectedView === id
                  ? 'btn-primary text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Overview */}
        {selectedView === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ACWR Card */}
            {analytics.acwr && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-orange-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">Injury Risk</h3>
                  </div>
                  <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    analytics.acwr.status === 'optimal' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    analytics.acwr.status === 'building' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    analytics.acwr.status === 'danger' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  }`}>
                    {analytics.acwr.status}
                  </div>
                </div>
                <div className="text-5xl font-black text-white mb-2 bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent">
                  {analytics.acwr.ratio.toFixed(2)}
                </div>
                <div className="text-sm text-gray-300 mb-4 font-medium">
                  {analytics.acwr.ratio < 0.8 ? 'Below target range' :
                   analytics.acwr.ratio <= 1.3 ? 'Target range' :
                   analytics.acwr.ratio <= 1.5 ? 'High load' :
                   'High risk — reduce load'}
                </div>
                <div className="space-y-2.5 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">7-day load</span>
                    <span className="text-base text-white font-bold">
                      {analytics.acwr.acuteLoad.toFixed(0)}
                      <span className="ml-1 text-xs font-semibold text-zinc-400">{weightUnit}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">28-day avg</span>
                    <span className="text-base text-white font-bold">
                      {analytics.acwr.chronicLoad.toFixed(0)}
                      <span className="ml-1 text-xs font-semibold text-zinc-400">{weightUnit}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Fitness-Fatigue Card */}
            {analytics.fitnessFatigue && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-purple-400" />
                    </div>
                    <h3 className="text-base font-bold text-white">Readiness</h3>
                  </div>
                  <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    analytics.fitnessFatigue.readiness === 'excellent' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    analytics.fitnessFatigue.readiness === 'good' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    analytics.fitnessFatigue.readiness === 'moderate' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {analytics.fitnessFatigue.readiness}
                  </div>
                </div>
                <div className="text-5xl font-black text-white mb-2 bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent">
                  {analytics.fitnessFatigue.performance.toFixed(0)}
                </div>
                <div className="text-sm text-gray-300 mb-4 font-medium">
                  Performance score
                </div>
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">Fitness</span>
                      <span className="text-sm text-green-400 font-bold">{analytics.fitnessFatigue.currentFitness.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all shadow-lg shadow-green-500/50"
                        style={{ width: `${Math.min(100, analytics.fitnessFatigue.currentFitness)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">Fatigue</span>
                      <span className="text-sm text-red-400 font-bold">{analytics.fitnessFatigue.currentFatigue.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all shadow-lg shadow-red-500/50"
                        style={{ width: `${Math.min(100, analytics.fitnessFatigue.currentFatigue)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Stats Card */}
            {analytics.personalStats && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">Your Stats</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1 font-medium">Workouts</div>
                    <div className="text-3xl font-black text-white">
                      {analytics.personalStats.totalWorkouts}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1 font-medium">Total Sets</div>
                    <div className="text-3xl font-black text-white">
                      {analytics.personalStats.totalSets}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Fatigue Resistance</span>
                    <span className="text-sm font-bold text-white">
                      {analytics.personalStats.fatigueResistance.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Recovery Speed</span>
                    <span className={`text-sm font-bold ${
                      analytics.personalStats.recoveryRate > 1.1 ? 'text-green-400' :
                      analytics.personalStats.recoveryRate > 0.9 ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {analytics.personalStats.recoveryRate > 1.1 ? 'Fast' :
                       analytics.personalStats.recoveryRate > 0.9 ? 'Normal' :
                       'Slow'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Recovery Status */}
            {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Battery className="h-5 w-5 text-green-400" />
                  </div>
                  <h3 className="text-base font-bold text-white">Muscle Recovery</h3>
                </div>
                <div className="space-y-3">
                  {analytics.recoveryProfiles.slice(0, 3).map(profile => (
                    <div key={profile.muscleGroup} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                      <span className="text-sm text-gray-200 capitalize font-medium">{profile.muscleGroup}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${
                          profile.readinessScore >= 8 ? 'bg-green-400 shadow-green-500/50' :
                          profile.readinessScore >= 6 ? 'bg-yellow-400 shadow-yellow-500/50' :
                          'bg-orange-400 shadow-orange-500/50'
                        }`}></div>
                        <span className={`text-sm font-bold ${
                          profile.readinessScore >= 8 ? 'text-green-400' :
                          profile.readinessScore >= 6 ? 'text-yellow-400' :
                          'text-orange-400'
                        }`}>
                          {profile.readinessScore.toFixed(1)}/10
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    void trackUiEvent(
                      { name: 'insights_view_change', source: 'insights', properties: { from: 'overview', to: 'recovery' } },
                      user?.id
                    );
                    setSelectedView('recovery');
                  }}
                  className="mt-4 w-full text-sm text-purple-400 hover:text-purple-300 transition-colors font-bold hover:bg-white/5 rounded-lg py-2"
                >
                  View All Muscles →
                </button>
              </div>
            )}

            {/* Quick Efficiency Status */}
            {analytics.sfrInsights && analytics.sfrInsights.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                    {pinnedExerciseIds.length > 0 ? (
                      <Star className="h-5 w-5 text-yellow-300" />
                    ) : (
                      <Target className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {pinnedExerciseIds.length > 0 ? 'Pinned Exercises' : 'Best Exercises'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {pinnedExerciseIds.length > 0 && pinnedSfrInsights.length === 0 ? (
                    <div className="bg-white/5 rounded-lg p-4 text-sm text-zinc-400">
                      Your pinned exercises don’t have enough recent data yet. Pin from the Efficiency tab once you’ve logged a few sessions.
                    </div>
                  ) : (
                    (pinnedExerciseIds.length > 0 ? pinnedSfrInsights : analytics.sfrInsights)
                      .slice(0, 3)
                      .map((insight) => {
                        const isPinned = pinnedExerciseSet.has(insight.exerciseId);
                        return (
                          <div
                            key={insight.exerciseId}
                            className="flex justify-between items-center gap-3 bg-white/5 rounded-lg p-3"
                          >
                            <span className="text-sm text-gray-200 truncate font-medium">{insight.exerciseName}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                                insight.interpretation === 'excellent' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                insight.interpretation === 'good' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              }`}>
                                {insight.interpretation}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePinnedExercise(insight.exerciseId)}
                                className={`rounded-lg border p-1 transition-colors ${
                                  isPinned
                                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                                    : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                                }`}
                                title={isPinned ? 'Unpin exercise' : 'Pin exercise'}
                                aria-label={isPinned ? 'Unpin exercise' : 'Pin exercise'}
                              >
                                <Star className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
                <button
                  onClick={() => {
                    void trackUiEvent(
                      { name: 'insights_view_change', source: 'insights', properties: { from: 'overview', to: 'efficiency' } },
                      user?.id
                    );
                    setSelectedView('efficiency');
                  }}
                  className="mt-4 w-full text-sm text-purple-400 hover:text-purple-300 transition-colors font-bold hover:bg-white/5 rounded-lg py-2"
                >
                  {pinnedExerciseIds.length > 0 ? 'Manage Pins →' : 'View All Exercises →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Training Load Detail View */}
        {selectedView === 'training-load' && analytics.acwr && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Training Load (ACWR)</h2>
              <div className="mb-6 sm:mb-8">
                <div className="flex items-baseline gap-3 mb-2">
                  <div className="text-5xl sm:text-6xl font-bold text-white">{analytics.acwr.ratio.toFixed(2)}</div>
                  <div className={`text-base sm:text-lg font-semibold px-3 py-1 rounded ${
                    analytics.acwr.status === 'optimal' ? 'bg-green-500/20 text-green-400' :
                    analytics.acwr.status === 'building' ? 'bg-blue-500/20 text-blue-400' :
                    analytics.acwr.status === 'danger' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {analytics.acwr.status}
                  </div>
                </div>
                <div className="h-3 sm:h-4 bg-gray-700 rounded-full overflow-hidden relative">
                  {/* Sweet spot indicator (0.8-1.3) */}
                  <div className="absolute left-[40%] right-[35%] h-full bg-green-500/30" />
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, (analytics.acwr.ratio / 2) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-400 mt-1.5">
                  <span>0.0</span>
                  <span className="text-green-400 text-xs">Sweet Spot</span>
                  <span>2.0+</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Metrics</h3>
                  <div className="space-y-3">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">7-day load</span>
                        <span className="text-base sm:text-lg text-white font-bold">
                          {analytics.acwr.acuteLoad.toFixed(0)}
                          <span className="ml-1 text-xs font-semibold text-zinc-400">{weightUnit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">28-day average</span>
                        <span className="text-base sm:text-lg text-white font-bold">
                          {analytics.acwr.chronicLoad.toFixed(0)}
                          <span className="ml-1 text-xs font-semibold text-zinc-400">{weightUnit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">Training strain</span>
                        <span className="text-base sm:text-lg text-white font-bold">{analytics.acwr.strain.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">Monotony</span>
                        <span className={`text-base sm:text-lg font-bold ${
                          analytics.acwr.monotony > 2.5 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {analytics.acwr.monotony.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">What This Means</h3>
                  <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                    {analytics.acwr.ratio < 0.5 && (
                      <div className="bg-yellow-500/10 border-l-4 border-yellow-500 rounded-lg p-3">
                        <p className="font-semibold text-yellow-400 mb-1">Detraining Zone</p>
                        <p className="text-gray-400">Load too low to maintain fitness. Gradually increase volume.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio >= 0.5 && analytics.acwr.ratio < 0.8 && (
                      <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded-lg p-3">
                        <p className="font-semibold text-blue-400 mb-1">Maintenance Mode</p>
                        <p className="text-gray-400">Preserving fitness but not building. Consider progressive overload.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio >= 0.8 && analytics.acwr.ratio <= 1.3 && (
                      <div className="bg-green-500/10 border-l-4 border-green-500 rounded-lg p-3">
                        <p className="font-semibold text-green-400 mb-1">Optimal Zone</p>
                        <p className="text-gray-400">Perfect balance for gains with minimal injury risk. Keep it up!</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 1.3 && analytics.acwr.ratio <= 1.5 && (
                      <div className="bg-orange-500/10 border-l-4 border-orange-500 rounded-lg p-3">
                        <p className="font-semibold text-orange-400 mb-1">Building Phase</p>
                        <p className="text-gray-400">Progressive overload territory. Monitor fatigue closely.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 1.5 && analytics.acwr.ratio <= 2.0 && (
                      <div className="bg-red-500/10 border-l-4 border-red-500 rounded-lg p-3">
                        <p className="font-semibold text-red-400 mb-1">Overreaching</p>
                        <p className="text-gray-400">High load spike. Plan recovery within 1-2 weeks.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 2.0 && (
                      <div className="bg-red-600/20 border-l-4 border-red-600 rounded-lg p-3">
                        <p className="font-semibold text-red-500 mb-1">DANGER ZONE</p>
                        <p className="text-gray-400">2-4× injury risk! Immediate deload recommended.</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-white/10 text-xs text-gray-500">
                      Based on research by Hulin et al. (2016)
                    </div>
                  </div>
                </div>
              </div>

            {/* Fitness-Fatigue Integration */}
            {analytics.fitnessFatigue && (
              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/10">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Performance Readiness</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-green-400 mb-1">Fitness</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.currentFitness.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Built-up adaptations</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-red-400 mb-1">Fatigue</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.currentFatigue.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Current stress level</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-purple-400 mb-1">Performance</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.performance.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Readiness: {analytics.fitnessFatigue.readiness}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Recovery View */}
        {selectedView === 'recovery' && (
          <div className="space-y-4 sm:space-y-6">
            <RecoveryOverview
              profiles={analytics.recoveryProfiles || []}
              loading={loadingRecovery}
            />

            {/* Info Card */}
            {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">How to Use This</h3>
                <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Readiness Score (1-10)</p>
                    <p className="text-gray-400">Below 7 = train light or rest. Above 8 = ready for heavy training.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Recovery Times</p>
                    <p className="text-gray-400">Based on research: Legs ~72h, Chest/Back ~48h, Arms ~36h. Adjusted for your fatigue.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Training Guidance</p>
                    <p className="text-gray-400">Train high-readiness muscles hard. Give low-readiness muscles more time.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Efficiency View */}
        {selectedView === 'efficiency' && (
          <div className="space-y-4 sm:space-y-6">
            <SFRInsightsTable
              insights={analytics.sfrInsights || []}
              loading={loadingEfficiency}
              pinnedExerciseIds={pinnedExerciseIds}
              onTogglePin={togglePinnedExercise}
            />

            {/* Info Card */}
            {analytics.sfrInsights && analytics.sfrInsights.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Understanding Efficiency (SFR)</h3>
                <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">What is SFR?</p>
                    <p className="text-gray-400">Stimulus-to-Fatigue Ratio. Higher = better gains per unit of fatigue.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">What Matters</p>
                    <p className="text-gray-400">Sets near failure (RPE 8-10) drive growth. SFR shows which exercises deliver best results.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">How to Use</p>
                    <p className="text-gray-400">Keep exercises with &quot;excellent&quot; SFR. Replace or reduce volume on &quot;poor&quot; SFR exercises.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal Profile View */}
        {selectedView === 'personal' && (
          analytics.hierarchicalModel ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Your Profile</h2>

              {/* Core Traits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3">Fatigue Resistance</h3>
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                    {analytics.personalStats?.fatigueResistance.toFixed(0)}/100
                  </div>
                  <div className={`text-xs sm:text-sm mb-3 font-medium ${
                    analytics.personalStats && analytics.personalStats.fatigueResistance > 70
                      ? 'text-green-400'
                      : analytics.personalStats && analytics.personalStats.fatigueResistance > 50
                      ? 'text-blue-400'
                      : 'text-yellow-400'
                  }`}>
                    {analytics.personalStats && analytics.personalStats.fatigueResistance > 70
                      ? 'Above Average - Handles volume well'
                      : analytics.personalStats && analytics.personalStats.fatigueResistance > 50
                      ? 'Average - Normal tolerance'
                      : 'Below Average - Fatigue-sensitive'}
                  </div>
                  <div className="h-2 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                      style={{ width: `${analytics.personalStats?.fatigueResistance || 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3">Recovery Speed</h3>
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                    {analytics.personalStats?.recoveryRate.toFixed(2)}×
                  </div>
                  <div className={`text-xs sm:text-sm mb-3 font-medium ${
                    analytics.personalStats && analytics.personalStats.recoveryRate > 1.1
                      ? 'text-green-400'
                      : analytics.personalStats && analytics.personalStats.recoveryRate > 0.9
                      ? 'text-blue-400'
                      : 'text-yellow-400'
                  }`}>
                    {analytics.personalStats && analytics.personalStats.recoveryRate > 1.1
                      ? 'Fast - Train more frequently'
                      : analytics.personalStats && analytics.personalStats.recoveryRate > 0.9
                      ? 'Normal - Standard rest needed'
                      : 'Slow - Extra rest helps'}
                  </div>
                  <div className="h-2 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                      style={{ width: `${Math.min(100, ((analytics.personalStats?.recoveryRate || 1) / 1.5) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Training Summary - Mobile First */}
              <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-white/10">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Training Volume</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.personalStats?.totalWorkouts || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Workouts</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.personalStats?.totalSets || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Total Sets</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.exerciseRates?.length || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Exercises</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {(analytics.hierarchicalModel.userConfidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Confidence</div>
                  </div>
                </div>
              </div>

              {/* Exercise-Specific Rates */}
              {analytics.exerciseRates && analytics.exerciseRates.length > 0 && (
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Exercise Fatigue Rates</h3>
                  <div className="text-xs sm:text-sm text-gray-400 mb-3">Shows how much each exercise fatigues you per set</div>
                  <div className="space-y-2">
                    {analytics.exerciseRates
                      .sort((a, b) => b.fatigueRate - a.fatigueRate)
                      .slice(0, 10)
                      .map((exercise) => (
                        <div key={exercise.exerciseId} className="bg-white/5 rounded-xl p-3 border border-white/10">
                          <div className="flex justify-between items-start gap-2 mb-1.5">
                            <span className="text-xs sm:text-sm text-white font-medium flex-1 min-w-0 truncate">
                              {exercise.exerciseName || exercise.exerciseId}
                            </span>
                            <span className={`text-xs sm:text-sm font-bold flex-shrink-0 ${
                              exercise.fatigueRate > 0.2 ? 'text-red-400' :
                              exercise.fatigueRate > 0.15 ? 'text-orange-400' :
                              exercise.fatigueRate > 0.1 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {(exercise.fatigueRate * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{exercise.sampleSize} sets</span>
                            <span>•</span>
                            <span>{(Math.max(0, 1 - exercise.variance) * 100).toFixed(0)}% confidence</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
              {loadingModel
                ? 'Building your performance profile...'
                : 'Profile insights will appear once enough workouts are available.'}
            </div>
          )
        )}

        {/* Research Citation */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
          <p>Research-backed analytics</p>
        </div>
      </div>
    </div>
  );
}
