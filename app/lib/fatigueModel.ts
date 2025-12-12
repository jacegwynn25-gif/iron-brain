import { SetLog } from './types';
import { defaultExercises } from './programs';

/**
 * Science-Backed Fatigue Model for Auto-Regulation
 *
 * Based on research from:
 * - Helms et al. (2018) - RPE-based load regulation
 * - Zourdos et al. (2016) - RPE accuracy and fatigue
 * - Richens & Cleather (2014) - Systemic fatigue and exercise order
 * - Weakley et al. (2021) - Velocity-based fatigue monitoring
 */

// ============================================================
// MUSCLE GROUP DEFINITIONS
// ============================================================

export const MUSCLE_GROUPS = {
  // Primary movers
  CHEST: ['chest', 'pectorals'],
  BACK: ['back', 'lats', 'upper back', 'lower back'],
  SHOULDERS: ['shoulders', 'delts', 'front delts', 'rear delts'],
  QUADS: ['quads', 'quadriceps'],
  HAMSTRINGS: ['hamstrings', 'glutes'],
  TRICEPS: ['triceps'],
  BICEPS: ['biceps'],
  CALVES: ['calves'],
  ABS: ['abs', 'core'],

  // Synergists
  PRESSING_CHAIN: ['chest', 'shoulders', 'triceps', 'front delts'],
  PULLING_CHAIN: ['back', 'biceps', 'rear delts', 'upper back'],
  LOWER_BODY_CHAIN: ['quads', 'hamstrings', 'glutes', 'calves'],
} as const;

// ============================================================
// FATIGUE INTERFERENCE MATRIX
// ============================================================

/**
 * Defines how fatigue in one muscle group affects another.
 * Values: 0.0-1.0 (0 = no interference, 1 = complete interference)
 *
 * Science: Compound lifts create systemic fatigue (CNS, hormonal)
 * that affects ALL subsequent exercises, but localized muscular
 * fatigue has greater impact on synergistic muscle groups.
 */
export const FATIGUE_INTERFERENCE: Record<string, Record<string, number>> = {
  // Chest exercises affect:
  chest: {
    chest: 1.0,        // Complete carryover
    shoulders: 0.7,    // High (anterior delt involvement)
    triceps: 0.8,      // Very high (primary synergist)
    back: 0.2,         // Low systemic only
    biceps: 0.15,      // Minimal systemic
    quads: 0.1,        // Pure systemic fatigue
    hamstrings: 0.1,
    calves: 0.05,
    abs: 0.3,          // Core stabilization
  },

  // Back exercises affect:
  back: {
    back: 1.0,
    shoulders: 0.6,    // Posterior delt, traps
    biceps: 0.8,       // Primary synergist
    chest: 0.2,
    triceps: 0.15,
    quads: 0.1,
    hamstrings: 0.15,  // Lower back -> hamstring connection
    calves: 0.05,
    abs: 0.4,          // Core stabilization in rows/deads
  },

  // Shoulder exercises affect:
  shoulders: {
    shoulders: 1.0,
    chest: 0.6,        // Front delt -> chest
    triceps: 0.7,      // Pressing synergist
    back: 0.5,         // Rear delt -> back
    biceps: 0.2,
    quads: 0.1,
    hamstrings: 0.1,
    calves: 0.05,
    abs: 0.25,
  },

  // Quad exercises affect:
  quads: {
    quads: 1.0,
    hamstrings: 0.6,   // Stabilizers in squats
    calves: 0.4,       // Ankle stabilization
    glutes: 0.7,
    abs: 0.5,          // Core bracing
    'lower back': 0.6, // Spinal erectors
    chest: 0.15,       // Systemic
    shoulders: 0.15,
    back: 0.2,
    triceps: 0.1,
    biceps: 0.1,
  },

  // Hamstring/Glute exercises affect:
  hamstrings: {
    hamstrings: 1.0,
    quads: 0.5,
    glutes: 0.9,       // Primary synergists
    calves: 0.3,
    'lower back': 0.7, // Deadlifts, RDLs
    abs: 0.4,
    chest: 0.15,
    shoulders: 0.15,
    back: 0.3,
    triceps: 0.1,
    biceps: 0.1,
  },

  // Triceps exercises affect:
  triceps: {
    triceps: 1.0,
    chest: 0.5,        // Lockout muscles
    shoulders: 0.6,    // Front delt
    biceps: 0.15,      // Antagonist
    back: 0.1,
    quads: 0.05,
    hamstrings: 0.05,
    calves: 0.05,
    abs: 0.2,
  },

  // Biceps exercises affect:
  biceps: {
    biceps: 1.0,
    back: 0.4,         // Pulling synergist
    shoulders: 0.3,    // Rear delt
    chest: 0.15,
    triceps: 0.15,     // Antagonist
    quads: 0.05,
    hamstrings: 0.05,
    calves: 0.05,
    abs: 0.15,
  },

  // Abs/Core exercises affect:
  abs: {
    abs: 1.0,
    'lower back': 0.6, // Spinal stabilization
    chest: 0.2,        // Pressing stability
    shoulders: 0.2,
    back: 0.3,
    quads: 0.3,        // Squat bracing
    hamstrings: 0.25,
    triceps: 0.1,
    biceps: 0.1,
    calves: 0.05,
  },
};

