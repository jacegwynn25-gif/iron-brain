/**
 * Bayesian RPE Calibration
 *
 * Proper statistical treatment of RPE-based load selection with uncertainty quantification.
 *
 * Research Foundations:
 * - Helms et al. (2016): Validated RPE scale for resistance training
 * - Zourdos et al. (2016): RPE-based load prescription
 * - Bayesian inference: Update beliefs about true ability given new evidence
 *
 * Key Improvements over naive approach:
 * 1. Accounts for measurement uncertainty (RPE is subjective)
 * 2. Learns individual patterns (some lifters conservative, others aggressive)
 * 3. Adapts to exercise-specific calibration
 * 4. Provides confidence intervals
 * 5. Handles small sample sizes gracefully
 */

import { SetLog } from '../types';
import {
  calculateDescriptiveStats,
  bayesianWeightEstimate,
  confidenceInterval,
  detectOutliersModifiedZ,
  ConfidenceInterval
} from './statistical-utils';

// ============================================================
// INTERFACES
// ============================================================

export interface RPECalibrationProfile {
  exerciseId: string;
  historicalBias: number; // Positive = tends to overshoot, negative = undershoot
  biasStdDev: number;
  sampleSize: number;
  lastUpdated: Date;
  confidence: number;
  credibleInterval: { lower: number; upper: number };
}

export interface BayesianRPEAnalysis {
  needsAdjustment: boolean;
  direction: 'increase' | 'decrease' | 'good';
  currentBias: number; // Current session's RPE deviation
  posteriorBias: number; // Updated belief after combining with history
  suggestedWeightChange: number; // Percentage change (-0.15 to +0.10)
  confidence: number;
  reasoning: string;
  scientificBasis: string;
  credibleInterval: { lower: number; upper: number };
}

export interface RPEAccuracyMetrics {
  meanAbsoluteError: number; // Average |actual - target| RPE
  rootMeanSquareError: number; // RMSE
  calibrationScore: number; // 0-100, higher = better calibrated
  consistency: number; // 0-100, higher = more consistent
  outlierRate: number; // 0-1, proportion of outliers
}

// ============================================================
// BAYESIAN RPE CALIBRATION
// ============================================================

/**
 * Build historical RPE calibration profile for an exercise
 *
 * @param historicalSets - Past sets for this exercise with RPE data
 * @returns Profile with bias estimate and confidence
 */
export function buildRPEProfile(historicalSets: SetLog[]): RPECalibrationProfile | null {
  const validSets = historicalSets.filter(
    s => s.prescribedRPE != null && s.actualRPE != null && s.completed
  );

  if (validSets.length < 3) {
    return null; // Need minimum data
  }

  // Calculate RPE deviations (actual - prescribed)
  const deviations = validSets.map(s => s.actualRPE! - s.prescribedRPE!);

  // Remove outliers (bad days, misrecorded data)
  const outlierAnalysis = detectOutliersModifiedZ(deviations);
  const cleanDeviations = deviations.filter((_, i) => !outlierAnalysis[i].isOutlier);

  if (cleanDeviations.length < 3) {
    // Too many outliers, use all data
    const stats = calculateDescriptiveStats(deviations);
    return {
      exerciseId: validSets[0].exerciseId,
      historicalBias: stats.mean,
      biasStdDev: stats.stdDev,
      sampleSize: deviations.length,
      lastUpdated: new Date(),
      confidence: Math.min(0.7, deviations.length / 20), // Low confidence due to noise
      credibleInterval: { lower: stats.mean - stats.stdDev, upper: stats.mean + stats.stdDev }
    };
  }

  const stats = calculateDescriptiveStats(cleanDeviations);
  const ci = confidenceInterval(cleanDeviations, 0.95);

  // Confidence increases with sample size and decreases with variance
  const sampleConfidence = Math.min(0.95, cleanDeviations.length / 15);
  const consistencyPenalty = Math.min(1.0, 1 / (1 + stats.stdDev));
  const confidence = sampleConfidence * consistencyPenalty;

  return {
    exerciseId: validSets[0].exerciseId,
    historicalBias: stats.mean,
    biasStdDev: stats.stdDev,
    sampleSize: cleanDeviations.length,
    lastUpdated: new Date(),
    confidence,
    credibleInterval: { lower: ci.lower, upper: ci.upper }
  };
}

/**
 * Analyze current session RPE with Bayesian updating
 *
 * Process:
 * 1. Calculate current session bias
 * 2. Retrieve historical prior (if exists)
 * 3. Update belief using Bayesian inference
 * 4. Determine if weight adjustment needed
 * 5. Provide confidence-weighted recommendation
 */
