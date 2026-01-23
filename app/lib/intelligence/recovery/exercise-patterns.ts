/**
 * Exercise-Specific Recovery Patterns
 *
 * Movement pattern neural demand and coordination recovery constants.
 * This captures the fact that exercises targeting the same muscle can have
 * vastly different recovery timelines due to neural/coordination/systemic demands.
 *
 * Example: Back Squat vs Leg Press both hit quads, but:
 * - Back Squat: 84h half-life (axial loading, high CNS demand, spinal stress)
 * - Leg Press: 48h half-life (machine-guided, low CNS demand, no spinal load)
 *
 * Research Foundation:
 * - Zatsiorsky & Kraemer (2006): Movement complexity affects recovery
 * - González-Badillo & Sánchez-Medina (2010): Neural fatigue in complex movements
 * - Schoenfeld & Grgic (2020): Exercise-specific fatigue patterns
 * - Stone et al. (2007): Axial loading and systemic recovery
 */

/**
 * Exercise Complexity Tiers
 *
 * Tier 3 (Axial/Systemic): Deadlifts, squats, overhead press
 * - High CNS demand, spinal loading, whole-body coordination
 * - Recovery: 72-96h half-life
 *
 * Tier 2 (Compound Multi-Joint): Bench press, rows, lunges
 * - Moderate CNS demand, multi-muscle coordination
 * - Recovery: 48-72h half-life
 *
 * Tier 1 (Isolation Single-Joint): Curls, extensions, flyes
 * - Low CNS demand, single-muscle focus
 * - Recovery: 24-36h half-life
 */
export type ExerciseComplexityTier = 1 | 2 | 3;

/**
 * Exercise Pattern Classification
 */
export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'lunge'
  | 'isolation_upper'
  | 'isolation_lower'
  | 'core'
  | 'carry';

/**
 * Muscle Involvement in Exercise
 */
export interface MuscleInvolvement {
  muscle: string;
  percentage: number; // 0-100% (how much this muscle is involved)
  isPrimary: boolean; // Primary mover vs secondary/stabilizer
}

/**
 * Exercise Recovery Pattern
 */
export interface ExercisePattern {
  exerciseName: string;
  movementPattern: MovementPattern;
  complexityTier: ExerciseComplexityTier;
  halfLife: number; // Movement-pattern recovery half-life in hours
  cnsLoad: number; // CNS complexity factor (0-10 scale)
  technicalDemand: number; // Skill/coordination demand (0-10 scale)
  spinalLoad: boolean; // Does exercise load the spine axially?
  muscleInvolvement: MuscleInvolvement[]; // Primary + secondary muscles
  stabilizationDemand: number; // Stabilizer muscle demand (0-10 scale)
}

/**
 * Exercise Recovery Database
 *
 * Half-life rationale:
 * - Tier 3 Axial: 72-96h (CNS + muscle + spinal recovery)
 * - Tier 2 Compound: 48-72h (muscle + coordination)
 * - Tier 1 Isolation: 24-36h (muscle only, minimal CNS)
 */
