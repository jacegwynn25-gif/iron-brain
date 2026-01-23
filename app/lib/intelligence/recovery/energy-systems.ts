/**
 * Energy System Depletion Tracking
 *
 * Models the three energy systems used during resistance training:
 * 1. Phosphocreatine (PCr) - Immediate energy (0-10 seconds)
 * 2. Glycogen (Glycolytic) - Short-term energy (10-120 seconds)
 * 3. Intramuscular Triglycerides (IMTG) - Long-term energy (>2 minutes)
 *
 * Research Foundation:
 * - Greenhaff (1995): Creatine phosphate and anaerobic energy provision
 * - Ivy et al. (1988): Muscle glycogen resynthesis after exercise
 * - Casey et al. (1996): Metabolic response during resistance exercise
 * - MacDougall et al. (1999): Muscle substrate utilization during resistance training
 * - Haff & Triplett (2016): Essentials of Strength Training and Conditioning
 */

import { MUSCLE_RECOVERY_CONSTANTS } from './muscle-architecture';
import { getExercisePattern } from './exercise-patterns';

/**
 * Energy System Type
 */
export type EnergySystem = 'phosphocreatine' | 'glycogen' | 'imtg';

/**
 * Energy System State for a specific muscle
 */
export interface EnergySystemState {
  muscleName: string;
  phosphocreatine: number; // 0-100% (100 = fully loaded)
  glycogen: number; // 0-100% (100 = fully loaded)
  imtg: number; // 0-100% (100 = fully loaded)
  lastDepletionTimestamp: Date | null;
  estimatedFullReplenishmentAt: Date | null;
}

/**
 * Training Set Energy Depletion
 */
export interface SetEnergyDepletion {
  exerciseName: string;
  muscleName: string;
  timestamp: Date;
  pcrDepletion: number; // Amount of PCr depleted (0-100)
  glycogenDepletion: number; // Amount of glycogen depleted (0-100)
  imtgDepletion: number; // Amount of IMTG depleted (0-100)
  setDuration: number; // Seconds
  restInterval: number; // Seconds before next set
}

/**
 * Calculate PCr depletion from a single set
 *
 * PCr System:
 * - Dominant for 0-10 second max efforts (1-3 reps at RPE 9-10)
 * - 30-60 seconds of max effort = near-complete depletion
 * - 80% recovery in 3-5 minutes rest
 * - 100% recovery in 8-10 minutes rest
 *
 * @param reps - Number of reps
 * @param rpe - RPE (6-10 scale, higher = more depletion)
 * @param setDuration - Seconds (typical = 20-40s for hypertrophy)
 * @returns PCr depletion percentage (0-100)
 */
export function calculatePCrDepletion(
  reps: number,
  rpe: number,
  setDuration: number
): number {
  // High-intensity sets (RPE 9-10, low reps) = high PCr demand
  const intensityFactor = rpe >= 9 ? 1.0 : rpe >= 7 ? 0.7 : 0.4;

  // Longer sets = more depletion (up to saturation at ~60 seconds)
  const durationFactor = Math.min(1.0, setDuration / 60);

  // Low reps (1-5) = very high PCr demand (power/strength)
  // High reps (15+) = lower PCr demand (more glycolytic)
  const repRangeFactor = reps <= 5 ? 1.2 : reps <= 10 ? 1.0 : 0.6;

  const depletion = 40 * intensityFactor * durationFactor * repRangeFactor;

  return Math.min(100, Math.max(0, depletion));
}

/**
 * Calculate PCr recovery after rest interval
 *
 * Recovery curve (exponential):
 * - 1 min rest = 50% recovery
 * - 3 min rest = 80% recovery
 * - 5 min rest = 90% recovery
 * - 8-10 min rest = 100% recovery
 *
 * @param currentPCr - Current PCr level (0-100)
 * @param restSeconds - Rest interval in seconds
 * @returns New PCr level after rest (0-100)
 */
export function recoverPCr(
  currentPCr: number,
  restSeconds: number
): number {
  const maxPCr = 100;
  const deficit = maxPCr - currentPCr;

  // Half-life of PCr recovery ≈ 3 minutes (180 seconds)
  const halfLife = 180;
  const k = Math.LN2 / halfLife;

  // Exponential recovery: recovered = deficit × (1 - e^(-kt))
  const recoveredAmount = deficit * (1 - Math.exp(-k * restSeconds));

  return Math.min(maxPCr, currentPCr + recoveredAmount);
}