export function analyzeBayesianRPE(
  currentSets: SetLog[],
  historicalProfile: RPECalibrationProfile | null
): BayesianRPEAnalysis {
  const validSets = currentSets.filter(
    s => s.prescribedRPE != null && s.actualRPE != null && s.completed
  );

  if (validSets.length === 0) {
    return {
      needsAdjustment: false,
      direction: 'good',
      currentBias: 0,
      posteriorBias: 0,
      suggestedWeightChange: 0,
      confidence: 0,
      reasoning: 'Insufficient RPE data for calibration analysis.',
      scientificBasis: '',
      credibleInterval: { lower: 0, upper: 0 }
    };
  }

  // Current session bias
  const currentDeviations = validSets.map(s => s.actualRPE! - s.prescribedRPE!);
  const currentBias = currentDeviations.reduce((a, b) => a + b, 0) / currentDeviations.length;

  // If no historical data, use current session only
  if (!historicalProfile) {
    return analyzeCurrentSessionOnly(currentBias, currentDeviations, validSets[0].exerciseId);
  }

  // Bayesian update: Combine historical prior with current evidence
  const posterior = bayesianWeightEstimate(
    historicalProfile.historicalBias,
    historicalProfile.biasStdDev,
    historicalProfile.sampleSize,
    currentDeviations
  );

  const posteriorBias = posterior.posteriorMean;
  const confidence = posterior.confidence;

  // Decision threshold: Need consistent bias to recommend change
  // Require |bias| > 1.5 RPE points with high confidence
  const needsAdjustment = Math.abs(posteriorBias) > 1.5 && confidence > 0.65;

  let direction: BayesianRPEAnalysis['direction'] = 'good';
  let suggestedWeightChange = 0;
  let reasoning = '';
  let scientificBasis = '';

  if (needsAdjustment) {
    direction = posteriorBias > 0 ? 'decrease' : 'increase';

    // Weight change based on RPE deviation and confidence
    // Research: ~3-5% weight change ≈ 1 RPE point (Helms et al., 2016)
    const baseChange = posteriorBias * 0.04; // 4% per RPE point
    suggestedWeightChange = baseChange * confidence; // Scale by confidence

    // Cap changes at ±15%
    suggestedWeightChange = Math.max(-0.15, Math.min(0.10, suggestedWeightChange));

    if (direction === 'decrease') {
      reasoning = `Weight consistently too heavy. Posterior estimate: ${Math.abs(posteriorBias).toFixed(1)} RPE points above target. Based on ${historicalProfile.sampleSize + currentDeviations.length} total sets.`;
      scientificBasis = 'Helms et al. (2016): RPE-based auto-regulation - approximately 4% weight change per RPE point. Bayesian inference provides robust estimate accounting for uncertainty.';
    } else {
      reasoning = `Weight consistently too light. Posterior estimate: ${Math.abs(posteriorBias).toFixed(1)} RPE points below target. Based on ${historicalProfile.sampleSize + currentDeviations.length} total sets.`;
      scientificBasis = 'Zourdos et al. (2016): RPE-based progression requires training near target intensity. Bayesian analysis confirms systematic undershoot.';
    }
  } else {
    if (Math.abs(posteriorBias) <= 1.0) {
      reasoning = 'RPE calibration is accurate. Current bias within acceptable range (±1 RPE point).';
    } else {
      reasoning = `Bias detected (${posteriorBias.toFixed(1)} RPE points), but confidence too low (${(confidence * 100).toFixed(0)}%) to recommend change. Collect more data.`;
    }
    scientificBasis = 'Helms et al. (2016): RPE variability is normal. Only systematic bias requires adjustment.';
  }

  return {
    needsAdjustment,
    direction,
    currentBias,
    posteriorBias,
    suggestedWeightChange,
    confidence,
    reasoning,
    scientificBasis,
    credibleInterval: posterior.credibleInterval
  };
}

/**
 * Analyze current session only (no historical data)
 */
function analyzeCurrentSessionOnly(
  currentBias: number,
  deviations: number[],
  exerciseId: string
): BayesianRPEAnalysis {
  const stats = calculateDescriptiveStats(deviations);

  // Require strong evidence with no history: |bias| > 2 RPE and 3+ consistent sets
  const consistentSets = deviations.filter(d => Math.sign(d) === Math.sign(currentBias)).length;
  const needsAdjustment = Math.abs(currentBias) > 2.0 && consistentSets >= 3;

  const direction: BayesianRPEAnalysis['direction'] = currentBias > 0 ? 'decrease' : currentBias < -1.5 ? 'increase' : 'good';

  let suggestedWeightChange = 0;
  let reasoning = '';
  let confidence = 0;

  if (needsAdjustment) {
    // Conservative adjustment with limited data
    suggestedWeightChange = currentBias * 0.03; // 3% per RPE point (conservative)
    suggestedWeightChange = Math.max(-0.15, Math.min(0.10, suggestedWeightChange));

    confidence = Math.min(0.75, consistentSets / 5); // Max 75% confidence with no history

    reasoning = `${consistentSets} sets with consistent ${direction === 'decrease' ? 'overshoot' : 'undershoot'} (avg ${Math.abs(currentBias).toFixed(1)} RPE points). Limited historical data - using conservative adjustment.`;
  } else {
    reasoning = 'Insufficient data for confident recommendation. Need more sets or historical context.';
    confidence = 0.3;
  }

  return {
    needsAdjustment,
    direction,
    currentBias,
    posteriorBias: currentBias,
    suggestedWeightChange,
    confidence,
    reasoning,
    scientificBasis: 'Helms et al. (2016): RPE-based load prescription requires systematic patterns. Single-session data treated conservatively.',
    credibleInterval: { lower: currentBias - stats.stdDev, upper: currentBias + stats.stdDev }
  };
}