export const EXERCISE_PATTERNS: Record<string, ExercisePattern> = {
  // ==================== TIER 3: AXIAL/SYSTEMIC ====================

  'Barbell Back Squat': {
    exerciseName: 'Barbell Back Squat',
    movementPattern: 'squat',
    complexityTier: 3,
    halfLife: 84,
    cnsLoad: 9,
    technicalDemand: 8,
    spinalLoad: true,
    stabilizationDemand: 9,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 80, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 50, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 70, isPrimary: false },
      { muscle: 'Abs', percentage: 60, isPrimary: false },
      { muscle: 'Upper Back', percentage: 40, isPrimary: false }
    ]
  },

  'Barbell Front Squat': {
    exerciseName: 'Barbell Front Squat',
    movementPattern: 'squat',
    complexityTier: 3,
    halfLife: 78,
    cnsLoad: 9,
    technicalDemand: 9,
    spinalLoad: true,
    stabilizationDemand: 10,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 60, isPrimary: true },
      { muscle: 'Erector Spinae', percentage: 80, isPrimary: false },
      { muscle: 'Abs', percentage: 90, isPrimary: false },
      { muscle: 'Upper Back', percentage: 60, isPrimary: false }
    ]
  },

  'Conventional Deadlift': {
    exerciseName: 'Conventional Deadlift',
    movementPattern: 'hinge',
    complexityTier: 3,
    halfLife: 96,
    cnsLoad: 10,
    technicalDemand: 8,
    spinalLoad: true,
    stabilizationDemand: 10,
    muscleInvolvement: [
      { muscle: 'Hamstrings', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 100, isPrimary: true },
      { muscle: 'Erector Spinae', percentage: 100, isPrimary: true },
      { muscle: 'Lats', percentage: 70, isPrimary: false },
      { muscle: 'Traps', percentage: 80, isPrimary: false },
      { muscle: 'Forearms', percentage: 90, isPrimary: false },
      { muscle: 'Quads', percentage: 40, isPrimary: false }
    ]
  },

  'Sumo Deadlift': {
    exerciseName: 'Sumo Deadlift',
    movementPattern: 'hinge',
    complexityTier: 3,
    halfLife: 90,
    cnsLoad: 10,
    technicalDemand: 9,
    spinalLoad: true,
    stabilizationDemand: 9,
    muscleInvolvement: [
      { muscle: 'Glutes', percentage: 100, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 80, isPrimary: true },
      { muscle: 'Quads', percentage: 70, isPrimary: true },
      { muscle: 'Erector Spinae', percentage: 80, isPrimary: false },
      { muscle: 'Traps', percentage: 70, isPrimary: false },
      { muscle: 'Forearms', percentage: 90, isPrimary: false }
    ]
  },

  'Romanian Deadlift': {
    exerciseName: 'Romanian Deadlift',
    movementPattern: 'hinge',
    complexityTier: 3,
    halfLife: 78,
    cnsLoad: 7,
    technicalDemand: 7,
    spinalLoad: true,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Hamstrings', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 90, isPrimary: true },
      { muscle: 'Erector Spinae', percentage: 70, isPrimary: false },
      { muscle: 'Forearms', percentage: 60, isPrimary: false }
    ]
  },

  'Barbell Overhead Press': {
    exerciseName: 'Barbell Overhead Press',
    movementPattern: 'vertical_push',
    complexityTier: 3,
    halfLife: 72,
    cnsLoad: 8,
    technicalDemand: 8,
    spinalLoad: true,
    stabilizationDemand: 9,
    muscleInvolvement: [
      { muscle: 'Front Delts', percentage: 100, isPrimary: true },
      { muscle: 'Side Delts', percentage: 70, isPrimary: true },
      { muscle: 'Triceps', percentage: 80, isPrimary: false },
      { muscle: 'Upper Back', percentage: 50, isPrimary: false },
      { muscle: 'Abs', percentage: 60, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 50, isPrimary: false }
    ]
  },

  'Clean and Press': {
    exerciseName: 'Clean and Press',
    movementPattern: 'vertical_push',
    complexityTier: 3,
    halfLife: 96,
    cnsLoad: 10,
    technicalDemand: 10,
    spinalLoad: true,
    stabilizationDemand: 10,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 80, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 70, isPrimary: true },
      { muscle: 'Glutes', percentage: 70, isPrimary: true },
      { muscle: 'Front Delts', percentage: 100, isPrimary: true },
      { muscle: 'Traps', percentage: 90, isPrimary: false },
      { muscle: 'Triceps', percentage: 80, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 80, isPrimary: false }
    ]
  },

  // ==================== TIER 2: COMPOUND MULTI-JOINT ====================

  'Barbell Bench Press': {
    exerciseName: 'Barbell Bench Press',
    movementPattern: 'horizontal_push',
    complexityTier: 2,
    halfLife: 60,
    cnsLoad: 6,
    technicalDemand: 6,
    spinalLoad: false,
    stabilizationDemand: 6,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 100, isPrimary: true },
      { muscle: 'Front Delts', percentage: 70, isPrimary: true },
      { muscle: 'Triceps', percentage: 80, isPrimary: true },
      { muscle: 'Lats', percentage: 30, isPrimary: false }
    ]
  },

  'Incline Bench Press': {
    exerciseName: 'Incline Bench Press',
    movementPattern: 'horizontal_push',
    complexityTier: 2,
    halfLife: 54,
    cnsLoad: 5,
    technicalDemand: 5,
    spinalLoad: false,
    stabilizationDemand: 5,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 90, isPrimary: true },
      { muscle: 'Front Delts', percentage: 90, isPrimary: true },
      { muscle: 'Triceps', percentage: 70, isPrimary: true }
    ]
  },

  'Dumbbell Bench Press': {
    exerciseName: 'Dumbbell Bench Press',
    movementPattern: 'horizontal_push',
    complexityTier: 2,
    halfLife: 54,
    cnsLoad: 5,
    technicalDemand: 6,
    spinalLoad: false,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 100, isPrimary: true },
      { muscle: 'Front Delts', percentage: 60, isPrimary: true },
      { muscle: 'Triceps', percentage: 70, isPrimary: true }
    ]
  },

  'Barbell Row': {
    exerciseName: 'Barbell Row',
    movementPattern: 'horizontal_pull',
    complexityTier: 2,
    halfLife: 66,
    cnsLoad: 7,
    technicalDemand: 7,
    spinalLoad: true,
    stabilizationDemand: 8,
    muscleInvolvement: [
      { muscle: 'Lats', percentage: 100, isPrimary: true },
      { muscle: 'Upper Back', percentage: 90, isPrimary: true },
      { muscle: 'Rear Delts', percentage: 70, isPrimary: true },
      { muscle: 'Biceps', percentage: 60, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 60, isPrimary: false },
      { muscle: 'Forearms', percentage: 70, isPrimary: false }
    ]
  },

  'Pendlay Row': {
    exerciseName: 'Pendlay Row',
    movementPattern: 'horizontal_pull',
    complexityTier: 2,
    halfLife: 72,
    cnsLoad: 8,
    technicalDemand: 8,
    spinalLoad: true,
    stabilizationDemand: 9,
    muscleInvolvement: [
      { muscle: 'Lats', percentage: 100, isPrimary: true },
      { muscle: 'Upper Back', percentage: 100, isPrimary: true },
      { muscle: 'Rear Delts', percentage: 80, isPrimary: true },
      { muscle: 'Biceps', percentage: 50, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 70, isPrimary: false },
      { muscle: 'Hamstrings', percentage: 40, isPrimary: false }
    ]
  },

  'Pull-Up': {
    exerciseName: 'Pull-Up',
    movementPattern: 'vertical_pull',
    complexityTier: 2,
    halfLife: 60,
    cnsLoad: 6,
    technicalDemand: 7,
    spinalLoad: false,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Lats', percentage: 100, isPrimary: true },
      { muscle: 'Upper Back', percentage: 70, isPrimary: true },
      { muscle: 'Biceps', percentage: 80, isPrimary: true },
      { muscle: 'Rear Delts', percentage: 50, isPrimary: false },
      { muscle: 'Forearms', percentage: 80, isPrimary: false },
      { muscle: 'Abs', percentage: 40, isPrimary: false }
    ]
  },

  'Weighted Dip': {
    exerciseName: 'Weighted Dip',
    movementPattern: 'vertical_push',
    complexityTier: 2,
    halfLife: 54,
    cnsLoad: 6,
    technicalDemand: 6,
    spinalLoad: false,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 90, isPrimary: true },
      { muscle: 'Triceps', percentage: 100, isPrimary: true },
      { muscle: 'Front Delts', percentage: 70, isPrimary: true }
    ]
  },

  'Bulgarian Split Squat': {
    exerciseName: 'Bulgarian Split Squat',
    movementPattern: 'lunge',
    complexityTier: 2,
    halfLife: 60,
    cnsLoad: 6,
    technicalDemand: 7,
    spinalLoad: false,
    stabilizationDemand: 8,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 90, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 50, isPrimary: false },
      { muscle: 'Abs', percentage: 50, isPrimary: false }
    ]
  },

  'Walking Lunge': {
    exerciseName: 'Walking Lunge',
    movementPattern: 'lunge',
    complexityTier: 2,
    halfLife: 54,
    cnsLoad: 5,
    technicalDemand: 6,
    spinalLoad: false,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 80, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 40, isPrimary: false }
    ]
  },

  'Leg Press': {
    exerciseName: 'Leg Press',
    movementPattern: 'squat',
    complexityTier: 2,
    halfLife: 48,
    cnsLoad: 4,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 70, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 30, isPrimary: false }
    ]
  },

  'Hack Squat': {
    exerciseName: 'Hack Squat',
    movementPattern: 'squat',
    complexityTier: 2,
    halfLife: 54,
    cnsLoad: 5,
    technicalDemand: 4,
    spinalLoad: false,
    stabilizationDemand: 4,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true },
      { muscle: 'Glutes', percentage: 60, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 30, isPrimary: false }
    ]
  },

  // ==================== TIER 1: ISOLATION SINGLE-JOINT ====================

  'Barbell Curl': {
    exerciseName: 'Barbell Curl',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 30,
    cnsLoad: 2,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Biceps', percentage: 100, isPrimary: true },
      { muscle: 'Forearms', percentage: 40, isPrimary: false }
    ]
  },

  'Dumbbell Curl': {
    exerciseName: 'Dumbbell Curl',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 28,
    cnsLoad: 2,
    technicalDemand: 2,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Biceps', percentage: 100, isPrimary: true },
      { muscle: 'Forearms', percentage: 30, isPrimary: false }
    ]
  },

  'Tricep Pushdown': {
    exerciseName: 'Tricep Pushdown',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 30,
    cnsLoad: 2,
    technicalDemand: 2,
    spinalLoad: false,
    stabilizationDemand: 2,
    muscleInvolvement: [
      { muscle: 'Triceps', percentage: 100, isPrimary: true }
    ]
  },

  'Overhead Tricep Extension': {
    exerciseName: 'Overhead Tricep Extension',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 32,
    cnsLoad: 2,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 4,
    muscleInvolvement: [
      { muscle: 'Triceps', percentage: 100, isPrimary: true },
      { muscle: 'Abs', percentage: 20, isPrimary: false }
    ]
  },

  'Lateral Raise': {
    exerciseName: 'Lateral Raise',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 32,
    cnsLoad: 2,
    technicalDemand: 4,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Side Delts', percentage: 100, isPrimary: true },
      { muscle: 'Traps', percentage: 30, isPrimary: false }
    ]
  },

  'Face Pull': {
    exerciseName: 'Face Pull',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 30,
    cnsLoad: 2,
    technicalDemand: 4,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Rear Delts', percentage: 100, isPrimary: true },
      { muscle: 'Upper Back', percentage: 50, isPrimary: false },
      { muscle: 'Biceps', percentage: 20, isPrimary: false }
    ]
  },

  'Pec Fly': {
    exerciseName: 'Pec Fly',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 36,
    cnsLoad: 2,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 3,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 100, isPrimary: true },
      { muscle: 'Front Delts', percentage: 30, isPrimary: false }
    ]
  },

  'Cable Fly': {
    exerciseName: 'Cable Fly',
    movementPattern: 'isolation_upper',
    complexityTier: 1,
    halfLife: 34,
    cnsLoad: 2,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 4,
    muscleInvolvement: [
      { muscle: 'Chest', percentage: 100, isPrimary: true },
      { muscle: 'Front Delts', percentage: 30, isPrimary: false }
    ]
  },

  'Leg Extension': {
    exerciseName: 'Leg Extension',
    movementPattern: 'isolation_lower',
    complexityTier: 1,
    halfLife: 36,
    cnsLoad: 2,
    technicalDemand: 2,
    spinalLoad: false,
    stabilizationDemand: 2,
    muscleInvolvement: [
      { muscle: 'Quads', percentage: 100, isPrimary: true }
    ]
  },

  'Leg Curl': {
    exerciseName: 'Leg Curl',
    movementPattern: 'isolation_lower',
    complexityTier: 1,
    halfLife: 36,
    cnsLoad: 2,
    technicalDemand: 2,
    spinalLoad: false,
    stabilizationDemand: 2,
    muscleInvolvement: [
      { muscle: 'Hamstrings', percentage: 100, isPrimary: true }
    ]
  },

  'Calf Raise': {
    exerciseName: 'Calf Raise',
    movementPattern: 'isolation_lower',
    complexityTier: 1,
    halfLife: 28,
    cnsLoad: 1,
    technicalDemand: 2,
    spinalLoad: false,
    stabilizationDemand: 2,
    muscleInvolvement: [
      { muscle: 'Calves', percentage: 100, isPrimary: true }
    ]
  },

  'Hip Thrust': {
    exerciseName: 'Hip Thrust',
    movementPattern: 'hinge',
    complexityTier: 1,
    halfLife: 42,
    cnsLoad: 3,
    technicalDemand: 4,
    spinalLoad: false,
    stabilizationDemand: 4,
    muscleInvolvement: [
      { muscle: 'Glutes', percentage: 100, isPrimary: true },
      { muscle: 'Hamstrings', percentage: 60, isPrimary: false },
      { muscle: 'Abs', percentage: 40, isPrimary: false }
    ]
  },

  // ==================== CORE ====================

  'Ab Wheel Rollout': {
    exerciseName: 'Ab Wheel Rollout',
    movementPattern: 'core',
    complexityTier: 2,
    halfLife: 36,
    cnsLoad: 5,
    technicalDemand: 7,
    spinalLoad: true,
    stabilizationDemand: 8,
    muscleInvolvement: [
      { muscle: 'Abs', percentage: 100, isPrimary: true },
      { muscle: 'Erector Spinae', percentage: 60, isPrimary: false },
      { muscle: 'Lats', percentage: 40, isPrimary: false }
    ]
  },

  'Plank': {
    exerciseName: 'Plank',
    movementPattern: 'core',
    complexityTier: 1,
    halfLife: 24,
    cnsLoad: 2,
    technicalDemand: 3,
    spinalLoad: false,
    stabilizationDemand: 6,
    muscleInvolvement: [
      { muscle: 'Abs', percentage: 100, isPrimary: true },
      { muscle: 'Obliques', percentage: 70, isPrimary: false },
      { muscle: 'Erector Spinae', percentage: 40, isPrimary: false }
    ]
  },

  'Hanging Leg Raise': {
    exerciseName: 'Hanging Leg Raise',
    movementPattern: 'core',
    complexityTier: 2,
    halfLife: 30,
    cnsLoad: 4,
    technicalDemand: 6,
    spinalLoad: false,
    stabilizationDemand: 7,
    muscleInvolvement: [
      { muscle: 'Abs', percentage: 100, isPrimary: true },
      { muscle: 'Forearms', percentage: 60, isPrimary: false },
      { muscle: 'Lats', percentage: 30, isPrimary: false }
    ]
  }
};

