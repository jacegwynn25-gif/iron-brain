/**
 * Connective Tissue Stress Monitoring
 *
 * Tracks stress on tendons, ligaments, and joint structures.
 * Critical because connective tissue recovers 5-10x slower than muscle tissue.
 *
 * Key Insight: Muscle can be fully recovered while tendons are still damaged.
 * This mismatch is the #1 cause of overuse injuries in strength athletes.
 *
 * Recovery Timelines:
 * - Muscle: 24-96 hours
 * - Tendons: 120-480 hours (5-20 days)
 * - Ligaments: 240-720 hours (10-30 days)
 * - Cartilage: 360-1080 hours (15-45 days)
 *
 * Research Foundation:
 * - Kjaer (2004): Role of extracellular matrix in adaptation
 * - Magnusson et al. (2010): Tendon properties in strength training
 * - Arampatzis et al. (2007): Mechanical properties of the triceps surae tendon
 * - Cook & Purdam (2009): Tendon pathology continuum
 */

/**
 * Connective Tissue Type
 */
export type ConnectiveTissueType = 'tendon' | 'ligament' | 'cartilage' | 'bursa';

/**
 * Joint Complex - Combination of joint + associated connective tissue
 */
export type JointComplex =
  | 'shoulder' // Rotator cuff, labrum, AC joint, bursa
  | 'elbow' // Biceps tendon, triceps tendon, ulnar collateral ligament
  | 'wrist' // Wrist extensors/flexors, carpal ligaments
  | 'spine' // Spinal erectors, disc, spinal ligaments
  | 'hip' // Hip flexors, glute tendons, labrum
  | 'knee' // Patellar tendon, ACL/PCL/MCL/LCL, meniscus
  | 'ankle'; // Achilles tendon, ankle ligaments

/**
 * Connective Tissue Structure
 */
export interface ConnectiveTissueStructure {
  name: string;
  type: ConnectiveTissueType;
  joint: JointComplex;
  halfLife: number; // Recovery half-life in hours (much longer than muscle)
  vulnerableToEccentric: boolean; // Extra stress from eccentric loading
  vulnerableToBallistic: boolean; // Extra stress from ballistic/plyometric movements
  chronicStressCumulative: boolean; // Does stress accumulate without full recovery?
  injuryThreshold: number; // 0-100 stress level where injury risk becomes high
}

/**
 * Connective Tissue Database
 *
 * Half-life rationale:
 * - Tendons: 200-400 hours (8-17 days)
 * - Ligaments: 300-600 hours (12-25 days)
 * - Cartilage: 400-800 hours (17-33 days)
 */
