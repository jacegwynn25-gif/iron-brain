'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import {
  getRecoveryAssessment,
  type RecoveryAssessment
} from '../intelligence/recovery-integration-service';

interface UseRecoveryStateOptions {
  autoRefresh?: boolean; // Auto-refresh every N minutes
  refreshIntervalMinutes?: number; // Default 30 minutes
  useCached?: boolean; // Use cached data if recent enough
}

interface UseRecoveryStateResult {
  assessment: RecoveryAssessment | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * React hook to fetch and manage recovery assessment data
 *
 * Usage:
 * ```typescript
 * const { assessment, loading, error, refresh } = useRecoveryState({
 *   useCached: true,
 *   autoRefresh: true,
 *   refreshIntervalMinutes: 30
 * });
 * ```
 */
export function useRecoveryState(
  options: UseRecoveryStateOptions = {}
): UseRecoveryStateResult {
  const {
    autoRefresh = false,
    refreshIntervalMinutes = 30,
    useCached = true
  } = options;

  const { user } = useAuth();
  const [assessment, setAssessment] = useState<RecoveryAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAssessment = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getRecoveryAssessment(
        user.id,
        forceRefresh ? false : useCached
      );

      setAssessment(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching recovery assessment:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch recovery data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, useCached]);

  // Initial fetch
  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    const intervalMs = refreshIntervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      fetchAssessment();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalMinutes, user?.id, fetchAssessment]);

  const refresh = useCallback(async () => {
    await fetchAssessment(true); // Force refresh (no cache)
  }, [fetchAssessment]);

  return {
    assessment,
    loading,
    error,
    refresh,
    lastUpdated
  };
}

/**
 * Hook specifically for injury risk data
 * Useful when you only need injury warnings without full recovery state
 */
export function useInjuryRisk() {
  const { assessment, loading, error, refresh } = useRecoveryState({
    useCached: true
  });

  return {
    injuryRisk: assessment?.injuryRisk ?? null,
    injuryWarning: assessment?.injuryWarning ?? null,
    loading,
    error,
    refresh
  };
}

/**
 * Hook for pre-workout readiness check
 * Returns simplified readiness data for traffic light UI
 */
export function usePreWorkoutReadiness() {
  const { assessment, loading, error, refresh } = useRecoveryState({
    useCached: true
  });

  return {
    readinessMessage: assessment?.readinessMessage ?? null,
    overallRecovery: assessment?.recoveryState?.overallRecoveryScore ?? 0,
    muscleStatuses: assessment?.muscleStatuses ?? [],
    injuryWarning: assessment?.injuryWarning ?? null,
    dataQuality: assessment?.dataQuality ?? 'low',
    confidence: assessment?.confidence ?? 0,
    loading,
    error,
    refresh
  };
}

/**
 * Hook for muscle-specific recovery data
 * Useful for recovery dashboard
 */
export function useMuscleRecovery() {
  const { assessment, loading, error, refresh } = useRecoveryState({
    useCached: true,
    autoRefresh: true,
    refreshIntervalMinutes: 30
  });

  const getMuscleStatus = useCallback((muscleName: string) => {
    if (!assessment?.recoveryState?.muscles) return null;
    return assessment.recoveryState.muscles.get(muscleName) ?? null;
  }, [assessment]);

  const getExerciseStatus = useCallback((exerciseName: string) => {
    if (!assessment?.recoveryState?.exercises) return null;
    return assessment.recoveryState.exercises.get(exerciseName) ?? null;
  }, [assessment]);

  // Enhance muscle statuses with recovery percentages
  const enhancedMuscleStatuses = (assessment?.muscleStatuses ?? []).map(status => {
    const muscleState = assessment?.recoveryState?.muscles.get(status.muscle);
    return {
      ...status,
      recoveryPercentage: muscleState?.recoveryPercentage ?? 0
    };
  });

  return {
    muscles: assessment?.recoveryState?.muscles ?? new Map(),
    exercises: assessment?.recoveryState?.exercises ?? new Map(),
    muscleStatuses: enhancedMuscleStatuses,
    getMuscleStatus,
    getExerciseStatus,
    loading,
    error,
    refresh
  };
}

/**
 * Hook for set recommendations during workout
 * Takes current exercise and provides dynamic weight adjustment
 */
export function useSetRecommendation(exerciseName: string | null) {
  const { assessment, loading } = useRecoveryState({ useCached: true });

  if (!exerciseName || !assessment) {
    return {
      recommendation: null,
      muscleReadiness: 0,
      exerciseReadiness: 0,
      loading
    };
  }

  const exerciseState = assessment.recoveryState?.exercises.get(exerciseName);
  const exerciseReadiness = exerciseState?.recoveryPercentage ?? 100;

  // Find primary muscles for this exercise
  // TODO: Import EXERCISE_PATTERNS to get muscle involvement
  const muscleReadiness = assessment.recoveryState?.overallRecoveryScore ?? 100;

  return {
    recommendation: {
      exerciseName,
      readiness: exerciseReadiness,
      suggestedWeightMultiplier: exerciseReadiness >= 85 ? 1.0 :
                                  exerciseReadiness >= 60 ? 0.85 :
                                  0.70,
      message: exerciseReadiness >= 85 ? 'Fully recovered - train normally' :
               exerciseReadiness >= 60 ? 'Partially recovered - reduce weight 15%' :
               'Still fatigued - reduce weight 30% or skip'
    },
    muscleReadiness,
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
