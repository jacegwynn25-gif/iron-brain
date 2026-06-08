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

export type InferredCustomExerciseDefaults = Pick<
  CustomExercise,
  'equipment' | 'exerciseType' | 'movementPattern' | 'defaultRestSeconds'
> & {
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

const CUSTOM_PREFIX = /^custom[_-]+/i;
const KNOWN_ACRONYMS = new Set(['rdl', 'ssb', 'ohp', 'db', 'bb', 'ez', 'pr', 'rm']);

const HEURISTIC_BLEND_BY_ID: Record<string, [ExerciseMuscleGroup, ExerciseMuscleGroup]> = {
  bench_press: ['chest', 'triceps'],
  dips: ['chest', 'triceps'],
  dip: ['chest', 'triceps'],
  weighted_dip: ['chest', 'triceps'],
  overhead_press: ['shoulders', 'triceps'],
  pull_up: ['back', 'biceps'],
  pullup: ['back', 'biceps'],
  weighted_pullup: ['back', 'biceps'],
  chin_up: ['back', 'biceps'],
  chinup: ['back', 'biceps'],
  weighted_chinup: ['back', 'biceps'],
  barbell_row: ['back', 'biceps'],
  dumbbell_row: ['back', 'biceps'],
  high_cable_row: ['back', 'shoulders'],
  lat_pulldown: ['back', 'biceps'],
  face_pull: ['shoulders', 'back'],
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
  lateral_raise_machine: 'shoulders',
  db_lateral_raise: 'shoulders',
  cable_lateral_raise: 'shoulders',
  front_raise: 'shoulders',
  rear_delt_fly: 'shoulders',
  cable_rear_delt_fly: 'shoulders',
  rear_delt_machine: 'shoulders',
  arnold_press: 'shoulders',
  shoulder_press_machine: 'shoulders',
  barbell_shrug: 'back',
  tricep_extension: 'triceps',
  tricep_pressdown: 'triceps',
  rope_pressdown: 'triceps',
  tricep_overhead_cable: 'triceps',
  bicep_curl: 'biceps',
  db_curl: 'biceps',
  bicep_curl_cable: 'biceps',
  rope_hammer_curl: 'biceps',
  cable_reverse_curl: 'biceps',
  barbell_curl: 'biceps',
  bicep_curl_hammer: 'biceps',
  calf_raise: 'calves',
  seated_calf_raise: 'calves',
  standing_calf_raise: 'calves',
  plank: 'core',
  ab_wheel: 'core',
  hanging_leg_raise: 'core',
};

const PROFILE_TO_CUSTOM_LABEL: Record<ExerciseMuscleGroup, string | null> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  back: 'Back',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Abs',
  other: null,
};

const PULL_TERMS = [
  /\brow\b/,
  /\brows\b/,
  /\bt bar\b/,
  /\bseal row\b/,
  /\bmeadows row\b/,
  /\bpulldown\b/,
  /\bpull down\b/,
  /\bpull up\b/,
  /\bpullup\b/,
  /\bchin up\b/,
  /\bchinup\b/,
  /\bhigh row\b/,
  /\blow row\b/,
  /\bface pull\b/,
  /\bstraight arm pulldown\b/,
  /\bshrug\b/,
];

const SHOULDER_ISOLATION_TERMS = [
  /\blateral raise\b/,
  /\blat raise\b/,
  /\bside raise\b/,
  /\bfront raise\b/,
  /\brear delt\b/,
  /\breverse fly\b/,
  /\bupright row\b/,
  /\bface pull\b/,
];

const SHOULDER_PRESS_TERMS = [
  /\bshoulder\b/,
  /\bohp\b/,
  /\boverhead press\b/,
  /\bmilitary press\b/,
  /\bpush press\b/,
  /\barnold press\b/,
];

const CHEST_TERMS = [
  /\bbench\b/,
  /\bchest press\b/,
  /\bpec\b/,
  /\bpush up\b/,
  /\bpushup\b/,
  /\bfly\b/,
  /\bflies\b/,
  /\bdip\b/,
  /\bincline press\b/,
  /\bdecline press\b/,
  /\bflat press\b/,
];

const SQUAT_TERMS = [
  /\bsquat\b/,
  /\bleg press\b/,
  /\blunge\b/,
  /\bsplit squat\b/,
  /\bstep up\b/,
  /\bleg extension\b/,
];