export const CONNECTIVE_TISSUE_STRUCTURES: Record<string, ConnectiveTissueStructure> = {
  // ==================== SHOULDER COMPLEX ====================
  'Rotator Cuff Tendons': {
    name: 'Rotator Cuff Tendons',
    type: 'tendon',
    joint: 'shoulder',
    halfLife: 288, // 12 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 70
  },
  'Shoulder Labrum': {
    name: 'Shoulder Labrum',
    type: 'cartilage',
    joint: 'shoulder',
    halfLife: 480, // 20 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 60
  },
  'Subacromial Bursa': {
    name: 'Subacromial Bursa',
    type: 'bursa',
    joint: 'shoulder',
    halfLife: 168, // 7 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 75
  },

  // ==================== ELBOW COMPLEX ====================
  'Biceps Tendon (Long Head)': {
    name: 'Biceps Tendon (Long Head)',
    type: 'tendon',
    joint: 'elbow',
    halfLife: 240, // 10 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 70
  },
  'Triceps Tendon': {
    name: 'Triceps Tendon',
    type: 'tendon',
    joint: 'elbow',
    halfLife: 216, // 9 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 75
  },
  'Ulnar Collateral Ligament': {
    name: 'Ulnar Collateral Ligament',
    type: 'ligament',
    joint: 'elbow',
    halfLife: 336, // 14 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 65
  },

  // ==================== WRIST COMPLEX ====================
  'Wrist Extensor Tendons': {
    name: 'Wrist Extensor Tendons',
    type: 'tendon',
    joint: 'wrist',
    halfLife: 192, // 8 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 75
  },
  'Wrist Flexor Tendons': {
    name: 'Wrist Flexor Tendons',
    type: 'tendon',
    joint: 'wrist',
    halfLife: 192, // 8 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 75
  },

  // ==================== SPINE COMPLEX ====================
  'Spinal Erector Tendons': {
    name: 'Spinal Erector Tendons',
    type: 'tendon',
    joint: 'spine',
    halfLife: 360, // 15 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 60 // Very sensitive to overuse
  },
  'Spinal Ligaments': {
    name: 'Spinal Ligaments',
    type: 'ligament',
    joint: 'spine',
    halfLife: 480, // 20 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 55 // Extremely sensitive
  },
  'Intervertebral Discs': {
    name: 'Intervertebral Discs',
    type: 'cartilage',
    joint: 'spine',
    halfLife: 720, // 30 days (VERY slow)
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 50 // Critical structure
  },

  // ==================== HIP COMPLEX ====================
  'Hip Flexor Tendons': {
    name: 'Hip Flexor Tendons',
    type: 'tendon',
    joint: 'hip',
    halfLife: 240, // 10 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 70
  },
  'Glute Tendons': {
    name: 'Glute Tendons',
    type: 'tendon',
    joint: 'hip',
    halfLife: 264, // 11 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: false,
    chronicStressCumulative: true,
    injuryThreshold: 75
  },
  'Hip Labrum': {
    name: 'Hip Labrum',
    type: 'cartilage',
    joint: 'hip',
    halfLife: 480, // 20 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 60
  },

  // ==================== KNEE COMPLEX ====================
  'Patellar Tendon': {
    name: 'Patellar Tendon',
    type: 'tendon',
    joint: 'knee',
    halfLife: 312, // 13 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 65
  },
  'Quadriceps Tendon': {
    name: 'Quadriceps Tendon',
    type: 'tendon',
    joint: 'knee',
    halfLife: 288, // 12 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 70
  },
  'ACL': {
    name: 'ACL',
    type: 'ligament',
    joint: 'knee',
    halfLife: 480, // 20 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: false, // Acute injury, not cumulative
    injuryThreshold: 50
  },
  'Meniscus': {
    name: 'Meniscus',
    type: 'cartilage',
    joint: 'knee',
    halfLife: 600, // 25 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 55
  },

  // ==================== ANKLE COMPLEX ====================
  'Achilles Tendon': {
    name: 'Achilles Tendon',
    type: 'tendon',
    joint: 'ankle',
    halfLife: 336, // 14 days
    vulnerableToEccentric: true,
    vulnerableToBallistic: true,
    chronicStressCumulative: true,
    injuryThreshold: 65
  },
  'Ankle Ligaments': {
    name: 'Ankle Ligaments',
    type: 'ligament',
    joint: 'ankle',
    halfLife: 288, // 12 days
    vulnerableToEccentric: false,
    vulnerableToBallistic: true,
    chronicStressCumulative: false, // Mostly acute sprains
    injuryThreshold: 60
  }
};

/**
 * Exercise Connective Tissue Stress Profile
 *
 * Maps exercises to the connective tissues they stress
 */
export interface ExerciseConnectiveStress {
  exerciseName: string;
  stressedStructures: {
    structure: string;
    baseStress: number; // 0-100 (how much stress this exercise creates)
    eccentricMultiplier: number; // Extra stress if eccentric is emphasized
    ballisticMultiplier: number; // Extra stress if ballistic/explosive
  }[];
}

/**
 * Exercise-Specific Connective Tissue Stress
 *
 * Stress levels (0-100):
 * - 0-20: Minimal stress (isolation exercises, machine-guided)
 * - 20-40: Moderate stress (compound movements with control)
 * - 40-60: High stress (heavy compounds, overhead movements)
 * - 60-80: Very high stress (near-max lifts, ballistic movements)
 * - 80-100: Extreme stress (max effort lifts, plyometrics)
 */
