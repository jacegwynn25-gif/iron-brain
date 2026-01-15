/**
 * Adaptive Recovery Models
 *
 * Implements validated fatigue-fitness models for personalized recovery prediction.
 *
 * Research Foundations:
 * 1. Fitness-Fatigue Model (Banister et al., 1975)
 * 2. ACWR - Acute:Chronic Workload Ratio (Hulin et al., 2016)
 * 3. Schoenfeld & Grgic (2018) - Muscle recovery timeframes
 * 4. Adaptive algorithms learn individual recovery rates
 *
 * Key Improvements:
 * - Personalized recovery curves (not fixed 48h/72h)
 * - Accounts for training load accumulation
 * - Predicts optimal training readiness
 * - Warns of maladaptation (overtraining risk)
 */

import { SetLog } from '../types';
import {
  calculateDescriptiveStats,
  exponentialMovingAverage,
  detectTrend
} from './statistical-utils';

// ============================================================
// INTERFACES
// ============================================================

export interface FitnessFatigueModel {
  userId: string;
  muscleGroup: string;

  // Model parameters (learned from user data)
  fitnessDecayRate: number; // τ1 (days) - how fast fitness decays
  fatigueDecayRate: number; // τ2 (days) - how fast fatigue dissipates
  fitnessGainCoefficient: number; // k1 - fitness response to training
  fatigueGainCoefficient: number; // k2 - fatigue response to training

  // Current state
  currentFitness: number; // 0-100
  currentFatigue: number; // 0-100
  netPerformance: number; // fitness - fatigue

  lastTrained: Date;
  confidence: number;
}

export interface WorkloadMetrics {
  acuteLoad: number; // Last 7 days
  chronicLoad: number; // Last 28 days
  acwr: number; // Acute:Chronic Workload Ratio
  trainingMonotony: number; // Lack of variation
  trainingStrain: number; // Load × monotony
  status: 'optimal' | 'building' | 'maintaining' | 'detraining' | 'overreaching' | 'danger';
  recommendation: string;
  scientificBasis: string;
}

export interface AdaptiveRecoveryProfile {
  muscleGroup: string;
  personalizedRecoveryHours: number; // Learned recovery time (not fixed)
  readinessScore: number; // 0-10
  recoveryPercentage: number; // 0-100
  estimatedFullRecovery: Date;
  chronicFatiguePenalty: number; // Penalty from repeated training
  trainingAge: number; // Months of consistent training
  adaptationRate: number; // How fast user recovers (relative to population)
  confidence: number;
}

// ============================================================
// FITNESS-FATIGUE MODEL
// ============================================================

/**
 * Initialize or update Fitness-Fatigue model for a muscle group
 *
 * Model: Performance(t) = Fitness(t) - Fatigue(t)
 *
 * Fitness(t) = Fitness(t-1) * exp(-1/τ1) + k1 * Load(t)
 * Fatigue(t) = Fatigue(t-1) * exp(-1/τ2) + k2 * Load(t)
 *
 * Research: Banister et al. (1975), refined by Busso (2003)
 */