const HINGE_TERMS = [
  /\bdeadlift\b/,
  /\brdl\b/,
  /\bromanian deadlift\b/,
  /\bgood morning\b/,
  /\bleg curl\b/,
  /\bhamstring curl\b/,
  /\bnordic\b/,
  /\bglute ham\b/,
];

const GLUTE_TERMS = [
  /\bhip thrust\b/,
  /\bglute bridge\b/,
  /\bglute\b/,
  /\bkickback\b/,
  /\babductor\b/,
];

const CORE_TERMS = [
  /\bplank\b/,
  /\bab\b/,
  /\babs\b/,
  /\bcrunch\b/,
  /\bsit up\b/,
  /\bsitup\b/,
  /\bdead bug\b/,
  /\bhanging leg\b/,
  /\brussian twist\b/,
  /\bpallof\b/,
  /\bwoodchop\b/,
  /\brotation\b/,
];

const TRICEPS_TERMS = [
  /\btricep\b/,
  /\bskull crusher\b/,
  /\bpressdown\b/,
  /\bpushdown\b/,
];

const BICEPS_TERMS = [
  /\bbicep\b/,
  /\bhammer curl\b/,
  /\bpreacher curl\b/,
  /\bcurl\b/,
];

const CARRY_TERMS = [
  /\bcarry\b/,
  /\bfarmer\b/,
  /\bsuitcase\b/,
];

const STRONG_CLASSIFICATION_TERMS = [
  ...PULL_TERMS,
  ...SHOULDER_ISOLATION_TERMS,
  ...SHOULDER_PRESS_TERMS,
  ...CHEST_TERMS,
  ...SQUAT_TERMS,
  ...HINGE_TERMS,
  ...GLUTE_TERMS,
  ...CORE_TERMS,
  ...TRICEPS_TERMS,
  ...BICEPS_TERMS,
  ...CARRY_TERMS,
  /\bcalf\b/,
];