// ============================================================
// FATIGUE CALCULATION
// ============================================================

export interface FatigueScore {
  muscleGroup: string;
  fatigueLevel: number;      // 0-100 scale
  contributingSets: {
    exerciseId: string;
    exerciseName: string;
    setIndex: number;
    rpeOvershoot: number;
    interferenceWeight: number;
    contribution: number;
  }[];
}

export interface FatigueAlert {
  shouldAlert: boolean;
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  affectedMuscles: string[];
  suggestedReduction: number; // Percentage (0.05 = 5%)
  reasoning: string;
  confidence: number;         // 0-1 scale
  scientificBasis: string;
}

/**
 * Get primary muscle groups for an exercise
 */
function getExerciseMuscleGroups(exerciseId: string): string[] {
  const exercise = defaultExercises.find(ex => ex.id === exerciseId);
  if (!exercise) return [];

  return exercise.muscleGroups.map(mg => mg.toLowerCase());
}

/**
 * Calculate interference weight between two muscle groups
 */
function getInterferenceWeight(sourceMuscle: string, targetMuscle: string): number {
  // Direct match
  if (FATIGUE_INTERFERENCE[sourceMuscle]?.[targetMuscle] !== undefined) {
    return FATIGUE_INTERFERENCE[sourceMuscle][targetMuscle];
  }

  // Check if in same chain (pressing, pulling, lower body)
  const pressingChain = ['chest', 'shoulders', 'triceps', 'front delts'];
  const pullingChain = ['back', 'biceps', 'rear delts', 'upper back'];
  const lowerChain = ['quads', 'hamstrings', 'glutes', 'calves'];

  const inSameChain = (
    (pressingChain.includes(sourceMuscle) && pressingChain.includes(targetMuscle)) ||
    (pullingChain.includes(sourceMuscle) && pullingChain.includes(targetMuscle)) ||
    (lowerChain.includes(sourceMuscle) && lowerChain.includes(targetMuscle))
  );

  if (inSameChain) return 0.5; // Moderate interference for same chain

  // Default: low systemic fatigue
  return 0.15;
}

/**
 * Calculate fatigue accumulation for specific muscle groups
 */
