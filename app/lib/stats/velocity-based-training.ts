/**
 * Velocity-Based Training (VBT) Module
 *
 * Implements research-validated velocity loss thresholds for fatigue detection.
 *
 * Key Research:
 * - González-Badillo & Sánchez-Medina (2010): Velocity loss = fatigue indicator
 * - Pareja-Blanco et al. (2017): 20% velocity loss optimal for hypertrophy
 * - Weakley et al. (2021): Individual velocity profiles for load prescription
 *
 * Methodology:
 * - Compare rep-to-rep velocity within a set (not set averages)
 * - Calculate velocity loss from fastest to slowest rep
 * - Use research-backed thresholds: <10% = low, 10-20% = moderate, >20% = high
 */

import { SetLog } from '../types';
import { calculateDescriptiveStats, detectTrend } from './statistical-utils';

// ============================================================
// INTERFACES
// ============================================================

export interface VelocityProfile {
  exerciseId: string;
  fastestRepDuration: number; // seconds
  slowestRepDuration: number; // seconds
  avgRepDuration: number;
  velocityLoss: number; // 0-1 (0% to 100%)
  velocityLossPercent: number; // 0-100
  fatigueClassification: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  repVelocities: number[]; // duration of each rep
  trend: 'stable' | 'gradual_slowdown' | 'sharp_decline';
  confidence: number;
}

export interface VBTAnalysis {
  hasFatigue: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'high' | 'critical';
  velocityLossPercent: number;
  recommendation: string;
  scientificBasis: string;
  confidence: number;
}

// ============================================================
// VELOCITY LOSS CALCULATION
// ============================================================

/**
 * Calculate velocity profile from set with rep-level timing data
 *
 * Proper implementation:
 * - Excludes first rep (often slower due to initial acceleration)
 * - Compares fastest rep to last rep (not averages)
 * - Uses duration as proxy for velocity (shorter = faster)
 *
 * Research basis:
 * González-Badillo & Sánchez-Medina (2010): Movement velocity as loading intensity measure
 */
export function calculateVelocityProfile(set: SetLog): VelocityProfile | null {
  // Need set duration and rep count to estimate per-rep velocity
  if (!set.setDurationSeconds || !set.actualReps || set.actualReps < 3) {
    return null;
  }

  // If we have rep-by-rep timing data (future enhancement)
  // For now, estimate based on total duration and fatigue patterns
  const repVelocities = estimateRepVelocities(
    set.setDurationSeconds,
    set.actualReps,
    set.formBreakdown || false,
    set.reachedFailure || false
  );

  // Exclude first rep (warm-up effect)
  const workingReps = repVelocities.slice(1);

  if (workingReps.length < 2) {
    return null;
  }

  const stats = calculateDescriptiveStats(workingReps);
  const fastestRepDuration = stats.min;
  const slowestRepDuration = stats.max;
  const avgRepDuration = stats.mean;

  // Velocity loss = (slowest - fastest) / fastest
  // Higher duration = lower velocity, so inversion makes sense
  const velocityLoss = (slowestRepDuration - fastestRepDuration) / fastestRepDuration;
  const velocityLossPercent = velocityLoss * 100;

  // Classify fatigue based on research thresholds
  let fatigueClassification: VelocityProfile['fatigueClassification'];
  if (velocityLossPercent < 10) {
    fatigueClassification = 'minimal';
  } else if (velocityLossPercent < 20) {
    fatigueClassification = 'low';
  } else if (velocityLossPercent < 30) {
    fatigueClassification = 'moderate';
  } else if (velocityLossPercent < 40) {
    fatigueClassification = 'high';
  } else {
    fatigueClassification = 'severe';
  }

  // Detect trend (gradual vs sharp decline)
  // Use robust regression if available for outlier-resistant trend detection
  let trendAnalysis;
  try {
    const { robustRegressionVelocity } = require('./advanced-methods');
    const robustResult = robustRegressionVelocity(workingReps);
    trendAnalysis = {
      slope: robustResult.slope,
      intercept: robustResult.intercept,
      rSquared: robustResult.rSquared,
      trend: robustResult.slope > 0.05 ? 'increasing' : robustResult.slope < -0.05 ? 'decreasing' : 'stable'
    };
  } catch (err) {
    // Fallback to standard linear regression
    trendAnalysis = detectTrend(workingReps);
  }

  let trend: VelocityProfile['trend'] = 'stable';
  if (trendAnalysis.trend === 'increasing') {
    // Duration increasing = velocity decreasing
    if (Math.abs(trendAnalysis.slope) > 0.2) {
      trend = 'sharp_decline';
    } else {
      trend = 'gradual_slowdown';
    }
  }

  // Confidence based on r-squared and sample size
  const confidence = Math.min(0.95, trendAnalysis.rSquared * (workingReps.length / 10));

  return {
    exerciseId: set.exerciseId,
    fastestRepDuration,
    slowestRepDuration,
    avgRepDuration,
    velocityLoss,
    velocityLossPercent,
    fatigueClassification,
    repVelocities,
    trend,
    confidence
  };
}

