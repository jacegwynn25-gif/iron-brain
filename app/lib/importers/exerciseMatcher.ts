import Fuse from 'fuse.js';
import { getAllExercises } from '../programs';
import type { Exercise } from '../types';
import type { ExerciseMatch, ExerciseMatcherResult } from './types';

// Comprehensive alias dictionary based on user's workout data
const EXERCISE_ALIASES: Record<string, string[]> = {
  // Bench variations
  bench_tng: ['tng bench', 'bench press', 'bench', 'bp', 'flat bench', 'touch and go bench', 'touch n go'],
  bench_paused: ['paused bench', 'pause bench', 'comp bench', 'competition bench', 'paused bp'],
  incline_bench: ['incline bench', 'incline press', 'incline bp', 'incline barbell'],

  // Squat variations
  squat: ['back squat', 'barbell squat', 'sq', 'squat', 'back squat barbell'],
  leg_press: ['leg press', 'leg press machine'],

  // Deadlift variations
  romanian_deadlift: ['rdl', 'rdl / sldl', 'romanian deadlift', 'stiff leg deadlift', 'sldl', 'stiff legged'],
  deadlift: ['dl', 'conventional deadlift', 'deadlift', 'barbell deadlift'],

  // Tricep exercises
  overhead_cable_extension: ['overhead cable extension', 'overhead cable ext', 'overhead ext', 'cable overhead extension'],
  tricep_pressdown: ['machine pressdown', 'pressdown', 'cable pressdown', 'tricep pressdown', 'triceps pressdown'],
  jm_press: ['jm press', 'jm', 'jm bench'],

  // Back exercises
  chest_supported_row: ['chest supported row', 'seal row', 'chest support row'],
  neutral_grip_row: ['neutral grip row', 'neutral row', 'neutral grip'],
  lat_pulldown: ['lat pulldown', 'pulldown', 'light pulldown', 'cable pulldown'],
  cable_row: ['cable row', 'seated cable row', 'seated row'],

  // Shoulder exercises
  lateral_raise: ['lateral raise', 'side raise', 'lat raise', 'side lateral', 'dumbbell lateral'],
  machine_shoulder_press: ['machine shoulder press', 'shoulder press machine', 'machine press'],
  ohp: ['overhead press', 'shoulder press', 'military press', 'standing press', 'barbell shoulder press'],
  rear_delt_fly: ['rear delt fly', 'reverse fly', 'rear fly', 'rear delt', 'reverse pec deck'],

  // Bicep exercises
  cable_curl: ['cable curl', 'cable bicep curl', 'cable curls'],
  bicep_curl_preacher: ['machine preacher curl', 'preacher curl machine', 'preacher curl', 'preacher'],
  hammer_curl: ['hammer curl', 'neutral curl', 'hammer curls', 'neutral grip curl'],
  barbell_curl: ['barbell curl', 'bb curl', 'straight bar curl'],

  // Leg exercises
  leg_curl: ['leg curl', 'hamstring curl', 'lying leg curl', 'seated leg curl'],
  leg_extension: ['leg extension', 'leg ext', 'quad extension'],

  // Other common exercises
  bench_dumbbell: ['dumbbell bench', 'db bench', 'dumbbell press'],
  row_dumbbell: ['dumbbell row', 'db row', 'single arm row'],
  lunge: ['lunge', 'lunges', 'walking lunge', 'reverse lunge'],
  leg_raise: ['leg raise', 'hanging leg raise', 'lying leg raise'],
  plank: ['plank', 'front plank', 'forearm plank'],
  pullup: ['pull up', 'pullup', 'pull-up', 'chinup', 'chin up'],
  pushup: ['push up', 'pushup', 'push-up'],
  dip: ['dip', 'dips', 'parallel bar dip'],
};

// Build reverse alias map (alias -> exerciseId)
const ALIAS_TO_EXERCISE_ID: Map<string, string> = new Map();
for (const [exerciseId, aliases] of Object.entries(EXERCISE_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_EXERCISE_ID.set(alias.toLowerCase(), exerciseId);
  }
}

/**
 * Normalize exercise name for matching
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters
 * - Handle pluralization
 */
function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[\/\|]/g, ' ') // Replace / and | with space
    .replace(/\s+/g, ' ') // Collapse again
    .replace(/s$/, ''); // Simple stemming: remove trailing 's'
}

/**
 * Match a single exercise name to the exercise database
 */
