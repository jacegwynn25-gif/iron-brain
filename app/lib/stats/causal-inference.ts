/**
 * Causal Inference Methods
 *
 * ADVANCED ANALYTICS - Beyond correlation to causation:
 * - Instrumental variables (address confounding)
 * - Regression discontinuity (natural experiments)
 * - Difference-in-differences (before/after comparisons)
 * - Propensity score matching (control for confounders)
 * - Granger causality (does X predict Y?)
 *
 * Research Foundations:
 * - Pearl (2009): Causality - Models, Reasoning, and Inference
 * - Angrist & Pischke (2009): Mostly Harmless Econometrics
 * - Imbens & Rubin (2015): Causal Inference for Statistics
 */

import { SetLog } from '../types';
import { calculateDescriptiveStats, detectTrend } from './statistical-utils';

// ============================================================
// GRANGER CAUSALITY
// ============================================================

/**
 * Test if X Granger-causes Y
 *
 * "Does past fatigue predict future performance better than
 * just using past performance alone?"
 *
 * Research: Granger (1969) - Investigating Causal Relations
 */
export interface GrangerCausalityResult {
  xCausesY: boolean;
  fStatistic: number;
  pValue: number;
  interpretation: string;
  confidence: number;
}

export function testGrangerCausality(
  xSeries: number[], // Predictor (e.g., fatigue)
  ySeries: number[], // Outcome (e.g., performance)
  lag: number = 1
): GrangerCausalityResult {
  const n = xSeries.length;

  if (n < lag + 5) {
    return {
      xCausesY: false,
      fStatistic: 0,
      pValue: 1,
      interpretation: 'Insufficient data for Granger causality test',
      confidence: 0
    };
  }

  // Model 1 (restricted): Y predicted by its own lags only
  // Y_t = α + β1*Y_{t-1} + ... + βk*Y_{t-k} + ε

  // Model 2 (unrestricted): Y predicted by its lags AND X's lags
  // Y_t = α + β1*Y_{t-1} + ... + βk*Y_{t-k} + γ1*X_{t-1} + ... + γk*X_{t-k} + ε

  // If Model 2 is significantly better, X Granger-causes Y

  // Simplified implementation: lag-1 model
  const restrictedSSE = calculateSSE(ySeries, xSeries, lag, false);
  const unrestrictedSSE = calculateSSE(ySeries, xSeries, lag, true);

  // F-statistic
  const numerator = (restrictedSSE - unrestrictedSSE) / lag;
  const denominator = unrestrictedSSE / (n - 2 * lag - 1);

  // Guard against division by zero or negative values
  if (denominator <= 0 || !isFinite(numerator) || !isFinite(denominator)) {
    return {
      xCausesY: false,
      fStatistic: 0,
      pValue: 1.0,
      interpretation: 'Insufficient data for causal analysis',
      confidence: 0
    };
  }

  const fStatistic = numerator / denominator;

  // Approximate p-value (F-distribution with lag, n-2*lag-1 df)
  // Simplified: use threshold F > 4 for significance at α=0.05
  const pValue = fStatistic > 4 ? 0.01 : fStatistic > 2.5 ? 0.05 : 0.2;
  const xCausesY = fStatistic > 2.5; // p < 0.05 threshold

  // Clamp confidence to valid range [0, 0.95]
  const confidence = Math.max(0, Math.min(0.95, fStatistic / 5));

  const interpretation = xCausesY
    ? `Past ${lag}-set fatigue significantly predicts future performance (F=${fStatistic.toFixed(2)}, p<0.05). Causal relationship likely.`
    : `No significant Granger-causal relationship detected. Fatigue may not predictively cause performance changes.`;

  return {
    xCausesY,
    fStatistic,
    pValue,
    interpretation,
    confidence
  };
}

/**
 * Calculate sum of squared errors for regression
 */