/**
 * Estimate rep-by-rep velocities from total set duration
 *
 * Model assumptions:
 * - First rep is often slower (acceleration phase)
 * - Velocity decreases exponentially with fatigue
 * - Form breakdown accelerates velocity loss
 * - Failure indicates complete velocity loss on last rep
 */
function estimateRepVelocities(
  totalDuration: number,
  repCount: number,
  formBreakdown: boolean,
  reachedFailure: boolean
): number[] {
  const avgDuration = totalDuration / repCount;
  const velocities: number[] = [];

  // First rep (slightly slower)
  velocities.push(avgDuration * 1.05);

  // Model fatigue accumulation
  const fatigueRate = formBreakdown ? 0.08 : 0.03; // Faster decline with form issues
  const failurePenalty = reachedFailure ? 0.5 : 0; // Last rep much slower if failed

  for (let i = 1; i < repCount; i++) {
    const fatigueFactor = 1 + (fatigueRate * i);
    const isLastRep = i === repCount - 1;
    const penalty = isLastRep ? failurePenalty : 0;

    velocities.push(avgDuration * fatigueFactor * (1 + penalty));
  }

  // Normalize to match total duration
  const estimatedTotal = velocities.reduce((a, b) => a + b, 0);
  const normalizationFactor = totalDuration / estimatedTotal;

  return velocities.map(v => v * normalizationFactor);
}

/**
 * Analyze multiple sets for velocity-based fatigue
 *
 * Looks for:
 * - Increasing velocity loss across sets (cumulative fatigue)
 * - Sets exceeding research-backed thresholds
 * - Declining performance trends
 */
export function analyzeVBTFatigue(sets: SetLog[]): VBTAnalysis {
  const profiles = sets
    .map(set => calculateVelocityProfile(set))
    .filter((p): p is VelocityProfile => p !== null);

  if (profiles.length === 0) {
    return {
      hasFatigue: false,
      severity: 'none',
      velocityLossPercent: 0,
      recommendation: 'Insufficient velocity data for analysis.',
      scientificBasis: '',
      confidence: 0
    };
  }

  // Calculate average velocity loss
  const avgVelocityLoss = profiles.reduce((sum, p) => sum + p.velocityLossPercent, 0) / profiles.length;

  // Count sets exceeding thresholds
  const setsExceeding20 = profiles.filter(p => p.velocityLossPercent > 20).length;
  const setsExceeding30 = profiles.filter(p => p.velocityLossPercent > 30).length;

  // Check for increasing trend (fatigue accumulation)
  const velocityLosses = profiles.map(p => p.velocityLossPercent);
  const trend = detectTrend(velocityLosses);
  const isIncreasingFatigue = trend.trend === 'increasing' && trend.slope > 2; // >2% increase per set

  // Determine severity
  let severity: VBTAnalysis['severity'] = 'none';
  let hasFatigue = false;

  if (setsExceeding30 >= 2 || avgVelocityLoss > 35) {
    severity = 'critical';
    hasFatigue = true;
  } else if (setsExceeding20 >= 3 || avgVelocityLoss > 25) {
    severity = 'high';
    hasFatigue = true;
  } else if (setsExceeding20 >= 2 || isIncreasingFatigue) {
    severity = 'moderate';
    hasFatigue = true;
  } else if (setsExceeding20 >= 1 || avgVelocityLoss > 15) {
    severity = 'mild';
    hasFatigue = true;
  }

  // Generate recommendation
  let recommendation = '';
  let scientificBasis = '';

  if (severity === 'critical') {
    recommendation = `Severe velocity loss detected (${avgVelocityLoss.toFixed(0)}% avg). Stop this exercise - CNS fatigue is compromising performance and injury risk is elevated.`;
    scientificBasis = 'Pareja-Blanco et al. (2017): Velocity losses >40% indicate excessive fatigue with diminishing returns and elevated injury risk.';
  } else if (severity === 'high') {
    recommendation = `High velocity loss (${avgVelocityLoss.toFixed(0)}% avg). Reduce load by 10-15% or stop exercise after this set.`;
    scientificBasis = 'González-Badillo & Sánchez-Medina (2010): Velocity loss >30% compromises training quality without additional hypertrophic benefit.';
  } else if (severity === 'moderate') {
    recommendation = `Moderate velocity loss (${avgVelocityLoss.toFixed(0)}% avg). Consider reducing reps by 2-3 or increasing rest to 3+ minutes.`;
    scientificBasis = 'Pareja-Blanco et al. (2017): 20-30% velocity loss optimal for hypertrophy, but monitor for further degradation.';
  } else if (severity === 'mild') {
    recommendation = `Mild velocity loss (${avgVelocityLoss.toFixed(0)}% avg). Performance is declining but still within optimal range.`;
    scientificBasis = 'Pareja-Blanco et al. (2017): <20% velocity loss maintains training quality and minimizes fatigue.';
  }

  // Confidence based on sample size and measurement quality
  const avgConfidence = profiles.reduce((sum, p) => sum + p.confidence, 0) / profiles.length;
  const sampleSizeConfidence = Math.min(1.0, profiles.length / 5);
  const confidence = (avgConfidence + sampleSizeConfidence) / 2;

  return {
    hasFatigue,
    severity,
    velocityLossPercent: avgVelocityLoss,
    recommendation,
    scientificBasis,
    confidence
  };
}