/**
 * Calculate glycogen depletion from a single set
 *
 * Glycogen System:
 * - Dominant for 10-120 second efforts (hypertrophy sets)
 * - 60-90 minutes of resistance training = 30-40% muscle glycogen depletion
 * - High-rep sets (10-20 reps) = high glycolytic demand
 * - 24-48 hour recovery with proper nutrition (carbs)
 *
 * @param reps - Number of reps
 * @param sets - Number of sets
 * @param rpe - RPE (6-10 scale)
 * @param setDuration - Seconds
 * @returns Glycogen depletion percentage (0-100)
 */
export function calculateGlycogenDepletion(
  reps: number,
  sets: number,
  rpe: number,
  setDuration: number
): number {
  // Hypertrophy range (8-15 reps) = highest glycolytic demand
  const repRangeFactor = reps >= 8 && reps <= 15 ? 1.2 :
                        reps > 15 ? 1.5 : // Very high reps = extreme glycolytic
                        0.6; // Low reps = more PCr-dominant

  // Intensity (RPE) affects glycolytic flux rate
  const intensityFactor = (rpe - 6) / 4; // 0.0 at RPE 6, 1.0 at RPE 10

  // Duration of glycolytic work
  const durationFactor = Math.min(1.0, setDuration / 60);

  // Per-set depletion (typical set = 2-5% glycogen depletion)
  const depletionPerSet = 3.5 * repRangeFactor * intensityFactor * durationFactor;

  // Total depletion (multiple sets compound)
  const totalDepletion = depletionPerSet * sets;

  return Math.min(100, Math.max(0, totalDepletion));
}

/**
 * Calculate glycogen recovery over time
 *
 * Recovery timeline:
 * - 0-2 hours post-workout: Minimal recovery (need carbs + insulin spike)
 * - 2-24 hours: Linear recovery (5-10% per hour with proper nutrition)
 * - 24-48 hours: Final 20% recovery (slower)
 *
 * Factors:
 * - Carb intake (high carb = faster recovery)
 * - Training status (trained athletes resynthesize faster)
 * - Muscle damage (damaged muscle = slower glycogen storage)
 *
 * @param currentGlycogen - Current glycogen level (0-100)
 * @param hoursSinceDepletion - Hours since workout
 * @param nutritionQuality - Nutrition quality (0-1, where 1 = optimal carb intake)
 * @returns New glycogen level (0-100)
 */
export function recoverGlycogen(
  currentGlycogen: number,
  hoursSinceDepletion: number,
  nutritionQuality: number = 0.8 // Default: decent nutrition
): number {
  const maxGlycogen = 100;
  const deficit = maxGlycogen - currentGlycogen;

  if (deficit <= 0) return maxGlycogen;

  // Phase 1 (0-2 hours): Slow recovery (need nutrients)
  // Phase 2 (2-24 hours): Fast linear recovery
  // Phase 3 (24-48 hours): Slow final recovery

  let recovered = 0;

  if (hoursSinceDepletion <= 2) {
    // Slow initial recovery: ~2% per hour
    recovered = deficit * (hoursSinceDepletion / 2) * 0.1 * nutritionQuality;
  } else if (hoursSinceDepletion <= 24) {
    // Fast recovery phase: ~8% per hour
    const phase1Recovery = deficit * 0.1 * nutritionQuality;
    const phase2Hours = hoursSinceDepletion - 2;
    const phase2Recovery = deficit * (phase2Hours / 22) * 0.7 * nutritionQuality;
    recovered = phase1Recovery + phase2Recovery;
  } else {
    // Final slow recovery: remaining deficit over 24 hours
    const phase1Recovery = deficit * 0.1 * nutritionQuality;
    const phase2Recovery = deficit * 0.7 * nutritionQuality;
    const phase3Hours = hoursSinceDepletion - 24;
    const remainingDeficit = deficit - phase1Recovery - phase2Recovery;
    const phase3Recovery = remainingDeficit * Math.min(1.0, phase3Hours / 24);
    recovered = phase1Recovery + phase2Recovery + phase3Recovery;
  }

  return Math.min(maxGlycogen, currentGlycogen + recovered);
}