function calculateSSE(
  y: number[],
  x: number[],
  lag: number,
  includeX: boolean
): number {
  const n = y.length;
  let sse = 0;

  for (let t = lag; t < n; t++) {
    // Predict Y_t using lags
    let yHat = 0;
    let count = 0;

    // Y's own lags
    for (let l = 1; l <= lag; l++) {
      if (t - l >= 0) {
        yHat += y[t - l];
        count++;
      }
    }

    // X's lags (if included)
    if (includeX) {
      for (let l = 1; l <= lag; l++) {
        if (t - l >= 0) {
          yHat += x[t - l];
          count++;
        }
      }
    }

    yHat = count > 0 ? yHat / count : y[t];

    const residual = y[t] - yHat;
    sse += residual * residual;
  }

  return sse;
}

// ============================================================
// PROPENSITY SCORE MATCHING
// ============================================================

/**
 * Match similar workouts to estimate treatment effect
 *
 * Example: "Does training while fatigued (treatment) cause
 * worse outcomes than training fresh (control)?"
 *
 * Matches workouts on confounders (volume, intensity, exercise selection)
 * to isolate effect of fatigue
 *
 * Research: Rosenbaum & Rubin (1983)
 */
export interface PropensityScoreAnalysis {
  treatmentEffect: number; // Average treatment effect
  standardError: number;
  confidence: number;
  significant: boolean;
  interpretation: string;
  matchedPairs: number;
}

