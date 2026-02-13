import { defaultExercises } from '../programs';
import type { CustomExercise, Exercise as LibraryExercise } from '../types';

export type ExerciseMuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'other';

export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  source: 'default' | 'custom';
  muscleGroups: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

export type ExerciseCatalog = {
  entriesById: Map<string, ExerciseCatalogEntry>;
  lookupByKey: Map<string, ExerciseCatalogEntry>;
};

export type ExerciseIdentity = {
  id: string;
  name?: string | null;
};

type ResolveExerciseDisplayNameOptions = {
  catalog?: ExerciseCatalog | null;
  cachedName?: string | null;
};

type ResolveExerciseMuscleProfileOptions = {
  catalog?: ExerciseCatalog | null;
};

const CUSTOM_PREFIX = /^custom[_-]+/i;
const KNOWN_ACRONYMS = new Set(['rdl', 'ssb', 'ohp', 'db', 'bb', 'ez', 'pr', 'rm']);

const HEURISTIC_BLEND_BY_ID: Record<string, [ExerciseMuscleGroup, ExerciseMuscleGroup]> = {
  bench_press: ['chest', 'triceps'],
  dips: ['chest', 'triceps'],
  overhead_press: ['shoulders', 'triceps'],
  pull_up: ['back', 'biceps'],
  chin_up: ['back', 'biceps'],
  barbell_row: ['back', 'biceps'],
  dumbbell_row: ['back', 'biceps'],
  lat_pulldown: ['back', 'biceps'],
  face_pull: ['back', 'biceps'],
  back_squat: ['quads', 'glutes'],
  split_squat: ['quads', 'glutes'],
  lunges: ['quads', 'glutes'],
  leg_press: ['quads', 'glutes'],
  leg_extension: ['quads', 'glutes'],
  deadlift: ['hamstrings', 'glutes'],
  hip_thrust: ['glutes', 'hamstrings'],
  leg_curl: ['hamstrings', 'glutes'],
};

const HEURISTIC_PRIMARY_BY_ID: Record<string, ExerciseMuscleGroup> = {
  lateral_raise: 'shoulders',
  tricep_extension: 'triceps',
  bicep_curl: 'biceps',
  calf_raise: 'calves',
  plank: 'core',
  ab_wheel: 'core',
};

const COMMON_TARGET_BY_ID: Record<string, 'push' | 'pull' | 'legs' | 'core'> = {
  back_squat: 'legs',
  deadlift: 'legs',
  bench_press: 'push',
  overhead_press: 'push',
  pull_up: 'pull',
  chin_up: 'pull',
  barbell_row: 'pull',
  dumbbell_row: 'pull',
  lat_pulldown: 'pull',
  dips: 'push',
  tricep_extension: 'push',
  bicep_curl: 'pull',
  leg_press: 'legs',
  lunges: 'legs',
  split_squat: 'legs',
  calf_raise: 'legs',
  hip_thrust: 'legs',
  leg_extension: 'legs',
  leg_curl: 'legs',
  face_pull: 'pull',
  lateral_raise: 'push',
  plank: 'core',
  ab_wheel: 'core',
};

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function toSlug(value: string, separator: '-' | '_'): string {
  const trimmed = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');
  return trimmed;
}

function registerLookupKey(
  lookupByKey: Map<string, ExerciseCatalogEntry>,
  key: string | null | undefined,
  entry: ExerciseCatalogEntry
) {
  const normalized = key ? normalizeLookupKey(key) : '';
  if (!normalized) return;
  lookupByKey.set(normalized, entry);
}

function createCatalogEntryFromDefault(exercise: LibraryExercise): ExerciseCatalogEntry {
  return {
    id: exercise.id,
    name: exercise.name,
    source: 'default',
    muscleGroups: exercise.muscleGroups.map((group) => group.toLowerCase()),
    primaryMuscles: [],
    secondaryMuscles: [],
  };
}

function createCatalogEntryFromCustom(exercise: CustomExercise): ExerciseCatalogEntry {
  const primary = Array.isArray(exercise.primaryMuscles)
    ? exercise.primaryMuscles.map((group) => group.toLowerCase())
    : [];
  const secondary = Array.isArray(exercise.secondaryMuscles)
    ? exercise.secondaryMuscles.map((group) => group.toLowerCase())
    : [];

  return {
    id: exercise.id,
    name: exercise.name,
    source: 'custom',
    muscleGroups: [...primary, ...secondary],
    primaryMuscles: primary,
    secondaryMuscles: secondary,
  };
}

