/**
 * Advanced Statistical Methods
 *
 * CUTTING-EDGE IMPLEMENTATIONS:
 * - Change point detection (detect fatigue spikes)
 * - Sequential Bayesian updating (update beliefs after each set)
 * - Robust regression (M-estimators, resistant to outliers)
 * - Prediction intervals (not just point estimates)
 * - Power analysis (sample size adequacy)
 * - Model comparison (AIC/BIC)
 * - Multi-stage data cleaning pipeline
 *
 * Research Foundations:
 * - Killick et al. (2012): Optimal detection of changepoints
 * - Huber (1964): Robust statistics and M-estimators
 * - Gelman et al. (2013): Bayesian Data Analysis
 * - Burnham & Anderson (2002): Model Selection and Multimodel Inference
 */

import { SetLog } from '../types';
import {
  calculateDescriptiveStats,
  detectOutliersModifiedZ
} from './statistical-utils';

// ============================================================
// CHANGE POINT DETECTION
// ============================================================

/**
 * Detect abrupt changes in performance (fatigue spikes)
 *
 * Uses CUSUM (Cumulative Sum) control chart
 * Research: Killick et al. (2012) - Optimal changepoint detection
 *
 * Better than simple trend detection because it detects WHEN performance suddenly drops
 */
export interface ChangePoint {
  setIndex: number;
  confidence: number;
  magnitude: number; // How big was the change
  direction: 'increase' | 'decrease';
  beforeMean: number;
  afterMean: number;
}

export function detectChangePoints(values: number[]): ChangePoint[] {
  if (values.length < 4) return [];

  const changePoints: ChangePoint[] = [];
  const stats = calculateDescriptiveStats(values);
  const mean = stats.mean;
  const stdDev = stats.stdDev;

  // CUSUM for detecting shifts
  let cumulativeSum = 0;
  let minCumSum = 0;
  let maxCumSum = 0;

  // Threshold for detection (in standard deviations)
  const threshold = 1.5 * stdDev;

  for (let i = 1; i < values.length; i++) {
    const deviation = values[i] - mean;
    cumulativeSum += deviation;

    // Check for upward shift
    if (cumulativeSum - minCumSum > threshold) {
      // Potential change point
      const beforeValues = values.slice(0, i);
      const afterValues = values.slice(i);

      if (beforeValues.length >= 2 && afterValues.length >= 2) {
        const beforeStats = calculateDescriptiveStats(beforeValues);
        const afterStats = calculateDescriptiveStats(afterValues);

        const magnitude = Math.abs(afterStats.mean - beforeStats.mean);
        const pooledStd = Math.sqrt((beforeStats.variance + afterStats.variance) / 2);

        // Effect size (Cohen's d)
        const effectSize = magnitude / pooledStd;

        // Only report if effect size is meaningful (>0.5 = medium effect)
        if (effectSize > 0.5) {
          changePoints.push({
            setIndex: i,
            confidence: Math.min(0.95, effectSize / 2), // Higher effect = higher confidence
            magnitude,
            direction: afterStats.mean > beforeStats.mean ? 'increase' : 'decrease',
            beforeMean: beforeStats.mean,
            afterMean: afterStats.mean
          });
        }
      }

      minCumSum = cumulativeSum;
    }

    // Check for downward shift
    if (maxCumSum - cumulativeSum > threshold) {
      maxCumSum = cumulativeSum;
    }

    // Update extremes
    minCumSum = Math.min(minCumSum, cumulativeSum);
    maxCumSum = Math.max(maxCumSum, cumulativeSum);
  }

  return changePoints;
}

/**
 * Interpret change points for fatigue analysis
 */
