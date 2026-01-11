/**
 * Cross-Session Fatigue Tracking & Recovery Modeling
 *
 * Research basis:
 * - Schoenfeld & Grgic (2018): Muscle-specific recovery timeframes
 * - McLester et al. (2003): Recovery patterns vary by muscle group size
 * - Weakley et al. (2021): Multi-day fatigue accumulation
 */

import { supabase } from '../supabase/client';
import { FatigueScore } from '../fatigueModel';
import { SetLog } from '../types';

// ============================================================
// RECOVERY CURVES (Science-Backed)
// ============================================================

/**
 * Base recovery hours to 95% recovery at moderate intensity
 * Research: Schoenfeld & Grgic (2018) - Training frequency meta-analysis
 */
export const RECOVERY_CURVES: Record<string, number> = {
  // Upper body (faster recovery - smaller muscles)
  chest: 48,
  back: 48,
  shoulders: 36,
  triceps: 36,
  biceps: 36,
  abs: 24,

  // Lower body (slower recovery - larger muscles, higher systemic stress)
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  calves: 24,

  // Special cases
  'lower back': 72,  // Spinal erectors - high CNS involvement
  'upper back': 48,
  'front delts': 36,
  'rear delts': 36,
};

// ============================================================
// INTERFACES
// ============================================================

export interface RecoveryProfile {
  muscleGroup: string;
  lastTrainedDate: string;              // ISO timestamp
  daysSinceLastTraining: number;
  recoveryPercentage: number;           // 0-100
  readinessScore: number;               // 1-10 scale
  estimatedFullRecoveryDate: string;    // ISO date
  lastFatigueScore: number;             // 0-100
}

export interface FatigueSnapshot {
  userId: string;
  workoutSessionId: string;
  muscleGroup: string;
  fatigueScore: number;
  rpeOvershootAvg?: number;
  formBreakdownCount?: number;
  failureCount?: number;
  volumeLoad?: number;
}

// ============================================================
// RECOVERY CALCULATIONS
// ============================================================

/**
 * Calculate recovery percentage based on time since training and fatigue severity
 * Uses exponential decay model (fast recovery initially, slows near 100%)
 */
export function calculateRecoveryPercentage(
  muscleGroup: string,
  lastFatigueScore: number,       // 0-100
  hoursSinceTraining: number
): number {
  const baseRecoveryHours = RECOVERY_CURVES[muscleGroup.toLowerCase()] || 48;

  // Adjust recovery time based on fatigue severity
  // Critical fatigue (80+) takes 50% longer to recover
  // Mild fatigue (20-) recovers 20% faster
  const severityMultiplier = 1 + (lastFatigueScore - 50) / 200;
  const adjustedRecoveryHours = baseRecoveryHours * Math.max(0.8, Math.min(1.5, severityMultiplier));

  // Exponential recovery curve: y = 100 * (1 - e^(-k*t))
  // Where k is chosen so 95% recovery occurs at adjustedRecoveryHours
  // Solving: 0.95 = 1 - e^(-k*T) → k = -ln(0.05)/T ≈ 2.996/T
  const k = 2.996 / adjustedRecoveryHours;
  const recoveryPercentage = 100 * (1 - Math.exp(-k * hoursSinceTraining));

  return Math.min(recoveryPercentage, 100);
}

/**
 * Calculate readiness score (1-10) considering both acute and chronic fatigue
 *
 * Research: Weakley et al. (2021) - Multi-factor readiness improves training outcomes
 */