// ============================================================
// RPE ACCURACY METRICS
// ============================================================

/**
 * Calculate comprehensive RPE accuracy metrics
 * Useful for dashboard/analytics
 */
export function calculateRPEAccuracy(sets: SetLog[]): RPEAccuracyMetrics {
  const validSets = sets.filter(
    s => s.prescribedRPE != null && s.actualRPE != null && s.completed
  );

  if (validSets.length === 0) {
    return {
      meanAbsoluteError: 0,
      rootMeanSquareError: 0,
      calibrationScore: 50,
      consistency: 50,
      outlierRate: 0
    };
  }

  const deviations = validSets.map(s => s.actualRPE! - s.prescribedRPE!);
  const absoluteErrors = deviations.map(d => Math.abs(d));

  // MAE (Mean Absolute Error)
  const mae = absoluteErrors.reduce((a, b) => a + b, 0) / absoluteErrors.length;

  // RMSE (Root Mean Square Error) - penalizes large errors more
  const squaredErrors = deviations.map(d => d * d);
  const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length);

  // Calibration score: 100 = perfect, 0 = terrible
  // Based on MAE: 0 = 100, 3+ = 0
  const calibrationScore = Math.max(0, 100 * (1 - mae / 3));

  // Consistency: Lower stdDev = higher consistency
  const stats = calculateDescriptiveStats(deviations);
  const consistency = Math.max(0, 100 * (1 - stats.stdDev / 3));

  // Outlier rate
  const outliers = detectOutliersModifiedZ(deviations);
  const outlierRate = outliers.filter(o => o.isOutlier).length / outliers.length;

  return {
    meanAbsoluteError: mae,
    rootMeanSquareError: rmse,
    calibrationScore,
    consistency,
    outlierRate
  };
}

/**
 * Interpret RPE accuracy metrics for user feedback
 */
export function interpretRPEAccuracy(metrics: RPEAccuracyMetrics): {
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  feedback: string;
} {
  if (metrics.calibrationScore >= 85 && metrics.consistency >= 80) {
    return {
      rating: 'excellent',
      feedback: 'Your RPE accuracy is excellent! You have strong awareness of your exertion levels and consistent execution.'
    };
  }

  if (metrics.calibrationScore >= 70 && metrics.consistency >= 65) {
    return {
      rating: 'good',
      feedback: 'Good RPE accuracy. Minor deviations are normal and your calibration is solid.'
    };
  }

  if (metrics.calibrationScore >= 50 || metrics.consistency >= 50) {
    return {
      rating: 'fair',
      feedback: `Fair RPE accuracy (MAE: ${metrics.meanAbsoluteError.toFixed(1)}). Consider recording videos to review form and effort levels, or adjust your load selection.`
    };
  }

  return {
    rating: 'poor',
    feedback: `RPE calibration needs improvement (MAE: ${metrics.meanAbsoluteError.toFixed(1)}). Weights may be consistently too heavy or light. Review your RPE scale understanding and consider more conservative load selection.`
  };
}

// ============================================================
// EXERCISE-SPECIFIC LEARNING
// ============================================================

/**
 * Some exercises are harder to gauge RPE (e.g., leg exercises, new movements)
 * Track exercise-specific calibration difficulty
 */
export interface ExerciseRPEDifficulty {
  exerciseId: string;
  difficultyScore: number; // 0-100, higher = harder to calibrate
  recommendedLearningPeriod: number; // Sets needed to calibrate
  category: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
}

export function assessExerciseRPEDifficulty(
  exerciseId: string,
  historicalSets: SetLog[]
): ExerciseRPEDifficulty {
  const metrics = calculateRPEAccuracy(historicalSets);

  // Difficulty based on MAE and consistency
  const difficultyScore = 100 - (metrics.calibrationScore + metrics.consistency) / 2;

  let category: ExerciseRPEDifficulty['category'];
  let recommendedLearningPeriod: number;

  if (difficultyScore < 20) {
    category = 'easy';
    recommendedLearningPeriod = 8;
  } else if (difficultyScore < 40) {
    category = 'moderate';
    recommendedLearningPeriod = 12;
  } else if (difficultyScore < 60) {
    category = 'difficult';
    recommendedLearningPeriod = 20;
  } else {
    category = 'very_difficult';
    recommendedLearningPeriod = 30;
  }

  return {
    exerciseId,
    difficultyScore,
    recommendedLearningPeriod,
    category
  };
}
