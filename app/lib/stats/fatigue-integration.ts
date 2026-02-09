/**
 * Advanced Fatigue Integration Layer
 *
 * This module integrates PhD-level statistical methods into the fatigue detection system:
 * - Hierarchical Bayesian models for personalized fatigue prediction
 * - Change point detection for identifying critical fatigue moments
 * - Sequential Bayesian updating for real-time adaptation
 *
 * PURPOSE: Bridge between advanced statistical modules and production fatigue system
 */

import { SetLog } from '../types';
import {
  buildHierarchicalFatigueModel,
  predictFatigueNextSet,
  type HierarchicalFatigueModel,
  type FatiguePrediction
} from './hierarchical-models';
import {
  detectChangePoints,
  type ChangePoint
} from './advanced-methods';

// ============================================================
// HIERARCHICAL FATIGUE PREDICTION SYSTEM
// ============================================================

/**
 * Enhanced fatigue assessment using hierarchical Bayesian models
 *
 * IMPROVEMENT OVER BASIC SYSTEM:
 * - Learns user's personal fatigue resistance (not one-size-fits-all)
 * - Tracks exercise-specific fatigue rates (deadlifts vs curls)
 * - Provides confidence intervals on predictions
 * - Updates in real-time during workout (online learning)
 */
export interface EnhancedFatigueAssessment {
  // Current state
  currentFatigue: number; // 0-100
  fatigueLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';

  // Prediction for next set
  nextSetPrediction: FatiguePrediction;

  // User personalization
  userFatigueResistance: number; // 0-100, higher = more resistant
  exerciseSpecificRate: number; // Fatigue per set for THIS exercise

  // Statistical confidence
  confidence: number; // 0-1
  predictionInterval: { lower: number; upper: number };

  // Actionable insights
  recommendation: string;
  shouldStop: boolean;
  reasonsToStop: string[];

  // Change point detection
  criticalMoment?: {
    detected: boolean;
    setNumber: number;
    magnitude: number;
    interpretation: string;
  };
}

/**
 * Build or retrieve hierarchical model for user
 *
 * In production, this would load from database.
 * For now, builds from historical workout data.
 */
export function getOrBuildHierarchicalModel(
  userId: string,
  allWorkouts: Array<{
    date: Date;
    exercises: Array<{
      exerciseId: string;
      sets: SetLog[];
    }>;
  }>
): HierarchicalFatigueModel {
  // In Phase 3, this would do:
  // const cached = await db.hierarchicalModels.findOne({ userId });
  // if (cached && isFresh(cached)) return cached;

  const model = buildHierarchicalFatigueModel(userId, allWorkouts);

  // Would also save to database here
  // await db.hierarchicalModels.upsert({ userId }, model);

  return model;
}

/**
 * Main integration function: Assess fatigue with advanced methods
 *
 * USE THIS INSTEAD OF BASIC detectTrueFatigue when:
 * - User has ≥3 historical workouts (enough for personalization)
 * - Want confidence intervals on predictions
 * - Need to detect critical moments (change points)
 * - Want real-time updating during workout
 */
export function assessFatigueWithHierarchicalModel(
  currentExerciseId: string,
  completedSets: SetLog[],
  hierarchicalModel: HierarchicalFatigueModel
): EnhancedFatigueAssessment {
  const setsCompleted = completedSets.filter(s => s.completed).length;

  // 1. Get personalized prediction for next set
  const nextSetPrediction = predictFatigueNextSet(
    hierarchicalModel,
    currentExerciseId,
    setsCompleted
  );

  // 2. Calculate current fatigue state
  const currentFatigue = nextSetPrediction.expectedFatigue;

  // 3. Classify fatigue level
  let fatigueLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  if (currentFatigue >= 80) fatigueLevel = 'critical';
  else if (currentFatigue >= 60) fatigueLevel = 'high';
  else if (currentFatigue >= 40) fatigueLevel = 'moderate';
  else if (currentFatigue >= 20) fatigueLevel = 'low';
  else fatigueLevel = 'minimal';

  // 4. Detect change points (critical moments where fatigue suddenly spikes)
  let criticalMoment: EnhancedFatigueAssessment['criticalMoment'];
  if (completedSets.length >= 5) {
    const rpeValues = completedSets
      .filter(s => s.actualRPE !== null && s.actualRPE !== undefined)
      .map(s => s.actualRPE!);

    if (rpeValues.length >= 5) {
      const changePoints = detectChangePoints(rpeValues);

      if (changePoints.length > 0) {
        const latestChangePoint = changePoints[changePoints.length - 1];

        // Only flag if change point is recent (within last 2 sets)
        if (rpeValues.length - latestChangePoint.setIndex <= 2) {
          criticalMoment = {
            detected: true,
            setNumber: latestChangePoint.setIndex + 1,
            magnitude: latestChangePoint.magnitude,
            interpretation: interpretChangePoint(latestChangePoint)
          };
        }
      }
    }
  }

  // 5. Determine if user should stop
  const reasonsToStop: string[] = [];
  let shouldStop = false;

  if (currentFatigue >= 80) {
    reasonsToStop.push('Fatigue exceeds 80% - quality compromised');
    shouldStop = true;
  }

  if (criticalMoment?.detected && criticalMoment.magnitude > 2.0) {
    reasonsToStop.push(`Sudden fatigue spike detected at set ${criticalMoment.setNumber}`);
    shouldStop = true;
  }

  if (nextSetPrediction.predictionInterval.upper >= 95) {
    reasonsToStop.push('Upper confidence bound suggests extreme fatigue risk');
    shouldStop = true;
  }

  // Lower confidence bound check (even best-case scenario is too fatigued)
  if (nextSetPrediction.predictionInterval.lower >= 70) {
    reasonsToStop.push('Even optimistic estimate suggests high fatigue');
    shouldStop = true;
  }

  // 6. Extract personalization metrics
  const exerciseFactors = hierarchicalModel.exerciseSpecificFactors.get(currentExerciseId);
  const exerciseSpecificRate = exerciseFactors?.baselineFatigueRate || 0.15;

  return {
    currentFatigue,
    fatigueLevel,
    nextSetPrediction,
    userFatigueResistance: hierarchicalModel.userFatigueResistance,
    exerciseSpecificRate,
    confidence: nextSetPrediction.confidence,
    predictionInterval: nextSetPrediction.predictionInterval,
    recommendation: buildRecommendation(
      fatigueLevel,
      nextSetPrediction,
      criticalMoment,
      shouldStop
    ),
    shouldStop,
    reasonsToStop,
    criticalMoment
  };
}

