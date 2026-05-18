import type { SetLog, WeightUnit, WorkoutSession } from '../types';
import { resolveExerciseDisplayName, type ExerciseCatalog } from '../exercises/catalog';
import { convertWeight } from '../units';
import { estimate1RM } from './one-rep-max';

export type CanonicalAnalyticsAnomalyReason =
  | 'invalid_weight'
  | 'invalid_reps'
  | 'suspicious_barbell_weight';

export interface CanonicalAnalyticsSet {
  sourceWorkoutId: string;
  sourceSetId?: string;
  exerciseKey: string;
  exerciseName: string;
  date?: string;
  rawWeight: number;
  rawWeightUnit: WeightUnit;
  weightLbs: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  isWarmup: boolean;
  isAnomaly: boolean;
  anomalyReason?: CanonicalAnalyticsAnomalyReason;
  volumeLoadLbs: number;
  estimated1RMLbs: number;
}

export interface CanonicalAnalyticsSummary {
  totalSets: number;
  verifiedStrengthSets: number;
  verifiedVolumeSets: number;
  anomalousSets: number;
  anomalyCounts: Record<CanonicalAnalyticsAnomalyReason, number>;
}

export interface CanonicalAnalyticsAuditContributor {
  sourceWorkoutId: string;
  sourceSetId?: string;
  exerciseKey: string;
  exerciseName: string;
  date?: string;
  rawWeight: number;
  rawWeightUnit: WeightUnit;
  reps: number;
  rpe: number | null;
  volumeLoadLbs: number;
  estimated1RMLbs: number;
}

