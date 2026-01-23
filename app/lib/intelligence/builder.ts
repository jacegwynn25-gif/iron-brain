/**
 * Iron Brain - Evidence-Based Program Builder
 *
 * This is the core logic engine that generates GOAL-SPECIFIC programs
 * based on the scientific configuration in config.ts.
 *
 * Key Features:
 * - GOAL-AWARE rep ranges (NSCA/ACSM/Juggernaut research)
 *   • Strength: 3-6 reps @ high intensity
 *   • Hypertrophy: 6-12 reps @ moderate intensity
 *   • Powerlifting: Block periodization (hypertrophy → strength → peaking)
 *   • Peaking: 1-3 reps (singles, doubles, triples)
 * - Uses Volume Landmarks (MEV, MAV, MRV) to set appropriate volume
 * - Prioritizes S-Tier (stretch-focused) exercises
 * - Enforces junk volume limits (≤10 sets/muscle/session)
 * - Applies experience-appropriate splits
 */

import {
  VOLUME_LANDMARKS,
  EXERCISE_TIER_LIST,
  ExerciseConfig,
  ExerciseTier,
  TrainingGoal,
  Range,
  RepRangePreference,
  RIRPreference,
  getExercisesForMuscle,
  getRecommendedVolume,
  isJunkVolume,
  getRepRangeForGoal,
  getRIRForGoal,
  getVolumeMultiplierForGoal,
  getWeekProgress,
} from './config';
import {
  ProgramTemplate,
  WeekTemplate,
  DayTemplate,
  SetTemplate,
} from '../types';

// ============================================
// USER PROFILE TYPES
// ============================================

export interface UserProfile {
  // Experience
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  trainingAgeYears: number;

  // Schedule
  daysPerWeek: 3 | 4 | 5 | 6;
  sessionLengthMinutes: 45 | 60 | 75 | 90;

  // Goals - matches TrainingGoal from config.ts
  primaryGoal: 'hypertrophy' | 'strength' | 'powerlifting' | 'peaking' | 'general';

  // Equipment
  availableEquipment: ('barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight')[];

  // Preferences
  emphasisMuscles?: string[];   // Muscles to prioritize
  weakPoints?: string[];        // Muscles needing extra work
  excludeExercises?: string[];  // Exercise IDs to avoid
  injuries?: string[];          // Injured areas to work around
  repRangePreference?: RepRangePreference;
  rirPreference?: RIRPreference;

  // Advanced
  recoveryCapacity?: 'low' | 'average' | 'high';
  weekCount?: number;           // Program length (default: 4)
}

// ============================================
// SPLIT STRUCTURES
// ============================================

type SplitType = 'full_body' | 'upper_lower' | 'ppl' | 'ppl_6';

interface SplitConfig {
  type: SplitType;
  days: {
    name: string;
    muscles: string[];
    dayOfWeek: DayTemplate['dayOfWeek'];
  }[];
}