// ============================================================
// CHANGE POINT INTERPRETATION
// ============================================================

function interpretChangePoint(cp: ChangePoint): string {
  if (cp.magnitude > 3.0) {
    return 'Severe fatigue spike - immediate rest recommended';
  } else if (cp.magnitude > 2.0) {
    return 'Significant fatigue increase detected - consider ending exercise';
  } else if (cp.magnitude > 1.0) {
    return 'Moderate fatigue shift - reduce load or increase rest';
  } else {
    return 'Minor fatigue fluctuation - monitor closely';
  }
}

// ============================================================
// RECOMMENDATION BUILDER
// ============================================================

function buildRecommendation(
  fatigueLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'critical',
  prediction: FatiguePrediction,
  criticalMoment?: EnhancedFatigueAssessment['criticalMoment'],
  shouldStop?: boolean
): string {
  if (shouldStop) {
    return `STOP: ${prediction.recommendation} ${criticalMoment?.detected ? 'Critical fatigue moment detected.' : ''}`;
  }

  switch (fatigueLevel) {
    case 'critical':
      return `Critical fatigue (${prediction.expectedFatigue.toFixed(0)}%). End exercise now to preserve quality.`;

    case 'high':
      return `High fatigue (${prediction.expectedFatigue.toFixed(0)}%). ${prediction.recommendation}`;

    case 'moderate':
      if (prediction.confidence < 0.7) {
        return `Moderate fatigue (${prediction.expectedFatigue.toFixed(0)}%), but prediction uncertain (${(prediction.confidence * 100).toFixed(0)}% confidence). Monitor how you feel.`;
      }
      return `Moderate fatigue (${prediction.expectedFatigue.toFixed(0)}%). Can continue but quality may decline.`;

    case 'low':
      return `Low fatigue (${prediction.expectedFatigue.toFixed(0)}%). Continue as planned.`;

    case 'minimal':
      return `Minimal fatigue (${prediction.expectedFatigue.toFixed(0)}%). Performing well.`;
  }
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Simple wrapper: Get enhanced assessment from current workout data
 *
 * Use this in production when you have historical data available
 */
export function getEnhancedFatigueAssessment(
  userId: string,
  currentExerciseId: string,
  completedSets: SetLog[],
  allHistoricalWorkouts: Array<{
    date: Date;
    exercises: Array<{ exerciseId: string; sets: SetLog[] }>;
  }>
): EnhancedFatigueAssessment {
  // Build/retrieve model
  const model = getOrBuildHierarchicalModel(userId, allHistoricalWorkouts);

  // Assess current state
  return assessFatigueWithHierarchicalModel(
    currentExerciseId,
    completedSets,
    model
  );
}

/**
 * Check if we have enough data for hierarchical modeling
 */
export function canUseHierarchicalModel(
  historicalWorkouts: Array<{ date: Date; exercises: Array<{ exerciseId: string; sets: SetLog[] }> }>
): boolean {
  // Need at least 3 workouts for meaningful personalization
  if (historicalWorkouts.length < 3) return false;

  // Need at least 30 total sets across all workouts
  const totalSets = historicalWorkouts.reduce((sum, workout) => {
    return sum + workout.exercises.reduce((exSum, ex) => {
      return exSum + ex.sets.length;
    }, 0);
  }, 0);

  return totalSets >= 30;
}
