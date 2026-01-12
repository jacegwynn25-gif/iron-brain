/**
 * Workout Intelligence Hook
 *
 * React hook that connects the WorkoutIntelligenceService to React components.
 * Provides real-time workout intelligence using PhD-level analytics models.
 */

import { useState, useEffect, useMemo } from 'react';
import { SetLog, Exercise } from './types';
import { getWorkoutIntelligence } from './intelligence/workout-intelligence-service';
import type { SetRecommendation, SessionFatigueAssessment } from './intelligence/workout-intelligence-service';
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
  }, [intelligence, upcomingExerciseId, completedSets.length, targetReps, targetRPE]);

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
  }, [intelligence, completedSets.length]);

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
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof import('./intelligence/workout-intelligence-service').WorkoutIntelligenceService.prototype.getPreWorkoutReadiness>> | null>(null);
  const [loading, setLoading] = useState(false);

  const intelligence = useMemo(() => getWorkoutIntelligence(userId), [userId]);

  useEffect(() => {
    let cancelled = false;
    logger.debug('🔍 usePreWorkoutReadiness: Starting...', { userId, plannedExercises });
    setLoading(true);

    intelligence.getPreWorkoutReadiness(plannedExercises)
      .then(result => {
        logger.debug('✅ usePreWorkoutReadiness: Got result', result);
        if (!cancelled) {
          setReadiness(result);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('❌ usePreWorkoutReadiness: Error getting pre-workout readiness:', err);
        if (!cancelled) {
          setReadiness(null);
          setLoading(false);
        }
      });

    return () => {
      logger.debug('🧹 usePreWorkoutReadiness: Cleanup');
      cancelled = true;
    };
  }, [intelligence, plannedExercises?.join(',')]);

  return { readiness, loading };
}