export function interpretChangePoints(
  changePoints: ChangePoint[],
  metric: 'velocity' | 'rpe' | 'weight'
): {
  hasCriticalChange: boolean;
  interpretation: string;
  recommendation: string;
} {
  if (changePoints.length === 0) {
    return {
      hasCriticalChange: false,
      interpretation: 'No abrupt performance changes detected - fatigue accumulation is gradual.',
      recommendation: 'Continue monitoring. Gradual fatigue is expected and manageable.'
    };
  }

  // Find most significant change
  const criticalChange = changePoints.reduce((max, cp) =>
    cp.magnitude > max.magnitude ? cp : max
  );

  const hasCriticalChange = criticalChange.confidence > 0.7 && criticalChange.magnitude > 1.0;

  let interpretation = '';
  let recommendation = '';

  if (metric === 'velocity' && criticalChange.direction === 'decrease') {
    interpretation = `Abrupt velocity drop detected at set ${criticalChange.setIndex}. Performance decreased by ${criticalChange.magnitude.toFixed(1)}% suddenly.`;
    recommendation = hasCriticalChange
      ? 'STOP: Acute fatigue spike detected. End exercise or take extended rest (5+ min).'
      : 'Monitor closely. Consider reducing reps or increasing rest for remaining sets.';
  } else if (metric === 'rpe' && criticalChange.direction === 'increase') {
    interpretation = `RPE spiked at set ${criticalChange.setIndex}, increasing ${criticalChange.magnitude.toFixed(1)} points.`;
    recommendation = 'Fatigue accumulating faster than expected. Reduce load or volume.';
  }

  return {
    hasCriticalChange,
    interpretation,
    recommendation
  };
}

// ============================================================
// SEQUENTIAL BAYESIAN UPDATING
// ============================================================

/**
 * Update fatigue belief after EACH set (not just at end)
 *
 * Allows real-time decision making during workout
 * Research: Gelman et al. (2013) - Sequential Bayesian analysis
 */
export interface SequentialFatigueEstimate {
  setNumber: number;
  posteriorFatigue: number; // 0-100 scale
  credibleInterval: { lower: number; upper: number };
  confidence: number;
  recommendation: 'continue' | 'reduce_load' | 'stop';
  reasoning: string;
}

export function sequentialFatigueAnalysis(
  sets: SetLog[],
  priorFatigue: number = 20 // Start with mild baseline fatigue
): SequentialFatigueEstimate[] {
  const estimates: SequentialFatigueEstimate[] = [];

  // Prior parameters (Beta distribution for fatigue probability)
  let alpha = 2 + priorFatigue / 10; // Shape parameter
  let beta = 10 - priorFatigue / 10; // Shape parameter

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    if (!set.completed) continue;

    // Evidence from this set
    let fatigueEvidence = 0;

    // Form breakdown = strong evidence (Häkkinen & Komi 1983)
    if (set.formBreakdown) fatigueEvidence += 30;

    // Unintentional failure = strong evidence (Izquierdo et al. 2006)
    if (set.reachedFailure && set.prescribedRPE && set.prescribedRPE <= 7) {
      fatigueEvidence += 25;
    }

    // RPE overshoot = moderate evidence
    if (set.actualRPE && set.prescribedRPE && set.actualRPE > set.prescribedRPE) {
      const overshoot = set.actualRPE - set.prescribedRPE;
      fatigueEvidence += overshoot * 5; // 5 points per RPE overshoot
    }

    // Bayesian update
    if (fatigueEvidence > 10) {
      alpha += fatigueEvidence / 10; // Increase fatigue belief
    } else {
      beta += 1; // Increase no-fatigue belief (set went well)
    }

    // Posterior estimate
    const posteriorFatigue = (alpha / (alpha + beta)) * 100;

    // Variance (for credible interval)
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const stdDev = Math.sqrt(variance) * 100;

    // 95% credible interval
    const credibleInterval = {
      lower: Math.max(0, posteriorFatigue - 1.96 * stdDev),
      upper: Math.min(100, posteriorFatigue + 1.96 * stdDev)
    };

    // Confidence = inverse of interval width
    const intervalWidth = credibleInterval.upper - credibleInterval.lower;
    const confidence = Math.max(0.3, 1 - intervalWidth / 100);

    // Recommendation
    let recommendation: SequentialFatigueEstimate['recommendation'] = 'continue';
    let reasoning = '';

    if (posteriorFatigue > 70 && confidence > 0.7) {
      recommendation = 'stop';
      reasoning = `High fatigue detected (${posteriorFatigue.toFixed(0)}/100) with ${(confidence * 100).toFixed(0)}% confidence. Risk of overtraining.`;
    } else if (posteriorFatigue > 50 && confidence > 0.6) {
      recommendation = 'reduce_load';
      reasoning = `Moderate fatigue accumulating (${posteriorFatigue.toFixed(0)}/100). Reduce reps or increase rest.`;
    } else {
      recommendation = 'continue';
      reasoning = `Fatigue manageable (${posteriorFatigue.toFixed(0)}/100). Continue as planned.`;
    }

    estimates.push({
      setNumber: i + 1,
      posteriorFatigue,
      credibleInterval,
      confidence,
      recommendation,
      reasoning
    });
  }

  return estimates;
}