/**
 * Calculate IMTG depletion from a single set
 *
 * IMTG (Intramuscular Triglycerides):
 * - Used minimally in strength training (more for endurance)
 * - 1-2% depletion per set (low intensity aerobic component)
 * - 12-24 hour recovery
 *
 * @param setDuration - Seconds
 * @param sets - Number of sets
 * @returns IMTG depletion percentage (0-100)
 */
export function calculateIMTGDepletion(
  setDuration: number,
  sets: number
): number {
  // IMTG used minimally in resistance training
  const depletionPerSet = 1.5 * (setDuration / 60); // ~1.5% per minute
  const totalDepletion = depletionPerSet * sets;

  return Math.min(100, Math.max(0, totalDepletion));
}

/**
 * Calculate IMTG recovery over time
 *
 * Recovery timeline: 12-24 hours with proper nutrition
 *
 * @param currentIMTG - Current IMTG level (0-100)
 * @param hoursSinceDepletion - Hours since workout
 * @returns New IMTG level (0-100)
 */
export function recoverIMTG(
  currentIMTG: number,
  hoursSinceDepletion: number
): number {
  const maxIMTG = 100;
  const deficit = maxIMTG - currentIMTG;

  if (deficit <= 0) return maxIMTG;

  // Linear recovery over 18 hours
  const recoveryRate = deficit / 18;
  const recovered = Math.min(deficit, recoveryRate * hoursSinceDepletion);

  return Math.min(maxIMTG, currentIMTG + recovered);
}

/**
 * Calculate energy system depletion for an entire workout session
 *
 * @param exercises - Array of exercises with sets/reps/RPE
 * @param muscleName - Target muscle group
 * @returns Energy depletion amounts
 */
export function calculateSessionEnergyDepletion(
  exercises: {
    exerciseName: string;
    sets: number;
    reps: number;
    rpe: number;
    setDuration: number; // Seconds per set
    restInterval: number; // Seconds between sets
  }[],
  muscleName: string
): {
  totalPCrDepletion: number;
  totalGlycogenDepletion: number;
  totalIMTGDepletion: number;
  finalPCrLevel: number; // PCr at end of workout (accounts for rest between sets)
} {
  let cumulativePCr = 100; // Start fully loaded
  let totalGlycogenDepletion = 0;
  let totalIMTGDepletion = 0;

  for (const exercise of exercises) {
    const pattern = getExercisePattern(exercise.exerciseName);
    if (!pattern) continue;

    // Check if exercise involves this muscle
    const involvement = pattern.muscleInvolvement.find(m => m.muscle === muscleName);
    if (!involvement) continue;

    // Scale depletion by muscle involvement
    const involvementScale = involvement.percentage / 100;

    for (let set = 0; set < exercise.sets; set++) {
      // Deplete PCr for this set
      const pcrDep = calculatePCrDepletion(exercise.reps, exercise.rpe, exercise.setDuration);
      cumulativePCr = Math.max(0, cumulativePCr - pcrDep * involvementScale);

      // Recover PCr during rest interval
      if (set < exercise.sets - 1) {
        cumulativePCr = recoverPCr(cumulativePCr, exercise.restInterval);
      }
    }

    // Glycogen depletion (cumulative across sets)
    const glycogenDep = calculateGlycogenDepletion(
      exercise.reps,
      exercise.sets,
      exercise.rpe,
      exercise.setDuration
    );
    totalGlycogenDepletion += glycogenDep * involvementScale;

    // IMTG depletion (minimal)
    const imtgDep = calculateIMTGDepletion(exercise.setDuration, exercise.sets);
    totalIMTGDepletion += imtgDep * involvementScale;
  }

  return {
    totalPCrDepletion: 100 - cumulativePCr,
    totalGlycogenDepletion: Math.min(100, totalGlycogenDepletion),
    totalIMTGDepletion: Math.min(100, totalIMTGDepletion),
    finalPCrLevel: cumulativePCr
  };
}

/**
 * Build energy system state for a muscle from workout history
 *
 * @param muscleName - Target muscle
 * @param workoutHistory - Recent workout sessions
 * @param currentTime - Current timestamp
 * @param nutritionQuality - Nutrition quality (0-1)
 * @returns Complete energy system state
 */