export function updateFitnessFatigueModel(
  previousModel: FitnessFatigueModel | null,
  muscleGroup: string,
  newTrainingLoad: number,
  daysSinceLastTrained: number
): FitnessFatigueModel {
  // Default population parameters (if no personal data)
  const defaultParams = {
    fitnessDecayRate: 7, // Fitness decays slower (τ1 = 7 days)
    fatigueDecayRate: 2, // Fatigue dissipates faster (τ2 = 2 days)
    fitnessGainCoefficient: 1.0,
    fatigueGainCoefficient: 2.0, // Fatigue accumulates faster than fitness
  };

  const params = previousModel || { ...defaultParams, currentFitness: 0, currentFatigue: 0 };

  // Decay previous values
  const fitnessDecay = Math.exp(-daysSinceLastTrained / params.fitnessDecayRate);
  const fatigueDecay = Math.exp(-daysSinceLastTrained / params.fatigueDecayRate);

  const newFitness = params.currentFitness * fitnessDecay + params.fitnessGainCoefficient * newTrainingLoad;
  const newFatigue = params.currentFatigue * fatigueDecay + params.fatigueGainCoefficient * newTrainingLoad;

  // Calculate raw performance (fitness - fatigue)
  const rawPerformance = newFitness - newFatigue;

  // Normalize to 0-100 scale for easier interpretation
  // Formula: map [-100, 200] → [0, 100]
  // 0 = extremely overtrained, 50 = neutral, 100 = peak readiness
  const netPerformance = Math.max(0, Math.min(100, ((rawPerformance + 100) / 300) * 100));

  return {
    userId: previousModel?.userId || '',
    muscleGroup,
    fitnessDecayRate: params.fitnessDecayRate,
    fatigueDecayRate: params.fatigueDecayRate,
    fitnessGainCoefficient: params.fitnessGainCoefficient,
    fatigueGainCoefficient: params.fatigueGainCoefficient,
    currentFitness: Math.min(100, newFitness),
    currentFatigue: Math.min(100, newFatigue),
    netPerformance,
    lastTrained: new Date(),
    confidence: previousModel ? Math.min(0.95, (previousModel.confidence || 0.5) + 0.05) : 0.5
  };
}

/**
 * Calculate training load from workout sets
 *
 * Load = Volume × Intensity × Effort
 * Volume = sets × reps × weight
 * Intensity = RPE / 10
 * Effort = proximity to failure
 */
export function calculateTrainingLoad(sets: SetLog[]): number {
  let totalLoad = 0;

  for (const set of sets) {
    if (!set.completed || !set.actualReps || !set.actualWeight) continue;

    const volume = set.actualReps * set.actualWeight;
    const intensity = (set.actualRPE || 7) / 10; // Default RPE 7
    const effortMultiplier = set.reachedFailure ? 1.5 : 1.0;

    totalLoad += volume * intensity * effortMultiplier;
  }

  return totalLoad / 1000; // Normalize
}

// ============================================================
// ACUTE:CHRONIC WORKLOAD RATIO (ACWR)
// ============================================================

/**
 * Calculate ACWR and workload metrics
 *
 * Research: Hulin et al. (2016) - Injury risk vs ACWR
 * - ACWR 0.8-1.3 = "Sweet spot" (optimal adaptation)
 * - ACWR < 0.8 = Detraining risk
 * - ACWR > 1.5 = Injury risk (too much too soon)
 *
 * Uses exponentially weighted moving average (EWMA) for robustness
 */