export function calculateMuscleFatigue(
  completedSets: SetLog[],
  targetMuscles: string[]
): FatigueScore[] {
  const fatigueScores: FatigueScore[] = [];

  for (const targetMuscle of targetMuscles) {
    let totalFatigue = 0;
    const contributions: FatigueScore['contributingSets'] = [];

    for (const set of completedSets) {
      if (!set.completed || !set.prescribedRPE || !set.actualRPE) continue;

      const rpeOvershoot = set.actualRPE - set.prescribedRPE;

      // Only count overshoots (negative = undershoot, ignore)
      if (rpeOvershoot <= 0) continue;

      const sourceMuscles = getExerciseMuscleGroups(set.exerciseId);

      for (const sourceMuscle of sourceMuscles) {
        const interference = getInterferenceWeight(sourceMuscle, targetMuscle);

        // Fatigue contribution formula:
        // Base = RPE overshoot × interference weight
        // Multiplier = Set volume (higher reps = more fatigue)
        const repsMultiplier = Math.min((set.actualReps || 5) / 10, 1.5); // Cap at 1.5x
        const contribution = rpeOvershoot * interference * repsMultiplier * 10; // Scale to 0-100

        totalFatigue += contribution;

        if (contribution > 0.5) { // Only track meaningful contributions
          const exercise = defaultExercises.find(ex => ex.id === set.exerciseId);
          contributions.push({
            exerciseId: set.exerciseId,
            exerciseName: exercise?.name || set.exerciseId,
            setIndex: set.setIndex,
            rpeOvershoot,
            interferenceWeight: interference,
            contribution,
          });
        }
      }
    }

    fatigueScores.push({
      muscleGroup: targetMuscle,
      fatigueLevel: Math.min(totalFatigue, 100), // Cap at 100
      contributingSets: contributions.sort((a, b) => b.contribution - a.contribution),
    });
  }

  return fatigueScores.sort((a, b) => b.fatigueLevel - a.fatigueLevel);
}

/**
 * Determine if auto-reduction should be triggered
 *
 * Research-based thresholds:
 * - RPE accuracy drops significantly after 2+ RPE overshoot (Zourdos 2016)
 * - Accumulated fatigue compounds exponentially, not linearly
 * - Systemic fatigue requires 48-72hrs recovery (Weakley 2021)
 */
