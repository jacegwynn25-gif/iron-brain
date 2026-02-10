import { SetLog } from './types';
import { defaultExercises } from './programs';
import { logger } from './logger';
import { analyzeSampleSizePower, cleanAndValidateData } from './stats/advanced-methods';
// Commented out - VBT module deleted (incomplete implementation)
// import { analyzeVBTFatigue, type VBTAnalysis } from './stats/velocity-based-training';
import { analyzeBayesianRPE, type BayesianRPEAnalysis } from './stats/bayesian-rpe';
import { getEnhancedFatigueAssessment, canUseHierarchicalModel } from './stats/fatigue-integration';
import { convertWeight } from './units';

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

export interface RecommendationOption {
  type: 'reduce_weight' | 'reduce_reps' | 'increase_rest' | 'skip_exercise' | 'swap_exercise';
  description: string;
  newWeight?: number;
  newReps?: number | string;
  newRest?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface FatigueAlert {
  shouldAlert: boolean;
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  affectedMuscles: string[];
  suggestedReduction: number; // Percentage (0.05 = 5%)
  reasoning: string;
  confidence: number;         // 0-1 scale
  scientificBasis: string;
  recommendations?: RecommendationOption[]; // Multiple options for user
}

/**
 * Get primary muscle groups for an exercise
 * Tries multiple strategies: direct ID match, slug match, name inference
 */
function getExerciseMuscleGroups(exerciseId: string, exerciseName?: string): string[] {
  // Strategy 1: Direct ID match
  let exercise = defaultExercises.find(ex => ex.id === exerciseId);

  // Strategy 2: Try matching by slug (exerciseId might be a slug)
  if (!exercise) {
    const slug = exerciseId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    exercise = defaultExercises.find(ex =>
      ex.id.toLowerCase() === slug ||
      ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug
    );
  }

  // Strategy 3: Try matching by name
  if (!exercise && exerciseName) {
    const searchName = exerciseName.toLowerCase();
    exercise = defaultExercises.find(ex =>
      ex.name.toLowerCase() === searchName ||
      ex.name.toLowerCase().includes(searchName) ||
      searchName.includes(ex.name.toLowerCase())
    );
  }

  if (exercise) {
    return exercise.muscleGroups.map(mg => mg.toLowerCase());
  }

  // Strategy 4: Infer from exercise name keywords
  const name = (exerciseName || exerciseId).toLowerCase();
  const inferred: string[] = [];

  // Chest exercises
  if (name.includes('bench') || name.includes('chest') || name.includes('fly') || name.includes('pec')) {
    inferred.push('chest');
    if (name.includes('press')) inferred.push('triceps', 'shoulders');
  }
  // Back exercises
  if (name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('back')) {
    inferred.push('back');
    if (name.includes('row') || name.includes('pull')) inferred.push('biceps');
  }
  // Shoulder exercises
  if (name.includes('shoulder') || name.includes('delt') || name.includes('ohp') || name.includes('military')) {
    inferred.push('shoulders');
    if (name.includes('press')) inferred.push('triceps');
  }
  // Leg exercises
  if (name.includes('squat') || name.includes('leg press') || name.includes('quad') || name.includes('lunge')) {
    inferred.push('quads', 'glutes');
  }
  if (name.includes('deadlift') || name.includes('rdl') || name.includes('hamstring') || name.includes('curl')) {
    if (name.includes('leg') || name.includes('ham')) inferred.push('hamstrings');
    if (name.includes('deadlift') || name.includes('rdl')) inferred.push('hamstrings', 'back', 'glutes');
  }
  // Arm exercises
  if (name.includes('bicep') || name.includes('curl')) {
    if (!name.includes('leg') && !name.includes('ham')) inferred.push('biceps');
  }
  if (name.includes('tricep') || name.includes('pushdown') || name.includes('extension') || name.includes('skullcrusher')) {
    if (!name.includes('leg') && !name.includes('quad')) inferred.push('triceps');
  }
  // Core
  if (name.includes('ab') || name.includes('crunch') || name.includes('plank') || name.includes('core')) {
    inferred.push('abs');
  }
  // Calves
  if (name.includes('calf') || name.includes('calves')) {
    inferred.push('calves');
  }

  return [...new Set(inferred)]; // Remove duplicates
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
 *
 * FIXED: Now tracks actual training load, not just RPE overshoots
 * Research: Schoenfeld & Grgic (2018) - Volume and intensity both contribute to fatigue
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
      // Only skip if not completed - we DO want to count sets without RPE data
      if (!set.completed) continue;

      const sourceMuscles = getExerciseMuscleGroups(set.exerciseId, set.exerciseName);

      // Skip if exercise doesn't target any muscles we track
      if (sourceMuscles.length === 0) continue;

      for (const sourceMuscle of sourceMuscles) {
        const interference = getInterferenceWeight(sourceMuscle, targetMuscle);

        // Skip if no interference with target muscle
        if (interference < 0.1) continue;

        // BASE FATIGUE: Calculate from actual training intensity (RPE-based)
        // RPE 10 = max fatigue contribution, RPE 6 = minimal
        const actualRPE = set.actualRPE ?? set.prescribedRPE ?? 7;
        // Scale: RPE 6=0.3, RPE 7=0.5, RPE 8=0.7, RPE 9=0.9, RPE 10=1.0
        const rpeIntensity = Math.max(0.3, (actualRPE - 5) / 5);

        // VOLUME FACTOR: Higher reps = more fatigue
        const repsMultiplier = Math.min((set.actualReps || 5) / 8, 1.5); // 8 reps = 1.0x

        // LOAD FACTOR: Heavier weights create more systemic fatigue
        const weight = set.actualWeight || 0;
        const weightLbs = weight > 0 ? convertWeight(weight, set.weightUnit ?? 'lbs', 'lbs') : 0;
        // Normalize weight contribution (assuming 100-300 lbs is typical working range)
        const loadFactor = weightLbs > 0 ? Math.min(1.5, Math.max(0.5, weightLbs / 150)) : 1.0;

        // ENHANCED: Form breakdown multiplier (Häkkinen & Komi 1983)
        let formBreakdownMultiplier = 1.0;
        if (set.formBreakdown === true) {
          formBreakdownMultiplier = 1.5;
        }

        // ENHANCED: Failure multiplier (Izquierdo et al. 2006)
        let failureMultiplier = 1.0;
        if (set.reachedFailure === true) {
          failureMultiplier = 1.4;
        }

        // ENHANCED: Tempo slowdown detection
        let tempoMultiplier = 1.0;
        if (set.setDurationSeconds && set.actualReps && set.actualReps > 0) {
          const avgSecondsPerRep = set.setDurationSeconds / set.actualReps;
          const exercise = defaultExercises.find(ex => ex.id === set.exerciseId);
          const isCompound = exercise?.type === 'compound';
          const slowThreshold = isCompound ? 4 : 3;

          if (avgSecondsPerRep > slowThreshold) {
            tempoMultiplier = 1.2;
          }
        }

        // RPE OVERSHOOT BONUS: Still give extra penalty for overshooting targets
        let overshootBonus = 0;
        if (set.prescribedRPE && set.actualRPE && set.actualRPE > set.prescribedRPE) {
          overshootBonus = (set.actualRPE - set.prescribedRPE) * 3;
        }

        // FINAL FATIGUE CONTRIBUTION
        // Base contribution = intensity × volume × load × interference × multipliers
        // Each set at RPE 8+ with decent volume contributes ~8-15 fatigue points
        const baseContribution = rpeIntensity * repsMultiplier * loadFactor * interference * 12;
        const contribution = baseContribution * formBreakdownMultiplier * failureMultiplier * tempoMultiplier + overshootBonus;

        totalFatigue += contribution;

        if (contribution > 1) {
          const exercise = defaultExercises.find(ex => ex.id === set.exerciseId);
          contributions.push({
            exerciseId: set.exerciseId,
            exerciseName: exercise?.name || set.exerciseName || set.exerciseId,
            setIndex: set.setIndex,
            rpeOvershoot: set.prescribedRPE && set.actualRPE ? set.actualRPE - set.prescribedRPE : 0,
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
  // Reduced logging to prevent console spam
  // logger.debug('🔬 FATIGUE MODEL: shouldTriggerAutoReduction called');
  // logger.debug('   Completed sets to analyze:', completedSets.length);
  // logger.debug('   Upcoming exercise ID:', upcomingExerciseId);

  const upcomingMuscles = getExerciseMuscleGroups(upcomingExerciseId);
  // logger.debug('   Upcoming exercise muscles:', upcomingMuscles);

  const fatigueScores = calculateMuscleFatigue(completedSets, upcomingMuscles);
  // logger.debug('   Fatigue scores calculated:', fatigueScores.length, 'muscle groups');

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

  // logger.debug('   Max fatigue score:', fatigueLevel.toFixed(1), 'in', maxFatigue.muscleGroup);
  // logger.debug('   All fatigue scores:', fatigueScores.map(fs => `${fs.muscleGroup}: ${fs.fatigueLevel.toFixed(1)}`).join(', '));

  // Calculate average RPE overshoot
  const overshootSets = completedSets.filter(
    s => s.completed && s.prescribedRPE && s.actualRPE && s.actualRPE > s.prescribedRPE
  );
  const avgOvershoot = overshootSets.length > 0
    ? overshootSets.reduce((sum, s) => sum + (s.actualRPE! - s.prescribedRPE!), 0) / overshootSets.length
    : 0;

  // logger.debug('   Overshoot sets:', overshootSets.length);
  // logger.debug('   Average overshoot:', avgOvershoot.toFixed(2));

  // Threshold logic (research-based)
  // logger.debug('   Checking thresholds...');
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

  // Generate multiple recommendation options if alert should be shown
  let recommendations: RecommendationOption[] | undefined;
  if (shouldAlert && severity !== 'mild') {
    recommendations = generateRecommendations(severity, suggestedReduction);
  }

  // Logging disabled - fatigue alerts work silently in the background
  // if (shouldAlert) {
  //   logger.debug('🚨 FATIGUE ALERT:', severity.toUpperCase(), '-', affectedMuscles.join(', '), '-', (suggestedReduction * 100).toFixed(0) + '% reduction suggested');
  // }

  return {
    shouldAlert,
    severity,
    affectedMuscles,
    suggestedReduction,
    reasoning,
    confidence,
    scientificBasis,
    recommendations,
  };
}

/**
 * Generate multiple recommendation options based on fatigue severity
 */
function generateRecommendations(
  severity: 'mild' | 'moderate' | 'high' | 'critical',
  suggestedReduction: number
): RecommendationOption[] {
  const reductionPercent = Math.round(suggestedReduction * 100);
  const recommendations: RecommendationOption[] = [];

  // Option 1: Reduce weight (primary recommendation)
  recommendations.push({
    type: 'reduce_weight',
    description: `Reduce weight by ~${reductionPercent}% (recommended)`,
    confidence: 'high',
  });

  // Option 2: Reduce reps instead of weight
  if (severity === 'moderate' || severity === 'mild') {
    recommendations.push({
      type: 'reduce_reps',
      description: 'Reduce reps by 2-3, keep same weight',
      confidence: 'medium',
    });
  }

  // Option 3: Increase rest time for critical/high fatigue
  if (severity === 'critical' || severity === 'high') {
    recommendations.push({
      type: 'increase_rest',
      description: 'Add 60-90s extra rest between sets',
      newRest: 90,
      confidence: 'medium',
    });
  }

  // Option 4: Skip/swap exercise for critical fatigue
  if (severity === 'critical') {
    recommendations.push({
      type: 'skip_exercise',
      description: 'Skip this exercise or swap for similar alternative',
      confidence: 'high',
    });
  }

  return recommendations;
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

// ============================================================
// NEW: TRUE FATIGUE DETECTION (Separate from RPE Calibration)
// ============================================================

/**
 * Detect TRUE FATIGUE using performance degradation indicators
 * This is DIFFERENT from RPE calibration - it measures actual accumulated stress
 *
 * Research:
 * - Häkkinen & Komi (1983) - Form breakdown = neuromuscular fatigue
 * - Izquierdo et al. (2006) - Unintentional failure = CNS stress
 * - González-Badillo & Sánchez-Medina (2010) - Velocity loss = fatigue
 */
export interface TrueFatigueIndicators {
  hasFatigue: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'high' | 'critical';
  indicators: {
    formBreakdown: number;      // Count of sets with form issues
    unintentionalFailure: number; // Failed at RPE < 9
    velocityLoss: number;        // Average velocity loss % (research-validated)
    volumeOverload: boolean;     // High volume + muscle interference
  };
  affectedMuscles: string[];
  reasoning: string;
  scientificBasis: string;
  confidence: number;
  // vbtAnalysis?: VBTAnalysis; // Commented out - VBT module deleted
  dataQuality?: {
    originalSets: number;
    cleanedSets: number;
    outliersRemoved: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  powerAnalysis?: {
    currentPower: number; // 0-1, statistical power of current sample
    setsNeededForHighPower: number; // Sets needed for 80% power
    recommendation: string;
  };
}

export function detectTrueFatigue(
  sets: SetLog[],
  exerciseId?: string
): TrueFatigueIndicators {
  // Filter to exercise if specified, otherwise use all
  let relevantSets = exerciseId
    ? sets.filter(s => s.exerciseId === exerciseId && s.completed)
    : sets.filter(s => s.completed);

  if (relevantSets.length === 0) {
    return {
      hasFatigue: false,
      severity: 'none',
      indicators: {
        formBreakdown: 0,
        unintentionalFailure: 0,
        velocityLoss: 0,
        volumeOverload: false,
      },
      affectedMuscles: [],
      reasoning: '',
      scientificBasis: '',
      confidence: 0,
    };
  }

  // DATA CLEANING: Remove outliers and validate data quality
  let dataQualityReport: ReturnType<typeof cleanAndValidateData>['report'] | null = null;
  try {
    const cleaningResult = cleanAndValidateData(relevantSets);
    relevantSets = cleaningResult.cleanedSets;
    dataQualityReport = cleaningResult.report;

    // Log quality issues if any
    if (dataQualityReport.removedCount > 0) {
      logger.debug(`Data cleaning: Removed ${dataQualityReport.removedCount} outlier sets`);
    }
  } catch {
    console.warn('Data cleaning unavailable, proceeding with raw data');
  }

  // Indicator 1: Form Breakdown
  const formBreakdownCount = relevantSets.filter(s => s.formBreakdown === true).length;

  // Indicator 2: Unintentional Failure (hit failure when RPE target was moderate)
  const unintentionalFailureCount = relevantSets.filter(s => {
    if (!s.reachedFailure || !s.prescribedRPE) return false;
    // If they hit failure but target RPE was 7 or below, that's unintentional
    return s.prescribedRPE <= 7;
  }).length;

  // Indicator 3: Velocity-Based Training Analysis (DISABLED - VBT module deleted)
  // Previously used VBT methodology from González-Badillo & Sánchez-Medina (2010)
  // Commented out until rep-by-rep timing data is collected in UI
  // let vbtAnalysis: VBTAnalysis | null = null;
  const avgVelocityLoss = 0; // Default to 0 (no velocity loss detected)

  // Indicator 4: Volume Overload with Muscle Interference
  const allMuscleGroups = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'triceps', 'biceps', 'calves', 'abs'];
  const fatigueScores = calculateMuscleFatigue(sets, allMuscleGroups);
  const maxFatigue = fatigueScores.length > 0
    ? Math.max(...fatigueScores.map(fs => fs.fatigueLevel))
    : 0;
  const volumeOverload = fatigueScores.length > 0 && maxFatigue >= 30;

  // Calculate severity using RESEARCH-VALIDATED THRESHOLDS
  // Pareja-Blanco et al. (2017): >20% velocity loss = moderate fatigue
  let severity: TrueFatigueIndicators['severity'] = 'none';
  let hasFatigue = false;

  // Critical: Multiple indicators OR severe velocity loss
  if (
    (formBreakdownCount >= 2 && unintentionalFailureCount >= 1) ||
    avgVelocityLoss > 40 ||
    (volumeOverload && (formBreakdownCount >= 1 || avgVelocityLoss > 30))
  ) {
    severity = 'critical';
    hasFatigue = true;
  }
  // High: Significant indicators OR high velocity loss
  else if (
    (formBreakdownCount >= 2 || unintentionalFailureCount >= 2) ||
    avgVelocityLoss > 30 ||
    (volumeOverload && avgVelocityLoss > 20)
  ) {
    severity = 'high';
    hasFatigue = true;
  }
  // Moderate: Some indicators OR moderate velocity loss (research threshold)
  else if (
    (formBreakdownCount >= 1 && unintentionalFailureCount >= 1) ||
    avgVelocityLoss > 20 || // Pareja-Blanco threshold
    (volumeOverload && formBreakdownCount >= 1)
  ) {
    severity = 'moderate';
    hasFatigue = true;
  }
  // Mild: Single indicator OR mild velocity loss
  else if (
    formBreakdownCount >= 1 ||
    unintentionalFailureCount >= 1 ||
    avgVelocityLoss > 10 ||
    volumeOverload
  ) {
    severity = 'mild';
    hasFatigue = true;
  }

  // Build reasoning with VBT data
  const reasons: string[] = [];
  if (formBreakdownCount > 0) reasons.push(`${formBreakdownCount} set${formBreakdownCount > 1 ? 's' : ''} with form breakdown`);
  if (unintentionalFailureCount > 0) reasons.push(`${unintentionalFailureCount} unintentional failure${unintentionalFailureCount > 1 ? 's' : ''}`);
  if (avgVelocityLoss > 10) reasons.push(`${avgVelocityLoss.toFixed(0)}% velocity loss`);
  if (volumeOverload) reasons.push('high volume accumulation');

  const reasoning = reasons.length > 0
    ? `Performance degradation detected: ${reasons.join(', ')}.`
    : '';

  // Affected muscles
  const affectedMuscles = fatigueScores
    .filter(fs => fs.fatigueLevel >= 20)
    .slice(0, 3)
    .map(fs => fs.muscleGroup);

  // Scientific basis (prioritize VBT if significant)
  let scientificBasis = '';
  if (avgVelocityLoss > 20) {
    scientificBasis = 'Pareja-Blanco et al. (2017): Velocity loss >20% indicates fatigue exceeding optimal hypertrophy zone.';
  } else if (formBreakdownCount > 0) {
    scientificBasis = 'Häkkinen & Komi (1983): Form breakdown indicates neuromuscular fatigue requiring recovery.';
  } else if (unintentionalFailureCount > 0) {
    scientificBasis = 'Izquierdo et al. (2006): Unintentional failure signals CNS fatigue - reduce volume or intensity.';
  } else if (avgVelocityLoss > 0) {
    scientificBasis = 'González-Badillo & Sánchez-Medina (2010): Velocity loss is a reliable fatigue indicator.';
  }

  // Confidence calculation with VBT
  let confidence = 0.5;
  const indicatorCount = (formBreakdownCount > 0 ? 1 : 0) + (unintentionalFailureCount > 0 ? 1 : 0) + (avgVelocityLoss > 10 ? 1 : 0);

  // VBT confidence calculation disabled (VBT module deleted)
  // if (vbtAnalysis && vbtAnalysis.confidence) {
  //   confidence = (vbtAnalysis.confidence * 0.6) + (Math.min(1.0, indicatorCount / 3) * 0.4);
  // } else {
  //   confidence = indicatorCount >= 3 ? 0.85 : indicatorCount >= 2 ? 0.70 : 0.55;
  // }

  // Fallback confidence calculation (without VBT)
  confidence = indicatorCount >= 3 ? 0.85 : indicatorCount >= 2 ? 0.70 : 0.55;

  // POWER ANALYSIS: Calculate statistical power and sample size recommendations
  let powerAnalysisResult: {
    currentPower: number;
    setsNeededForHighPower: number;
    recommendation: string;
  } | null = null;
  try {
    const currentN = relevantSets.length;
    const estimatedEffect = hasFatigue ? 0.5 : 0.2; // Medium effect if fatigued, small otherwise

    const powerAnalysis = analyzeSampleSizePower(currentN, estimatedEffect);
    const requiredN = Math.ceil(64 * (0.5 / Math.max(0.1, estimatedEffect)) ** 2);

    let recommendation = '';
    if (powerAnalysis.power < 0.6) {
      recommendation = `Low statistical power (${(powerAnalysis.power * 100).toFixed(0)}%). Complete ${Math.max(0, requiredN - currentN)} more sets for reliable estimate.`;
    } else if (powerAnalysis.power < 0.8) {
      recommendation = `Moderate power (${(powerAnalysis.power * 100).toFixed(0)}%). ${Math.max(0, requiredN - currentN)} more sets recommended for high confidence.`;
    } else {
      recommendation = `High statistical power (${(powerAnalysis.power * 100).toFixed(0)}%). Sample size sufficient for reliable conclusions.`;
    }

    powerAnalysisResult = {
      currentPower: powerAnalysis.power,
      setsNeededForHighPower: Math.max(0, requiredN - currentN),
      recommendation
    };
  } catch {
    // Power analysis unavailable
  }

  // Data quality reporting
  const dataQuality = dataQualityReport ? {
    originalSets: sets.filter(s => s.completed).length,
    cleanedSets: relevantSets.length,
    outliersRemoved: dataQualityReport.removedCount,
    quality: dataQualityReport.quality,
  } : undefined;

  return {
    hasFatigue,
    severity,
    indicators: {
      formBreakdown: formBreakdownCount,
      unintentionalFailure: unintentionalFailureCount,
      velocityLoss: avgVelocityLoss,
      volumeOverload,
    },
    affectedMuscles,
    reasoning,
    scientificBasis,
    confidence,
    // vbtAnalysis: vbtAnalysis ?? undefined, // Commented out - VBT module deleted
    dataQuality,
    powerAnalysis: powerAnalysisResult ?? undefined,
  };
}

// ============================================================
// ENHANCED: HIERARCHICAL BAYESIAN FATIGUE DETECTION
// ============================================================

/**
 * Enhanced fatigue detection using PhD-level hierarchical Bayesian models
 *
 * WHEN TO USE:
 * - User has ≥3 historical workouts (sufficient for personalization)
 * - Want confidence intervals on predictions
 * - Need personalized fatigue assessment (not one-size-fits-all)
 * - Want real-time updating during workout
 *
 * BENEFITS OVER BASIC:
 * - Learns user's personal fatigue resistance
 * - Tracks exercise-specific fatigue rates
 * - Provides prediction intervals (not just point estimates)
 * - Detects critical moments (change points)
 * - Updates model in real-time (online learning)
 */
export interface EnhancedTrueFatigueIndicators extends TrueFatigueIndicators {
  // Additional hierarchical model insights
  personalizedAssessment?: {
    userFatigueResistance: number; // 0-100, user's personal resistance
    exerciseSpecificRate: number; // Fatigue rate for THIS exercise
    nextSetPrediction: {
      expectedFatigue: number;
      lower: number; // 95% confidence interval
      upper: number;
    };
    criticalMoment?: {
      detected: boolean;
      setNumber: number;
      interpretation: string;
    };
    shouldStopNow: boolean;
    reasonsToStop: string[];
  };
  usingHierarchicalModel: boolean; // True if advanced model was used
}

/**
 * Detect fatigue with optional hierarchical model enhancement
 *
 * Automatically uses hierarchical model if historical data available,
 * otherwise falls back to standard VBT-based detection.
 */
export function detectTrueFatigueEnhanced(
  sets: SetLog[],
  exerciseId?: string,
  options?: {
    userId?: string;
    historicalWorkouts?: Array<{
      date: Date;
      exercises: Array<{ exerciseId: string; sets: SetLog[] }>;
    }>;
  }
): EnhancedTrueFatigueIndicators {
  // Get standard detection first
  const standardDetection = detectTrueFatigue(sets, exerciseId);

  // Check if we can use hierarchical model
  if (!options?.userId || !options?.historicalWorkouts || !exerciseId) {
    return {
      ...standardDetection,
      usingHierarchicalModel: false
    };
  }

  try {
    // Check if we have enough data
    if (!canUseHierarchicalModel(options.historicalWorkouts)) {
      return {
        ...standardDetection,
        usingHierarchicalModel: false
      };
    }

    // Get enhanced assessment
    const relevantSets = sets.filter(
      s => s.exerciseId === exerciseId && s.completed
    );

    const enhanced = getEnhancedFatigueAssessment(
      options.userId,
      exerciseId,
      relevantSets,
      options.historicalWorkouts
    );

    const mapFatigueLevel = (
      level: 'minimal' | 'low' | 'moderate' | 'high' | 'critical'
    ): TrueFatigueIndicators['severity'] => {
      switch (level) {
        case 'critical':
          return 'critical';
        case 'high':
          return 'high';
        case 'moderate':
          return 'moderate';
        case 'low':
          return 'mild';
        case 'minimal':
        default:
          return 'none';
      }
    };

    // Merge standard detection with hierarchical insights
    return {
      ...standardDetection,
      // Override severity if hierarchical model is more confident
      severity: enhanced.confidence > standardDetection.confidence
        ? mapFatigueLevel(enhanced.fatigueLevel)
        : standardDetection.severity,
      hasFatigue: enhanced.currentFatigue > 40 || standardDetection.hasFatigue,
      confidence: Math.max(enhanced.confidence, standardDetection.confidence),
      personalizedAssessment: {
        userFatigueResistance: enhanced.userFatigueResistance,
        exerciseSpecificRate: enhanced.exerciseSpecificRate,
        nextSetPrediction: {
          expectedFatigue: enhanced.nextSetPrediction.expectedFatigue,
          lower: enhanced.predictionInterval.lower,
          upper: enhanced.predictionInterval.upper
        },
        criticalMoment: enhanced.criticalMoment,
        shouldStopNow: enhanced.shouldStop,
        reasonsToStop: enhanced.reasonsToStop
      },
      usingHierarchicalModel: true,
      scientificBasis: standardDetection.scientificBasis +
        ' Enhanced with hierarchical Bayesian personalization (Gelman & Hill, 2006).',
      reasoning: enhanced.recommendation
    };
  } catch (err) {
    console.warn('Enhanced fatigue detection unavailable, using standard:', err);
    return {
      ...standardDetection,
      usingHierarchicalModel: false
    };
  }
}

// ============================================================
// NEW: RPE CALIBRATION ANALYSIS (Separate from Fatigue)
// ============================================================

/**
 * Analyze RPE calibration - is weight too heavy/light for target RPE?
 * This is about ACCURACY, not fatigue
 *
 * UPGRADED: Now uses Bayesian inference for proper uncertainty quantification
 */
export interface RPECalibration {
  needsAdjustment: boolean;
  direction: 'increase' | 'decrease' | 'good';
  avgDeviation: number;         // Current session deviation
  posteriorBias?: number;       // Bayesian-updated belief (with history)
  consistentOvershoot: boolean;  // Consistently 2+ above target
  consistentUndershoot: boolean; // Consistently 2+ below target
  suggestedChange: number;       // Percentage (0.05 = 5%)
  reasoning: string;
  confidence: number;
  credibleInterval?: { lower: number; upper: number }; // Bayesian credible interval
  bayesianAnalysis?: BayesianRPEAnalysis; // Full Bayesian analysis object
}

export function analyzeRPECalibration(sets: SetLog[], exerciseId?: string): RPECalibration {
  // Filter to completed sets with both actual and prescribed RPE
  const relevantSets = (exerciseId ? sets.filter(s => s.exerciseId === exerciseId) : sets)
    .filter(s => s.completed && s.actualRPE !== null && s.prescribedRPE !== null);

  if (relevantSets.length < 2) {
    return {
      needsAdjustment: false,
      direction: 'good',
      avgDeviation: 0,
      consistentOvershoot: false,
      consistentUndershoot: false,
      suggestedChange: 0,
      reasoning: 'Insufficient data for RPE calibration.',
      confidence: 0,
    };
  }

  // Try to use Bayesian analysis (with fallback to simple method)
  let bayesianAnalysis: BayesianRPEAnalysis | null = null;
  let useBayesian = false;

  try {
    // For now, analyze without historical profile (future: load from storage)
    bayesianAnalysis = analyzeBayesianRPE(relevantSets, null);
    useBayesian = true;
  } catch {
    console.warn('Bayesian RPE analysis unavailable, using fallback');
  }

  // If Bayesian available, use it
  if (useBayesian && bayesianAnalysis) {
    const deviations = relevantSets.map(s => (s.actualRPE! - s.prescribedRPE!));
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const overshoots = deviations.filter(d => d >= 2);
    const undershoots = deviations.filter(d => d <= -2);

    return {
      needsAdjustment: bayesianAnalysis.needsAdjustment,
      direction: bayesianAnalysis.direction,
      avgDeviation,
      posteriorBias: bayesianAnalysis.posteriorBias,
      consistentOvershoot: overshoots.length >= 2,
      consistentUndershoot: undershoots.length >= 2,
      suggestedChange: Math.abs(bayesianAnalysis.suggestedWeightChange),
      reasoning: bayesianAnalysis.reasoning,
      confidence: bayesianAnalysis.confidence,
      credibleInterval: bayesianAnalysis.credibleInterval,
      bayesianAnalysis,
    };
  }

  // Fallback: Simple analysis (original logic)
  const deviations = relevantSets.map(s => (s.actualRPE! - s.prescribedRPE!));
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

  const overshoots = deviations.filter(d => d >= 2);
  const undershoots = deviations.filter(d => d <= -2);

  const consistentOvershoot = overshoots.length >= 2;
  const consistentUndershoot = undershoots.length >= 2;

  const needsAdjustment = consistentOvershoot || consistentUndershoot;
  let direction: RPECalibration['direction'] = 'good';
  let suggestedChange = 0;
  let reasoning = '';

  if (consistentOvershoot) {
    direction = 'decrease';
    suggestedChange = Math.min(0.15, Math.abs(avgDeviation) * 0.05);
    reasoning = `Weight consistently too heavy. Average overshoot: ${avgDeviation.toFixed(1)} RPE points above target across ${overshoots.length} sets.`;
  } else if (consistentUndershoot) {
    direction = 'increase';
    suggestedChange = Math.min(0.10, Math.abs(avgDeviation) * 0.04);
    reasoning = `Weight too light for target RPE. Average undershoot: ${Math.abs(avgDeviation).toFixed(1)} RPE points below target across ${undershoots.length} sets.`;
  } else if (Math.abs(avgDeviation) < 0.5) {
    reasoning = 'RPE calibration looks good - weight matches target intensity.';
  } else {
    reasoning = 'RPE varies but no consistent pattern - weight is reasonable.';
  }

  const confidence = needsAdjustment ? (overshoots.length + undershoots.length >= 3 ? 0.85 : 0.70) : 0.5;

  return {
    needsAdjustment,
    direction,
    avgDeviation,
    consistentOvershoot,
    consistentUndershoot,
    suggestedChange,
    reasoning,
    confidence,
  };
}