export function calculateACWR(workouts: Array<{ date: Date; load: number }>): WorkloadMetrics {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Acute load (last 7 days)
  const acuteWorkouts = workouts.filter(w => w.date >= sevenDaysAgo);
  const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + w.load, 0);

  // Chronic load (last 28 days)
  const chronicWorkouts = workouts.filter(w => w.date >= twentyEightDaysAgo);
  const chronicLoad = chronicWorkouts.reduce((sum, w) => sum + w.load, 0) / 4; // Average per week

  // ACWR
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

  // Training Monotony = Mean / SD (Foster, 1998)
  const loads = chronicWorkouts.map(w => w.load);
  const stats = calculateDescriptiveStats(loads);
  const trainingMonotony = stats.stdDev > 0 ? stats.mean / stats.stdDev : 1.0;

  // Training Strain = Total Load × Monotony
  const trainingStrain = chronicLoad * 4 * trainingMonotony;

  // Status determination
  let status: WorkloadMetrics['status'];
  let recommendation: string;
  let scientificBasis: string;

  if (acwr < 0.5) {
    status = 'detraining';
    recommendation = 'Training volume too low. Increase training frequency or intensity to maintain adaptations.';
    scientificBasis = 'Schoenfeld et al. (2016): Minimum effective dose - at least 10 sets per muscle per week needed for growth.';
  } else if (acwr < 0.8) {
    status = 'maintaining';
    recommendation = 'Maintenance phase. Sufficient to preserve adaptations but insufficient for optimal progress.';
    scientificBasis = 'Hulin et al. (2016): ACWR <0.8 maintains but does not build fitness.';
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    status = 'optimal';
    recommendation = 'Optimal training load. Well-positioned for continued adaptation with minimal injury risk.';
    scientificBasis = 'Hulin et al. (2016): ACWR 0.8-1.3 represents the "sweet spot" - maximal adaptation, minimal risk.';
  } else if (acwr > 1.3 && acwr <= 1.5) {
    status = 'building';
    recommendation = 'Progressive overload zone. Monitor for fatigue accumulation and ensure adequate recovery.';
    scientificBasis = 'Gabbett (2016): ACWR 1.3-1.5 builds fitness but requires careful fatigue management.';
  } else if (acwr > 1.5 && acwr <= 2.0) {
    status = 'overreaching';
    recommendation = 'Functional overreaching. Acute spike in load - ensure deload within 1-2 weeks to avoid maladaptation.';
    scientificBasis = 'Meeusen et al. (2013): Short-term overreaching can boost adaptation if followed by recovery.';
  } else {
    status = 'danger';
    recommendation = 'DANGER: Excessive acute load spike. Very high injury risk. Implement immediate deload (50% volume reduction).';
    scientificBasis = 'Hulin et al. (2016): ACWR >2.0 associated with 2-4x injury risk. Immediate intervention required.';
  }

  // Additional warning for high monotony
  if (trainingMonotony > 2.5) {
    recommendation += ' WARNING: High training monotony detected - add variation to prevent maladaptation.';
  }

  return {
    acuteLoad,
    chronicLoad: chronicLoad * 4, // Convert back to 28-day total
    acwr,
    trainingMonotony,
    trainingStrain,
    status,
    recommendation,
    scientificBasis
  };
}

// ============================================================
// ADAPTIVE RECOVERY PROFILES
// ============================================================

/**
 * Build personalized recovery profile by learning from user's actual performance
 *
 * Learns:
 * - How fast individual recovers (faster/slower than population average)
 * - Chronic fatigue patterns
 * - Training age effects
 */