const COMMON_TARGET_BY_ID: Record<string, 'push' | 'pull' | 'legs' | 'core'> = {
  back_squat: 'legs',
  deadlift: 'legs',
  bench_press: 'push',
  overhead_press: 'push',
  pull_up: 'pull',
  chin_up: 'pull',
  barbell_row: 'pull',
  dumbbell_row: 'pull',
  high_cable_row: 'pull',
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
  cable_lateral_raise: 'push',
  cable_rear_delt_fly: 'pull',
  barbell_shrug: 'pull',
  rope_pressdown: 'push',
  rope_hammer_curl: 'pull',
  cable_reverse_curl: 'pull',
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

  // Built-in exercises only need id + name-slug registered. The _/- variants are
  // resolved at lookup time in resolveCatalogEntry, so pre-registering them is redundant.
  const registerBuiltIn = (entry: ExerciseCatalogEntry) => {
    entriesById.set(entry.id, entry);
    const nameDash = toSlug(entry.name, '-');
    registerLookupKey(lookupByKey, entry.id, entry);
    registerLookupKey(lookupByKey, nameDash, entry);
  };

  // Custom exercises need all alias variants since they may be referenced by
  // user-defined slugs stored in historical set logs.
  const registerCustom = (entry: ExerciseCatalogEntry, aliases: string[]) => {
    entriesById.set(entry.id, entry);
    const idDash = entry.id.replace(/_/g, '-');
    const idUnderscore = entry.id.replace(/-/g, '_');
    const nameDash = toSlug(entry.name, '-');
    const nameUnderscore = toSlug(entry.name, '_');
    const keys = [entry.id, idDash, idUnderscore, nameDash, nameUnderscore, ...aliases];
    keys.forEach((key) => registerLookupKey(lookupByKey, key, entry));
  };

  builtInExercises.forEach((exercise) => {
    registerBuiltIn(createCatalogEntryFromDefault(exercise));
  });

  customExercises.forEach((exercise) => {
    const entry = createCatalogEntryFromCustom(exercise);
    const customSlugDash = toSlug(exercise.slug || exercise.name, '-');
    const customSlugUnderscore = toSlug(exercise.slug || exercise.name, '_');

    registerCustom(entry, [
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
  const entry = resolveCatalogEntry(exerciseId, options.catalog);
  if (entry?.name) {
    return entry.name;
  }

  if (isMeaningfulCachedName(options.cachedName, exerciseId)) {
    return options.cachedName.trim();
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
  if (/forearm|wrist|grip/.test(normalized)) return 'other';

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

function normalizeExerciseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyTerm(value: string, terms: RegExp[]) {
  return terms.some((term) => term.test(value));
}

function inferEquipmentFromName(name: string): CustomExercise['equipment'] {
  if (/\b(db|dumbbell|dumbbells)\b/.test(name)) return 'dumbbell';
  if (/\b(kb|kettlebell|kettlebells)\b/.test(name)) return 'kettlebell';
  if (/\b(cable|cables)\b/.test(name)) return 'cable';
  if (/\b(band|bands)\b/.test(name)) return 'band';
  if (/\b(machine|smith|hack squat|leg press|pec deck)\b/.test(name)) return 'machine';
  if (/\b(bodyweight|push up|pushup|pull up|pullup|chin up|chinup|dip|plank|crunch|sit up|situp)\b/.test(name)) {
    return 'bodyweight';
  }
  if (/\b(bb|barbell|ez bar|t bar|trap bar|landmine)\b/.test(name)) return 'barbell';
  return 'other';
}

function toCustomMuscleLabel(group: ExerciseMuscleGroup | undefined): string | null {
  return group ? PROFILE_TO_CUSTOM_LABEL[group] : null;
}

function labelsFromProfile(
  primary: ExerciseMuscleGroup,
  secondary?: ExerciseMuscleGroup
): Pick<InferredCustomExerciseDefaults, 'primaryMuscles' | 'secondaryMuscles'> {
  const primaryLabel = toCustomMuscleLabel(primary);
  const secondaryLabel = secondary && secondary !== primary ? toCustomMuscleLabel(secondary) : null;

  return {
    primaryMuscles: primaryLabel ? [primaryLabel] : [],
    secondaryMuscles: secondaryLabel ? [secondaryLabel] : [],
  };
}

type HeuristicProfile = {
  primary: ExerciseMuscleGroup;
  secondary?: ExerciseMuscleGroup;
  exerciseType: CustomExercise['exerciseType'];
  movementPattern: CustomExercise['movementPattern'];
  defaultRestSeconds: number;
};

function classifyExerciseByName(exerciseName: string): HeuristicProfile {
  const name = normalizeExerciseText(exerciseName);
  const compact = name.replace(/\s+/g, ' ');

  // Pulling motions win over support descriptors: "chest supported row" is a back row.
  if (hasAnyTerm(compact, PULL_TERMS)) {
    if (
      hasAnyTerm(compact, SHOULDER_ISOLATION_TERMS) &&
      !/\brow\b/.test(compact) &&
      !/\bupright row\b/.test(compact) &&
      !/\bpulldown\b/.test(compact)
    ) {
      return {
        primary: 'shoulders',
        secondary: 'back',
        exerciseType: 'isolation',
        movementPattern: 'pull',
        defaultRestSeconds: 75,
      };
    }

    if (/\bupright row\b/.test(compact)) {
      return {
        primary: 'shoulders',
        secondary: 'back',
        exerciseType: 'compound',
        movementPattern: 'pull',
        defaultRestSeconds: 120,
      };
    }

    return {
      primary: 'back',
      secondary: 'biceps',
      exerciseType: 'compound',
      movementPattern: 'pull',
      defaultRestSeconds: 150,
    };
  }

  if (hasAnyTerm(compact, SHOULDER_ISOLATION_TERMS)) {
    return {
      primary: 'shoulders',
      secondary: compact.includes('rear delt') || compact.includes('face pull') ? 'back' : undefined,
      exerciseType: 'isolation',
      movementPattern: compact.includes('rear delt') || compact.includes('face pull') ? 'pull' : 'push',
      defaultRestSeconds: 75,
    };
  }

  if (hasAnyTerm(compact, SHOULDER_PRESS_TERMS)) {
    return {
      primary: 'shoulders',
      secondary: 'triceps',
      exerciseType: 'compound',
      movementPattern: 'push',
      defaultRestSeconds: 150,
    };
  }

  if (hasAnyTerm(compact, SQUAT_TERMS)) {
    const isIsolation = /\bleg extension\b/.test(compact);
    return {
      primary: 'quads',
      secondary: isIsolation ? undefined : 'glutes',
      exerciseType: isIsolation ? 'isolation' : 'compound',
      movementPattern: 'squat',
      defaultRestSeconds: isIsolation ? 90 : 180,
    };
  }

  if (hasAnyTerm(compact, HINGE_TERMS)) {
    const isIsolation = /\bcurl\b/.test(compact) || /\bnordic\b/.test(compact);
    return {
      primary: 'hamstrings',
      secondary: isIsolation ? undefined : 'glutes',
      exerciseType: isIsolation ? 'isolation' : 'compound',
      movementPattern: 'hinge',
      defaultRestSeconds: isIsolation ? 90 : 180,
    };
  }

  if (hasAnyTerm(compact, GLUTE_TERMS)) {
    return {
      primary: 'glutes',
      secondary: compact.includes('kickback') || compact.includes('abductor') ? undefined : 'hamstrings',
      exerciseType: compact.includes('kickback') || compact.includes('abductor') ? 'isolation' : 'compound',
      movementPattern: 'hinge',
      defaultRestSeconds: compact.includes('kickback') || compact.includes('abductor') ? 75 : 150,
    };
  }

  if (/\bcalf\b/.test(compact)) {
    return {
      primary: 'calves',
      exerciseType: 'isolation',
      movementPattern: 'other',
      defaultRestSeconds: 75,
    };
  }

  if (hasAnyTerm(compact, CORE_TERMS)) {
    return {
      primary: 'core',
      exerciseType: 'isolation',
      movementPattern: compact.includes('rotation') || compact.includes('twist') || compact.includes('woodchop') ? 'rotation' : 'other',
      defaultRestSeconds: 60,
    };
  }

  if (hasAnyTerm(compact, TRICEPS_TERMS)) {
    return {
      primary: 'triceps',
      exerciseType: 'isolation',
      movementPattern: 'push',
      defaultRestSeconds: 75,
    };
  }

  if (hasAnyTerm(compact, BICEPS_TERMS)) {
    return {
      primary: 'biceps',
      exerciseType: 'isolation',
      movementPattern: 'pull',
      defaultRestSeconds: 75,
    };
  }

  if (hasAnyTerm(compact, CHEST_TERMS)) {
    const isIsolation = /\bfly\b/.test(compact) || /\bflies\b/.test(compact) || /\bpec deck\b/.test(compact);
    return {
      primary: 'chest',
      secondary: isIsolation ? undefined : 'triceps',
      exerciseType: isIsolation ? 'isolation' : 'compound',
      movementPattern: 'push',
      defaultRestSeconds: isIsolation ? 90 : 150,
    };
  }

  if (hasAnyTerm(compact, CARRY_TERMS)) {
    return {
      primary: 'core',
      secondary: 'back',
      exerciseType: 'compound',
      movementPattern: 'carry',
      defaultRestSeconds: 90,
    };
  }

  return {
    primary: 'other',
    exerciseType: 'isolation',
    movementPattern: 'other',
    defaultRestSeconds: 90,
  };
}

function shouldPreferNameProfileForCustom(
  exerciseName: string,
  customProfile: { primary: ExerciseMuscleGroup; secondary?: ExerciseMuscleGroup } | null,
  classified: HeuristicProfile
): boolean {
  if (classified.primary === 'other') return false;
  if (!customProfile) return true;
  if (customProfile.primary === classified.primary) return false;

  const name = normalizeExerciseText(exerciseName);
  return hasAnyTerm(name, STRONG_CLASSIFICATION_TERMS);
}

export function inferCustomExerciseDefaults(exerciseName: string): InferredCustomExerciseDefaults {
  const classification = classifyExerciseByName(exerciseName);
  const labels = labelsFromProfile(classification.primary, classification.secondary);

  return {
    equipment: inferEquipmentFromName(normalizeExerciseText(exerciseName)),
    exerciseType: classification.exerciseType,
    primaryMuscles: labels.primaryMuscles,
    secondaryMuscles: labels.secondaryMuscles,
    movementPattern: classification.movementPattern,
    defaultRestSeconds: classification.defaultRestSeconds,
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

  const classified = classifyExerciseByName(exerciseName);
  if (classified.primary !== 'other') {
    return {
      primary: classified.primary,
      secondary: classified.secondary,
    };
  }

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
    const nameProfile = classifyExerciseByName(exercise.name?.trim() || entry.name);
    if (shouldPreferNameProfileForCustom(entry.name, customProfile, nameProfile)) {
      return {
        primary: nameProfile.primary,
        secondary: nameProfile.secondary,
      };
    }
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