export function buildExerciseCatalog(
  builtInExercises: LibraryExercise[] = defaultExercises,
  customExercises: CustomExercise[] = []
): ExerciseCatalog {
  const entriesById = new Map<string, ExerciseCatalogEntry>();
  const lookupByKey = new Map<string, ExerciseCatalogEntry>();

  const registerEntry = (entry: ExerciseCatalogEntry, aliases: string[] = []) => {
    entriesById.set(entry.id, entry);

    const idDash = entry.id.replace(/_/g, '-');
    const idUnderscore = entry.id.replace(/-/g, '_');
    const nameDash = toSlug(entry.name, '-');
    const nameUnderscore = toSlug(entry.name, '_');
    const keys = [entry.id, idDash, idUnderscore, nameDash, nameUnderscore, ...aliases];

    keys.forEach((key) => registerLookupKey(lookupByKey, key, entry));
  };

  builtInExercises.forEach((exercise) => {
    const entry = createCatalogEntryFromDefault(exercise);
    registerEntry(entry);
  });

  customExercises.forEach((exercise) => {
    const entry = createCatalogEntryFromCustom(exercise);
    const customSlugDash = toSlug(exercise.slug || exercise.name, '-');
    const customSlugUnderscore = toSlug(exercise.slug || exercise.name, '_');

    registerEntry(entry, [
      exercise.slug,
      customSlugDash,
      customSlugUnderscore,
      `custom_${customSlugUnderscore}`,
      `custom-${customSlugDash}`,
    ]);
  });

  return { entriesById, lookupByKey };
}

function resolveCatalogEntry(exerciseId: string, catalog?: ExerciseCatalog | null): ExerciseCatalogEntry | null {
  if (!catalog) return null;

  const direct = catalog.entriesById.get(exerciseId);
  if (direct) return direct;

  const normalized = normalizeLookupKey(exerciseId);
  if (!normalized) return null;

  return (
    catalog.lookupByKey.get(normalized) ??
    catalog.lookupByKey.get(normalized.replace(/-/g, '_')) ??
    catalog.lookupByKey.get(normalized.replace(/_/g, '-')) ??
    null
  );
}

function looksRandomIdentifier(tokens: string[]): boolean {
  if (tokens.length === 0) return false;

  const joined = tokens.join('');
  if (/^\d+$/.test(joined)) return true;

  if (tokens.some((token) => token.length >= 14 && /^[a-z0-9]+$/.test(token))) {
    return true;
  }

  if (
    tokens.length >= 2 &&
    /^\d{8,}$/.test(tokens[0] ?? '') &&
    /^[a-z0-9]{5,}$/.test(tokens[1] ?? '')
  ) {
    return true;
  }

  if (/^[a-f0-9]{24,}$/.test(joined)) {
    return true;
  }

  return false;
}

function toDisplayWord(token: string): string {
  if (!token) return '';
  if (/^\d+$/.test(token)) return token;
  const lower = token.toLowerCase();
  if (KNOWN_ACRONYMS.has(lower)) return lower.toUpperCase();
  return `${lower[0].toUpperCase()}${lower.slice(1)}`;
}

function humanizeToken(value: string, fallbackLabel: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return fallbackLabel;

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return fallbackLabel;
  if (looksRandomIdentifier(tokens)) return fallbackLabel;

  return tokens.map((token) => toDisplayWord(token)).join(' ');
}

function isLegacyCustomSlug(exerciseId: string): boolean {
  const normalized = normalizeLookupKey(exerciseId);
  if (!CUSTOM_PREFIX.test(normalized)) return false;

  const remainder = normalized.replace(CUSTOM_PREFIX, '');
  if (!remainder) return false;

  if (/^\d+(?:[_-][a-z0-9]+)*$/.test(remainder)) {
    return false;
  }

  return /[a-z]/.test(remainder);
}

function humanizeGenericExerciseId(exerciseId: string): string {
  return humanizeToken(exerciseId, 'Exercise');
}

function normalizeComparableText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isMeaningfulCachedName(cachedName: string | null | undefined, exerciseId: string): cachedName is string {
  if (!cachedName) return false;
  const trimmed = cachedName.trim();
  if (!trimmed) return false;

  const normalizedCached = normalizeComparableText(trimmed);
  const normalizedId = normalizeComparableText(exerciseId);
  return normalizedCached !== normalizedId;
}

export function humanizeLegacyExerciseId(exerciseId: string): string {
  const stripped = exerciseId.trim().replace(CUSTOM_PREFIX, '');
  return humanizeToken(stripped, 'Custom Exercise');
}

export function resolveExerciseDisplayName(
  exerciseId: string,
  options: ResolveExerciseDisplayNameOptions = {}
): string {
  if (isMeaningfulCachedName(options.cachedName, exerciseId)) {
    return options.cachedName.trim();
  }

  const entry = resolveCatalogEntry(exerciseId, options.catalog);
  if (entry?.name) {
    return entry.name;
  }

  if (isLegacyCustomSlug(exerciseId)) {
    return humanizeLegacyExerciseId(exerciseId);
  }

  return humanizeGenericExerciseId(exerciseId);
}

