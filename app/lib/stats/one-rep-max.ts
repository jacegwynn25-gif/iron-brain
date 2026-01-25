/**
 * One Rep Max (1RM) Calculations with RPE/RIR Adjustment
 *
 * Standard 1RM formulas don't account for effort level. This module provides
 * RPE-adjusted calculations that give more accurate estimates.
 *
 * Key insight: Someone lifting 185 lbs × 5 reps @ RPE 7 (3 reps in reserve)
 * has a higher true max than someone lifting 190 lbs × 5 reps @ RPE 10 (failure).
 */

/**
 * Convert RPE to Reps in Reserve (RIR)
 * RPE 10 = 0 RIR (failure)
 * RPE 9 = 1 RIR
 * RPE 8 = 2 RIR
 * etc.
 */
export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

/**
 * Standard Epley formula for 1RM estimation
 * 1RM = weight × (1 + reps/30)
 *
 * Accurate for rep ranges 1-10, less reliable for higher reps
 */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Brzycki formula for 1RM estimation
 * 1RM = weight × (36 / (37 - reps))
 *
 * Slightly more conservative than Epley for higher rep ranges
 */
export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return weight * 2; // Cap at ~2x for very high reps
  return weight * (36 / (37 - reps));
}

/**
 * RPE-Adjusted 1RM Calculation
 *
 * Uses RIR to estimate total reps-to-failure, then applies standard formula.
 *
 * Example:
 * - 185 lbs × 5 reps @ RPE 7 (RIR 3)
 *   → reps_to_failure = 5 + 3 = 8
 *   → 1RM = 185 × (1 + 8/30) = 234 lbs
 *
 * - 190 lbs × 5 reps @ RPE 10 (RIR 0)
 *   → reps_to_failure = 5 + 0 = 5
 *   → 1RM = 190 × (1 + 5/30) = 222 lbs
 *
 * Person A has higher 1RM despite lifting less absolute weight.
 */
export function rpeAdjusted1RM(
  weight: number,
  reps: number,
  rpe: number | null | undefined,
  formula: 'epley' | 'brzycki' = 'epley'
): number {
  if (weight <= 0 || reps <= 0) return 0;

  // Default to RPE 8 if not provided (conservative assumption)
  const effectiveRpe = rpe != null && rpe >= 5 && rpe <= 10 ? rpe : 8;

  // Calculate reps in reserve
  const rir = rpeToRir(effectiveRpe);

  // Total reps to failure = actual reps + reps in reserve
  const repsToFailure = reps + rir;

  // Apply chosen formula
  if (formula === 'brzycki') {
    return brzycki1RM(weight, repsToFailure);
  }
  return epley1RM(weight, repsToFailure);
}

/**
 * Calculate estimated 1RM from a set, with optional RPE adjustment
 */
export interface SetData {
  weight: number;
  reps: number;
  rpe?: number | null;
  exerciseId: string;
  exerciseName?: string;
  date?: Date | string;
}

export interface Exercise1RM {
  exerciseId: string;
  exerciseName: string;
  estimated1RM: number;
  bestSet: {
    weight: number;
    reps: number;
    rpe: number | null;
    date?: string;
  };
  totalVolume: number;
  setCount: number;
}

/**
 * Calculate 1RM estimates for all exercises from a collection of sets
 * Returns exercises sorted by estimated 1RM (highest first)
 */
export function calculate1RMLeaderboard(
  sets: SetData[],
  options: {
    formula?: 'epley' | 'brzycki';
    minSets?: number;
    excludeWarmups?: boolean;
  } = {}
): Exercise1RM[] {
  const { formula = 'epley', minSets = 1 } = options;

  // Group sets by exercise
  const exerciseMap = new Map<string, {
    exerciseName: string;
    sets: SetData[];
  }>();

  for (const set of sets) {
    if (set.weight <= 0 || set.reps <= 0) continue;

    const existing = exerciseMap.get(set.exerciseId);
    if (existing) {
      existing.sets.push(set);
    } else {
      exerciseMap.set(set.exerciseId, {
        exerciseName: set.exerciseName || set.exerciseId,
        sets: [set],
      });
    }
  }

  // Calculate 1RM for each exercise
  const results: Exercise1RM[] = [];

  for (const [exerciseId, data] of exerciseMap) {
    if (data.sets.length < minSets) continue;

    let best1RM = 0;
    let bestSet: SetData | null = null;
    let totalVolume = 0;

    for (const set of data.sets) {
      const estimated = rpeAdjusted1RM(set.weight, set.reps, set.rpe, formula);
      totalVolume += set.weight * set.reps;

      if (estimated > best1RM) {
        best1RM = estimated;
        bestSet = set;
      }
    }

    if (bestSet && best1RM > 0) {
      results.push({
        exerciseId,
        exerciseName: data.exerciseName,
        estimated1RM: Math.round(best1RM),
        bestSet: {
          weight: bestSet.weight,
          reps: bestSet.reps,
          rpe: bestSet.rpe ?? null,
          date: bestSet.date ? new Date(bestSet.date).toISOString().split('T')[0] : undefined,
        },
        totalVolume: Math.round(totalVolume),
        setCount: data.sets.length,
      });
    }
  }

  // Sort by estimated 1RM (highest first)
  return results.sort((a, b) => b.estimated1RM - a.estimated1RM);
}

/**
 * Calculate volume leaders - exercises ranked by total weight moved
 * Returns exercises sorted by total volume (highest first)
 */
export function calculateVolumeLeaderboard(
  sets: SetData[],
  options: {
    minSets?: number;
  } = {}
): Array<{
  exerciseId: string;
  exerciseName: string;
  totalVolume: number;
  setCount: number;
  avgWeightPerSet: number;
}> {
  const { minSets = 1 } = options;

  // Group sets by exercise
  const exerciseMap = new Map<string, {
    exerciseName: string;
    totalVolume: number;
    totalWeight: number;
    setCount: number;
  }>();

  for (const set of sets) {
    if (set.weight <= 0 || set.reps <= 0) continue;

    const volume = set.weight * set.reps;
    const existing = exerciseMap.get(set.exerciseId);

    if (existing) {
      existing.totalVolume += volume;
      existing.totalWeight += set.weight;
      existing.setCount += 1;
    } else {
      exerciseMap.set(set.exerciseId, {
        exerciseName: set.exerciseName || set.exerciseId,
        totalVolume: volume,
        totalWeight: set.weight,
        setCount: 1,
      });
    }
  }

  // Convert to array and filter by minimum sets
  const results = Array.from(exerciseMap.entries())
    .filter(([, data]) => data.setCount >= minSets)
    .map(([exerciseId, data]) => ({
      exerciseId,
      exerciseName: data.exerciseName,
      totalVolume: Math.round(data.totalVolume),
      setCount: data.setCount,
      avgWeightPerSet: Math.round(data.totalWeight / data.setCount),
    }));

  // Sort by total volume (highest first)
  return results.sort((a, b) => b.totalVolume - a.totalVolume);
}
