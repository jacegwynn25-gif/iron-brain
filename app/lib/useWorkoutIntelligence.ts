/**
 * Workout Intelligence Hook
 *
 * React hook that connects the WorkoutIntelligenceService to React components.
 * Provides real-time workout intelligence using PhD-level analytics models.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { SetLog } from './types';
import { getWorkoutIntelligence } from './intelligence/workout-intelligence';
import type { PreWorkoutReadiness, SetRecommendation, SessionFatigueAssessment } from './intelligence/workout-intelligence';
import { logger } from './logger';

export interface WeightRecommendation {
  type: 'increase' | 'decrease' | 'maintain';
  suggestedWeight: number;
  currentWeight: number;
  reasoning: string;
  confidence: number; // 0-1
  scientificBasis: string;
}

export interface PROpportunity {
  isOpportunity: boolean;
  currentPR: number;
  targetWeight: number;
  gap: number; // lbs away from PR
  type: 'max_weight' | 'max_e1rm';
}

export interface WorkoutIntelligence {
  // Real-time set recommendation
  setRecommendation: SetRecommendation | null;

  // Session fatigue assessment
  fatigueAssessment: SessionFatigueAssessment | null;

  // Legacy compatibility (mapped from new service)
  weightRecommendation: WeightRecommendation | null;

  // PR opportunities (not yet implemented in new service)
  prOpportunity: PROpportunity | null;

  // Should show any alert
  hasRecommendation: boolean;

  // Loading state
  loading: boolean;
}

const buildFallbackReadiness = (): PreWorkoutReadiness => ({
  overallScore: 6.5,
  overallStatus: 'moderate',
  acwr: 1.0,
  acwrStatus: 'unknown',
  fitnessScore: 50,
  fatigueScore: 25,
  performanceScore: 25,
  muscleReadiness: [],
  warnings: ['Readiness data is taking longer than expected. Proceed with caution.'],
  recommendations: ['Start lighter and adjust based on how you feel.'],
  confidence: 0.2
});

const READINESS_CACHE_TTL_MS = 5 * 60 * 1000;
const READINESS_CACHE_PREFIX = 'iron_brain_readiness_cache_';

type ReadinessCacheEntry = {
  timestamp: number;
  readiness: PreWorkoutReadiness;
  source?: 'fallback' | 'real';
};

const readReadinessCache = (cacheKey: string): ReadinessCacheEntry | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as ReadinessCacheEntry;
  } catch {
    return null;
  }
};

const writeReadinessCache = (
  cacheKey: string,
  readiness: PreWorkoutReadiness,
  source: ReadinessCacheEntry['source'] = 'real'
) => {
  if (typeof window === 'undefined') return;
  try {
    const payload: ReadinessCacheEntry = {
      timestamp: Date.now(),
      readiness,
      source,
    };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures
  }
};

/**
 * Real-time workout intelligence hook
 *
 * Analyzes completed sets and provides science-backed recommendations:
 * - Fatigue-based weight reductions (using hierarchical models, ACWR, recovery data)
 * - Progressive overload suggestions (using personal data and exercise-specific rates)
 * - Session fatigue monitoring (cumulative tracking with smart alerts)
 */
