/**
 * Multi-Factor Readiness Score Calculation
 *
 * Research basis:
 * - Schoenfeld & Grgic (2018): Muscle-specific recovery timeframes
 * - Helms et al. (2018): RPE-based load regulation and recovery
 * - Weakley et al. (2021): Multi-factor readiness improves training outcomes
 * - McLester et al. (2003): Frequency and recovery relationship
 *
 * This module provides a science-based readiness calculation that considers:
 * 1. Time-based recovery (exponential decay)
 * 2. Training intensity (RPE, volume)
 * 3. Training frequency (sessions per week, consecutive days)
 * 4. Recovery context (sleep, stress, nutrition)
 */

import { supabase } from '../supabase/client';

// ============================================================
// INTERFACES
// ============================================================

export interface ReadinessFactors {
  // Base recovery (from time since last training)
  recoveryPercentage: number;      // 0-100

  // Intensity factors (from last session)
  lastSessionFatigue: number;      // 0-100 fatigue score
  avgRpeOvershoot?: number;        // How much RPE exceeded target
  formBreakdownCount?: number;     // Number of sets with form issues
  failureCount?: number;           // Number of sets to failure

  // Frequency factors
  sessionsLast7Days: number;       // Training frequency
  hoursSinceLastTraining: number;  // Time since last session
  consecutiveTrainingDays: number; // Days trained in a row

  // Context modifiers (if available)
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  sleepHours?: number;
  stressLevel?: number;            // 1-10 scale
}

export interface ReadinessResult {
  score: number;                   // 1-10 scale
  factors: {
    base: number;                  // Contribution from time-based recovery
    intensity: number;             // Contribution from training intensity
    frequency: number;             // Contribution from training frequency
    context: number;               // Contribution from sleep/stress
  };
  interpretation: 'excellent' | 'good' | 'moderate' | 'poor' | 'rest';
  recommendation: string;
}

// ============================================================
// WEIGHTING CONSTANTS (Research-Based)
// ============================================================

const WEIGHTS = {
  // How much each factor contributes to final score
  RECOVERY_TIME: 0.40,      // 40% - Schoenfeld & Grgic 2018
  INTENSITY: 0.30,          // 30% - Helms 2018 (RPE-based)
  FREQUENCY: 0.20,          // 20% - Accumulation effects
  CONTEXT: 0.10,            // 10% - Sleep/stress modifiers
};

const THRESHOLDS = {
  // Time thresholds for penalties
  RECENT_TRAINING_HOURS: 24,      // Training <24h ago = significant penalty
  SAME_DAY_HOURS: 12,             // Training <12h ago = heavy penalty

  // Frequency thresholds
  HIGH_FREQUENCY: 4,              // >4 sessions/week for same muscle
  CONSECUTIVE_PENALTY_START: 2,   // Penalty starts at 2+ consecutive days

  // Intensity thresholds
  HIGH_RPE_OVERSHOOT: 1.5,        // RPE exceeding target by 1.5+ is concerning
  CRITICAL_FATIGUE: 70,           // Fatigue score >70 needs extra recovery
};

// ============================================================
// MAIN CALCULATION
// ============================================================

/**
 * Calculate multi-factor readiness score
 *
 * @param factors - All factors affecting readiness
 * @returns ReadinessResult with score, breakdown, and recommendation
 */