export const EXERCISE_CONNECTIVE_STRESS: Record<string, ExerciseConnectiveStress> = {
  'Barbell Back Squat': {
    exerciseName: 'Barbell Back Squat',
    stressedStructures: [
      { structure: 'Patellar Tendon', baseStress: 50, eccentricMultiplier: 1.4, ballisticMultiplier: 1.3 },
      { structure: 'Quadriceps Tendon', baseStress: 45, eccentricMultiplier: 1.4, ballisticMultiplier: 1.3 },
      { structure: 'Spinal Erector Tendons', baseStress: 55, eccentricMultiplier: 1.2, ballisticMultiplier: 1.2 },
      { structure: 'Spinal Ligaments', baseStress: 60, eccentricMultiplier: 1.1, ballisticMultiplier: 1.4 },
      { structure: 'Hip Flexor Tendons', baseStress: 35, eccentricMultiplier: 1.3, ballisticMultiplier: 1.2 },
      { structure: 'Achilles Tendon', baseStress: 25, eccentricMultiplier: 1.2, ballisticMultiplier: 1.3 }
    ]
  },

  'Conventional Deadlift': {
    exerciseName: 'Conventional Deadlift',
    stressedStructures: [
      { structure: 'Spinal Erector Tendons', baseStress: 70, eccentricMultiplier: 1.3, ballisticMultiplier: 1.2 },
      { structure: 'Spinal Ligaments', baseStress: 75, eccentricMultiplier: 1.2, ballisticMultiplier: 1.5 },
      { structure: 'Intervertebral Discs', baseStress: 65, eccentricMultiplier: 1.1, ballisticMultiplier: 1.4 },
      { structure: 'Glute Tendons', baseStress: 45, eccentricMultiplier: 1.3, ballisticMultiplier: 1.2 },
      { structure: 'Wrist Extensor Tendons', baseStress: 40, eccentricMultiplier: 1.1, ballisticMultiplier: 1.1 }
    ]
  },

  'Barbell Bench Press': {
    exerciseName: 'Barbell Bench Press',
    stressedStructures: [
      { structure: 'Rotator Cuff Tendons', baseStress: 45, eccentricMultiplier: 1.4, ballisticMultiplier: 1.3 },
      { structure: 'Subacromial Bursa', baseStress: 50, eccentricMultiplier: 1.2, ballisticMultiplier: 1.2 },
      { structure: 'Triceps Tendon', baseStress: 40, eccentricMultiplier: 1.3, ballisticMultiplier: 1.3 },
      { structure: 'Biceps Tendon (Long Head)', baseStress: 30, eccentricMultiplier: 1.4, ballisticMultiplier: 1.2 },
      { structure: 'Wrist Extensor Tendons', baseStress: 25, eccentricMultiplier: 1.2, ballisticMultiplier: 1.1 }
    ]
  },

  'Barbell Overhead Press': {
    exerciseName: 'Barbell Overhead Press',
    stressedStructures: [
      { structure: 'Rotator Cuff Tendons', baseStress: 60, eccentricMultiplier: 1.3, ballisticMultiplier: 1.4 },
      { structure: 'Subacromial Bursa', baseStress: 65, eccentricMultiplier: 1.2, ballisticMultiplier: 1.3 },
      { structure: 'Shoulder Labrum', baseStress: 50, eccentricMultiplier: 1.2, ballisticMultiplier: 1.5 },
      { structure: 'Triceps Tendon', baseStress: 45, eccentricMultiplier: 1.3, ballisticMultiplier: 1.3 },
      { structure: 'Spinal Erector Tendons', baseStress: 40, eccentricMultiplier: 1.2, ballisticMultiplier: 1.2 }
    ]
  },

  'Pull-Up': {
    exerciseName: 'Pull-Up',
    stressedStructures: [
      { structure: 'Biceps Tendon (Long Head)', baseStress: 45, eccentricMultiplier: 1.5, ballisticMultiplier: 1.3 },
      { structure: 'Rotator Cuff Tendons', baseStress: 40, eccentricMultiplier: 1.3, ballisticMultiplier: 1.3 },
      { structure: 'Ulnar Collateral Ligament', baseStress: 35, eccentricMultiplier: 1.2, ballisticMultiplier: 1.4 },
      { structure: 'Wrist Flexor Tendons', baseStress: 30, eccentricMultiplier: 1.2, ballisticMultiplier: 1.1 }
    ]
  },

  'Barbell Row': {
    exerciseName: 'Barbell Row',
    stressedStructures: [
      { structure: 'Spinal Erector Tendons', baseStress: 55, eccentricMultiplier: 1.3, ballisticMultiplier: 1.2 },
      { structure: 'Spinal Ligaments', baseStress: 50, eccentricMultiplier: 1.2, ballisticMultiplier: 1.3 },
      { structure: 'Biceps Tendon (Long Head)', baseStress: 35, eccentricMultiplier: 1.4, ballisticMultiplier: 1.2 },
      { structure: 'Wrist Flexor Tendons', baseStress: 40, eccentricMultiplier: 1.2, ballisticMultiplier: 1.1 }
    ]
  }
};

