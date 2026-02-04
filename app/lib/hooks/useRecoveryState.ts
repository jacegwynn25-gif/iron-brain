'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../supabase/auth-context';
import {
  calculateTrainingReadiness,
  type TrainingReadiness
} from '../intelligence/recovery-integration-service';

interface UseRecoveryStateOptions {
  autoRefresh?: boolean; // Auto-refresh every N minutes
  refreshIntervalMinutes?: number; // Default 30 minutes
}

interface UseRecoveryStateResult {
  readiness: TrainingReadiness | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

type InjuryRiskLevel = 'low' | 'medium' | 'high' | 'very_high' | 'critical';

type BodyRegion = 'upper' | 'lower' | 'unknown';

interface DerivedInjuryRisk {
  overallRiskLevel: InjuryRiskLevel;
  warnings: string[];
  score: number;
  modifier: number;
}

interface MuscleRecoveryStatus {
  muscle: string;
  status: string;
  emoji: string;
  recoveryPercentage: number;
  modifier: number;
}

interface RegionRecovery {
  modifier: number;
  recoveryPercentage: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRecoveryPercentage(modifier: number): number {
  return clamp(Math.round(modifier * 100), 0, 100);
}

function classifyExercise(exerciseName: string | null): BodyRegion {
  if (!exerciseName) return 'unknown';

  const lower = exerciseName.toLowerCase();
  const isUpper =
    lower.includes('upper') ||
    lower.includes('push') ||
    lower.includes('pull') ||
    lower.includes('chest') ||
    lower.includes('back') ||
    lower.includes('arm') ||
    lower.includes('shoulder');

  if (isUpper) return 'upper';

  const isLower =
    lower.includes('lower') ||
    lower.includes('leg') ||
    lower.includes('squat') ||
    lower.includes('glute') ||
    lower.includes('hamstring') ||
    lower.includes('quad');

  if (isLower) return 'lower';

  return 'unknown';
}

function toMuscleStatus(muscle: string, modifier: number): MuscleRecoveryStatus {
  const recoveryPercentage = toRecoveryPercentage(modifier);

  if (recoveryPercentage >= 95) {
    return {
      muscle,
      status: 'Ready to push',
      emoji: '💪',
      recoveryPercentage,
      modifier: Number(modifier.toFixed(3))
    };
  }

  if (recoveryPercentage >= 85) {
    return {
      muscle,
      status: 'Recovering',
      emoji: '🤔',
      recoveryPercentage,
      modifier: Number(modifier.toFixed(3))
    };
  }

  return {
    muscle,
    status: 'Still fatigued',
    emoji: '😴',
    recoveryPercentage,
    modifier: Number(modifier.toFixed(3))
  };
}

function deriveInjuryRisk(readiness: TrainingReadiness): DerivedInjuryRisk {
  let overallRiskLevel: InjuryRiskLevel = 'low';

  if (readiness.score < 40) overallRiskLevel = 'critical';
  else if (readiness.score < 50) overallRiskLevel = 'very_high';
  else if (readiness.score < 65) overallRiskLevel = 'high';
  else if (readiness.score < 80) overallRiskLevel = 'medium';

  const warningSet = new Set<string>();

  if (overallRiskLevel !== 'low') {
    warningSet.add(readiness.reason);
    warningSet.add(readiness.recommendation);
  }

  return {
    overallRiskLevel,
    warnings: Array.from(warningSet),
    score: readiness.score,
    modifier: readiness.modifier
  };
}

/**
 * React hook to fetch and manage training readiness data
 */
export function useRecoveryState(
  options: UseRecoveryStateOptions = {}
): UseRecoveryStateResult {
  const {
    autoRefresh = false,
    refreshIntervalMinutes = 30
  } = options;

  const { user } = useAuth();
  const [readiness, setReadiness] = useState<TrainingReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!user?.id) {
      setReadiness(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await calculateTrainingReadiness(user.id);
      setReadiness(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching training readiness:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch training readiness data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    const intervalMs = refreshIntervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      void fetchReadiness();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalMinutes, user?.id, fetchReadiness]);

  const refresh = useCallback(async () => {
    await fetchReadiness();
  }, [fetchReadiness]);

  return {
    readiness,
    loading,
    error,
    refresh,
    lastUpdated
  };
}

/**
 * Hook for readiness-driven injury risk summary
 */
export function useInjuryRisk() {
  const { readiness, loading, error, refresh } = useRecoveryState();

  const injuryRisk = useMemo(() => {
    if (!readiness) return null;
    return deriveInjuryRisk(readiness);
  }, [readiness]);

  return {
    injuryRisk,
    injuryWarning: injuryRisk?.warnings[0] ?? null,
    loading,
    error,
    refresh
  };
}

/**
 * Hook for pre-workout readiness check
 */
export function usePreWorkoutReadiness() {
  const { readiness, loading, error, refresh } = useRecoveryState();

  const recommendations = useMemo(() => {
    if (!readiness) return [];

    const unique = new Set<string>();
    unique.add(readiness.recommendation);
    unique.add(readiness.reason);

    return Array.from(unique);
  }, [readiness]);

  return {
    score: readiness?.score ?? 0,
    modifier: readiness?.modifier ?? 1,
    recommendation: readiness?.recommendation ?? '',
    recommendations,
    reason: readiness?.reason ?? '',
    focusAdjustments: readiness?.focus_adjustments ?? {
      upper_body_modifier: 1,
      lower_body_modifier: 1
    },
    loading,
    error,
    refresh
  };
}

/**
 * Hook for region-specific readiness data
 */
export function useMuscleRecovery() {
  const { readiness, loading, error, refresh } = useRecoveryState({
    autoRefresh: true,
    refreshIntervalMinutes: 30
  });

  const muscleStatuses = useMemo(() => {
    if (!readiness) return [];

    return [
      toMuscleStatus('Upper Body', readiness.focus_adjustments.upper_body_modifier),
      toMuscleStatus('Lower Body', readiness.focus_adjustments.lower_body_modifier)
    ];
  }, [readiness]);

  const muscles = useMemo(() => {
    return new Map<string, RegionRecovery>(
      muscleStatuses.map((status) => [
        status.muscle,
        {
          modifier: status.modifier,
          recoveryPercentage: status.recoveryPercentage
        }
      ])
    );
  }, [muscleStatuses]);

  const getMuscleStatus = useCallback((muscleName: string) => {
    return muscles.get(muscleName) ?? null;
  }, [muscles]);

  const getExerciseStatus = useCallback((exerciseName: string) => {
    const region = classifyExercise(exerciseName);
    if (region === 'upper') return muscles.get('Upper Body') ?? null;
    if (region === 'lower') return muscles.get('Lower Body') ?? null;
    return null;
  }, [muscles]);

  return {
    muscles,
    exercises: new Map<string, RegionRecovery>(),
    muscleStatuses,
    getMuscleStatus,
    getExerciseStatus,
    score: readiness?.score ?? 0,
    modifier: readiness?.modifier ?? 1,
    recommendation: readiness?.recommendation ?? '',
    loading,
    error,
    refresh
  };
}

/**
 * Hook for per-exercise set recommendation during workout
 */
export function useSetRecommendation(exerciseName: string | null) {
  const { readiness, loading } = useRecoveryState();

  if (!exerciseName || !readiness) {
    return {
      recommendation: null,
      muscleReadiness: 0,
      exerciseReadiness: 0,
      loading
    };
  }

  const region = classifyExercise(exerciseName);
  const suggestedWeightMultiplier =
    region === 'upper'
      ? readiness.focus_adjustments.upper_body_modifier
      : region === 'lower'
        ? readiness.focus_adjustments.lower_body_modifier
        : readiness.modifier;

  const exerciseReadiness = toRecoveryPercentage(suggestedWeightMultiplier);

  return {
    recommendation: {
      exerciseName,
      readiness: exerciseReadiness,
      suggestedWeightMultiplier: Number(suggestedWeightMultiplier.toFixed(3)),
      message: readiness.recommendation,
      reason: readiness.reason
    },
    muscleReadiness: readiness.score,
    exerciseReadiness,
    loading
  };
}

/**
 * Hook for session fatigue tracking during workout
 * Accumulates fatigue as user logs sets
 */
export function useSessionFatigue() {
  const [sessionFatigue, setSessionFatigue] = useState(0);
  const [sessionVolume, setSessionVolume] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);

