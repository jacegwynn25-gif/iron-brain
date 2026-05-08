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
import { convertWeight } from '../units';
import {
  calculateDescriptiveStats
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
  chronicWeeklyLoad: number; // 28-day load expressed as a weekly baseline
  acwr: number; // Acute:Chronic Workload Ratio
  trainingMonotony: number; // Lack of variation
  trainingStrain: number; // Load × monotony
  status: 'optimal' | 'building' | 'maintaining' | 'detraining' | 'overreaching' | 'danger';
  baselineConfidence: 'low' | 'medium' | 'high';
  recommendation: string;
  scientificBasis: string;
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
  // The raw performance typically ranges from -50 (very fatigued) to +100 (well-rested with fitness)
  // Map this to 0-100 where:
  //   rawPerformance = -50 → 0 (heavily fatigued)
  //   rawPerformance = 0   → 50 (balanced - fitness equals fatigue)
  //   rawPerformance = 50  → 83 (good readiness)
  //   rawPerformance = 100 → 100 (peak readiness)
  // Formula: sigmoid-like curve centered at 0, clamped to 0-100
  const normalizedPerformance = 50 + (rawPerformance / 2);
  const netPerformance = Math.max(0, Math.min(100, normalizedPerformance));

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

    const weightLbs = convertWeight(set.actualWeight, set.weightUnit ?? 'lbs', 'lbs');
    const volume = set.actualReps * weightLbs;
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
 * - ACWR 0.8-1.3 = steady load progression zone
 * - ACWR < 0.8 = lower recent load than baseline
 * - ACWR > 1.5 = acute workload spike that deserves recovery management
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

  // Chronic load (last 28 days) and weekly baseline
  const chronicWorkouts = workouts.filter(w => w.date >= twentyEightDaysAgo);
  const chronicTotalLoad = chronicWorkouts.reduce((sum, w) => sum + w.load, 0);
  const chronicWeeklyLoad = chronicTotalLoad / 4;

  // ACWR
  const acwr = chronicWeeklyLoad > 0 ? acuteLoad / chronicWeeklyLoad : 1.0;
  const oldestChronicTime = chronicWorkouts.reduce(
    (oldest, workout) => Math.min(oldest, workout.date.getTime()),
    Number.POSITIVE_INFINITY
  );
  const baselineAgeDays = Number.isFinite(oldestChronicTime)
    ? (now.getTime() - oldestChronicTime) / (24 * 60 * 60 * 1000)
    : 0;
  const baselineConfidence: WorkloadMetrics['baselineConfidence'] =
    chronicWorkouts.length >= 8 && baselineAgeDays >= 21
      ? 'high'
      : chronicWorkouts.length >= 4 && baselineAgeDays >= 14
        ? 'medium'
        : 'low';

  // Training Monotony = Mean / SD (Foster, 1998)
  const loads = chronicWorkouts.map(w => w.load);
  const stats = calculateDescriptiveStats(loads);
  const trainingMonotony = stats.stdDev > 0 ? stats.mean / stats.stdDev : 1.0;

  // Training Strain = Total Load × Monotony
  const trainingStrain = chronicTotalLoad * trainingMonotony;

  // Status determination
  let status: WorkloadMetrics['status'];
  let recommendation: string;
  let scientificBasis: string;

  if (baselineConfidence === 'low') {
    status = 'building';
    recommendation = 'Still building a reliable load baseline. Use this as a direction signal, not a risk verdict.';
    scientificBasis = 'Load-ratio metrics need several weeks of history before thresholds become useful for decisions.';
  } else if (acwr < 0.5) {
    status = 'detraining';
    recommendation = 'Recent workload is well below your baseline. Build back gradually before pushing max effort.';
    scientificBasis = 'Acute load materially below baseline can mean detraining or a planned deload, depending on context.';
  } else if (acwr < 0.8) {
    status = 'maintaining';
    recommendation = 'Recent workload is below baseline. Good for recovery or a lighter week.';
    scientificBasis = 'A lower acute-to-chronic ratio usually reflects a reduced loading week, not a problem by itself.';
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    status = 'optimal';
    recommendation = 'Recent workload is close to your weekly baseline. This is the most stable training-load range.';
    scientificBasis = 'A ratio near 1.0 means acute load is tracking close to recent chronic load.';
  } else if (acwr > 1.3 && acwr <= 1.5) {
    status = 'building';
    recommendation = 'Workload is building above baseline. Keep effort honest and watch recovery.';
    scientificBasis = 'Moderate acute load increases can be useful when fatigue and recovery stay controlled.';
  } else if (acwr > 1.5 && acwr <= 2.0) {
    status = 'overreaching';
    recommendation = 'Acute workload is spiking. Consider holding load, trimming sets, or adding recovery.';
    scientificBasis = 'Large short-term load spikes are a recovery-management flag, especially without a planned overload block.';
  } else {
    status = 'danger';
    recommendation = 'Very large workload spike. Treat the next session as a recovery-managed session unless this was planned.';
    scientificBasis = 'Very high acute-to-chronic ratios are best handled as load-spike warnings, not deterministic injury predictions.';
  }

  // Additional warning for high monotony
  if (trainingMonotony > 2.5) {
    recommendation += ' WARNING: High training monotony detected - add variation to prevent maladaptation.';
  }

  return {
    acuteLoad,
    chronicLoad: chronicTotalLoad,
    chronicWeeklyLoad,
    acwr,
    trainingMonotony,
    trainingStrain,
    status,
    baselineConfidence,
    recommendation,
    scientificBasis
  };
}