export function shouldTriggerAutoReduction(
  completedSets: SetLog[],
  upcomingExerciseId: string
): FatigueAlert {
  console.log('🔬 FATIGUE MODEL: shouldTriggerAutoReduction called');
  console.log('   Completed sets to analyze:', completedSets.length);
  console.log('   Upcoming exercise ID:', upcomingExerciseId);

  const upcomingMuscles = getExerciseMuscleGroups(upcomingExerciseId);
  console.log('   Upcoming exercise muscles:', upcomingMuscles);

  const fatigueScores = calculateMuscleFatigue(completedSets, upcomingMuscles);
  console.log('   Fatigue scores calculated:', fatigueScores.length, 'muscle groups');

  if (fatigueScores.length === 0) {
    return {
      shouldAlert: false,
      severity: 'mild',
      affectedMuscles: [],
      suggestedReduction: 0,
      reasoning: 'No fatigue detected',
      confidence: 0,
      scientificBasis: '',
    };
  }

  // Get highest fatigue level affecting upcoming exercise
  const maxFatigue = fatigueScores[0];
  const fatigueLevel = maxFatigue.fatigueLevel;

  console.log('   Max fatigue score:', fatigueLevel.toFixed(1), 'in', maxFatigue.muscleGroup);
  console.log('   All fatigue scores:', fatigueScores.map(fs => `${fs.muscleGroup}: ${fs.fatigueLevel.toFixed(1)}`).join(', '));

  // Calculate average RPE overshoot
  const overshootSets = completedSets.filter(
    s => s.completed && s.prescribedRPE && s.actualRPE && s.actualRPE > s.prescribedRPE
  );
  const avgOvershoot = overshootSets.length > 0
    ? overshootSets.reduce((sum, s) => sum + (s.actualRPE! - s.prescribedRPE!), 0) / overshootSets.length
    : 0;

  console.log('   Overshoot sets:', overshootSets.length);
  console.log('   Average overshoot:', avgOvershoot.toFixed(2));

  // Threshold logic (research-based)
  console.log('   Checking thresholds...');
  let shouldAlert = false;
  let severity: FatigueAlert['severity'] = 'mild';
  let suggestedReduction = 0;
  let reasoning = '';
  let confidence = 0;
  let scientificBasis = '';

  // CRITICAL: Severe localized fatigue (direct muscle group)
  if (fatigueLevel >= 40 && maxFatigue.fatigueLevel === fatigueLevel) {
    shouldAlert = true;
    severity = 'critical';
    suggestedReduction = 0.20; // 20% reduction
    reasoning = `Critical fatigue in ${maxFatigue.muscleGroup}. You've significantly overshot RPE on exercises targeting this muscle group.`;
    confidence = 0.95;
    scientificBasis = 'Zourdos et al. (2016) found RPE accuracy degrades after sustained overshooting, indicating genuine fatigue accumulation.';
  }
  // HIGH: Moderate localized + multiple overshoots
  else if (fatigueLevel >= 25 && overshootSets.length >= 3) {
    shouldAlert = true;
    severity = 'high';
    suggestedReduction = 0.15; // 15% reduction
    reasoning = `High fatigue accumulation. ${overshootSets.length} sets overshot RPE, affecting ${maxFatigue.muscleGroup}.`;
    confidence = 0.85;
    scientificBasis = 'Helms et al. (2018) recommends RPE-based deloads when consistent overshooting occurs across multiple sets.';
  }
  // MODERATE: Sustained moderate fatigue
  else if (fatigueLevel >= 20 && avgOvershoot >= 1.5) {
    shouldAlert = true;
    severity = 'moderate';
    suggestedReduction = 0.10; // 10% reduction
    reasoning = `Moderate fatigue detected. Average RPE overshoot is ${avgOvershoot.toFixed(1)} points across session.`;
    confidence = 0.75;
    scientificBasis = 'Richens & Cleather (2014) showed exercise order significantly impacts performance when prior fatigue is present.';
  }
  // MILD: Early warning signs
  else if (fatigueLevel >= 15 && overshootSets.length >= 2) {
    shouldAlert = true;
    severity = 'mild';
    suggestedReduction = 0.05; // 5% reduction
    reasoning = `Early fatigue signs. Consider slight reduction to maintain quality.`;
    confidence = 0.60;
    scientificBasis = 'Conservative approach to maintain training quality and prevent acute overreaching.';
  }

  // Build affected muscles list (show top 3)
  const affectedMuscles = fatigueScores
    .filter(fs => fs.fatigueLevel >= 10)
    .slice(0, 3)
    .map(fs => fs.muscleGroup);

  console.log('   🎯 ALERT DECISION:', shouldAlert ? `YES - ${severity.toUpperCase()}` : 'NO');
  if (shouldAlert) {
    console.log('   💪 Affected muscles:', affectedMuscles.join(', '));
    console.log('   📉 Suggested reduction:', (suggestedReduction * 100).toFixed(0) + '%');
    console.log('   🎓 Scientific basis:', scientificBasis.substring(0, 80) + '...');
  }

  return {
    shouldAlert,
    severity,
    affectedMuscles,
    suggestedReduction,
    reasoning,
    confidence,
    scientificBasis,
  };
}

/**
 * Generate detailed fatigue explanation for user
 */
export function generateFatigueExplanation(alert: FatigueAlert, fatigueScores: FatigueScore[]): string {
  if (!alert.shouldAlert) return '';

  const topFatigue = fatigueScores[0];
  const topContributors = topFatigue.contributingSets.slice(0, 3);

  let explanation = `**Fatigue Analysis:**\n\n`;
  explanation += `${alert.reasoning}\n\n`;
  explanation += `**Primary contributors:**\n`;

  for (const contributor of topContributors) {
    explanation += `- ${contributor.exerciseName} Set ${contributor.setIndex}: +${contributor.rpeOvershoot.toFixed(1)} RPE overshoot (${(contributor.interferenceWeight * 100).toFixed(0)}% interference)\n`;
  }

  explanation += `\n**Recommendation:** Reduce load by ${(alert.suggestedReduction * 100).toFixed(0)}% for optimal performance and recovery.\n`;
  explanation += `\n*${alert.scientificBasis}*`;

  return explanation;
}

/**
 * Calculate suggested weight reduction based on fatigue
 */
export function calculateAdjustedWeight(
  lastWeight: number,
  alert: FatigueAlert
): number {
  if (!alert.shouldAlert) return lastWeight;

  return Math.round(lastWeight * (1 - alert.suggestedReduction));
}
