/**
 * Cross-Session Fatigue Tracking & Recovery Modeling
 *
 * Research basis:
 * - Schoenfeld & Grgic (2018): Muscle-specific recovery timeframes
 * - McLester et al. (2003): Recovery patterns vary by muscle group size
 * - Weakley et al. (2021): Multi-day fatigue accumulation
 */

import { supabase } from '../supabase/client';
import { FatigueScore, calculateMuscleFatigue } from '../fatigueModel';
import { SetLog } from '../types';
import { convertWeight } from '../units';
import type { Database } from '../supabase/database.types';

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

type SupabaseFatigueHistoryRow = Database['public']['Tables']['fatigue_history']['Row'];
type SupabaseFatigueHistoryInsert = Database['public']['Tables']['fatigue_history']['Insert'];

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
 *
 * This function applies:
 * 1. Base recovery from time elapsed (40% weight)
 * 2. Chronic fatigue penalty from recent sessions (30% weight)
 * 3. Training frequency penalty (30% weight)
 */
export function calculateReadinessScore(
  muscleGroup: string,
  recoveryPercentage: number,         // 0-100
  recentFatigueHistory: number[],     // Last 3-5 sessions for this muscle
  hoursSinceLastTraining?: number     // Optional - for frequency penalty
): number {
  // 1. BASE READINESS (40% weight) - from time-based recovery
  const baseReadiness = recoveryPercentage / 10; // 0-10 scale

  // 2. CHRONIC FATIGUE PENALTY (30% weight)
  // If we have recent fatigue history, apply accumulated fatigue penalty
  let chronicPenalty = 0;
  if (recentFatigueHistory.length > 0) {
    const avgRecentFatigue = recentFatigueHistory.reduce((a, b) => a + b, 0) / recentFatigueHistory.length;
    const maxRecentFatigue = Math.max(...recentFatigueHistory);

    // Penalty formula calibrated for actual fatigue scores (typically 5-30 range):
    // - Starts penalizing at fatigue > 5 (very low threshold)
    // - Scales up quickly: fatigue 10 = 0.5 penalty, fatigue 20 = 1.5 penalty, fatigue 30 = 2.5 penalty
    // - Peak fatigue also contributes: max > 20 adds additional penalty
    // - Max total penalty of 5 points
    const avgPenalty = Math.max(0, (avgRecentFatigue - 5) / 10); // 0-3+ scale (fatigue 35 = 3 penalty)
    const peakPenalty = Math.max(0, (maxRecentFatigue - 20) / 15);  // 0-2+ scale

    chronicPenalty = Math.min(5, avgPenalty + peakPenalty * 0.5);
  }

  // 3. FREQUENCY PENALTY (30% weight)
  // Penalize training the same muscle too soon
  let frequencyPenalty = 0;
  if (hoursSinceLastTraining !== undefined) {
    if (hoursSinceLastTraining < 12) {
      // Same day - heavy penalty
      frequencyPenalty = 3;
    } else if (hoursSinceLastTraining < 24) {
      // Yesterday - significant penalty
      frequencyPenalty = 2;
    } else if (hoursSinceLastTraining < 36) {
      // Within 36h - moderate penalty
      frequencyPenalty = 1.5;
    } else if (hoursSinceLastTraining < 48) {
      // Within 48h - small penalty
      frequencyPenalty = 1;
    }
  } else if (recentFatigueHistory.length >= 2) {
    // If we don't have hours but have 2+ recent sessions, assume frequent training
    frequencyPenalty = 1;
  }

  // FINAL CALCULATION
  // Start with base, subtract penalties
  let readiness = baseReadiness - chronicPenalty - frequencyPenalty;

  // Ensure score is in valid range (1-10)
  readiness = Math.max(1, Math.min(10, readiness));

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

  const snapshots: SupabaseFatigueHistoryInsert[] = fatigueScores.map(score => ({
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

  const { error } = await supabase
    .from('fatigue_history')
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

    const { error } = await supabase
      .from('recovery_estimates')
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
 * Falls back to calculating from workout history if database has no data
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

  if (error) {
    console.error('Failed to fetch recovery estimates:', error);
  }

  const rows = estimates ?? [];

  // If no database data, calculate from workout history as fallback
  if (rows.length === 0) {
    const fallbackProfiles = await calculateRecoveryFromWorkouts(userId);
    if (muscleGroups && muscleGroups.length > 0) {
      return fallbackProfiles.filter(p => muscleGroups.includes(p.muscleGroup));
    }
    return fallbackProfiles;
  }

  // Batch-fetch fatigue history for all muscle groups in one query
  // This is more efficient than querying per-muscle in the loop
  const muscleGroupsToFetch = rows.map(r => r.muscle_group.toLowerCase());
  const { data: fatigueHistoryData, error: fatigueError } = await supabase
    .from('fatigue_history')
    .select('muscle_group, fatigue_score, recorded_at')
    .eq('user_id', userId)
    .in('muscle_group', muscleGroupsToFetch)
    .order('recorded_at', { ascending: false });

  if (fatigueError) {
    console.error('[Recovery] Failed to fetch fatigue history:', fatigueError);
  }

  // Group fatigue history by muscle group (limit to 5 most recent per muscle)
  const fatigueByMuscle = new Map<string, number[]>();
  for (const row of (fatigueHistoryData ?? [])) {
    const muscle = row.muscle_group.toLowerCase();
    const existing = fatigueByMuscle.get(muscle) || [];
    if (existing.length < 5) {
      existing.push(row.fatigue_score);
      fatigueByMuscle.set(muscle, existing);
    }
  }

  // Calculate current recovery percentages from database data
  const now = new Date();

  const profiles: RecoveryProfile[] = rows.map((est) => {
    const lastTrained = new Date(est.last_trained_at);
    const hoursSince = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
    const daysSince = Math.floor(hoursSince / 24);

    const recoveryPercentage = calculateRecoveryPercentage(
      est.muscle_group,
      est.last_fatigue_score || 50,
      hoursSince
    );

    // Get recent fatigue history for this muscle (now properly populated!)
    const recentFatigueHistory = fatigueByMuscle.get(est.muscle_group.toLowerCase()) || [];

    const readinessScore = calculateReadinessScore(
      est.muscle_group,
      recoveryPercentage,
      recentFatigueHistory,
      hoursSince  // Pass hours since last training for frequency penalty
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
): Promise<SupabaseFatigueHistoryRow[]> {
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

  return data ?? [];
}

/**
 * Get recent fatigue scores for a specific muscle group
 * Used for chronic fatigue penalty calculation in readiness scoring
 *
 * @param userId - User ID
 * @param muscleGroup - Muscle group name (e.g., 'chest', 'back')
 * @param limit - Number of recent sessions to fetch (default 5)
 * @returns Array of fatigue scores (0-100) from most recent sessions
 */
export async function getRecentFatigueHistory(
  userId: string,
  muscleGroup: string,
  limit: number = 5
): Promise<number[]> {
  const { data, error } = await supabase
    .from('fatigue_history')
    .select('fatigue_score, recorded_at')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup.toLowerCase())
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[Recovery] Failed to fetch fatigue history for ${muscleGroup}:`, error);
    return [];
  }

  return (data ?? []).map(row => row.fatigue_score);
}

/**
 * Get training frequency for a muscle group in the last N days
 * Used for consecutive training day penalties
 */
export async function getTrainingFrequency(
  userId: string,
  muscleGroup: string,
  days: number = 7
): Promise<{ sessionsInPeriod: number; daysSinceLastTraining: number | null }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('fatigue_history')
    .select('recorded_at')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup.toLowerCase())
    .gte('recorded_at', cutoffDate.toISOString())
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error(`[Recovery] Failed to fetch training frequency for ${muscleGroup}:`, error);
    return { sessionsInPeriod: 0, daysSinceLastTraining: null };
  }

  const sessions = data ?? [];
  const sessionsInPeriod = sessions.length;

  let daysSinceLastTraining: number | null = null;
  if (sessions.length > 0 && sessions[0].recorded_at) {
    const lastTraining = new Date(sessions[0].recorded_at);
    const now = new Date();
    daysSinceLastTraining = (now.getTime() - lastTraining.getTime()) / (1000 * 60 * 60 * 24);
  }

  return { sessionsInPeriod, daysSinceLastTraining };
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
    totalVolumeLoad: sets.reduce((sum, s) => {
      const reps = s.actualReps || 0;
      const weight = s.actualWeight || 0;
      if (!reps || !weight) return sum;
      const weightLbs = convertWeight(weight, s.weightUnit ?? 'lbs', 'lbs');
      return sum + (weightLbs * reps);
    }, 0),
  };
}

/**
 * Calculate recovery profiles directly from workout history
 * Used as fallback when recovery_estimates table has no data
 */
export async function calculateRecoveryFromWorkouts(
  userId: string
): Promise<RecoveryProfile[]> {
  // Fetch recent workouts with set logs (last 14 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);

  const { data: workouts, error } = await supabase
    .from('workout_sessions')
    .select(`
      id,
      start_time,
      end_time,
      set_logs (
        id,
        exercise_id,
        exercise_slug,
        actual_weight,
        weight_unit,
        actual_reps,
        actual_rpe,
        completed,
        set_type
      )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('start_time', cutoffDate.toISOString())
    .order('start_time', { ascending: false });

  if (error || !workouts || workouts.length === 0) {
    return [];
  }

  // Track last training date and fatigue per muscle group
  const muscleData: Map<string, {
    lastTrainedDate: Date;
    fatigueScore: number;
    sets: SetLog[];
  }> = new Map();

  const muscleGroupsToTrack = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'triceps', 'biceps', 'abs', 'calves'];

  for (const workout of workouts) {
    const workoutTimeStr = workout.end_time || workout.start_time;
    if (!workoutTimeStr) continue; // Skip workouts with no timestamp

    const workoutDate = new Date(workoutTimeStr);
    const setLogs = workout.set_logs ?? [];

    // Convert to SetLog format for fatigue calculation
    const completedSets: SetLog[] = setLogs
      .filter(s => s.completed !== false && s.set_type !== 'warmup')
      .map(s => ({
        exerciseId: s.exercise_id ?? s.exercise_slug ?? '',
        actualWeight: s.actual_weight ?? undefined,
        weightUnit: s.weight_unit === 'kg' ? 'kg' : 'lbs',
        actualReps: s.actual_reps ?? undefined,
        actualRPE: s.actual_rpe ?? undefined,
        completed: true,
      } as SetLog));

    if (completedSets.length === 0) continue;

    // Calculate fatigue for all muscle groups for this workout
    const fatigueScores = calculateMuscleFatigue(completedSets, muscleGroupsToTrack);

    for (const score of fatigueScores) {
      if (score.fatigueLevel < 5) continue; // Skip muscles that weren't really trained

      const existing = muscleData.get(score.muscleGroup);

      // Only update if this workout is more recent for this muscle
      if (!existing || workoutDate > existing.lastTrainedDate) {
        muscleData.set(score.muscleGroup, {
          lastTrainedDate: workoutDate,
          fatigueScore: score.fatigueLevel,
          sets: completedSets,
        });
      }
    }
  }

  // Build recovery profiles from muscle data
  const now = new Date();
  const profiles: RecoveryProfile[] = [];

  // Also fetch fatigue history from the database for chronic fatigue calculations
  // Even if recovery_estimates is empty, fatigue_history may have data
  const muscleGroupsList = Array.from(muscleData.keys());
  const fatigueByMuscle = new Map<string, number[]>();

  if (muscleGroupsList.length > 0) {
    const { data: fatigueHistoryData, error: fatigueError } = await supabase
      .from('fatigue_history')
      .select('muscle_group, fatigue_score, recorded_at')
      .eq('user_id', userId)
      .in('muscle_group', muscleGroupsList)
      .order('recorded_at', { ascending: false });

    if (fatigueError) {
      console.error('[Recovery] Failed to fetch fatigue history in fallback:', fatigueError);
    }

    // Group by muscle (limit 5 per muscle)
    for (const row of (fatigueHistoryData ?? [])) {
      const muscle = row.muscle_group.toLowerCase();
      const existing = fatigueByMuscle.get(muscle) || [];
      if (existing.length < 5) {
        existing.push(row.fatigue_score);
        fatigueByMuscle.set(muscle, existing);
      }
    }
  }

  for (const [muscleGroup, data] of muscleData) {
    const hoursSince = (now.getTime() - data.lastTrainedDate.getTime()) / (1000 * 60 * 60);
    const daysSince = Math.floor(hoursSince / 24);

    const recoveryPercentage = calculateRecoveryPercentage(
      muscleGroup,
      data.fatigueScore,
      hoursSince
    );

    // Get fatigue history from database (if available)
    const recentFatigueHistory = fatigueByMuscle.get(muscleGroup.toLowerCase()) || [];

    // If no database history, use the calculated fatigue from workouts
    // This ensures consecutive training days are penalized even without database data
    const effectiveHistory = recentFatigueHistory.length > 0
      ? recentFatigueHistory
      : [data.fatigueScore]; // Use current workout's fatigue as minimum

    const readinessScore = calculateReadinessScore(
      muscleGroup,
      recoveryPercentage,
      effectiveHistory,
      hoursSince  // Pass hours since last training for frequency penalty
    );

    profiles.push({
      muscleGroup,
      lastTrainedDate: data.lastTrainedDate.toISOString(),
      daysSinceLastTraining: daysSince,
      recoveryPercentage,
      readinessScore,
      estimatedFullRecoveryDate: estimateFullRecoveryDate(
        muscleGroup,
        data.fatigueScore,
        data.lastTrainedDate
      ).toISOString(),
      lastFatigueScore: data.fatigueScore,
    });
  }

  // Sort by readiness (worst first)
  return profiles.sort((a, b) => a.readinessScore - b.readinessScore);
}