export function calculateReadinessScore(
  muscleGroup: string,
  recoveryPercentage: number,         // 0-100
  recentFatigueHistory: number[]      // Last 3-5 sessions for this muscle
): number {
  // Base readiness from current recovery
  let readiness = recoveryPercentage / 10; // 0-10 scale

  // Chronic fatigue penalty (consistently high fatigue = overtraining risk)
  if (recentFatigueHistory.length > 0) {
    const avgRecentFatigue = recentFatigueHistory.reduce((a, b) => a + b, 0) / recentFatigueHistory.length;

    // Penalize if average fatigue has been high (>50)
    // Reduces readiness by up to 5 points for chronic overreaching
    const chronicFatiguePenalty = Math.max(0, (avgRecentFatigue - 50) / 10);
    readiness = Math.max(1, readiness - chronicFatiguePenalty);
  }

  return Math.round(readiness * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate when muscle will be fully recovered (95%+)
 */
export function estimateFullRecoveryDate(
  muscleGroup: string,
  lastFatigueScore: number,
  lastTrainedDate: Date
): Date {
  const baseRecoveryHours = RECOVERY_CURVES[muscleGroup.toLowerCase()] || 48;
  const severityMultiplier = 1 + (lastFatigueScore - 50) / 200;
  const adjustedRecoveryHours = baseRecoveryHours * Math.max(0.8, Math.min(1.5, severityMultiplier));

  const recoveryMs = adjustedRecoveryHours * 60 * 60 * 1000;
  return new Date(lastTrainedDate.getTime() + recoveryMs);
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

/**
 * Save fatigue snapshot to database after workout completion
 */
export async function saveFatigueSnapshot(
  userId: string,
  workoutSessionId: string,
  fatigueScores: FatigueScore[]
): Promise<void> {
  if (!userId || fatigueScores.length === 0) return;

  const snapshots = fatigueScores.map(score => ({
    user_id: userId,
    workout_session_id: workoutSessionId,
    muscle_group: score.muscleGroup,
    fatigue_score: score.fatigueLevel,
    // Calculate contributing factors
    rpe_overshoot_avg: score.contributingSets.length > 0
      ? score.contributingSets.reduce((sum, s) => sum + s.rpeOvershoot, 0) / score.contributingSets.length
      : null,
    form_breakdown_count: 0,  // TODO: Track from set data
    failure_count: 0,          // TODO: Track from set data
    volume_load: null,         // TODO: Calculate from sets
  }));

  const { error } = await (supabase
    .from('fatigue_history') as any)
    .insert(snapshots);

  if (error) {
    console.error('Failed to save fatigue snapshot:', error);
    return;
  }

  // Update recovery estimates
  await updateRecoveryEstimates(userId, fatigueScores);
}

/**
 * Update recovery estimates for trained muscle groups
 */
async function updateRecoveryEstimates(
  userId: string,
  fatigueScores: FatigueScore[]
): Promise<void> {
  const now = new Date();

  for (const score of fatigueScores) {
    const estimatedRecoveryAt = estimateFullRecoveryDate(
      score.muscleGroup,
      score.fatigueLevel,
      now
    );

    const { error } = await (supabase
      .from('recovery_estimates') as any)
      .upsert({
        user_id: userId,
        muscle_group: score.muscleGroup,
        last_trained_at: now.toISOString(),
        estimated_recovery_at: estimatedRecoveryAt.toISOString(),
        current_recovery_percentage: 0, // Just trained - 0% recovered
        last_fatigue_score: score.fatigueLevel,
        rest_days: 0,
      }, {
        onConflict: 'user_id,muscle_group',
      });

    if (error) {
      console.error(`Failed to update recovery estimate for ${score.muscleGroup}:`, error);
    }
  }
}

/**
 * Get recovery profiles for all muscle groups (or specific ones)
 */
export async function getRecoveryProfiles(
  userId: string,
  muscleGroups?: string[]
): Promise<RecoveryProfile[]> {
  let query = supabase
    .from('recovery_estimates')
    .select('*')
    .eq('user_id', userId);

  if (muscleGroups && muscleGroups.length > 0) {
    query = query.in('muscle_group', muscleGroups);
  }

  const { data: estimates, error } = await query;

  if (error || !estimates) {
    console.error('Failed to fetch recovery estimates:', error);
    return [];
  }

  // Calculate current recovery percentages
  const now = new Date();
  const profiles: RecoveryProfile[] = (estimates as any[]).map((est: any) => {
    const lastTrained = new Date(est.last_trained_at);
    const hoursSince = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
    const daysSince = Math.floor(hoursSince / 24);

    const recoveryPercentage = calculateRecoveryPercentage(
      est.muscle_group,
      est.last_fatigue_score || 50,
      hoursSince
    );

    // Get recent fatigue history for readiness calculation
    // TODO: Query fatigue_history for last 3-5 sessions
    const recentFatigueHistory: number[] = [];

    const readinessScore = calculateReadinessScore(
      est.muscle_group,
      recoveryPercentage,
      recentFatigueHistory
    );

    return {
      muscleGroup: est.muscle_group,
      lastTrainedDate: est.last_trained_at,
      daysSinceLastTraining: daysSince,
      recoveryPercentage,
      readinessScore,
      estimatedFullRecoveryDate: est.estimated_recovery_at,
      lastFatigueScore: est.last_fatigue_score || 0,
    };
  });

  // Sort by readiness (worst first - needs attention)
  return profiles.sort((a, b) => a.readinessScore - b.readinessScore);
}

/**
 * Get recovery profile for a specific muscle group
 */
export async function getRecoveryProfile(
  userId: string,
  muscleGroup: string
): Promise<RecoveryProfile | null> {
  const profiles = await getRecoveryProfiles(userId, [muscleGroup]);
  return profiles[0] || null;
}

/**
 * Get fatigue history for analysis/charting
 */
export async function getFatigueHistory(
  userId: string,
  days: number = 30
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('fatigue_history')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', cutoffDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch fatigue history:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate aggregate metrics from set data for fatigue snapshot
 */
export function calculateFatigueMetrics(sets: SetLog[]): {
  formBreakdownCount: number;
  failureCount: number;
  totalVolumeLoad: number;
} {
  return {
    formBreakdownCount: sets.filter(s => s.formBreakdown === true).length,
    failureCount: sets.filter(s => s.reachedFailure === true).length,
    totalVolumeLoad: sets.reduce((sum, s) =>
      sum + ((s.actualWeight || 0) * (s.actualReps || 0)), 0
    ),
  };
}