export function useWorkoutIntelligence(
  userId: string | null,
  completedSets: SetLog[],
  upcomingExerciseId: string | null,
  targetReps: number,
  targetRPE: number | null,
  lastWeight?: number | null
): WorkoutIntelligence {
  const [setRecommendation, setSetRecommendation] = useState<SetRecommendation | null>(null);
  const [fatigueAssessment, setFatigueAssessment] = useState<SessionFatigueAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  // Get intelligence service instance
  const intelligence = useMemo(() => getWorkoutIntelligence(userId), [userId]);

  // Get set recommendation when exercise changes or new set completed
  useEffect(() => {
    if (!upcomingExerciseId) {
      setSetRecommendation(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    intelligence.getSetRecommendation(
      upcomingExerciseId,
      completedSets.filter(s => s.exerciseId === upcomingExerciseId).length + 1,
      targetReps,
      targetRPE,
      completedSets
    ).then(rec => {
      if (!cancelled) {
        setSetRecommendation(rec);
        setLoading(false);
      }
    }).catch(err => {
      console.error('Error getting set recommendation:', err);
      if (!cancelled) {
        setSetRecommendation(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [intelligence, upcomingExerciseId, completedSets, targetReps, targetRPE]);

  // Assess session fatigue when sets change
  useEffect(() => {
    if (completedSets.length === 0) {
      setFatigueAssessment(null);
      return;
    }

    let cancelled = false;

    intelligence.assessSessionFatigue(completedSets)
      .then(assessment => {
        if (!cancelled) {
          setFatigueAssessment(assessment);
        }
      })
      .catch(err => {
        console.error('Error assessing session fatigue:', err);
        if (!cancelled) {
          setFatigueAssessment(null);
        }
      });

    return () => { cancelled = true; };
  }, [intelligence, completedSets]);

  // Map new service data to legacy interface for backward compatibility
  const weightRecommendation = useMemo((): WeightRecommendation | null => {
    if (!setRecommendation) return null;

    const baseline = lastWeight || setRecommendation.baseline.weight;
    const suggested = setRecommendation.suggestedWeight;

    let type: 'increase' | 'decrease' | 'maintain' = 'maintain';
    if (suggested > baseline * 1.02) type = 'increase';
    else if (suggested < baseline * 0.98) type = 'decrease';

    const confidenceMap = {
      'high': 0.85,
      'medium': 0.65,
      'low': 0.40
    };

    return {
      type,
      suggestedWeight: suggested,
      currentWeight: baseline,
      reasoning: setRecommendation.reasoning,
      confidence: confidenceMap[setRecommendation.confidence],
      scientificBasis: setRecommendation.fatigueAlert?.message || 'Based on hierarchical fatigue model, ACWR, and recovery data'
    };
  }, [setRecommendation, lastWeight]);

  const hasRecommendation = !!(
    (setRecommendation && setRecommendation.fatigueAlert) ||
    (weightRecommendation && weightRecommendation.type !== 'maintain') ||
    (fatigueAssessment && fatigueAssessment.shouldReduceWeight)
  );

  return {
    setRecommendation,
    fatigueAssessment,
    weightRecommendation,
    prOpportunity: null, // TODO: Implement in intelligence service
    hasRecommendation,
    loading
  };
}

/**
 * Hook for pre-workout readiness assessment
 */
export function usePreWorkoutReadiness(userId: string | null, plannedExercises?: string[]) {
  const initialPlanKey = plannedExercises && plannedExercises.length > 0
    ? Array.from(new Set(plannedExercises)).sort().join(',')
    : '';
  const initialCacheKey = `${READINESS_CACHE_PREFIX}${userId || 'guest'}_${initialPlanKey || 'all'}`;
  const [readiness, setReadiness] = useState<PreWorkoutReadiness | null>(() => {
    const cached = readReadinessCache(initialCacheKey);
    return cached?.readiness ?? buildFallbackReadiness();
  });
  const [loading, setLoading] = useState(false);

  const intelligence = useMemo(() => getWorkoutIntelligence(userId), [userId]);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plannedKey = initialPlanKey;
  const cacheKey = `${READINESS_CACHE_PREFIX}${userId || 'guest'}_${plannedKey || 'all'}`;

  useEffect(() => {
    let cancelled = false;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const plannedExercisesForRequest = plannedKey ? plannedKey.split(',') : undefined;
    const cached = readReadinessCache(cacheKey);
    const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
    const hasFreshCache = cached && cached.source !== 'fallback' && cacheAge < READINESS_CACHE_TTL_MS;
    logger.debug('🔍 usePreWorkoutReadiness: Starting...', { userId, plannedExercises: plannedExercisesForRequest });
    if (cached) {
      setReadiness(cached.readiness);
    }

    if (hasFreshCache) {
      setLoading(false);
      return () => {
        logger.debug('🧹 usePreWorkoutReadiness: Cleanup (cache hit)');
        cancelled = true;
      };
    }

    if (!cached) {
      const fallback = buildFallbackReadiness();
      setReadiness(fallback);
      writeReadinessCache(cacheKey, fallback, 'fallback');
    }

    setLoading(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      if (cancelled || requestIdRef.current !== requestId) return;
      logger.warn('⏱️ usePreWorkoutReadiness: Timeout');
      const fallback = buildFallbackReadiness();
      setReadiness((prev) => prev ?? fallback);
      writeReadinessCache(cacheKey, fallback, 'fallback');
      setLoading(false);
    }, 2500);

    intelligence.getPreWorkoutReadiness(plannedExercisesForRequest)
      .then(result => {
        logger.debug('✅ usePreWorkoutReadiness: Got result', result);
        if (!cancelled && requestIdRef.current === requestId) {
          setReadiness(result);
          writeReadinessCache(cacheKey, result);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('❌ usePreWorkoutReadiness: Error getting pre-workout readiness:', err);
        if (!cancelled && requestIdRef.current === requestId) {
          setReadiness(buildFallbackReadiness());
          setLoading(false);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      });

    return () => {
      logger.debug('🧹 usePreWorkoutReadiness: Cleanup');
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [cacheKey, intelligence, plannedKey, userId]);

  return { readiness, loading };
}