export interface CanonicalAnalyticsAuditSummary extends CanonicalAnalyticsSummary {
  includedSets: number;
  excludedSets: number;
  includedStrengthSets: number;
  includedVolumeSets: number;
  excludedWarmupSets: number;
  excludedIncompleteSets: number;
  excludedInvalidSets: number;
  topVolumeContributors: CanonicalAnalyticsAuditContributor[];
  topStrengthContributors: CanonicalAnalyticsAuditContributor[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BARBELL_COMPOUND_KEYS = new Set([
  'squat',
  'back_squat',
  'front_squat',
  'bench',
  'bench_press',
  'bench_tng',
  'bench_paused',
  'bench_tempo',
  'bench_close_grip',
  'bench_backoff',
  'deadlift',
  'conventional_deadlift',
  'sumo_deadlift',
  'overhead_press',
  'ohp',
  'military_press',
]);

const NON_BARBELL_NAME_RE = /\b(goblet|split|bulgarian|lunge|leg press|hack|smith|machine|dumbbell|db|kettlebell|kb)\b/i;
const BARBELL_NAME_RE = /\b(back squat|front squat|bench press|paused bench|close-grip bench|touch and go bench|deadlift|overhead press|military press)\b/i;

function positiveFinite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getCatalogEntry(key: string, catalog?: ExerciseCatalog | null) {
  if (!catalog) return null;
  const normalized = normalizeLookupKey(key);
  if (!normalized) return null;

  return (
    catalog.entriesById.get(key) ??
    catalog.entriesById.get(normalized) ??
    catalog.lookupByKey.get(normalized) ??
    catalog.lookupByKey.get(normalized.replace(/_/g, '-')) ??
    catalog.lookupByKey.get(normalized.replace(/-/g, '_')) ??
    null
  );
}

function fallbackExerciseName(exerciseKey: string, cachedName?: string | null, catalog?: ExerciseCatalog | null) {
  const resolved = resolveExerciseDisplayName(exerciseKey, {
    catalog,
    cachedName,
  });
  return resolved && resolved !== 'Exercise' ? resolved : 'Exercise';
}

function resolveExerciseIdentity(set: SetLog, catalog?: ExerciseCatalog | null) {
  const rawId = typeof set.exerciseId === 'string' ? set.exerciseId.trim() : '';
  const cachedName = typeof set.exerciseName === 'string' ? set.exerciseName.trim() : '';
  const idEntry = rawId ? getCatalogEntry(rawId, catalog) : null;
  if (idEntry) {
    return { exerciseKey: idEntry.id, exerciseName: idEntry.name };
  }

  const nameEntry = cachedName ? getCatalogEntry(cachedName, catalog) : null;
  if (nameEntry) {
    return { exerciseKey: nameEntry.id, exerciseName: nameEntry.name };
  }

  if (rawId && !UUID_RE.test(rawId)) {
    const exerciseKey = normalizeLookupKey(rawId);
    return {
      exerciseKey,
      exerciseName: fallbackExerciseName(rawId, cachedName, catalog),
    };
  }

  if (cachedName) {
    return {
      exerciseKey: normalizeLookupKey(cachedName),
      exerciseName: cachedName,
    };
  }

  return {
    exerciseKey: rawId || 'unknown_exercise',
    exerciseName: 'Exercise',
  };
}

function isLikelyBarbellCompound(exerciseKey: string, exerciseName: string) {
  const normalizedKey = normalizeLookupKey(exerciseKey);
  if (BARBELL_COMPOUND_KEYS.has(normalizedKey)) return true;
  if (NON_BARBELL_NAME_RE.test(exerciseName)) return false;
  return BARBELL_NAME_RE.test(exerciseName);
}

function detectAnomaly({
  exerciseKey,
  exerciseName,
  weightLbs,
  reps,
}: {
  exerciseKey: string;
  exerciseName: string;
  weightLbs: number;
  reps: number;
}): CanonicalAnalyticsAnomalyReason | undefined {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return undefined;
  if (!Number.isFinite(reps) || reps <= 0) return undefined;

  if (isLikelyBarbellCompound(exerciseKey, exerciseName) && (weightLbs < 45 || weightLbs > 1200)) {
    return 'suspicious_barbell_weight';
  }

  return undefined;
}

export function buildCanonicalAnalyticsSets(
  workouts: WorkoutSession[],
  options: { catalog?: ExerciseCatalog | null } = {}
): CanonicalAnalyticsSet[] {
  const sets: CanonicalAnalyticsSet[] = [];

  for (const workout of workouts) {
    const date = workout.endTime || workout.startTime || workout.date;

    for (const set of workout.sets ?? []) {
      const { exerciseKey, exerciseName } = resolveExerciseIdentity(set, options.catalog);
      const rawWeight = positiveFinite(set.actualWeight) ?? 0;
      const reps = positiveFinite(set.actualReps) ?? 0;
      const rawWeightUnit: WeightUnit = set.weightUnit === 'kg' ? 'kg' : 'lbs';
      const weightLbs = rawWeight > 0 ? convertWeight(rawWeight, rawWeightUnit, 'lbs') : 0;
      const completed = set.completed !== false && set.skipped !== true;
      const isWarmup = set.setType === 'warmup';
      const rpe = typeof set.actualRPE === 'number' && Number.isFinite(set.actualRPE) ? set.actualRPE : null;
      let anomalyReason: CanonicalAnalyticsAnomalyReason | undefined;
      if (completed && !isWarmup) {
        if (rawWeight <= 0) {
          anomalyReason = 'invalid_weight';
        } else if (reps <= 0) {
          anomalyReason = 'invalid_reps';
        } else {
          anomalyReason = detectAnomaly({ exerciseKey, exerciseName, weightLbs, reps });
        }
      }

      sets.push({
        sourceWorkoutId: workout.id,
        sourceSetId: set.id,
        exerciseKey,
        exerciseName,
        date,
        rawWeight,
        rawWeightUnit,
        weightLbs,
        reps,
        rpe,
        completed,
        isWarmup,
        isAnomaly: Boolean(anomalyReason),
        anomalyReason,
        volumeLoadLbs: weightLbs > 0 && reps > 0 ? weightLbs * reps : 0,
        estimated1RMLbs: weightLbs > 0 && reps > 0 ? estimate1RM(weightLbs, reps, rpe) : 0,
      });
    }
  }

  return sets;
}

export function isVerifiedStrengthSet(set: CanonicalAnalyticsSet): boolean {
  return (
    set.completed &&
    !set.isWarmup &&
    !set.isAnomaly &&
    set.weightLbs > 0 &&
    set.reps >= 1 &&
    set.reps <= 15
  );
}

export function isVerifiedVolumeSet(set: CanonicalAnalyticsSet): boolean {
  return set.completed && !set.isWarmup && !set.isAnomaly && set.weightLbs > 0 && set.reps > 0;
}

export function summarizeCanonicalAnalyticsSets(sets: CanonicalAnalyticsSet[]): CanonicalAnalyticsSummary {
  const anomalyCounts: CanonicalAnalyticsSummary['anomalyCounts'] = {
    invalid_weight: 0,
    invalid_reps: 0,
    suspicious_barbell_weight: 0,
  };

  for (const set of sets) {
    if (set.anomalyReason) {
      anomalyCounts[set.anomalyReason] += 1;
    }
  }

  return {
    totalSets: sets.length,
    verifiedStrengthSets: sets.filter(isVerifiedStrengthSet).length,
    verifiedVolumeSets: sets.filter(isVerifiedVolumeSet).length,
    anomalousSets: sets.filter((set) => set.isAnomaly).length,
    anomalyCounts,
  };
}

function toAuditContributor(set: CanonicalAnalyticsSet): CanonicalAnalyticsAuditContributor {
  return {
    sourceWorkoutId: set.sourceWorkoutId,
    sourceSetId: set.sourceSetId,
    exerciseKey: set.exerciseKey,
    exerciseName: set.exerciseName,
    date: set.date,
    rawWeight: set.rawWeight,
    rawWeightUnit: set.rawWeightUnit,
    reps: set.reps,
    rpe: set.rpe,
    volumeLoadLbs: set.volumeLoadLbs,
    estimated1RMLbs: set.estimated1RMLbs,
  };
}

export function buildCanonicalAnalyticsAudit(sets: CanonicalAnalyticsSet[]): CanonicalAnalyticsAuditSummary {
  const summary = summarizeCanonicalAnalyticsSets(sets);
  const volumeSets = sets.filter(isVerifiedVolumeSet);
  const strengthSets = sets.filter(isVerifiedStrengthSet);
  const excludedInvalidSets = sets.filter((set) =>
    set.anomalyReason === 'invalid_weight' || set.anomalyReason === 'invalid_reps'
  ).length;

  return {
    ...summary,
    includedSets: volumeSets.length,
    excludedSets: sets.length - volumeSets.length,
    includedStrengthSets: strengthSets.length,
    includedVolumeSets: volumeSets.length,
    excludedWarmupSets: sets.filter((set) => set.isWarmup).length,
    excludedIncompleteSets: sets.filter((set) => !set.completed).length,
    excludedInvalidSets,
    topVolumeContributors: [...volumeSets]
      .sort((a, b) => b.volumeLoadLbs - a.volumeLoadLbs)
      .slice(0, 5)
      .map(toAuditContributor),
    topStrengthContributors: [...strengthSets]
      .sort((a, b) => b.estimated1RMLbs - a.estimated1RMLbs)
      .slice(0, 5)
      .map(toAuditContributor),
  };
}
