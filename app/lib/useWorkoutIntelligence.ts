import { useMemo } from 'react';
import { SetLog, Exercise } from './types';
import { storage } from './storage';
import { shouldTriggerAutoReduction, calculateAdjustedWeight, FatigueAlert } from './fatigueModel';
import { getE1RMProgression } from './analytics';

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
  // Fatigue detection
  fatigueAlert: FatigueAlert | null;

  // Weight recommendations
  weightRecommendation: WeightRecommendation | null;

  // PR opportunities
  prOpportunity: PROpportunity | null;

  // Should show any alert
  hasRecommendation: boolean;
}

/**
 * Real-time workout intelligence hook
 *
 * Analyzes completed sets and provides science-backed recommendations:
 * - Fatigue-based weight reductions
 * - Progressive overload suggestions
 * - PR opportunity detection
 */
export function useWorkoutIntelligence(
  completedSets: SetLog[],
  upcomingExercise: Exercise | null,
  lastWorkoutBestSet?: { actualWeight?: number | null; actualReps?: number | null; actualRPE?: number | null }
): WorkoutIntelligence {
  const intelligence = useMemo(() => {
    if (!upcomingExercise) {
      return {
        fatigueAlert: null,
        weightRecommendation: null,
        prOpportunity: null,
        hasRecommendation: false,
      };
    }

    // 1. CHECK FOR FATIGUE (priority: safety first)
    const fatigueAlert = shouldTriggerAutoReduction(completedSets, upcomingExercise.id);

    // 2. CHECK FOR PROGRESSION OPPORTUNITY (if no fatigue)
    let weightRecommendation: WeightRecommendation | null = null;

    if (!fatigueAlert.shouldAlert && lastWorkoutBestSet && lastWorkoutBestSet.actualWeight && lastWorkoutBestSet.actualReps) {
      const lastWeight = lastWorkoutBestSet.actualWeight;
      const lastReps = lastWorkoutBestSet.actualReps;
      const lastRPE = lastWorkoutBestSet.actualRPE;

      // Get progression history for this exercise
      const progression = getE1RMProgression(upcomingExercise.id);
      const recentSessions = progression.slice(-5); // Last 5 sessions

      // Progressive overload logic
      // Based on Zourdos et al. (2016) - 2-5% increases when RPE < 8.5
      if (lastRPE !== null && lastRPE !== undefined) {
        // INCREASE: Consistently undershooting RPE
        if (lastRPE < 7.5 && lastReps >= 8) {
          const increase = Math.max(5, Math.round(lastWeight * 0.025)); // 2.5% or minimum 5lbs
          weightRecommendation = {
            type: 'increase',
            suggestedWeight: lastWeight + increase,
            currentWeight: lastWeight,
            reasoning: `Last set felt easy (RPE ${lastRPE}). Ready for progressive overload.`,
            confidence: 0.85,
            scientificBasis: 'Zourdos et al. (2016): 2-5% load increases recommended when RPE consistently < 8.0 and technique is solid.',
          };
        }
        // INCREASE: Hitting high reps with room to spare
        else if (lastRPE <= 8.0 && lastReps >= 12) {
          const increase = Math.max(5, Math.round(lastWeight * 0.03)); // 3% or minimum 5lbs
          weightRecommendation = {
            type: 'increase',
            suggestedWeight: lastWeight + increase,
            currentWeight: lastWeight,
            reasoning: `High reps (${lastReps}) with moderate RPE (${lastRPE}). Time to increase load.`,
            confidence: 0.80,
            scientificBasis: 'Schoenfeld et al. (2017): Progressive overload is key for hypertrophy. When rep count exceeds 12 with RPE < 8, load should increase.',
          };
        }
        // MAINTAIN: Good progression
        else if (lastRPE >= 7.5 && lastRPE <= 9.0) {
          weightRecommendation = {
            type: 'maintain',
            suggestedWeight: lastWeight,
            currentWeight: lastWeight,
            reasoning: `RPE ${lastRPE} is in the optimal hypertrophy range (7.5-9.0).`,
            confidence: 0.90,
            scientificBasis: 'Helms et al. (2018): RPE 7.5-9.0 provides optimal stimulus-to-fatigue ratio for muscle growth.',
          };
        }
      }

      // Check for stagnation (no E1RM improvement in 4+ sessions)
      if (recentSessions.length >= 4 && !weightRecommendation) {
        const recent4 = recentSessions.slice(-4);
        const avgE1RM = recent4.reduce((sum, s) => sum + s.e1rm, 0) / 4;
        const first2Avg = recent4.slice(0, 2).reduce((sum, s) => sum + s.e1rm, 0) / 2;
        const last2Avg = recent4.slice(-2).reduce((sum, s) => sum + s.e1rm, 0) / 2;

        // If E1RM hasn't improved by at least 2% in last 4 sessions
        if (last2Avg < first2Avg * 1.02) {
          const increase = Math.max(5, Math.round(lastWeight * 0.025));
          weightRecommendation = {
            type: 'increase',
            suggestedWeight: lastWeight + increase,
            currentWeight: lastWeight,
            reasoning: `Plateau detected. E1RM hasn't improved in last 4 sessions.`,
            confidence: 0.70,
            scientificBasis: 'Progression principle: When adaptation stalls, a small load increase can provide new stimulus.',
          };
        }
      }
    }

    // If fatigue detected, override any increase recommendations
    if (fatigueAlert.shouldAlert && weightRecommendation?.type === 'increase') {
      weightRecommendation = null;
    }

    // Apply fatigue-based reduction if needed
    if (fatigueAlert.shouldAlert && lastWorkoutBestSet && lastWorkoutBestSet.actualWeight) {
      const adjustedWeight = calculateAdjustedWeight(lastWorkoutBestSet.actualWeight, fatigueAlert);
      weightRecommendation = {
        type: 'decrease',
        suggestedWeight: adjustedWeight,
        currentWeight: lastWorkoutBestSet.actualWeight,
        reasoning: fatigueAlert.reasoning,
        confidence: fatigueAlert.confidence,
        scientificBasis: fatigueAlert.scientificBasis,
      };
    }

    // 3. CHECK FOR PR OPPORTUNITY
    let prOpportunity: PROpportunity | null = null;

    const prs = storage.getPersonalRecords(upcomingExercise.id);
    if (prs && lastWorkoutBestSet && lastWorkoutBestSet.actualWeight && lastWorkoutBestSet.actualReps) {
      const maxWeight = prs.maxWeight.weight;
      const maxE1RM = prs.maxE1RM.e1rm;

      // Calculate current E1RM potential
      const currentWeight = lastWorkoutBestSet.actualWeight;
      const currentE1RM = currentWeight * (1 + lastWorkoutBestSet.actualReps / 30); // Epley formula

      // PR opportunity if within 5% of max
      if (currentWeight >= maxWeight * 0.95 && currentWeight < maxWeight) {
        prOpportunity = {
          isOpportunity: true,
          currentPR: maxWeight,
          targetWeight: maxWeight + 5, // Suggest 5lbs above current PR
          gap: maxWeight - currentWeight,
          type: 'max_weight',
        };
      } else if (currentE1RM >= maxE1RM * 0.95 && currentE1RM < maxE1RM) {
        prOpportunity = {
          isOpportunity: true,
          currentPR: maxE1RM,
          targetWeight: Math.round(maxE1RM * 0.90), // 90% of PR E1RM for 3-5 reps
          gap: maxE1RM - currentE1RM,
          type: 'max_e1rm',
        };
      }
    }

    const hasRecommendation = !!(
      (fatigueAlert && fatigueAlert.shouldAlert) ||
      (weightRecommendation && weightRecommendation.type !== 'maintain') ||
      (prOpportunity && prOpportunity.isOpportunity)
    );

    return {
      fatigueAlert: fatigueAlert.shouldAlert ? fatigueAlert : null,
      weightRecommendation,
      prOpportunity,
      hasRecommendation,
    };
  }, [completedSets, upcomingExercise, lastWorkoutBestSet]);

  return intelligence;
}