function mapRawMuscleToGroup(rawValue: string): ExerciseMuscleGroup | null {
  const normalized = rawValue
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  if (/pec|chest/.test(normalized)) return 'chest';
  if (/shoulder|delt/.test(normalized)) return 'shoulders';
  if (/tricep/.test(normalized)) return 'triceps';
  if (/bicep/.test(normalized)) return 'biceps';
  if (/lat|back|trap|rhomboid/.test(normalized)) return 'back';
  if (/quad|vastus/.test(normalized)) return 'quads';
  if (/hamstring/.test(normalized)) return 'hamstrings';
  if (/glute/.test(normalized)) return 'glutes';
  if (/calf|soleus|gastrocnemius/.test(normalized)) return 'calves';
  if (/core|abs|abdom|oblique|transverse/.test(normalized)) return 'core';

  return null;
}

function firstDistinctGroups(
  values: string[],
  excluded?: ExerciseMuscleGroup
): ExerciseMuscleGroup[] {
  const groups: ExerciseMuscleGroup[] = [];

  for (const value of values) {
    const mapped = mapRawMuscleToGroup(value);
    if (!mapped || mapped === excluded || groups.includes(mapped)) continue;
    groups.push(mapped);
  }

  return groups;
}

function resolveFromMuscleLists(
  primaryMuscles: string[],
  secondaryMuscles: string[]
): { primary: ExerciseMuscleGroup; secondary?: ExerciseMuscleGroup } | null {
  const primaryCandidates = firstDistinctGroups(primaryMuscles);
  const primary = primaryCandidates[0] ?? null;
  if (!primary) return null;

  const secondaryCandidates = [
    ...firstDistinctGroups(secondaryMuscles, primary),
    ...primaryCandidates.slice(1),
  ];

  return {
    primary,
    secondary: secondaryCandidates[0] ?? undefined,
  };
}

function inferMuscleProfileFromHeuristics(
  exerciseId: string,
  exerciseName: string
): { primary: ExerciseMuscleGroup; secondary?: ExerciseMuscleGroup } {
  const normalizedId = normalizeLookupKey(exerciseId).replace(/-/g, '_');

  if (HEURISTIC_BLEND_BY_ID[normalizedId]) {
    const [primary, secondary] = HEURISTIC_BLEND_BY_ID[normalizedId];
    return { primary, secondary };
  }

  if (HEURISTIC_PRIMARY_BY_ID[normalizedId]) {
    return { primary: HEURISTIC_PRIMARY_BY_ID[normalizedId] };
  }

  const name = exerciseName.toLowerCase();

  if (name.includes('bench') || name.includes('chest') || name.includes('dip')) {
    return { primary: 'chest', secondary: 'triceps' };
  }
  if (name.includes('overhead') || name.includes('shoulder press') || name.includes('press')) {
    if (name.includes('leg press')) {
      return { primary: 'quads', secondary: 'glutes' };
    }
    return { primary: 'shoulders', secondary: 'triceps' };
  }
  if (name.includes('squat') || name.includes('leg press') || name.includes('lunge') || name.includes('split squat')) {
    return { primary: 'quads', secondary: 'glutes' };
  }
  if (name.includes('deadlift') || name.includes('rdl')) {
    return { primary: 'hamstrings', secondary: 'glutes' };
  }
  if (name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('chin')) {
    return { primary: 'back', secondary: 'biceps' };
  }
  if (name.includes('tricep')) return { primary: 'triceps' };
  if (name.includes('bicep') || name.includes('curl')) return { primary: 'biceps' };
  if (name.includes('calf')) return { primary: 'calves' };
  if (name.includes('plank') || name.includes('ab ') || name.includes('core') || name.includes('hanging leg')) {
    return { primary: 'core' };
  }
  if (name.includes('hip thrust') || name.includes('glute')) return { primary: 'glutes' };
  if (name.includes('hamstring') || name.includes('leg curl')) return { primary: 'hamstrings' };

  const target = COMMON_TARGET_BY_ID[normalizedId] ?? null;
  if (target === 'core') return { primary: 'core' };
  if (target === 'legs') return { primary: 'quads', secondary: 'glutes' };
  if (target === 'pull') return { primary: 'back', secondary: 'biceps' };
  if (target === 'push') return { primary: 'chest', secondary: 'triceps' };

  return { primary: 'other' };
}

export function resolveExerciseMuscleProfile(
  exercise: ExerciseIdentity,
  options: ResolveExerciseMuscleProfileOptions = {}
): { primary: ExerciseMuscleGroup; secondary?: ExerciseMuscleGroup } {
  const entry = resolveCatalogEntry(exercise.id, options.catalog);

  if (entry?.source === 'custom') {
    const customProfile = resolveFromMuscleLists(entry.primaryMuscles, entry.secondaryMuscles);
    if (customProfile) {
      return customProfile;
    }
  }

  if (entry) {
    const defaultProfile = resolveFromMuscleLists(entry.muscleGroups, []);
    if (defaultProfile) {
      return defaultProfile;
    }
  }

  const resolvedName = exercise.name?.trim() || resolveExerciseDisplayName(exercise.id, { catalog: options.catalog });
  return inferMuscleProfileFromHeuristics(exercise.id, resolvedName);
}