/**
 * Get exercise pattern by name (case-insensitive, fuzzy match)
 */
export function getExercisePattern(exerciseName: string): ExercisePattern | null {
  // Direct match
  if (EXERCISE_PATTERNS[exerciseName]) {
    return EXERCISE_PATTERNS[exerciseName];
  }

  // Case-insensitive search
  const normalized = exerciseName.toLowerCase().trim();
  for (const [key, pattern] of Object.entries(EXERCISE_PATTERNS)) {
    if (key.toLowerCase() === normalized) {
      return pattern;
    }
  }

  // Fuzzy match (contains key words)
  for (const [key, pattern] of Object.entries(EXERCISE_PATTERNS)) {
    const patternWords = key.toLowerCase().split(' ');
    const exerciseWords = normalized.split(' ');
    const matchCount = exerciseWords.filter(word => patternWords.includes(word)).length;
    if (matchCount >= Math.min(2, exerciseWords.length)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Calculate total exercise fatigue combining muscle + movement pattern recovery
 *
 * @param exerciseName - Name of exercise
 * @param hoursSinceLastPerformed - Time since this specific exercise was last done
 * @param muscleRecoveryMap - Map of muscle name -> recovery percentage (from muscle-architecture.ts)
 * @returns Combined fatigue score (0-100, where 100 = fully recovered)
 */
export function calculateExerciseFatigue(
  exerciseName: string,
  hoursSinceLastPerformed: number,
  muscleRecoveryMap: Map<string, number>
): {
  totalRecovery: number;
  muscleRecovery: number;
  movementPatternRecovery: number;
  cnsRecovery: number;
  breakdown: {
    muscle: string;
    involvement: number;
    recoveryPercentage: number;
    contributionToFatigue: number;
  }[];
} {
  const pattern = getExercisePattern(exerciseName);

  if (!pattern) {
    // Fallback: Use average muscle recovery
    const avgMuscleRecovery = Array.from(muscleRecoveryMap.values())
      .reduce((sum, val) => sum + val, 0) / (muscleRecoveryMap.size || 1);
    return {
      totalRecovery: avgMuscleRecovery,
      muscleRecovery: avgMuscleRecovery,
      movementPatternRecovery: 100,
      cnsRecovery: 100,
      breakdown: []
    };
  }

  // 1. Calculate movement pattern recovery (exponential decay)
  const k = Math.LN2 / pattern.halfLife;
  const movementPatternRecovery = (1 - Math.exp(-k * hoursSinceLastPerformed)) * 100;

  // 2. Calculate CNS recovery (slower for high CNS load exercises)
  const cnsHalfLife = pattern.halfLife * (1 + pattern.cnsLoad / 10); // CNS recovers 10-100% slower
  const kCNS = Math.LN2 / cnsHalfLife;
  const cnsRecovery = (1 - Math.exp(-kCNS * hoursSinceLastPerformed)) * 100;

  // 3. Calculate weighted muscle recovery
  let totalMuscleRecovery = 0;
  let totalInvolvement = 0;
  const breakdown: {
    muscle: string;
    involvement: number;
    recoveryPercentage: number;
    contributionToFatigue: number;
  }[] = [];

  for (const involvement of pattern.muscleInvolvement) {
    const muscleRecovery = muscleRecoveryMap.get(involvement.muscle) ?? 100;
    const weight = involvement.percentage * (involvement.isPrimary ? 1.5 : 1.0);
    totalMuscleRecovery += muscleRecovery * weight;
    totalInvolvement += weight;

    breakdown.push({
      muscle: involvement.muscle,
      involvement: involvement.percentage,
      recoveryPercentage: muscleRecovery,
      contributionToFatigue: (100 - muscleRecovery) * weight
    });
  }

  const muscleRecovery = totalInvolvement > 0 ? totalMuscleRecovery / totalInvolvement : 100;

  // 4. Combine recoveries with weighting based on complexity tier
  let totalRecovery: number;
  if (pattern.complexityTier === 3) {
    // Tier 3 (Axial): CNS dominates, muscle + movement pattern secondary
    totalRecovery = cnsRecovery * 0.5 + movementPatternRecovery * 0.3 + muscleRecovery * 0.2;
  } else if (pattern.complexityTier === 2) {
    // Tier 2 (Compound): Movement pattern + muscle balanced, CNS tertiary
    totalRecovery = movementPatternRecovery * 0.4 + muscleRecovery * 0.4 + cnsRecovery * 0.2;
  } else {
    // Tier 1 (Isolation): Muscle dominates
    totalRecovery = muscleRecovery * 0.7 + movementPatternRecovery * 0.2 + cnsRecovery * 0.1;
  }

  return {
    totalRecovery: Math.min(100, Math.max(0, totalRecovery)),
    muscleRecovery,
    movementPatternRecovery,
    cnsRecovery,
    breakdown: breakdown.sort((a, b) => b.contributionToFatigue - a.contributionToFatigue)
  };
}

/**
 * Get recommended rest days for exercise based on tier and last performance intensity
 *
 * @param exerciseName - Name of exercise
 * @param lastSessionRPE - RPE of last session (6-10 scale)
 * @returns Recommended rest days before training again
 */
export function getRecommendedRestDays(
  exerciseName: string,
  lastSessionRPE: number = 8
): number {
  const pattern = getExercisePattern(exerciseName);
  if (!pattern) return 2; // Default 2 days

  // Base rest from half-life (convert to days)
  const baseRestDays = pattern.halfLife / 24;

  // Adjust for RPE (harder sessions need more rest)
  const rpeMultiplier = 0.7 + ((lastSessionRPE - 6) / 4) * 0.6; // RPE 6 = 0.7x, RPE 10 = 1.3x

  return Math.ceil(baseRestDays * rpeMultiplier);
}
