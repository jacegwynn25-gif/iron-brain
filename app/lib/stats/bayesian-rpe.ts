/**
 * Bayesian RPE Calibration
 *
 * ⚠️ DEFERRED - NOT CURRENTLY IN USE ⚠️
 *
 * This implementation is well-designed but requires additional features before activation:
 * - Behavioral tracking UI (not currently implemented)
 * - RPE recording for every set (needs UI updates)
 * - Sufficient data collection period (minimum 30 days)
 *
 * Status: Keep for future V2 implementation
 * Ticket: #IRONBRAIN-V2-RPE-CALIBRATION
 *
 * ---
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
  bayesianWeightEstimate
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

// ============================================================
// BAYESIAN RPE CALIBRATION
// ============================================================

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
    return analyzeCurrentSessionOnly(currentBias, currentDeviations);
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
  deviations: number[]
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