  const addSet = useCallback((
    exerciseName: string,
    weight: number,
    reps: number,
    rpe: number
  ) => {
    const volume = weight * reps;
    const fatigueContribution = (rpe / 10) * Math.log(volume + 1) * 2;

    const newFatigue = Math.min(100, sessionFatigue + fatigueContribution);
    const newVolume = sessionVolume + volume;

    setSessionFatigue(newFatigue);
    setSessionVolume(newVolume);

    // Generate warnings
    const newWarnings: string[] = [];
    if (newFatigue >= 85) {
      newWarnings.push("You've hit 85% session fatigue. Continuing increases injury risk.");
    } else if (newFatigue >= 70) {
      newWarnings.push('High session fatigue. Consider wrapping up soon.');
    } else if (newFatigue >= 60) {
      newWarnings.push('Moderate fatigue building. 2-3 more exercises max.');
    }

    setWarnings(newWarnings);

    return {
      sessionFatigue: newFatigue,
      sessionVolume: newVolume,
      warnings: newWarnings
    };
  }, [sessionFatigue, sessionVolume]);

  const resetSession = useCallback(() => {
    setSessionFatigue(0);
    setSessionVolume(0);
    setWarnings([]);
  }, []);

  return {
    sessionFatigue,
    sessionVolume,
    warnings,
    addSet,
    resetSession
  };
}