export function buildEnergySystemState(
  muscleName: string,
  workoutHistory: {
    timestamp: Date;
    exercises: {
      exerciseName: string;
      sets: number;
      reps: number;
      rpe: number;
      setDuration: number;
      restInterval: number;
    }[];
  }[],
  currentTime: Date = new Date(),
  nutritionQuality: number = 0.8
): EnergySystemState {
  let currentPCr = 100;
  let currentGlycogen = 100;
  let currentIMTG = 100;
  let lastDepletionTimestamp: Date | null = null;

  // Sort workouts chronologically
  const sortedWorkouts = [...workoutHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (const workout of sortedWorkouts) {
    const hoursSinceWorkout = (currentTime.getTime() - workout.timestamp.getTime()) / (1000 * 60 * 60);

    // Calculate depletion from this workout
    const depletion = calculateSessionEnergyDepletion(workout.exercises, muscleName);

    // Apply depletion at time of workout, then recover to current time
    const pcrAfterWorkout = Math.max(0, currentPCr - depletion.totalPCrDepletion);
    const glycogenAfterWorkout = Math.max(0, currentGlycogen - depletion.totalGlycogenDepletion);
    const imtgAfterWorkout = Math.max(0, currentIMTG - depletion.totalIMTGDepletion);

    // Recover from workout to current time
    currentPCr = recoverPCr(pcrAfterWorkout, hoursSinceWorkout * 60 * 60); // Convert to seconds
    currentGlycogen = recoverGlycogen(glycogenAfterWorkout, hoursSinceWorkout, nutritionQuality);
    currentIMTG = recoverIMTG(imtgAfterWorkout, hoursSinceWorkout);

    lastDepletionTimestamp = workout.timestamp;
  }

  // Estimate full replenishment time (when glycogen reaches 95%)
  let estimatedFullReplenishmentAt: Date | null = null;
  if (currentGlycogen < 95 && lastDepletionTimestamp) {
    const deficit = 100 - currentGlycogen;
    const hoursToReplenish = (deficit / 100) * 36; // ~36 hours for full recovery
    estimatedFullReplenishmentAt = new Date(lastDepletionTimestamp.getTime() + hoursToReplenish * 60 * 60 * 1000);
  }

  return {
    muscleName,
    phosphocreatine: currentPCr,
    glycogen: currentGlycogen,
    imtg: currentIMTG,
    lastDepletionTimestamp,
    estimatedFullReplenishmentAt
  };
}

/**
 * Get energy system readiness recommendations
 *
 * @param energyState - Current energy system state
 * @returns Actionable recommendations
 */
export function getEnergySystemRecommendations(
  energyState: EnergySystemState
): {
  canTrainHeavy: boolean; // Can handle low-rep heavy sets (needs PCr)
  canTrainVolume: boolean; // Can handle high-volume hypertrophy (needs glycogen)
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // PCr check (needed for strength/power)
  const canTrainHeavy = energyState.phosphocreatine >= 85;
  if (energyState.phosphocreatine < 70) {
    warnings.push(`${energyState.muscleName} PCr at ${energyState.phosphocreatine.toFixed(0)}% (low). Strength may be compromised.`);
    recommendations.push('Consider longer rest intervals (3-5 min) between heavy sets.');
  }

  // Glycogen check (needed for volume)
  const canTrainVolume = energyState.glycogen >= 70;
  if (energyState.glycogen < 50) {
    warnings.push(`${energyState.muscleName} glycogen at ${energyState.glycogen.toFixed(0)}% (depleted). Reduce volume.`);
    recommendations.push('Consume 30-50g carbs pre-workout. Consider deload or rest day.');
  } else if (energyState.glycogen < 70) {
    warnings.push(`${energyState.muscleName} glycogen at ${energyState.glycogen.toFixed(0)}% (moderate).`);
    recommendations.push('Reduce volume by 20-30% or focus on strength (low reps) instead of hypertrophy.');
  }

  // IMTG check (rarely an issue in strength training)
  if (energyState.imtg < 60) {
    warnings.push(`${energyState.muscleName} IMTG at ${energyState.imtg.toFixed(0)}% (low endurance capacity).`);
  }

  return {
    canTrainHeavy,
    canTrainVolume,
    warnings,
    recommendations
  };
}