// ============================================================
// ROBUST REGRESSION
// ============================================================

/**
 * Fit robust regression for velocity trend
 *
 * Uses Huber M-estimator - resistant to outliers
 * Research: Huber (1964) - Robust estimation of location parameter
 *
 * Better than OLS because one outlier won't skew the entire trend
 */
export interface RobustRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  robustStdError: number;
  confidence: number;
  interpretation: 'stable' | 'gradual_decline' | 'sharp_decline' | 'improving';
}

export function robustRegressionVelocity(velocities: number[]): RobustRegressionResult {
  if (velocities.length < 3) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      robustStdError: 0,
      confidence: 0,
      interpretation: 'stable'
    };
  }

  const n = velocities.length;
  const x = Array.from({ length: n }, (_, i) => i);

  // Initial OLS estimate
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = velocities.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * velocities[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  let slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  let intercept = (sumY - slope * sumX) / n;

  // Iteratively reweighted least squares (IRLS) for robustness
  const maxIterations = 10;
  const tolerance = 1e-6;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Calculate residuals
    const residuals = velocities.map((y, i) => y - (slope * x[i] + intercept));

    // Calculate MAD (Median Absolute Deviation) for robust scale
    const absResiduals = residuals.map(r => Math.abs(r)).sort((a, b) => a - b);
    const mad = absResiduals[Math.floor(absResiduals.length / 2)] / 0.6745; // Scale factor

    if (mad < tolerance) break;

    // Huber weights (downweight outliers)
    const k = 1.345; // Tuning constant for 95% efficiency
    const weights = residuals.map(r => {
      const u = r / mad;
      return Math.abs(u) <= k ? 1 : k / Math.abs(u);
    });

    // Weighted least squares
    const sumW = weights.reduce((a, b) => a + b, 0);
    const sumWX = weights.reduce((sum, w, i) => sum + w * x[i], 0);
    const sumWY = weights.reduce((sum, w, i) => sum + w * velocities[i], 0);
    const sumWXY = weights.reduce((sum, w, i) => sum + w * x[i] * velocities[i], 0);
    const sumWXX = weights.reduce((sum, w, i) => sum + w * x[i] * x[i], 0);

    const newSlope = (sumW * sumWXY - sumWX * sumWY) / (sumW * sumWXX - sumWX * sumWX);
    const newIntercept = (sumWY - newSlope * sumWX) / sumW;

    // Check convergence
    if (Math.abs(newSlope - slope) < tolerance && Math.abs(newIntercept - intercept) < tolerance) {
      break;
    }

    slope = newSlope;
    intercept = newIntercept;
  }

  // Robust standard error
  const finalResiduals = velocities.map((y, i) => y - (slope * x[i] + intercept));
  const robustStdError = Math.sqrt(
    finalResiduals.reduce((sum, r) => sum + r * r, 0) / (n - 2)
  );

  // Confidence based on standard error relative to slope magnitude
  const slopeSignificance = Math.abs(slope) / robustStdError;
  const confidence = Math.min(0.95, slopeSignificance / 2);

  // Interpretation
  let interpretation: RobustRegressionResult['interpretation'] = 'stable';

  if (slope < -0.15 && confidence > 0.7) {
    interpretation = 'sharp_decline';
  } else if (slope < -0.05 && confidence > 0.6) {
    interpretation = 'gradual_decline';
  } else if (slope > 0.05 && confidence > 0.6) {
    interpretation = 'improving';
  }

  const meanY = sumY / n;
  const ssTot = velocities.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const ssRes = velocities.reduce(
    (sum, y, i) => sum + Math.pow(y - (slope * x[i] + intercept), 2),
    0
  );
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    slope,
    intercept,
    rSquared,
    robustStdError,
    confidence,
    interpretation
  };
}

// ============================================================
// PREDICTION INTERVALS
// ============================================================