/**
 * Connective Tissue Stress State
 */
export interface ConnectiveTissueState {
  structure: string;
  currentStress: number; // 0-100
  recoveryPercentage: number; // 0-100
  lastStressedAt: Date | null;
  estimatedFullRecoveryAt: Date | null;
  isAtRisk: boolean; // Stress > injuryThreshold
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

/**
 * Calculate connective tissue stress from a training session
 *
 * @param exerciseName - Exercise performed
 * @param sets - Number of sets
 * @param reps - Reps per set
 * @param rpe - RPE (6-10)
 * @param isEccentric - Emphasized eccentric phase?
 * @param isBallistic - Ballistic/explosive movement?
 * @returns Map of structure -> stress created (0-100)
 */
export function calculateConnectiveTissueStress(
  exerciseName: string,
  sets: number,
  reps: number,
  rpe: number,
  isEccentric: boolean = false,
  isBallistic: boolean = false
): Map<string, number> {
  const stressMap = new Map<string, number>();

  const exerciseStress = EXERCISE_CONNECTIVE_STRESS[exerciseName];
  if (!exerciseStress) return stressMap;

  // Volume multiplier (more sets = more cumulative stress)
  const volumeMultiplier = 1 + (sets - 1) * 0.15; // 1.0 at 1 set, 1.6 at 5 sets

  // Intensity multiplier (RPE affects connective tissue stress)
  const intensityMultiplier = 0.5 + ((rpe - 6) / 4) * 0.8; // 0.5 at RPE 6, 1.3 at RPE 10

  for (const stressProfile of exerciseStress.stressedStructures) {
    let stress = stressProfile.baseStress;

    // Apply eccentric multiplier if emphasized
    if (isEccentric) {
      stress *= stressProfile.eccentricMultiplier;
    }

    // Apply ballistic multiplier if explosive
    if (isBallistic) {
      stress *= stressProfile.ballisticMultiplier;
    }

    // Apply volume and intensity
    stress *= volumeMultiplier * intensityMultiplier;

    stressMap.set(stressProfile.structure, Math.min(100, stress));
  }

  return stressMap;
}

/**
 * Calculate connective tissue recovery using exponential decay
 *
 * @param structure - Connective tissue structure
 * @param currentStress - Current stress level (0-100)
 * @param hoursSinceLastStress - Hours since last stressed
 * @returns New stress level after recovery
 */
export function recoverConnectiveTissue(
  structureName: string,
  currentStress: number,
  hoursSinceLastStress: number
): number {
  const structure = CONNECTIVE_TISSUE_STRUCTURES[structureName];
  if (!structure) return currentStress;

  // Exponential decay
  const k = Math.LN2 / structure.halfLife;
  const remainingStress = currentStress * Math.exp(-k * hoursSinceLastStress);

  return Math.max(0, remainingStress);
}

/**
 * Build connective tissue state from workout history
 *
 * @param structureName - Connective tissue structure
 * @param workoutHistory - Historical training events
 * @param currentTime - Current timestamp
 * @returns Complete connective tissue state
 */
export function buildConnectiveTissueState(
  structureName: string,
  workoutHistory: {
    timestamp: Date;
    exerciseName: string;
    sets: number;
    reps: number;
    rpe: number;
    isEccentric?: boolean;
    isBallistic?: boolean;
  }[],
  currentTime: Date = new Date()
): ConnectiveTissueState {
  const structure = CONNECTIVE_TISSUE_STRUCTURES[structureName];
  if (!structure) {
    return {
      structure: structureName,
      currentStress: 0,
      recoveryPercentage: 100,
      lastStressedAt: null,
      estimatedFullRecoveryAt: null,
      isAtRisk: false,
      riskLevel: 'low'
    };
  }

  let cumulativeStress = 0;
  let lastStressedAt: Date | null = null;

  // Sort chronologically
  const sortedWorkouts = [...workoutHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (const workout of sortedWorkouts) {
    const hoursSinceWorkout = (currentTime.getTime() - workout.timestamp.getTime()) / (1000 * 60 * 60);

    // Calculate stress from this workout
    const stressMap = calculateConnectiveTissueStress(
      workout.exerciseName,
      workout.sets,
      workout.reps,
      workout.rpe,
      workout.isEccentric,
      workout.isBallistic
    );

    const workoutStress = stressMap.get(structureName) ?? 0;

    if (workoutStress > 0) {
      // Add decayed stress from this workout
      const decayedStress = recoverConnectiveTissue(structureName, workoutStress, hoursSinceWorkout);

      if (structure.chronicStressCumulative) {
        // Cumulative stress (doesn't fully reset between workouts)
        cumulativeStress += decayedStress;
      } else {
        // Non-cumulative (take max, like ACL)
        cumulativeStress = Math.max(cumulativeStress, decayedStress);
      }

      lastStressedAt = workout.timestamp;
    }
  }

  const currentStress = Math.min(100, cumulativeStress);
  const recoveryPercentage = 100 - currentStress;

  // Estimate full recovery time
  let estimatedFullRecoveryAt: Date | null = null;
  if (currentStress > 5 && lastStressedAt) {
    const k = Math.LN2 / structure.halfLife;
    const hoursToRecovery = -Math.log(5 / Math.max(currentStress, 5)) / k;
    estimatedFullRecoveryAt = new Date(lastStressedAt.getTime() + hoursToRecovery * 60 * 60 * 1000);
  }

  // Risk assessment
  const isAtRisk = currentStress >= structure.injuryThreshold;
  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  if (currentStress >= structure.injuryThreshold * 1.3) {
    riskLevel = 'critical';
  } else if (currentStress >= structure.injuryThreshold) {
    riskLevel = 'high';
  } else if (currentStress >= structure.injuryThreshold * 0.7) {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'low';
  }

  return {
    structure: structureName,
    currentStress,
    recoveryPercentage,
    lastStressedAt,
    estimatedFullRecoveryAt,
    isAtRisk,
    riskLevel
  };
}

/**
 * Get connective tissue recommendations
 *
 * @param state - Current connective tissue state
 * @returns Actionable recommendations
 */
export function getConnectiveTissueRecommendations(
  state: ConnectiveTissueState
): {
  warnings: string[];
  recommendations: string[];
  shouldRest: boolean;
  shouldDeload: boolean;
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const structure = CONNECTIVE_TISSUE_STRUCTURES[state.structure];

  if (state.riskLevel === 'critical') {
    warnings.push(`CRITICAL: ${state.structure} stress at ${state.currentStress.toFixed(0)}%. High injury risk!`);
    recommendations.push(`Take 7-14 days rest from exercises stressing ${state.structure}.`);
    recommendations.push('Consider seeing a sports medicine professional.');
  } else if (state.riskLevel === 'high') {
    warnings.push(`HIGH RISK: ${state.structure} stress at ${state.currentStress.toFixed(0)}%.`);
    recommendations.push(`Reduce volume by 50% for ${structure?.joint} exercises.`);
    recommendations.push(`Consider 3-5 days rest before training ${structure?.joint} again.`);
  } else if (state.riskLevel === 'moderate') {
    warnings.push(`Moderate stress on ${state.structure} (${state.currentStress.toFixed(0)}%).`);
    recommendations.push(`Reduce volume by 20-30% for ${structure?.joint} exercises.`);
    recommendations.push('Focus on controlled tempos (avoid ballistic movements).');
  }

  const shouldRest = state.riskLevel === 'critical';
  const shouldDeload = state.riskLevel === 'high' || state.riskLevel === 'moderate';

  return {
    warnings,
    recommendations,
    shouldRest,
    shouldDeload
  };
}