// ============================================================
// VELOCITY-BASED LOAD PRESCRIPTION
// ============================================================

/**
 * Individual velocity profile for load prescription
 *
 * Research: Weakley et al. (2021) - Individual velocity thresholds
 * predict 1RM better than population averages
 */
export interface IndividualVelocityProfile {
  userId: string;
  exerciseId: string;
  loadVelocityCurve: Array<{ load: number; avgVelocity: number }>; // kg/lbs → m/s proxy
  estimatedMaxVelocity: number; // Lightest load velocity
  estimatedMinVelocity: number; // Near-maximal load velocity
  lastUpdated: Date;
  confidence: number;
}

/**
 * Build individual velocity profile from historical data
 *
 * Future enhancement: Track actual velocities with video analysis or sensors
 */
export async function buildVelocityProfile(
  userId: string,
  exerciseId: string,
  historicalSets: SetLog[]
): Promise<IndividualVelocityProfile | null> {
  const setsWithDuration = historicalSets.filter(
    s => s.exerciseId === exerciseId && s.setDurationSeconds && s.actualReps && s.actualWeight
  );

  if (setsWithDuration.length < 10) {
    return null; // Need sufficient data
  }

  // Calculate average velocity (proxy) for each load
  const loadVelocityMap = new Map<number, number[]>();

  for (const set of setsWithDuration) {
    const weight = set.actualWeight!;
    const avgRepDuration = set.setDurationSeconds! / set.actualReps!;
    const velocityProxy = 1 / avgRepDuration; // Inverse duration as velocity proxy

    if (!loadVelocityMap.has(weight)) {
      loadVelocityMap.set(weight, []);
    }
    loadVelocityMap.get(weight)!.push(velocityProxy);
  }

  // Average velocities for each load
  const loadVelocityCurve = Array.from(loadVelocityMap.entries())
    .map(([load, velocities]) => ({
      load,
      avgVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length
    }))
    .sort((a, b) => a.load - b.load);

  if (loadVelocityCurve.length < 3) {
    return null; // Need multiple loads
  }

  const velocities = loadVelocityCurve.map(lv => lv.avgVelocity);
  const stats = calculateDescriptiveStats(velocities);

  return {
    userId,
    exerciseId,
    loadVelocityCurve,
    estimatedMaxVelocity: stats.max,
    estimatedMinVelocity: stats.min,
    lastUpdated: new Date(),
    confidence: Math.min(0.95, loadVelocityCurve.length / 10)
  };
}

/**
 * Suggest load based on target velocity zone
 *
 * Zones (research-based):
 * - Speed-Strength: >1.0 m/s (30-60% 1RM)
 * - Strength-Speed: 0.75-1.0 m/s (60-75% 1RM)
 * - Hypertrophy: 0.5-0.75 m/s (75-85% 1RM)
 * - Max Strength: <0.5 m/s (85-100% 1RM)
 */
export function suggestLoadForVelocity(
  profile: IndividualVelocityProfile,
  targetVelocity: number
): number | null {
  const { loadVelocityCurve } = profile;

  if (loadVelocityCurve.length < 2) return null;

  // Find closest loads
  let closestLower = loadVelocityCurve[0];
  let closestUpper = loadVelocityCurve[loadVelocityCurve.length - 1];

  for (let i = 0; i < loadVelocityCurve.length - 1; i++) {
    const current = loadVelocityCurve[i];
    const next = loadVelocityCurve[i + 1];

    if (current.avgVelocity >= targetVelocity && next.avgVelocity <= targetVelocity) {
      closestLower = current;
      closestUpper = next;
      break;
    }
  }

  // Linear interpolation
  const velocityRange = closestLower.avgVelocity - closestUpper.avgVelocity;
  if (velocityRange === 0) return closestLower.load;

  const velocityDiff = closestLower.avgVelocity - targetVelocity;
  const loadRange = closestUpper.load - closestLower.load;

  const suggestedLoad = closestLower.load + (velocityDiff / velocityRange) * loadRange;

  return Math.round(suggestedLoad);
}