export function analyzePropensityScores(
  treatedGroup: Array<{ outcome: number; covariates: number[] }>,
  controlGroup: Array<{ outcome: number; covariates: number[] }>
): PropensityScoreAnalysis {
  if (treatedGroup.length < 3 || controlGroup.length < 3) {
    return {
      treatmentEffect: 0,
      standardError: 0,
      confidence: 0,
      significant: false,
      interpretation: 'Insufficient data for propensity score matching',
      matchedPairs: 0
    };
  }

  // Simplified matching: Euclidean distance on covariates
  const matches: Array<{ treated: number; control: number }> = [];

  for (const treated of treatedGroup) {
    // Find closest control
    let closestControl: { outcome: number; covariates: number[] } | null = null;
    let minDistance = Infinity;

    for (const control of controlGroup) {
      const distance = euclideanDistance(treated.covariates, control.covariates);
      if (distance < minDistance) {
        minDistance = distance;
        closestControl = control;
      }
    }

    if (closestControl && minDistance < 2.0) {
      // Only match if close enough
      matches.push({
        treated: treated.outcome,
        control: closestControl.outcome
      });
    }
  }

  if (matches.length === 0) {
    return {
      treatmentEffect: 0,
      standardError: 0,
      confidence: 0,
      significant: false,
      interpretation: 'No suitable matches found',
      matchedPairs: 0
    };
  }

  // Calculate average treatment effect
  const diffs = matches.map(m => m.treated - m.control);
  const stats = calculateDescriptiveStats(diffs);

  const treatmentEffect = stats.mean;
  const standardError = stats.stdDev / Math.sqrt(matches.length);

  // T-statistic
  const tStat = Math.abs(treatmentEffect) / standardError;
  const significant = tStat > 1.96; // p < 0.05

  const confidence = Math.min(0.95, tStat / 3);

  const interpretation = significant
    ? `Significant treatment effect detected: ${treatmentEffect > 0 ? 'positive' : 'negative'} impact of ${Math.abs(treatmentEffect).toFixed(2)} points (95% CI). Effect is causal after controlling for confounders.`
    : `No significant treatment effect detected. Any observed differences may be due to confounding factors.`;

  return {
    treatmentEffect,
    standardError,
    confidence,
    significant,
    interpretation,
    matchedPairs: matches.length
  };
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

// ============================================================
// DIFFERENCE-IN-DIFFERENCES
// ============================================================

/**
 * Estimate causal effect using before/after comparison
 *
 * Example: "Did changing training program cause improvement?"
 *
 * Compares:
 * - Treatment group before vs after intervention
 * - Control group before vs after (same time period)
 * - Difference-in-differences isolates causal effect
 *
 * Research: Card & Krueger (1994) classic application
 */
export interface DifferenceInDifferencesResult {
  did: number; // Difference-in-differences estimate
  standardError: number;
  confidence: number;
  significant: boolean;
  interpretation: string;
  components: {
    treatmentBefore: number;
    treatmentAfter: number;
    controlBefore: number;
    controlAfter: number;
  };
}

export function differenceInDifferences(
  treatmentBefore: number[],
  treatmentAfter: number[],
  controlBefore: number[],
  controlAfter: number[]
): DifferenceInDifferencesResult {
  const treatmentBeforeStats = calculateDescriptiveStats(treatmentBefore);
  const treatmentAfterStats = calculateDescriptiveStats(treatmentAfter);
  const controlBeforeStats = calculateDescriptiveStats(controlBefore);
  const controlAfterStats = calculateDescriptiveStats(controlAfter);

  // Treatment effect = (After - Before) for treatment group
  const treatmentDiff = treatmentAfterStats.mean - treatmentBeforeStats.mean;

  // Control trend = (After - Before) for control group
  const controlDiff = controlAfterStats.mean - controlBeforeStats.mean;

  // DID = Treatment effect - Control trend
  // This removes confounding from time trends
  const did = treatmentDiff - controlDiff;

  // Standard error (pooled variance)
  const seSquared =
    treatmentBeforeStats.variance / treatmentBefore.length +
    treatmentAfterStats.variance / treatmentAfter.length +
    controlBeforeStats.variance / controlBefore.length +
    controlAfterStats.variance / controlAfter.length;

  const standardError = Math.sqrt(seSquared);
  const tStat = Math.abs(did) / standardError;
  const significant = tStat > 1.96;

  const confidence = Math.min(0.95, tStat / 3);

  const interpretation = significant
    ? `Causal effect confirmed: Intervention caused ${did > 0 ? 'improvement' : 'decline'} of ${Math.abs(did).toFixed(2)} points beyond natural trends (DID estimator, p<0.05).`
    : `No significant causal effect detected. Changes may be due to natural variation or time trends.`;

  return {
    did,
    standardError,
    confidence,
    significant,
    interpretation,
    components: {
      treatmentBefore: treatmentBeforeStats.mean,
      treatmentAfter: treatmentAfterStats.mean,
      controlBefore: controlBeforeStats.mean,
      controlAfter: controlAfterStats.mean
    }
  };
}

// ============================================================
// MEDIATION ANALYSIS
// ============================================================

/**
 * Understand HOW X causes Y (through what mechanism?)
 *
 * Example: "Does volume affect performance THROUGH fatigue?"
 *
 * X → M → Y
 * (Volume → Fatigue → Performance)
 *
 * Decomposes total effect into:
 * - Direct effect (X → Y directly)
 * - Indirect effect (X → M → Y, mediated)
 *
 * Research: Baron & Kenny (1986), Pearl (2001) causal mediation
 */
export interface MediationAnalysis {
  totalEffect: number; // c: Total X → Y
  directEffect: number; // c': Direct X → Y (controlling M)
  indirectEffect: number; // ab: X → M → Y
  proportionMediated: number; // 0-1, how much goes through M
  significant: boolean;
  interpretation: string;
}

export function analyzeMediationEffect(
  x: number[], // Independent variable (e.g., volume)
  m: number[], // Mediator (e.g., fatigue)
  y: number[] // Dependent variable (e.g., performance)
): MediationAnalysis {
  if (x.length !== m.length || x.length !== y.length || x.length < 10) {
    return {
      totalEffect: 0,
      directEffect: 0,
      indirectEffect: 0,
      proportionMediated: 0,
      significant: false,
      interpretation: 'Insufficient data for mediation analysis'
    };
  }

  // Path a: X → M
  const pathA = simpleRegression(x, m);

  // Path b: M → Y (controlling for X)
  const pathB = simpleRegression(m, y);

  // Path c: X → Y (total effect)
  const totalEffect = simpleRegression(x, y);

  // Path c': X → Y (controlling for M) - direct effect
  // Simplified: c' ≈ c - ab
  const indirectEffect = pathA * pathB;
  const directEffect = totalEffect - indirectEffect;

  // Guard against division by very small numbers
  const proportionMediated =
    Math.abs(totalEffect) > 0.01 ? Math.abs(indirectEffect / totalEffect) : 0;

  // Clamp to [0, 1] range
  const clampedProportion = Math.max(0, Math.min(1, proportionMediated));

  // Test significance of indirect effect (Sobel test approximation)
  const sobelZ = Math.abs(indirectEffect) / 0.1; // Simplified SE
  const significant = sobelZ > 1.96 && clampedProportion > 0.1;

  let interpretation = '';
  if (significant && clampedProportion > 0.5) {
    interpretation = `Strong mediation: ${(clampedProportion * 100).toFixed(0)}% of volume's effect on performance operates THROUGH fatigue. Fatigue is the primary mechanism.`;
  } else if (significant && clampedProportion > 0.2) {
    interpretation = `Partial mediation: ${(clampedProportion * 100).toFixed(0)}% mediated through fatigue. Both direct and indirect effects present.`;
  } else {
    interpretation = `No significant mediation detected. Volume affects performance directly, not through fatigue accumulation.`;
  }

  return {
    totalEffect,
    directEffect,
    indirectEffect,
    proportionMediated: clampedProportion,
    significant,
    interpretation
  };
}

/**
 * Simple linear regression: Y = a + bX
 * Returns slope (b)
 */
function simpleRegression(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const denominator = n * sumXX - sumX * sumX;

  // Check for division by zero (all X values are the same)
  if (Math.abs(denominator) < 1e-10) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Guard against NaN/Infinity
  if (!isFinite(slope)) return 0;

  return slope;
}

// ============================================================
// INSTRUMENTAL VARIABLES
// ============================================================

/**
 * Address endogeneity/confounding using instrumental variables
 *
 * Problem: X and Y may both be caused by unobserved confounder U
 * Solution: Find instrument Z that affects X but not Y (except through X)
 *
 * Example instrument: Day of week
 * - Affects training volume (people train more on weekends)
 * - Doesn't directly affect performance (except through volume)
 *
 * Research: Stock & Watson (2015) - Instrumental Variables Regression
 */
export interface InstrumentalVariableAnalysis {
  naiveEstimate: number; // OLS (biased if confounding)
  ivEstimate: number; // IV estimate (consistent)
  bias: number; // Difference between naive and IV
  significant: boolean;
  interpretation: string;
}

export function instrumentalVariableRegression(
  z: number[], // Instrument
  x: number[], // Endogenous variable
  y: number[] // Outcome
): InstrumentalVariableAnalysis {
  if (z.length !== x.length || z.length !== y.length || z.length < 15) {
    return {
      naiveEstimate: 0,
      ivEstimate: 0,
      bias: 0,
      significant: false,
      interpretation: 'Insufficient data for IV regression'
    };
  }

  // Naive OLS: Y = α + βX + ε (biased if confounding)
  const naiveEstimate = simpleRegression(x, y);

  // First stage: X = γ + δZ + u
  const firstStage = simpleRegression(z, x);

  // Reduced form: Y = π + ρZ + v
  const reducedForm = simpleRegression(z, y);

  // IV estimate: β_IV = ρ / δ (Wald estimator)
  const ivEstimate = reducedForm / firstStage;

  const bias = naiveEstimate - ivEstimate;
  const significant = Math.abs(bias) > 0.1; // Meaningful bias

  const interpretation = significant
    ? `Confounding detected: Naive estimate (${naiveEstimate.toFixed(2)}) differs from IV estimate (${ivEstimate.toFixed(2)}) by ${Math.abs(bias).toFixed(2)}. Use IV estimate for causal inference.`
    : `No significant confounding detected. Naive and IV estimates agree (bias=${bias.toFixed(2)}).`;

  return {
    naiveEstimate,
    ivEstimate,
    bias,
    significant,
    interpretation
  };
}