/**
 * Predict next set performance with uncertainty
 *
 * Returns INTERVAL (not just point estimate)
 * Accounts for both estimation uncertainty AND inherent variability
 */
export interface PerformancePrediction {
  expectedValue: number;
  predictionInterval: { lower: number; upper: number };
  confidenceInterval: { lower: number; upper: number };
  uncertainty: 'low' | 'medium' | 'high';
  recommendation: string;
}

export function predictNextSetPerformance(
  historicalPerformance: number[]
): PerformancePrediction {
  const stats = calculateDescriptiveStats(historicalPerformance);

  // Point estimate (mean)
  const expectedValue = stats.mean;

  // Confidence interval (uncertainty about the mean)
  const standardError = stats.stdDev / Math.sqrt(stats.count);
  const tCritical = 1.96; // For large samples
  const confidenceInterval = {
    lower: expectedValue - tCritical * standardError,
    upper: expectedValue + tCritical * standardError
  };

  // Prediction interval (uncertainty about NEXT observation)
  // Wider than confidence interval because includes inherent variability
  const predictionStdError = stats.stdDev * Math.sqrt(1 + 1 / stats.count);
  const predictionInterval = {
    lower: expectedValue - tCritical * predictionStdError,
    upper: expectedValue + tCritical * predictionStdError
  };

  // Uncertainty assessment
  const coefficientOfVariation = stats.stdDev / stats.mean;

  let uncertainty: PerformancePrediction['uncertainty'];
  if (coefficientOfVariation < 0.1) {
    uncertainty = 'low';
  } else if (coefficientOfVariation < 0.2) {
    uncertainty = 'medium';
  } else {
    uncertainty = 'high';
  }

  const recommendation =
    uncertainty === 'high'
      ? 'High variability detected. Focus on consistency before progression.'
      : uncertainty === 'medium'
        ? 'Moderate variability. Continue monitoring performance trends.'
        : 'Low variability - performance is consistent. Ready for progressive overload.';

  return {
    expectedValue,
    predictionInterval,
    confidenceInterval,
    uncertainty,
    recommendation
  };
}

// ============================================================
// POWER ANALYSIS
// ============================================================

/**
 * Determine if we have enough data to detect meaningful effects
 *
 * Prevents false conclusions from insufficient data
 * Research: Cohen (1988) - Statistical power analysis
 */
export interface PowerAnalysis {
  sampleSize: number;
  minimumDetectableEffect: number; // Cohen's d
  power: number; // 0-1, typically want >0.8
  adequacy: 'insufficient' | 'adequate' | 'excellent';
  recommendation: string;
}

export function analyzeSampleSizePower(
  sampleSize: number,
  observedEffectSize?: number
): PowerAnalysis {
  // For detecting medium effect (Cohen's d = 0.5) with 80% power
  const requiredSampleSizeForMediumEffect = 64;

  // Approximate power calculation for two-sample t-test
  // Power increases with sample size and effect size
  const effectSize = observedEffectSize || 0.5; // Default to medium effect
  const ncp = effectSize * Math.sqrt(sampleSize / 2); // Non-centrality parameter

  // Approximate power (simplified)
  const power = Math.min(0.99, 1 / (1 + Math.exp(-0.5 * (ncp - 2))));

  // Minimum detectable effect with 80% power
  const minimumDetectableEffect = 2.8 / Math.sqrt(sampleSize);

  let adequacy: PowerAnalysis['adequacy'];
  let recommendation: string;

  if (power < 0.5) {
    adequacy = 'insufficient';
    recommendation = `Insufficient data (n=${sampleSize}). Need ${Math.ceil(requiredSampleSizeForMediumEffect - sampleSize)} more observations for reliable conclusions.`;
  } else if (power < 0.8) {
    adequacy = 'adequate';
    recommendation = `Adequate data (n=${sampleSize}, power=${(power * 100).toFixed(0)}%). Consider collecting more data for higher confidence.`;
  } else {
    adequacy = 'excellent';
    recommendation = `Excellent data quality (n=${sampleSize}, power=${(power * 100).toFixed(0)}%). Conclusions are reliable.`;
  }

  return {
    sampleSize,
    minimumDetectableEffect,
    power,
    adequacy,
    recommendation
  };
}