export function calculateMultiFactorReadiness(factors: ReadinessFactors): ReadinessResult {
  // 1. BASE RECOVERY (40%)
  // Convert recovery percentage to 0-10 scale
  const baseScore = factors.recoveryPercentage / 10;

  // 2. INTENSITY FACTOR (30%)
  let intensityScore = 10; // Start at max

  // Penalty for high fatigue from last session
  if (factors.lastSessionFatigue > 0) {
    // Higher fatigue = lower readiness
    // 50 fatigue = 5 points, 100 fatigue = 0 points
    intensityScore -= (factors.lastSessionFatigue / 20);
  }

  // Extra penalty for RPE overshoot (indicates underestimated fatigue)
  if (factors.avgRpeOvershoot && factors.avgRpeOvershoot > THRESHOLDS.HIGH_RPE_OVERSHOOT) {
    intensityScore -= (factors.avgRpeOvershoot - THRESHOLDS.HIGH_RPE_OVERSHOOT) * 2;
  }

  // Penalty for form breakdowns (indicates neuromuscular fatigue)
  if (factors.formBreakdownCount && factors.formBreakdownCount > 0) {
    intensityScore -= factors.formBreakdownCount * 0.5;
  }

  // Penalty for training to failure (needs more recovery)
  if (factors.failureCount && factors.failureCount > 0) {
    intensityScore -= factors.failureCount * 0.3;
  }

  intensityScore = Math.max(0, Math.min(10, intensityScore));

  // 3. FREQUENCY FACTOR (20%)
  let frequencyScore = 10; // Start at max

  // Penalty for very recent training (<24h)
  if (factors.hoursSinceLastTraining < THRESHOLDS.SAME_DAY_HOURS) {
    // Same day training - heavy penalty
    frequencyScore -= 5;
  } else if (factors.hoursSinceLastTraining < THRESHOLDS.RECENT_TRAINING_HOURS) {
    // Yesterday - moderate penalty
    frequencyScore -= 3;
  } else if (factors.hoursSinceLastTraining < 48) {
    // Within 48h - small penalty
    frequencyScore -= 1;
  }

  // Penalty for consecutive training days
  if (factors.consecutiveTrainingDays >= THRESHOLDS.CONSECUTIVE_PENALTY_START) {
    // Each consecutive day adds increasing penalty
    // Day 2: -1, Day 3: -2, Day 4: -3, etc.
    const consecutivePenalty = (factors.consecutiveTrainingDays - 1) * 1;
    frequencyScore -= Math.min(consecutivePenalty, 4);
  }

  // Penalty for high weekly frequency
  if (factors.sessionsLast7Days > THRESHOLDS.HIGH_FREQUENCY) {
    frequencyScore -= (factors.sessionsLast7Days - THRESHOLDS.HIGH_FREQUENCY) * 0.5;
  }

  frequencyScore = Math.max(0, Math.min(10, frequencyScore));

  // 4. CONTEXT FACTOR (10%)
  let contextScore = 10; // Start at max (neutral if no data)

  if (factors.sleepQuality) {
    switch (factors.sleepQuality) {
      case 'poor':
        contextScore -= 3;
        break;
      case 'fair':
        contextScore -= 1.5;
        break;
      case 'excellent':
        contextScore += 0.5; // Bonus for excellent sleep
        break;
    }
  }

  if (factors.sleepHours !== undefined) {
    if (factors.sleepHours < 6) {
      contextScore -= 2;
    } else if (factors.sleepHours < 7) {
      contextScore -= 1;
    } else if (factors.sleepHours >= 8) {
      contextScore += 0.5; // Bonus for adequate sleep
    }
  }

  if (factors.stressLevel !== undefined && factors.stressLevel > 6) {
    // High stress (7-10) impairs recovery
    contextScore -= (factors.stressLevel - 6) * 0.5;
  }

  contextScore = Math.max(0, Math.min(10, contextScore));

  // WEIGHTED FINAL SCORE
  const finalScore =
    baseScore * WEIGHTS.RECOVERY_TIME +
    intensityScore * WEIGHTS.INTENSITY +
    frequencyScore * WEIGHTS.FREQUENCY +
    contextScore * WEIGHTS.CONTEXT;

  const clampedScore = Math.max(1, Math.min(10, Math.round(finalScore * 10) / 10));

  // INTERPRETATION
  let interpretation: ReadinessResult['interpretation'];
  let recommendation: string;

  if (clampedScore >= 8) {
    interpretation = 'excellent';
    recommendation = 'Optimal readiness for high-intensity training.';
  } else if (clampedScore >= 6.5) {
    interpretation = 'good';
    recommendation = 'Good readiness. Normal training volume recommended.';
  } else if (clampedScore >= 5) {
    interpretation = 'moderate';
    recommendation = 'Moderate readiness. Consider reducing volume or intensity by 10-20%.';
  } else if (clampedScore >= 3.5) {
    interpretation = 'poor';
    recommendation = 'Poor readiness. Recommend lighter training or different muscle group.';
  } else {
    interpretation = 'rest';
    recommendation = 'Rest recommended. Risk of overtraining or injury.';
  }

  return {
    score: clampedScore,
    factors: {
      base: Math.round(baseScore * 10) / 10,
      intensity: Math.round(intensityScore * 10) / 10,
      frequency: Math.round(frequencyScore * 10) / 10,
      context: Math.round(contextScore * 10) / 10,
    },
    interpretation,
    recommendation,
  };
}

// ============================================================
// DATA FETCHING HELPERS
// ============================================================

/**
 * Fetch context data (sleep, stress) for a user
 * Returns the most recent context data if available
 */
export async function getContextData(
  userId: string
): Promise<{ sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent'; sleepHours?: number; stressLevel?: number } | null> {
  const { data, error } = await supabase
    .from('user_context_data')
    .select('sleep_quality, sleep_hours, perceived_stress, work_stress, life_stress')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // Calculate combined stress (average of available stress values)
  let stressLevel: number | undefined;
  const stressValues = [data.perceived_stress, data.work_stress, data.life_stress].filter(v => v !== null);
  if (stressValues.length > 0) {
    stressLevel = stressValues.reduce((a, b) => a + b, 0) / stressValues.length;
  }

  return {
    sleepQuality: data.sleep_quality as 'poor' | 'fair' | 'good' | 'excellent' | undefined,
    sleepHours: data.sleep_hours ?? undefined,
    stressLevel,
  };
}

/**
 * Count consecutive training days for a muscle group
 */
export async function getConsecutiveTrainingDays(
  userId: string,
  muscleGroup: string
): Promise<number> {
  // Get the last 7 days of training dates for this muscle
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const { data, error } = await supabase
    .from('fatigue_history')
    .select('recorded_at')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup.toLowerCase())
    .gte('recorded_at', cutoffDate.toISOString())
    .order('recorded_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return 0;
  }

  // Group by date and count consecutive days ending today/yesterday
  const trainingDates = new Set<string>();
  for (const row of data) {
    if (row.recorded_at) {
      const dateStr = row.recorded_at.split('T')[0];
      trainingDates.add(dateStr);
    }
  }

  // Count consecutive days starting from today going backwards
  let consecutiveDays = 0;
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (trainingDates.has(dateStr)) {
      consecutiveDays++;
    } else if (consecutiveDays > 0) {
      // Gap found, stop counting
      break;
    }
  }

  return consecutiveDays;
}
