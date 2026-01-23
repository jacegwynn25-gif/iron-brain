/**
 * Bayesian Calibration Layer
 *
 * Learns user-specific recovery parameters by updating population priors
 * with individual observed data using Bayesian inference.
 *
 * Key Concept: Start with research-backed population defaults, then
 * continuously refine estimates as user accumulates training history.
 *
 * Example:
 * - Population: Quads recover in 72h (half-life)
 * - User observation: This user's quads consistently recover in 60h
 * - Calibrated: Update user's quad half-life to 60h (faster than average)
 *
 * Research Foundation:
 * - Gelman & Hill (2006): Hierarchical Bayesian modeling
 * - Kruschke (2014): Doing Bayesian Data Analysis
 * - McElreath (2020): Statistical Rethinking
 */

import { MUSCLE_RECOVERY_CONSTANTS } from './muscle-architecture';
import { EXERCISE_PATTERNS } from './exercise-patterns';

/**
 * User-Specific Recovery Parameter
 *
 * Stores both population prior and user-specific posterior
 */
export interface UserRecoveryParameter {
  parameterName: string;
  populationMean: number; // Population-level default
  populationStdDev: number; // Population variance
  userMean: number; // User-specific estimate
  userStdDev: number; // User-specific uncertainty
  observationCount: number; // Number of observations used to estimate
  lastUpdated: Date;
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Recovery Observation - Actual vs Predicted
 *
 * Used to update user-specific parameters
 */
export interface RecoveryObservation {
  timestamp: Date;
  parameterName: string; // e.g., "Quads_halfLife", "Barbell Back Squat_halfLife"
  predictedValue: number; // What the model predicted
  observedValue: number; // What actually happened
  confidence: number; // 0-1 (how confident are we in this observation?)
}

/**
 * Initialize user-specific parameter from population prior
 *
 * @param parameterName - Name of parameter
 * @param populationMean - Population-level mean
 * @param populationStdDev - Population-level standard deviation
 * @returns Initial user parameter (starts at population prior)
 */
export function initializeUserParameter(
  parameterName: string,
  populationMean: number,
  populationStdDev: number
): UserRecoveryParameter {
  return {
    parameterName,
    populationMean,
    populationStdDev,
    userMean: populationMean, // Start at population mean
    userStdDev: populationStdDev, // Start with population uncertainty
    observationCount: 0,
    lastUpdated: new Date(),
    confidenceLevel: 'very_low'
  };
}

/**
 * Update user parameter using Bayesian updating
 *
 * Formula (conjugate normal-normal):
 * posterior_mean = (prior_precision × prior_mean + data_precision × data_mean) / (prior_precision + data_precision)
 * posterior_precision = prior_precision + data_precision
 *
 * Where precision = 1 / variance = 1 / (stdDev^2)
 *
 * @param currentParameter - Current user parameter
 * @param observation - New observation
 * @returns Updated user parameter
 */
export function updateUserParameter(
  currentParameter: UserRecoveryParameter,
  observation: RecoveryObservation
): UserRecoveryParameter {
  // Prior (current user estimate)
  const priorMean = currentParameter.userMean;
  const priorVariance = currentParameter.userStdDev ** 2;
  const priorPrecision = 1 / priorVariance;

  // Likelihood (new observation)
  const dataMean = observation.observedValue;
  // Data variance depends on confidence (high confidence = low variance)
  const dataVariance = currentParameter.populationStdDev ** 2 * (1 / Math.max(0.1, observation.confidence));
  const dataPrecision = 1 / dataVariance;

  // Posterior (updated estimate)
  const posteriorPrecision = priorPrecision + dataPrecision;
  const posteriorMean = (priorPrecision * priorMean + dataPrecision * dataMean) / posteriorPrecision;
  const posteriorVariance = 1 / posteriorPrecision;
  const posteriorStdDev = Math.sqrt(posteriorVariance);

  // Update observation count
  const observationCount = currentParameter.observationCount + 1;

  // Update confidence level based on observation count and variance
  let confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  const relativeUncertainty = posteriorStdDev / posteriorMean;
  if (observationCount >= 20 && relativeUncertainty < 0.15) {
    confidenceLevel = 'very_high';
  } else if (observationCount >= 10 && relativeUncertainty < 0.25) {
    confidenceLevel = 'high';
  } else if (observationCount >= 5 && relativeUncertainty < 0.35) {
    confidenceLevel = 'medium';
  } else if (observationCount >= 2) {
    confidenceLevel = 'low';
  } else {
    confidenceLevel = 'very_low';
  }

  return {
    ...currentParameter,
    userMean: posteriorMean,
    userStdDev: posteriorStdDev,
    observationCount,
    lastUpdated: new Date(),
    confidenceLevel
  };
}

/**
 * Calculate shrinkage factor (how much to trust user data vs population)
 *
 * With few observations: Trust population more (shrinkage → 1)
 * With many observations: Trust user data more (shrinkage → 0)
 *
 * @param observationCount - Number of observations
 * @returns Shrinkage factor (0-1)
 */
export function calculateShrinkageFactor(observationCount: number): number {
  // Exponential decay: shrink = e^(-k × n)
  // With k = 0.2, we get:
  // - n=0: shrink = 1.0 (100% population prior)
  // - n=5: shrink = 0.37 (37% population, 63% user)
  // - n=10: shrink = 0.14 (14% population, 86% user)
  // - n=20: shrink = 0.02 (2% population, 98% user)

  const k = 0.2;
  return Math.exp(-k * observationCount);
}

/**
 * Get calibrated half-life for a muscle
 *
 * Returns user-specific half-life if available, otherwise population default
 *
 * @param muscleName - Name of muscle
 * @param userParameters - User's calibrated parameters
 * @returns Calibrated half-life in hours
 */
export function getCalibratedMuscleHalfLife(
  muscleName: string,
  userParameters: Map<string, UserRecoveryParameter>
): {
  halfLife: number;
  confidence: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  source: 'population' | 'user_calibrated';
} {
  const parameterName = `${muscleName}_halfLife`;
  const userParam = userParameters.get(parameterName);

  const muscleData = MUSCLE_RECOVERY_CONSTANTS[muscleName];
  if (!muscleData) {
    return {
      halfLife: 48, // Default fallback
      confidence: 'very_low',
      source: 'population'
    };
  }

  if (!userParam || userParam.observationCount === 0) {
    return {
      halfLife: muscleData.halfLife,
      confidence: 'very_low',
      source: 'population'
    };
  }

  return {
    halfLife: userParam.userMean,
    confidence: userParam.confidenceLevel,
    source: 'user_calibrated'
  };
}

/**
 * Get calibrated half-life for an exercise
 *
 * @param exerciseName - Name of exercise
 * @param userParameters - User's calibrated parameters
 * @returns Calibrated half-life in hours
 */
export function getCalibratedExerciseHalfLife(
  exerciseName: string,
  userParameters: Map<string, UserRecoveryParameter>
): {
  halfLife: number;
  confidence: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  source: 'population' | 'user_calibrated';
} {
  const parameterName = `${exerciseName}_halfLife`;
  const userParam = userParameters.get(parameterName);

  const exerciseData = EXERCISE_PATTERNS[exerciseName];
  if (!exerciseData) {
    return {
      halfLife: 48, // Default fallback
      confidence: 'very_low',
      source: 'population'
    };
  }

  if (!userParam || userParam.observationCount === 0) {
    return {
      halfLife: exerciseData.halfLife,
      confidence: 'very_low',
      source: 'population'
    };
  }

  return {
    halfLife: userParam.userMean,
    confidence: userParam.confidenceLevel,
    source: 'user_calibrated'
  };
}

/**
 * Infer recovery observation from subjective readiness rating
 *
 * User reports: "I feel 80% recovered" 48 hours after quads workout
 * System can use this to calibrate quad half-life
 *
 * @param muscleName - Muscle being assessed
 * @param hoursSinceTraining - Hours since last trained
 * @param subjectiveRecovery - User's subjective recovery (0-100%)
 * @param initialFatigue - How fatigued they were after workout
 * @returns Recovery observation
 */
export function inferRecoveryFromSubjectiveRating(
  muscleName: string,
  hoursSinceTraining: number,
  subjectiveRecovery: number,
  initialFatigue: number
): RecoveryObservation {
  // Solve for observed half-life from exponential decay
  // Recovery = (1 - e^(-kt)) × 100
  // Where k = ln(2) / half_life
  //
  // Rearrange to solve for half_life:
  // half_life = -ln(2) × t / ln(1 - recovery/100)

  const recoveryFraction = subjectiveRecovery / 100;
  const observedHalfLife = -Math.LN2 * hoursSinceTraining / Math.log(Math.max(0.01, 1 - recoveryFraction));

  // Confidence based on how long they've been tracking
  // Early ratings are less reliable (user doesn't know their scale yet)
  const confidence = 0.7; // Default moderate confidence

  return {
    timestamp: new Date(),
    parameterName: `${muscleName}_halfLife`,
    predictedValue: MUSCLE_RECOVERY_CONSTANTS[muscleName]?.halfLife ?? 48,
    observedValue: observedHalfLife,
    confidence
  };
}

/**
 * Infer recovery observation from performance metrics
 *
 * Example: User hits same weight/reps as last session
 * → Implies fully recovered (100%)
 *
 * Example: User can only hit 80% of last session's volume
 * → Implies only 80% recovered
 *
 * @param exerciseName - Exercise being performed
 * @param hoursSinceLastPerformed - Hours since this exercise was last done
 * @param volumeRatio - Current volume / previous session volume (0-1+)
 * @returns Recovery observation
 */
export function inferRecoveryFromPerformance(
  exerciseName: string,
  hoursSinceLastPerformed: number,
  volumeRatio: number
): RecoveryObservation {
  // Volume ratio maps to recovery percentage
  // 1.0+ = fully recovered (100%)
  // 0.9 = 90% recovered
  // 0.8 = 80% recovered (underre covered)

  const recoveryPercentage = Math.min(100, volumeRatio * 100);
  const recoveryFraction = recoveryPercentage / 100;

  // Solve for observed half-life
  const observedHalfLife = -Math.LN2 * hoursSinceLastPerformed / Math.log(Math.max(0.01, 1 - recoveryFraction));

  // Performance-based observations are more reliable than subjective
  const confidence = 0.85;

  const exerciseData = EXERCISE_PATTERNS[exerciseName];
  const predictedHalfLife = exerciseData?.halfLife ?? 48;

  return {
    timestamp: new Date(),
    parameterName: `${exerciseName}_halfLife`,
    predictedValue: predictedHalfLife,
    observedValue: observedHalfLife,
    confidence
  };
}

/**
 * Batch update user parameters from multiple observations
 *
 * @param currentParameters - Current user parameters
 * @param observations - Array of observations
 * @returns Updated parameters map
 */
export function batchUpdateParameters(
  currentParameters: Map<string, UserRecoveryParameter>,
  observations: RecoveryObservation[]
): Map<string, UserRecoveryParameter> {
  const updatedParameters = new Map(currentParameters);

  for (const observation of observations) {
    const currentParam = updatedParameters.get(observation.parameterName);

    if (!currentParam) {
      // Initialize new parameter if doesn't exist
      // Infer population stats from parameter name
      let populationMean = 48; // Default
      let populationStdDev = 12;

      // Try to extract from muscle/exercise data
      if (observation.parameterName.includes('_halfLife')) {
        const entityName = observation.parameterName.replace('_halfLife', '');

        const muscleData = MUSCLE_RECOVERY_CONSTANTS[entityName];
        if (muscleData) {
          populationMean = muscleData.halfLife;
          populationStdDev = muscleData.halfLife * 0.25; // 25% coefficient of variation
        }

        const exerciseData = EXERCISE_PATTERNS[entityName];
        if (exerciseData) {
          populationMean = exerciseData.halfLife;
          populationStdDev = exerciseData.halfLife * 0.25;
        }
      }

      const newParam = initializeUserParameter(
        observation.parameterName,
        populationMean,
        populationStdDev
      );
      updatedParameters.set(observation.parameterName, newParam);
    }

    const paramToUpdate = updatedParameters.get(observation.parameterName)!;
    const updatedParam = updateUserParameter(paramToUpdate, observation);
    updatedParameters.set(observation.parameterName, updatedParam);
  }

  return updatedParameters;
}

/**
 * Get calibration summary for user
 *
 * Shows which parameters have been calibrated and how confident we are
 *
 * @param userParameters - User's calibrated parameters
 * @returns Summary of calibration status
 */
export function getCalibrationSummary(
  userParameters: Map<string, UserRecoveryParameter>
): {
  totalParameters: number;
  calibratedParameters: number;
  averageConfidence: number;
  mostCalibratedParameters: UserRecoveryParameter[];
  leastCalibratedParameters: UserRecoveryParameter[];
} {
  const allParams = Array.from(userParameters.values());
  const calibratedParams = allParams.filter(p => p.observationCount > 0);

  const confidenceScores: number[] = calibratedParams.map(p => {
    switch (p.confidenceLevel) {
      case 'very_high': return 5;
      case 'high': return 4;
      case 'medium': return 3;
      case 'low': return 2;
      case 'very_low': return 1;
      default: return 0;
    }
  });

  const averageConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((sum: number, s: number) => sum + s, 0) / confidenceScores.length
    : 0;

  const sortedByObservations = [...allParams].sort((a, b) => b.observationCount - a.observationCount);

  return {
    totalParameters: allParams.length,
    calibratedParameters: calibratedParams.length,
    averageConfidence,
    mostCalibratedParameters: sortedByObservations.slice(0, 5),
    leastCalibratedParameters: sortedByObservations.slice(-5).reverse()
  };
}

/**
 * Detect anomalies in user observations
 *
 * Flags observations that are extremely far from population mean
 * (possible data entry errors or true outliers)
 *
 * @param observation - Observation to check
 * @param userParameter - Current user parameter
 * @returns Whether observation is anomalous
 */
export function detectAnomalousObservation(
  observation: RecoveryObservation,
  userParameter: UserRecoveryParameter
): {
  isAnomalous: boolean;
  zScore: number;
  message: string;
} {
  // Calculate z-score (how many standard deviations from mean)
  const zScore = Math.abs(observation.observedValue - userParameter.populationMean) / userParameter.populationStdDev;

  // Flag if >3 standard deviations from population mean
  const isAnomalous = zScore > 3;

  let message = '';
  if (isAnomalous) {
    message = `Observation (${observation.observedValue.toFixed(1)}) is ${zScore.toFixed(1)} std devs from population mean (${userParameter.populationMean.toFixed(1)}). Possible data error or true outlier.`;
  }

  return {
    isAnomalous,
    zScore,
    message
  };
}
