/**
 * Muscle Architecture Constants
 *
 * Research-backed recovery parameters for each muscle group.
 *
 * Research Foundation:
 * - Schoenfeld (2018): Muscle damage and recovery timelines
 * - Damas et al. (2016): Muscle architecture and fiber type recovery
 * - Burd et al. (2012): Muscle protein synthesis timelines
 * - Hartman et al. (2007): Muscle-specific recovery rates
 */

export interface MuscleArchitecture {
  halfLife: number;           // Recovery half-life in hours
  fiberType: 'fast' | 'slow' | 'mixed';
  bloodFlow: 'high' | 'medium' | 'low';
  massCategory: 'small' | 'medium' | 'large';
  recoveryMultiplier: number; // Base recovery speed (1.0 = average)
}

/**
 * Muscle Recovery Constants
 *
 * Half-life derivation:
 * - Small/Fast muscles (Biceps, Calves): 24-30h (high blood flow, fast fiber recovery)
 * - Medium/Mixed muscles (Chest, Shoulders, Lats): 42-54h (moderate mass, mixed fibers)
 * - Large/Slow muscles (Quads, Hamstrings): 66-78h (large mass, longer protein synthesis)
 * - Axial/Systemic muscles (Erector Spinae, Traps): 84-96h (CNS + muscle recovery)
 */
export const MUSCLE_RECOVERY_CONSTANTS: Record<string, MuscleArchitecture> = {
  // Upper Body - Arms (Small/Fast Recovery)
  'Biceps': {
    halfLife: 24,
    fiberType: 'fast',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.3
  },
  'Triceps': {
    halfLife: 28,
    fiberType: 'fast',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.25
  },
  'Forearms': {
    halfLife: 20,
    fiberType: 'fast',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.4
  },

  // Upper Body - Shoulders & Delts (Medium/Mixed)
  'Front Delts': {
    halfLife: 36,
    fiberType: 'mixed',
    bloodFlow: 'medium',
    massCategory: 'medium',
    recoveryMultiplier: 1.15
  },
  'Side Delts': {
    halfLife: 30,
    fiberType: 'fast',
    bloodFlow: 'medium',
    massCategory: 'small',
    recoveryMultiplier: 1.2
  },
  'Rear Delts': {
    halfLife: 30,
    fiberType: 'fast',
    bloodFlow: 'medium',
    massCategory: 'small',
    recoveryMultiplier: 1.2
  },
  'Traps': {
    halfLife: 84,
    fiberType: 'slow',
    bloodFlow: 'low',
    massCategory: 'large',
    recoveryMultiplier: 0.75 // Systemic load from deadlifts, shrugs
  },

  // Upper Body - Chest & Back (Medium/Large)
  'Chest': {
    halfLife: 48,
    fiberType: 'mixed',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 1.0
  },
  'Lats': {
    halfLife: 54,
    fiberType: 'mixed',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 0.95
  },
  'Upper Back': {
    halfLife: 60,
    fiberType: 'slow',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 0.9
  },
  'Erector Spinae': {
    halfLife: 96,
    fiberType: 'slow',
    bloodFlow: 'low',
    massCategory: 'large',
    recoveryMultiplier: 0.7 // Longest recovery due to CNS + postural demands
  },

  // Lower Body - Quads & Glutes (Large/Slow)
  'Quads': {
    halfLife: 72,
    fiberType: 'mixed',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 0.85
  },
  'Glutes': {
    halfLife: 66,
    fiberType: 'mixed',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 0.9
  },
  'Hamstrings': {
    halfLife: 78,
    fiberType: 'slow',
    bloodFlow: 'medium',
    massCategory: 'large',
    recoveryMultiplier: 0.8
  },
  'Calves': {
    halfLife: 24,
    fiberType: 'slow',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.3 // Small muscle, high daily use = fast adaptation
  },

  // Core & Abs
  'Abs': {
    halfLife: 24,
    fiberType: 'fast',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.35
  },
  'Obliques': {
    halfLife: 28,
    fiberType: 'mixed',
    bloodFlow: 'high',
    massCategory: 'small',
    recoveryMultiplier: 1.25
  },
  'Lower Back': {
    halfLife: 72,
    fiberType: 'slow',
    bloodFlow: 'low',
    massCategory: 'medium',
    recoveryMultiplier: 0.85 // Postural load + susceptible to overtraining
  }
};

/**
 * Calculate decay constant (k) from half-life
 *
 * Formula: k = ln(2) / t_half
 *
 * Used in exponential decay: Fatigue(t) = Initial * e^(-k*t)
 */
export function getDecayConstant(halfLife: number): number {
  return Math.LN2 / halfLife;
}

/**
 * Calculate muscle recovery percentage using exponential decay
 *
 * @param muscleName - Name of muscle group
 * @param hoursSinceTraining - Time elapsed since last training session
 * @param initialFatigue - Initial fatigue level (0-100)
 * @returns Recovery percentage (0-100)
 */
export function calculateMuscleRecovery(
  muscleName: string,
  hoursSinceTraining: number,
  initialFatigue: number = 100
): number {
  const muscleData = MUSCLE_RECOVERY_CONSTANTS[muscleName];
  if (!muscleData) {
    console.warn(`Unknown muscle: ${muscleName}, using default recovery`);
    return Math.min(100, (hoursSinceTraining / 48) * 100); // Fallback linear recovery
  }

  const k = getDecayConstant(muscleData.halfLife);
  const remainingFatigue = initialFatigue * Math.exp(-k * hoursSinceTraining);
  const recoveryPercentage = ((initialFatigue - remainingFatigue) / initialFatigue) * 100;

  return Math.min(100, Math.max(0, recoveryPercentage));
}

/**
 * Get optimal training window (supercompensation)
 *
 * Research: Zatsiorsky & Kraemer (2006) - Peak adaptation occurs AFTER full recovery
 *
 * @param muscleName - Name of muscle group
 * @returns Object with min/optimal/max training windows in hours
 */
export function getOptimalTrainingWindow(muscleName: string): {
  minWait: number;
  optimal: number;
  maxWait: number;
} {
  const muscleData = MUSCLE_RECOVERY_CONSTANTS[muscleName];
  if (!muscleData) {
    return { minWait: 36, optimal: 72, maxWait: 96 }; // Default
  }

  const baseRecovery = muscleData.halfLife * 2; // ~87% recovered at 2x half-life

  return {
    minWait: baseRecovery * 0.8,    // 80% of full recovery
    optimal: baseRecovery * 1.3,     // Peak supercompensation
    maxWait: baseRecovery * 2.0      // Detraining begins
  };
}