const SPLIT_CONFIGS: Record<string, SplitConfig> = {
  // Full Body 3x (Beginner)
  full_body_3: {
    type: 'full_body',
    days: [
      { name: 'Full Body A', muscles: ['chest', 'back', 'quads', 'hamstrings', 'sideDelts', 'biceps', 'triceps'], dayOfWeek: 'Mon' },
      { name: 'Full Body B', muscles: ['chest', 'back', 'quads', 'glutes', 'rearDelts', 'biceps', 'triceps'], dayOfWeek: 'Wed' },
      { name: 'Full Body C', muscles: ['chest', 'back', 'quads', 'hamstrings', 'sideDelts', 'calves', 'abs'], dayOfWeek: 'Fri' },
    ],
  },

  // Upper/Lower 4x (Intermediate)
  upper_lower_4: {
    type: 'upper_lower',
    days: [
      { name: 'Upper A (Push Focus)', muscles: ['chest', 'frontDelts', 'sideDelts', 'triceps', 'back', 'biceps'], dayOfWeek: 'Mon' },
      { name: 'Lower A (Quad Focus)', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'], dayOfWeek: 'Tue' },
      { name: 'Upper B (Pull Focus)', muscles: ['back', 'rearDelts', 'biceps', 'chest', 'triceps', 'sideDelts'], dayOfWeek: 'Thu' },
      { name: 'Lower B (Hinge Focus)', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'], dayOfWeek: 'Fri' },
    ],
  },

  // PPL 5x (Intermediate/Advanced)
  ppl_5: {
    type: 'ppl',
    days: [
      { name: 'Push', muscles: ['chest', 'frontDelts', 'sideDelts', 'triceps'], dayOfWeek: 'Mon' },
      { name: 'Pull', muscles: ['back', 'rearDelts', 'biceps'], dayOfWeek: 'Tue' },
      { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'], dayOfWeek: 'Wed' },
      { name: 'Upper', muscles: ['chest', 'back', 'sideDelts', 'biceps', 'triceps'], dayOfWeek: 'Fri' },
      { name: 'Lower', muscles: ['quads', 'hamstrings', 'glutes', 'calves'], dayOfWeek: 'Sat' },
    ],
  },

  // PPL 6x (Advanced)
  ppl_6: {
    type: 'ppl_6',
    days: [
      { name: 'Push A', muscles: ['chest', 'frontDelts', 'sideDelts', 'triceps'], dayOfWeek: 'Mon' },
      { name: 'Pull A', muscles: ['back', 'rearDelts', 'biceps'], dayOfWeek: 'Tue' },
      { name: 'Legs A', muscles: ['quads', 'hamstrings', 'glutes', 'calves'], dayOfWeek: 'Wed' },
      { name: 'Push B', muscles: ['chest', 'sideDelts', 'triceps'], dayOfWeek: 'Thu' },
      { name: 'Pull B', muscles: ['back', 'rearDelts', 'biceps'], dayOfWeek: 'Fri' },
      { name: 'Legs B', muscles: ['quads', 'hamstrings', 'glutes', 'abs'], dayOfWeek: 'Sat' },
    ],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const SPLIT_NAME_MAP: Record<SplitType, string> = {
  full_body: 'Full Body',
  upper_lower: 'Upper/Lower',
  ppl: 'Push Pull Legs',
  ppl_6: 'Push Pull Legs (6-Day)',
};

const GOAL_LABEL_MAP: Record<UserProfile['primaryGoal'], string> = {
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  powerlifting: 'Powerlifting',
  peaking: 'Peaking',
  general: 'General Fitness',
};

const EXPERIENCE_LABEL_MAP: Record<UserProfile['experienceLevel'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function normalizeProgramName(name: string): string {
  return name
    .replace(/\bA\.?I\.?\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—]+/, '')
    .replace(/[\s\-–—]+$/, '')
    .trim();
}

function buildProgramName(
  split: SplitConfig,
  experienceLevel: UserProfile['experienceLevel'],
  primaryGoal: UserProfile['primaryGoal']
): string {
  const splitName = SPLIT_NAME_MAP[split.type] || 'Program';
  const levelLabel = EXPERIENCE_LABEL_MAP[experienceLevel] || experienceLevel;
  const goalLabel = GOAL_LABEL_MAP[primaryGoal] || primaryGoal;
  return normalizeProgramName(`${splitName} - ${levelLabel} ${goalLabel}`);
}

/**
 * Select the appropriate split based on experience and days available
 */
function selectSplit(profile: UserProfile): SplitConfig {
  const { experienceLevel, daysPerWeek } = profile;

  // Beginners: Force Full Body
  if (experienceLevel === 'beginner' || daysPerWeek === 3) {
    return SPLIT_CONFIGS.full_body_3;
  }

  // Intermediate: Upper/Lower or PPL based on days
  if (experienceLevel === 'intermediate') {
    if (daysPerWeek === 4) return SPLIT_CONFIGS.upper_lower_4;
    if (daysPerWeek === 5) return SPLIT_CONFIGS.ppl_5;
    if (daysPerWeek === 6) return SPLIT_CONFIGS.ppl_6;
    return SPLIT_CONFIGS.upper_lower_4;
  }

  // Advanced: Can use any split
  if (daysPerWeek <= 4) return SPLIT_CONFIGS.upper_lower_4;
  if (daysPerWeek === 5) return SPLIT_CONFIGS.ppl_5;
  return SPLIT_CONFIGS.ppl_6;
}

/**
 * Get the best available exercise for a muscle, filtered by equipment
 */
function getBestExercise(
  muscle: string,
  availableEquipment: string[],
  excludeIds: string[] = [],
  preferTier: ExerciseTier = 'S'
): ExerciseConfig | null {
  const exercises = getExercisesForMuscle(muscle, 'C');

  // Filter by equipment and exclusions
  const available = exercises.filter(ex => {
    const hasEquipment = ex.equipment.some(eq => availableEquipment.includes(eq));
    const notExcluded = !excludeIds.includes(ex.id);
    return hasEquipment && notExcluded;
  });

  if (available.length === 0) return null;

  // Prioritize by tier, then by stretch-focused
  const tierOrder: ExerciseTier[] = ['S', 'A', 'B', 'C'];
  available.sort((a, b) => {
    const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
    if (tierDiff !== 0) return tierDiff;
    // Prefer stretch-focused within same tier
    if (a.stretchFocused && !b.stretchFocused) return -1;
    if (!a.stretchFocused && b.stretchFocused) return 1;
    // Prefer compounds over isolation for first exercise
    if (a.movementType === 'compound' && b.movementType === 'isolation') return -1;
    if (a.movementType === 'isolation' && b.movementType === 'compound') return 1;
    return 0;
  });

  return available[0];
}

/**
 * Get a secondary exercise (different from first)
 */
function getSecondaryExercise(
  muscle: string,
  availableEquipment: string[],
  excludeIds: string[]
): ExerciseConfig | null {
  return getBestExercise(muscle, availableEquipment, excludeIds, 'A');
}

const WEEKLY_RIR_REDUCTION: Record<TrainingGoal, number> = {
  hypertrophy: 0.6,
  strength: 0.5,
  powerlifting: 0.5,
  peaking: 0.3,
  general: 0.4,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function calculateSetTargetRIR(
  range: Range,
  setIndex: number,
  totalSets: number,
  weekProgress: number,
  goal: TrainingGoal
): number {
  const setProgress = totalSets <= 1 ? 0 : setIndex / (totalSets - 1);
  const base = range.max - setProgress * (range.max - range.min);
  const reduction = weekProgress * (WEEKLY_RIR_REDUCTION[goal] ?? WEEKLY_RIR_REDUCTION.general);
  const target = base - reduction;
  return Number(clamp(target, range.min, range.max).toFixed(1));
}

/**
 * Calculate weekly sets per muscle based on volume landmarks
 */
function calculateWeeklyVolume(
  profile: UserProfile
): Map<string, { sets: number; frequency: number }> {
  const volumeMap = new Map<string, { sets: number; frequency: number }>();
  const { experienceLevel, recoveryCapacity = 'average', emphasisMuscles = [] } = profile;

  for (const [muscleKey, landmark] of Object.entries(VOLUME_LANDMARKS)) {
    const { min, max, frequency } = getRecommendedVolume(
      muscleKey,
      experienceLevel,
      recoveryCapacity
    );

    // Use middle of range, or lean toward max for emphasis muscles
    let targetSets = Math.round((min + max) / 2);
    if (emphasisMuscles.includes(muscleKey)) {
      targetSets = Math.round(max * 0.9); // 90% of max for emphasis
    }

    volumeMap.set(muscleKey, { sets: targetSets, frequency });
  }

  return volumeMap;
}

/**
 * Distribute weekly sets across training days
 */
function distributeSetsAcrossDays(
  weeklyVolume: Map<string, { sets: number; frequency: number }>,
  split: SplitConfig
): Map<string, Map<string, number>> {
  // Map: dayName -> Map(muscle -> sets)
  const distribution = new Map<string, Map<string, number>>();

  // Initialize days
  for (const day of split.days) {
    distribution.set(day.name, new Map<string, number>());
  }

  // For each muscle, distribute sets across days that train it
  for (const [muscle, { sets: weeklyTotal }] of weeklyVolume) {
    // Find days that include this muscle
    const daysWithMuscle = split.days.filter(d => d.muscles.includes(muscle));

    if (daysWithMuscle.length === 0) continue;

    // Distribute evenly, respecting junk volume limit
    const setsPerDay = Math.ceil(weeklyTotal / daysWithMuscle.length);
    const cappedSetsPerDay = Math.min(setsPerDay, 10); // Junk volume limit

    for (const day of daysWithMuscle) {
      const dayMap = distribution.get(day.name)!;
      dayMap.set(muscle, cappedSetsPerDay);
    }
  }

  return distribution;
}

/**
 * Create sets for an exercise with GOAL-SPECIFIC rep ranges
 *
 * Rep ranges based on:
 * - NSCA: Strength = 1-6 reps
 * - ACSM: Hypertrophy = 6-12 reps
 * - Juggernaut: Peaking = 1-3 reps
 */
/**
 * Build sets for an exercise with goal-aware reps, RIR, and user preferences.
 */
function createSetsForExercise(
  exercise: ExerciseConfig,
  numSets: number,
  weekNumber: number,
  totalWeeks: number,
  goal: TrainingGoal,
  profile: UserProfile
): SetTemplate[] {
  const sets: SetTemplate[] = [];
  const weeks = Math.max(1, totalWeeks);

  const repRange = getRepRangeForGoal(exercise, goal, {
    weekNumber,
    totalWeeks: weeks,
    preference: profile.repRangePreference,
  });

  const rirRange = getRIRForGoal(exercise, goal, {
    weekNumber,
    totalWeeks: weeks,
    preference: profile.rirPreference,
  });

  const weekProgress = getWeekProgress(weekNumber, weeks);
  const restSeconds = getRestSecondsForGoal(exercise, goal);
  const prescribedReps =
    repRange.min === repRange.max ? `${repRange.min}` : `${repRange.min}-${repRange.max}`;

  for (let i = 0; i < numSets; i++) {
    const targetRIR = calculateSetTargetRIR(rirRange, i, numSets, weekProgress, goal);
    sets.push({
      exerciseId: exercise.id,
      setIndex: i,
      prescribedReps,
      minReps: repRange.min,
      maxReps: repRange.max,
      prescriptionMethod: 'rir',
      targetRIR,
      restSeconds,
      notes: exercise.executionNotes,
    });
  }

  return sets;
}

/**
 * Get goal-specific rest periods
 * - Strength/Peaking: Longer rest (3-5 min) for CNS recovery
 * - Hypertrophy: Moderate rest (90-120s) for metabolic stress
 */
function getRestSecondsForGoal(exercise: ExerciseConfig, goal: TrainingGoal): number {
  const isCompound = exercise.movementType === 'compound';

  switch (goal) {
    case 'strength':
    case 'powerlifting':
      return isCompound ? 240 : 180; // 4 min compounds, 3 min isolations
    case 'peaking':
      return isCompound ? 300 : 180; // 5 min for heavy singles/doubles
    case 'hypertrophy':
      return isCompound ? 150 : 90;  // 2.5 min compounds, 90s isolations
    case 'general':
    default:
      return isCompound ? 180 : 120; // 3 min compounds, 2 min isolations
  }
}

/**
 * Build a single day's workout
 */
function buildDay(
  dayConfig: SplitConfig['days'][0],
  muscleSetCounts: Map<string, number>,
  profile: UserProfile,
  weekNumber: number,
  totalWeeks: number,
  goal: TrainingGoal
): DayTemplate {
  const sets: SetTemplate[] = [];
  const usedExerciseIds: string[] = [];
  const { availableEquipment, excludeExercises = [] } = profile;

  // Sort muscles: prioritize compounds first (chest, back, quads before isolation muscles)
  const compoundMuscles = ['chest', 'back', 'quads', 'hamstrings', 'glutes'];
  const sortedMuscles = [...dayConfig.muscles].sort((a, b) => {
    const aIsCompound = compoundMuscles.includes(a);
    const bIsCompound = compoundMuscles.includes(b);
    if (aIsCompound && !bIsCompound) return -1;
    if (!aIsCompound && bIsCompound) return 1;
    return 0;
  });

  for (const muscle of sortedMuscles) {
    const targetSets = muscleSetCounts.get(muscle) || 0;
    if (targetSets === 0) continue;

    // Find best exercise for this muscle
    const exercise = getBestExercise(
      muscle,
      availableEquipment,
      [...usedExerciseIds, ...excludeExercises]
    );

    if (!exercise) continue;

    // If we need more than 4 sets, consider adding a second exercise
    if (targetSets > 4) {
      // First exercise: half the sets (at least 3)
      const firstExerciseSets = Math.max(3, Math.ceil(targetSets / 2));
      const exerciseSets = createSetsForExercise(exercise, firstExerciseSets, weekNumber, totalWeeks, goal, profile);
      sets.push(...exerciseSets);
      usedExerciseIds.push(exercise.id);

      // Second exercise: remaining sets
      const remainingSets = targetSets - firstExerciseSets;
      if (remainingSets > 0) {
        const secondExercise = getSecondaryExercise(
          muscle,
          availableEquipment,
          [...usedExerciseIds, ...excludeExercises]
        );
        if (secondExercise) {
          const secondSets = createSetsForExercise(secondExercise, remainingSets, weekNumber, totalWeeks, goal, profile);
          sets.push(...secondSets);
          usedExerciseIds.push(secondExercise.id);
        }
      }
    } else {
      // Single exercise for this muscle
      const exerciseSets = createSetsForExercise(exercise, targetSets, weekNumber, totalWeeks, goal, profile);
      sets.push(...exerciseSets);
      usedExerciseIds.push(exercise.id);
    }
  }

  // Reorder: Compounds first, then isolations
  const compoundSets: SetTemplate[] = [];
  const isolationSets: SetTemplate[] = [];

  for (const set of sets) {
    const exercise = EXERCISE_TIER_LIST.find(e => e.id === set.exerciseId);
    if (exercise?.movementType === 'compound') {
      compoundSets.push(set);
    } else {
      isolationSets.push(set);
    }
  }

  // Re-index sets after reordering
  const orderedSets = [...compoundSets, ...isolationSets];
  orderedSets.forEach((set, idx) => {
    set.setIndex = idx;
  });

  return {
    dayOfWeek: dayConfig.dayOfWeek,
    name: dayConfig.name,
    sets: orderedSets,
  };
}

/**
 * Build a complete week with goal-specific programming
 */
function buildWeek(
  weekNumber: number,
  totalWeeks: number,
  split: SplitConfig,
  distribution: Map<string, Map<string, number>>,
  profile: UserProfile,
  goal: TrainingGoal,
  isDeload: boolean = false
): WeekTemplate {
  const days: DayTemplate[] = [];

  // Apply goal-specific volume modifier
  const volumeMultiplier = isDeload ? 0.6 : getVolumeMultiplierForGoal(goal);

  for (const dayConfig of split.days) {
    const muscleSetCounts = distribution.get(dayConfig.name);
    if (!muscleSetCounts) continue;

    // Adjust volume based on goal and deload status
    const adjustedCounts = new Map<string, number>();
    for (const [muscle, sets] of muscleSetCounts) {
      adjustedCounts.set(muscle, Math.round(sets * volumeMultiplier));
    }

    const day = buildDay(dayConfig, adjustedCounts, profile, weekNumber, totalWeeks, goal);
    days.push(day);
  }

  return {
    weekNumber,
    days,
  };
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Determine the training goal for a specific week in a periodized program
 *
 * Goal-specific logic:
 * - Hypertrophy: Constant 6-12 rep range throughout
 * - Strength: Constant 3-6 rep range throughout
 * - Powerlifting: Block periodization (Juggernaut/RP style)
 *   • Hypertrophy block: First ~40% of weeks
 *   • Strength block: Next ~40% of weeks
 *   • Peaking block: Final ~20% of weeks (1-3 reps)
 * - Peaking: Direct competition prep, 1-3 reps throughout
 * - General: Mixed approach
 */
function getGoalForWeek(
  weekNumber: number,
  totalWeeks: number,
  userGoal: UserProfile['primaryGoal']
): TrainingGoal {
  switch (userGoal) {
    case 'hypertrophy':
      return 'hypertrophy';

    case 'strength':
      return 'strength';

    case 'powerlifting': {
      // Block periodization for powerlifting prep
      // Based on Juggernaut/RP methodology
      const hypertrophyEnd = Math.ceil(totalWeeks * 0.4);  // ~40% hypertrophy
      const strengthEnd = Math.ceil(totalWeeks * 0.8);      // ~40% strength

      if (weekNumber <= hypertrophyEnd) {
        return 'hypertrophy'; // Build muscle base (6-10 reps)
      } else if (weekNumber <= strengthEnd) {
        return 'powerlifting'; // Competition-style training (3-5 reps)
      } else {
        return 'peaking';      // Peak for meet (1-3 reps)
      }
    }

    case 'peaking':
      // Direct peaking - use low reps throughout
      return 'peaking';

    case 'general':
    default:
      return 'general';
  }
}

/**
 * Generate a complete GOAL-SPECIFIC program based on user profile
 *
 * @param profile - User's training profile and preferences
 * @returns A complete ProgramTemplate ready to use
 *
 * Key Features:
 * - Goal-aware rep ranges (NSCA/ACSM research)
 * - Block periodization for strength goals
 * - Progressive RIR throughout program
 */
export function generateProgram(profile: UserProfile): ProgramTemplate {
  const {
    experienceLevel,
    primaryGoal,
    weekCount = 4,
  } = profile;

  // 1. Select appropriate split
  const split = selectSplit(profile);

  // 2. Calculate weekly volume per muscle
  const weeklyVolume = calculateWeeklyVolume(profile);

  // 3. Distribute sets across training days
  const distribution = distributeSetsAcrossDays(weeklyVolume, split);

  // 4. Build weeks with goal-specific programming
  const weeks: WeekTemplate[] = [];
  for (let w = 1; w <= weekCount; w++) {
    // Determine goal for this week (may vary in periodized programs)
    const weekGoal = getGoalForWeek(w, weekCount, primaryGoal);

    // Deload every 4th week (or last week if weekCount not divisible by 4)
    const isDeload = w % 4 === 0 || w === weekCount;
    const week = buildWeek(w, weekCount, split, distribution, profile, weekGoal, isDeload);
    weeks.push(week);
  }

  // 5. Generate program name
  const splitName = SPLIT_NAME_MAP[split.type] || 'Program';
  const programName = buildProgramName(split, experienceLevel, primaryGoal);
  const goalLabel = GOAL_LABEL_MAP[primaryGoal] || primaryGoal;

  // 6. Build the program template
  const program: ProgramTemplate = {
    id: `ai_prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: programName,
    description: `${weekCount}-week ${splitName} program optimized for ${goalLabel}. Built using evidence-based volume landmarks and stretch-focused exercise selection.`,
    author: 'Iron Brain',
    goal: primaryGoal === 'strength' ? 'strength' : 'hypertrophy',
    experienceLevel,
    daysPerWeek: profile.daysPerWeek,
    weekCount,
    intensityMethod: 'rir',
    isCustom: true,
    weeks,
  };

  return program;
}

// ============================================
// VALIDATION & ANALYSIS
// ============================================

/**
 * Analyze a generated program and return stats
 */
export function analyzeProgramVolume(program: ProgramTemplate): {
  weeklyVolumeByMuscle: Map<string, number>;
  totalSetsPerWeek: number;
  exerciseCounts: Map<string, number>;
  warnings: string[];
} {
  const weeklyVolumeByMuscle = new Map<string, number>();
  const exerciseCounts = new Map<string, number>();
  const warnings: string[] = [];
  let totalSets = 0;

  // Analyze first week (representative)
  const firstWeek = program.weeks[0];
  if (!firstWeek) {
    return { weeklyVolumeByMuscle, totalSetsPerWeek: 0, exerciseCounts, warnings };
  }

  for (const day of firstWeek.days) {
    const muscleSetCounts = new Map<string, number>();

    for (const set of day.sets) {
      totalSets++;

      // Count exercise usage
      const exCount = exerciseCounts.get(set.exerciseId) || 0;
      exerciseCounts.set(set.exerciseId, exCount + 1);

      // Find exercise config to get muscle info
      const exercise = EXERCISE_TIER_LIST.find(e => e.id === set.exerciseId);
      if (exercise) {
        // Primary muscle
        const primary = exercise.primaryMuscle;
        const weeklyCount = weeklyVolumeByMuscle.get(primary) || 0;
        weeklyVolumeByMuscle.set(primary, weeklyCount + 1);

        // Track per-session volume for junk volume check
        const sessionCount = muscleSetCounts.get(primary) || 0;
        muscleSetCounts.set(primary, sessionCount + 1);
      }
    }

    // Check for junk volume
    for (const [muscle, sets] of muscleSetCounts) {
      if (isJunkVolume(sets)) {
        warnings.push(`${day.name}: ${muscle} has ${sets} sets (>10 = junk volume risk)`);
      }
    }
  }

  // Check for under/over volume
  for (const [muscle, sets] of weeklyVolumeByMuscle) {
    const landmark = VOLUME_LANDMARKS[muscle];
    if (landmark) {
      if (sets < landmark.MEV) {
        warnings.push(`${muscle}: ${sets} sets/week is below MEV (${landmark.MEV})`);
      }
      if (sets > landmark.MRV) {
        warnings.push(`${muscle}: ${sets} sets/week exceeds MRV (${landmark.MRV})`);
      }
    }
  }

  return {
    weeklyVolumeByMuscle,
    totalSetsPerWeek: totalSets,
    exerciseCounts,
    warnings,
  };
}

export default generateProgram;