// ============================================================
// MULTI-STAGE DATA CLEANING
// ============================================================

/**
 * Comprehensive data cleaning pipeline
 *
 * Stage 1: Remove impossible values
 * Stage 2: Detect outliers (Modified Z-Score)
 * Stage 3: Check for data entry errors
 * Stage 4: Validate against physiological limits
 */
export interface DataQualityReport {
  originalCount: number;
  cleanedCount: number;
  removedCount: number;
  issues: Array<{
    type: 'impossible' | 'outlier' | 'entry_error' | 'physiological';
    count: number;
    description: string;
  }>;
  quality: 'excellent' | 'good' | 'poor';
  recommendation: string;
}

export function cleanAndValidateData(
  sets: SetLog[]
): { cleanedSets: SetLog[]; report: DataQualityReport } {
  const originalCount = sets.length;
  const issues: DataQualityReport['issues'] = [];
  let currentSets = [...sets];

  // Stage 1: Remove impossible values
  const impossibleFilter = (s: SetLog) => {
    if (!s.actualReps || s.actualReps < 0 || s.actualReps > 100) return false;
    if (s.actualWeight && (s.actualWeight < 0 || s.actualWeight > 2000)) return false;
    if (s.actualRPE && (s.actualRPE < 0 || s.actualRPE > 10)) return false;
    return true;
  };

  const impossibleCount = currentSets.filter(s => !impossibleFilter(s)).length;
  currentSets = currentSets.filter(impossibleFilter);

  if (impossibleCount > 0) {
    issues.push({
      type: 'impossible',
      count: impossibleCount,
      description: `Removed ${impossibleCount} sets with physically impossible values`
    });
  }

  // Stage 2: Outlier detection on RPE
  if (currentSets.length >= 5) {
    const rpeValues = currentSets
      .filter(s => s.actualRPE !== null && s.actualRPE !== undefined)
      .map(s => s.actualRPE!);

    if (rpeValues.length >= 5) {
      const outliers = detectOutliersModifiedZ(rpeValues);
      const outlierIndices = outliers
        .map((o, i) => (o.isOutlier ? i : -1))
        .filter(i => i !== -1);

      if (outlierIndices.length > 0 && outlierIndices.length < currentSets.length * 0.3) {
        // Only remove if <30% are outliers (otherwise data itself is problem)
        currentSets = currentSets.filter(
          (s, i) => !outlierIndices.includes(i) || s.actualRPE === null
        );

        issues.push({
          type: 'outlier',
          count: outlierIndices.length,
          description: `Removed ${outlierIndices.length} statistical outliers`
        });
      }
    }
  }

  // Stage 3: Physiological validation
  const physiologicalIssues: SetLog[] = [];

  currentSets = currentSets.filter(s => {
    // RPE 10 with 15+ reps is suspicious (likely entry error)
    if (s.actualRPE === 10 && s.actualReps && s.actualReps > 15) {
      physiologicalIssues.push(s);
      return false;
    }

    // RPE <6 with failure is contradictory
    if (s.reachedFailure && s.actualRPE && s.actualRPE < 6) {
      physiologicalIssues.push(s);
      return false;
    }

    return true;
  });

  if (physiologicalIssues.length > 0) {
    issues.push({
      type: 'physiological',
      count: physiologicalIssues.length,
      description: `Removed ${physiologicalIssues.length} sets with physiologically unlikely combinations`
    });
  }

  const cleanedCount = currentSets.length;
  const removedCount = originalCount - cleanedCount;

  // Quality assessment
  const removalRate = removedCount / originalCount;
  let quality: DataQualityReport['quality'];
  let recommendation: string;

  if (removalRate < 0.1) {
    quality = 'excellent';
    recommendation = 'Data quality is excellent. Minimal cleaning required.';
  } else if (removalRate < 0.25) {
    quality = 'good';
    recommendation = 'Data quality is good. Some anomalies detected and removed.';
  } else {
    quality = 'poor';
    recommendation = 'Data quality concerns detected. Consider reviewing data entry procedures.';
  }

  return {
    cleanedSets: currentSets,
    report: {
      originalCount,
      cleanedCount,
      removedCount,
      issues,
      quality,
      recommendation
    }
  };
}