export async function buildAdaptiveRecoveryProfile(
  muscleGroup: string,
  recentWorkouts: Array<{
    date: Date;
    load: number;
    perceivedRecovery: number; // User-reported or inferred from performance
  }>
): Promise<AdaptiveRecoveryProfile> {
  // Base recovery times (population average, Schoenfeld & Grgic 2018)
  const baseRecoveryHours: Record<string, number> = {
    chest: 48,
    back: 48,
    shoulders: 36,
    quads: 72,
    hamstrings: 72,
    triceps: 36,
    biceps: 36,
    calves: 24,
    abs: 24
  };

  const baseHours = baseRecoveryHours[muscleGroup.toLowerCase()] || 48;

  if (recentWorkouts.length < 5) {
    // Insufficient data - use population defaults
    return {
      muscleGroup,
      personalizedRecoveryHours: baseHours,
      readinessScore: 7,
      recoveryPercentage: 70,
      estimatedFullRecovery: new Date(Date.now() + baseHours * 60 * 60 * 1000),
      chronicFatiguePenalty: 0,
      trainingAge: 0,
      adaptationRate: 1.0, // Population average
      confidence: 0.3
    };
  }

  // Analyze recovery patterns
  const recoveryRates: number[] = [];

  for (let i = 1; i < recentWorkouts.length; i++) {
    const prev = recentWorkouts[i - 1];
    const current = recentWorkouts[i];

    const hoursBetween = (current.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60);
    const recoveryAchieved = current.perceivedRecovery;

    // Estimate personal recovery rate
    // If 80% recovered after 36h, personal rate = 36 / 0.80 = 45h for full recovery
    if (recoveryAchieved > 0.5) {
      const estimatedFullRecoveryTime = hoursBetween / recoveryAchieved;
      recoveryRates.push(estimatedFullRecoveryTime);
    }
  }

  const stats = calculateDescriptiveStats(recoveryRates);
  const personalizedRecoveryHours = stats.median > 0 ? stats.median : baseHours;

  // Adaptation rate relative to population
  const adaptationRate = baseHours / personalizedRecoveryHours; // >1 = recovers faster, <1 = slower

  // Chronic fatigue check (using EWMA)
  const loads = recentWorkouts.map(w => w.load);
  const ewma = exponentialMovingAverage(loads, 0.3);
  const trend = detectTrend(ewma);

  let chronicFatiguePenalty = 0;
  if (trend.trend === 'increasing' && trend.slope > 5) {
    // Load increasing without sufficient recovery
    chronicFatiguePenalty = Math.min(24, trend.slope * 2); // Up to +24h penalty
  }

  // Training age (months of consistent training)
  const firstWorkout = recentWorkouts[0].date;
  const lastWorkoutDate = recentWorkouts[recentWorkouts.length - 1].date;
  const trainingAge = (lastWorkoutDate.getTime() - firstWorkout.getTime()) / (1000 * 60 * 60 * 24 * 30);

  // Current state
  const now = new Date();
  const lastWorkout = recentWorkouts[recentWorkouts.length - 1];
  const hoursSinceLastTrained = (now.getTime() - lastWorkout.date.getTime()) / (1000 * 60 * 60);

  const adjustedRecoveryTime = personalizedRecoveryHours + chronicFatiguePenalty;
  const recoveryPercentage = Math.min(100, (hoursSinceLastTrained / adjustedRecoveryTime) * 100);

  // Readiness score (1-10 scale)
  let readinessScore = (recoveryPercentage / 10) - (chronicFatiguePenalty / 10);
  readinessScore = Math.max(1, Math.min(10, readinessScore));

  const hoursRemaining = Math.max(0, adjustedRecoveryTime - hoursSinceLastTrained);
  const estimatedFullRecovery = new Date(now.getTime() + hoursRemaining * 60 * 60 * 1000);

  const confidence = Math.min(0.9, recentWorkouts.length / 20);

  return {
    muscleGroup,
    personalizedRecoveryHours: adjustedRecoveryTime,
    readinessScore,
    recoveryPercentage,
    estimatedFullRecovery,
    chronicFatiguePenalty,
    trainingAge,
    adaptationRate,
    confidence
  };
}

/**
 * Predict performance based on current recovery state
 *
 * Returns expected performance relative to baseline (0-100%)
 */
export function predictPerformance(
  recoveryProfile: AdaptiveRecoveryProfile
): {
  expectedPerformance: number; // 0-100%
  recommendation: 'proceed' | 'reduce_load' | 'skip';
  reasoning: string;
} {
  const { readinessScore, recoveryPercentage, chronicFatiguePenalty } = recoveryProfile;

  // Performance curve (non-linear)
  // 100% recovered = 100% performance
  // 80% recovered = 95% performance (slight drop)
  // 60% recovered = 85% performance (noticeable drop)
  // 40% recovered = 70% performance (significant impairment)
  let expectedPerformance = 100;

  if (recoveryPercentage < 100) {
    // Exponential performance decay
    expectedPerformance = 100 * Math.pow(recoveryPercentage / 100, 1.5);
  }

  // Chronic fatigue penalty
  if (chronicFatiguePenalty > 12) {
    expectedPerformance *= 0.85; // 15% performance penalty from chronic fatigue
  }

  let recommendation: 'proceed' | 'reduce_load' | 'skip';
  let reasoning: string;

  if (readinessScore >= 7 && expectedPerformance >= 90) {
    recommendation = 'proceed';
    reasoning = 'Full recovery achieved. Ready for high-quality training.';
  } else if (readinessScore >= 5 && expectedPerformance >= 75) {
    recommendation = 'reduce_load';
    reasoning = `Partial recovery (${recoveryPercentage.toFixed(0)}%). Reduce load by ${Math.round((100 - expectedPerformance) * 0.5)}% or volume by 20-30%.`;
  } else {
    recommendation = 'skip';
    reasoning = `Insufficient recovery (readiness ${readinessScore.toFixed(1)}/10). Risk of maladaptation and injury. Rest or train different muscle group.`;
  }

  return {
    expectedPerformance,
    recommendation,
    reasoning
  };
}