export function matchExercise(
  exerciseName: string,
  allExercises: Exercise[]
): ExerciseMatch {
  const normalized = normalizeExerciseName(exerciseName);

  // Tier 1: Exact match by ID or name
  for (const exercise of allExercises) {
    if (
      exercise.id.toLowerCase() === normalized ||
      normalizeExerciseName(exercise.name) === normalized
    ) {
      return {
        originalName: exerciseName,
        matchedExerciseId: exercise.id,
        matchedExerciseName: exercise.name,
        confidence: 'exact',
        confidenceScore: 100,
        needsReview: false,
      };
    }
  }

  // Tier 2: Alias match
  const aliasMatch = ALIAS_TO_EXERCISE_ID.get(normalized);
  if (aliasMatch) {
    const exercise = allExercises.find((e) => e.id === aliasMatch);
    if (exercise) {
      return {
        originalName: exerciseName,
        matchedExerciseId: exercise.id,
        matchedExerciseName: exercise.name,
        confidence: 'alias',
        confidenceScore: 95,
        needsReview: false,
      };
    }
  }

  // Handle "or" cases: try matching each part
  if (normalized.includes(' or ')) {
    const parts = normalized.split(' or ').map((p) => p.trim());
    for (const part of parts) {
      const partAliasMatch = ALIAS_TO_EXERCISE_ID.get(part);
      if (partAliasMatch) {
        const exercise = allExercises.find((e) => e.id === partAliasMatch);
        if (exercise) {
          return {
            originalName: exerciseName,
            matchedExerciseId: exercise.id,
            matchedExerciseName: exercise.name,
            confidence: 'alias',
            confidenceScore: 90,
            needsReview: true, // Review because it's ambiguous
          };
        }
      }
    }
  }

  // Tier 3: Fuzzy match using Fuse.js
  const fuse = new Fuse(allExercises, {
    keys: ['name', 'id'],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    includeScore: true,
  });

  const fuzzyResults = fuse.search(exerciseName);

  if (fuzzyResults.length > 0) {
    const topMatch = fuzzyResults[0];
    const score = Math.round((1 - (topMatch.score || 0)) * 100);

    // Get alternative matches (top 3)
    const alternatives = fuzzyResults.slice(1, 4).map((result) => ({
      exerciseId: result.item.id,
      exerciseName: result.item.name,
      score: Math.round((1 - (result.score || 0)) * 100),
    }));

    return {
      originalName: exerciseName,
      matchedExerciseId: topMatch.item.id,
      matchedExerciseName: topMatch.item.name,
      confidence: 'fuzzy',
      confidenceScore: score,
      alternativeMatches: alternatives,
      needsReview: score < 80, // Review if confidence < 80%
    };
  }

  // No match found
  return {
    originalName: exerciseName,
    matchedExerciseId: null,
    matchedExerciseName: null,
    confidence: 'none',
    confidenceScore: 0,
    needsReview: true,
  };
}

/**
 * Match multiple exercise names in batch
 */
export function matchExercises(
  exerciseNames: string[]
): ExerciseMatcherResult {
  const allExercises = getAllExercises();
  const uniqueNames = Array.from(new Set(exerciseNames)); // Deduplicate

  const matches = uniqueNames.map((name) => matchExercise(name, allExercises));

  const unmatchedCount = matches.filter((m) => m.confidence === 'none').length;
  const needsReviewCount = matches.filter((m) => m.needsReview).length;

  return {
    matches,
    unmatchedCount,
    needsReviewCount,
  };
}

/**
 * Update an exercise match (user override)
 */
export function updateExerciseMatch(
  match: ExerciseMatch,
  newExerciseId: string,
  allExercises: Exercise[]
): ExerciseMatch {
  const exercise = allExercises.find((e) => e.id === newExerciseId);

  if (!exercise) {
    throw new Error(`Exercise with ID ${newExerciseId} not found`);
  }

  return {
    ...match,
    matchedExerciseId: exercise.id,
    matchedExerciseName: exercise.name,
    confidence: 'exact', // User confirmed
    confidenceScore: 100,
    needsReview: false,
  };
}

/**
 * Add exercise alias to the dictionary (runtime learning)
 */
export function addExerciseAlias(
  alias: string,
  exerciseId: string
): void {
  const normalized = normalizeExerciseName(alias);
  ALIAS_TO_EXERCISE_ID.set(normalized, exerciseId);

  // Also add to the main dictionary
  if (!EXERCISE_ALIASES[exerciseId]) {
    EXERCISE_ALIASES[exerciseId] = [];
  }
  if (!EXERCISE_ALIASES[exerciseId].includes(normalized)) {
    EXERCISE_ALIASES[exerciseId].push(normalized);
  }
}
