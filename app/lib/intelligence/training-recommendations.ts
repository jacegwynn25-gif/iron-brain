import type { ProgramTemplate, SetTemplate, WeightUnit } from '@/app/lib/types';
import { convertWeight } from '@/app/lib/units';

export type RecommendationScope = 'next_set' | 'session' | 'program';
export type RecommendationAction =
  | 'increase_load'
  | 'reduce_load'
  | 'maintain_load'
  | 'adjust_reps'
  | 'add_rest'
  | 'trim_volume'
  | 'add_volume'
  | 'hold_program'
  | 'deload';

export type RecommendationSeverity = 'info' | 'watch' | 'adjust' | 'deload';
export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface TrainingRecommendationTarget {
  weight?: number | null;
  weightUnit?: WeightUnit;
  reps?: number | null;
  restSeconds?: number | null;
  prescribedWeight?: number | null;
  prescribedPercentage?: number | null;
}

export interface TrainingRecommendationApplyPatch {
  blockId?: string;
  exerciseId?: string;
  setId?: string;
  weight?: number | null;
  weightUnit?: WeightUnit;
  reps?: number | null;
  restSeconds?: number | null;
  setCountDelta?: number;
}

export interface TrainingRecommendation {
  id: string;
  scope: RecommendationScope;
  action: RecommendationAction;
  severity: RecommendationSeverity;
  confidence: RecommendationConfidence;
  title: string;
  reason: string;
  exerciseId?: string;
  exerciseName?: string;
  setId?: string;
  target?: TrainingRecommendationTarget;
  apply?: TrainingRecommendationApplyPatch;
  source: 'prescription' | 'exercise_history' | 'session_fatigue' | 'readiness' | 'e1rm' | 'program_load' | 'baseline';
}

export interface TrainingSetInput {
  blockId?: string;
  exerciseId?: string;
  exerciseName?: string;
  setId?: string;
  setIndex?: number;
  weight?: number | null;
  weightUnit?: WeightUnit | string | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  prescribedRPE?: number | null;
  prescribedRIR?: number | null;
  prescribedPercentage?: number | null;
  prescribedWeight?: number | null;
  touchedWeight?: boolean | null;
  touchedReps?: boolean | null;
  touchedRpe?: boolean | null;
  completed?: boolean | null;
  skipped?: boolean | null;
  type?: string | null;
}

export interface TrainingHistorySet {
  id?: string;
  workoutSessionId?: string | null;
  exerciseId?: string | null;
  exerciseName?: string | null;
  actualWeight?: number | null;
  weightUnit?: WeightUnit | string | null;
  actualReps?: number | null;
  actualRPE?: number | null;
  actualRIR?: number | null;
  prescribedReps?: string | number | null;
  prescribedRPE?: number | null;
  prescribedRIR?: number | null;
  prescribedPercentage?: number | null;
  prescribedWeight?: number | null;
  e1rm?: number | null;
  completed?: boolean | null;
  performedAt?: string | null;
}

export interface TrainingPersonalRecord {
  exerciseId?: string | null;
  recordType?: string | null;
  weight?: number | null;
  reps?: number | null;
  e1rm?: number | null;
  volume?: number | null;
}

export interface TrainingUserMax {
  exerciseId?: string | null;
  exerciseName?: string | null;
  weight?: number | null;
  unit?: WeightUnit | string | null;
}

export interface TrainingReadinessInput {
  score?: number | null;
  modifier?: number | null;
  source?: string | null;
  focusAdjustments?: {
    upperBodyModifier?: number | null;
    lowerBodyModifier?: number | null;
    overallModifier?: number | null;
  } | null;
}

export interface TrainingRecommendationInput {
  currentSet?: TrainingSetInput | null;
  nextSet?: TrainingSetInput | null;
  sessionSets?: TrainingSetInput[];
  historySets?: TrainingHistorySet[];
  personalRecords?: TrainingPersonalRecord[];
  userMaxes?: TrainingUserMax[];
  exerciseMuscleProfile?: {
    primary?: string | null;
    secondary?: string | null;
    groups?: string[];
  } | null;
  readiness?: TrainingReadinessInput | null;
  program?: ProgramTemplate | null;
  weightUnit?: WeightUnit;
}

type BaseLoad = {
  weight: number | null;
  unit: WeightUnit;
  source: TrainingRecommendation['source'];
  confidence: RecommendationConfidence;
};

type PerformanceSignal = {
  modifier: number;
  restSeconds: number | null;
  reason: string | null;
  source: TrainingRecommendation['source'] | null;
  confidence: RecommendationConfidence | null;
};

const LBS_INCREMENT = 5;
const KG_INCREMENT = 0.25;
const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lbs';

function stableId(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .join('-');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function normalizeUnit(unit: WeightUnit | string | null | undefined, fallback: WeightUnit = DEFAULT_WEIGHT_UNIT): WeightUnit {
  return unit === 'kg' || unit === 'lbs' ? unit : fallback;
}

export function roundRecommendationWeight(value: number, unit: WeightUnit): number {
  const increment = unit === 'kg' ? KG_INCREMENT : LBS_INCREMENT;
  const rounded = Math.round(value / increment) * increment;
  return unit === 'kg' ? Number(rounded.toFixed(2)) : Math.round(rounded);
}

function formatWeight(value: number | null | undefined, unit: WeightUnit | string | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const label = normalizeUnit(unit);
  const display = label === 'kg' ? Number(value.toFixed(2)).toString() : Math.round(value).toString();
  return `${display} ${label.toUpperCase()}`;
}

function targetRpeForSet(set: TrainingSetInput | null | undefined): number | null {
  if (!set) return null;
  const prescribedRpe = finiteNumber(set.prescribedRPE);
  if (prescribedRpe != null) return clamp(prescribedRpe, 1, 10);
  const prescribedRir = finiteNumber(set.prescribedRIR);
  if (prescribedRir != null) return clamp(10 - prescribedRir, 1, 10);
  return null;
}

function targetRepsForSet(set: TrainingSetInput | null | undefined): number | null {
  if (!set) return null;
  const reps = finiteNumber(set.reps);
  return reps != null && reps > 0 ? Math.round(reps) : null;
}

function effortFromRpeRir(rpe: unknown, rir: unknown): number | null {
  const explicitRpe = finiteNumber(rpe);
  if (explicitRpe != null) return clamp(explicitRpe, 1, 10);
  const explicitRir = finiteNumber(rir);
  if (explicitRir != null) return clamp(10 - explicitRir, 1, 10);
  return null;
}

function historyEffort(set: TrainingHistorySet | null | undefined): number | null {
  return effortFromRpeRir(set?.actualRPE, set?.actualRIR);
}

function sessionEffort(set: TrainingSetInput | null | undefined): number | null {
  return effortFromRpeRir(set?.rpe, set?.rir);
}

function historyReps(set: TrainingHistorySet | null | undefined): number | null {
  return positiveNumber(set?.actualReps);
}

function e1rmFromLoad(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

function representativeHistoryWeight(
  entry: TrainingHistorySet,
  targetReps: number | null,
  unit: WeightUnit
): number | null {
  const rawWeight = positiveNumber(entry.actualWeight);
  if (rawWeight == null) return null;

  const sourceUnit = normalizeUnit(entry.weightUnit, unit);
  const actualReps = historyReps(entry);
  const e1rm = positiveNumber(entry.e1rm) ?? e1rmFromLoad(rawWeight, actualReps);
  const shouldEstimateFromE1rm =
    e1rm != null &&
    targetReps != null &&
    actualReps != null &&
    Math.abs(targetReps - actualReps) >= 2;
  const rawTargetWeight = shouldEstimateFromE1rm ? e1rm / (1 + targetReps / 30) : rawWeight;
  const converted = sourceUnit === unit ? rawTargetWeight : convertWeight(rawTargetWeight, sourceUnit, unit);
  return roundRecommendationWeight(converted, unit);
}

function isLowerBodyProfile(input: TrainingRecommendationInput): boolean {
  const groups = [
    input.exerciseMuscleProfile?.primary,
    input.exerciseMuscleProfile?.secondary,
    ...(input.exerciseMuscleProfile?.groups ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  const name = [
    input.currentSet?.exerciseName,
    input.nextSet?.exerciseName,
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(quad|hamstring|glute|calf|squat|deadlift|hinge|lunge|leg|hip)\b/.test(`${groups} ${name}`);
}

function isUpperBodyProfile(input: TrainingRecommendationInput): boolean {
  const groups = [
    input.exerciseMuscleProfile?.primary,
    input.exerciseMuscleProfile?.secondary,
    ...(input.exerciseMuscleProfile?.groups ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  const name = [
    input.currentSet?.exerciseName,
    input.nextSet?.exerciseName,
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(chest|back|shoulder|delt|bicep|tricep|press|row|pull|curl|extension|lat)\b/.test(`${groups} ${name}`);
}

function readinessModifier(input: TrainingRecommendationInput): number {
  const score = finiteNumber(input.readiness?.score);
  const rawModifier = finiteNumber(input.readiness?.modifier);
  const focus = input.readiness?.focusAdjustments;
  let modifier = rawModifier != null ? clamp(rawModifier, 0.82, 1.08) : 1;

  if (score != null && rawModifier == null) {
    if (score <= 42) modifier = 0.88;
    else if (score <= 55) modifier = 0.93;
    else if (score <= 68) modifier = 0.97;
    else if (score >= 88) modifier = 1.025;
  }

  const localModifier = isLowerBodyProfile(input)
    ? finiteNumber(focus?.lowerBodyModifier)
    : isUpperBodyProfile(input)
      ? finiteNumber(focus?.upperBodyModifier)
      : finiteNumber(focus?.overallModifier);

  if (localModifier != null) {
    const boundedLocal = clamp(localModifier, 0.82, 1.08);
    modifier = boundedLocal < 1 || modifier < 1
      ? Math.min(modifier, boundedLocal)
      : Math.max(modifier, boundedLocal);
  }

  return clamp(modifier, 0.82, 1.08);
}

function getDirectHistory(input: TrainingRecommendationInput, exerciseId?: string | null): TrainingHistorySet[] {
  if (!exerciseId) return [];
  return (input.historySets ?? [])
    .filter((set) => set.completed !== false && set.exerciseId === exerciseId)
    .sort((a, b) => {
      const aTime = a.performedAt ? new Date(a.performedAt).getTime() : 0;
      const bTime = b.performedAt ? new Date(b.performedAt).getTime() : 0;
      return bTime - aTime;
    });
}

function historyWithLoad(history: TrainingHistorySet[]): TrainingHistorySet[] {
  return history.filter((entry) => positiveNumber(entry.actualWeight) != null);
}

function normalizeNameTokens(value: string | null | undefined): Set<string> {
  const tokens = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  const meaningful = tokens.filter((token) => !new Set([
    'the',
    'and',
    'with',
    'machine',
    'plate',
    'loaded',
    'single',
    'double',
    'standing',
    'seated',
  ]).has(token));

  return new Set(meaningful);
}

function getSimilarHistory(input: TrainingRecommendationInput, set: TrainingSetInput): TrainingHistorySet[] {
  const targetTokens = normalizeNameTokens(set.exerciseName);
  const profileTokens = normalizeNameTokens([
    input.exerciseMuscleProfile?.primary,
    input.exerciseMuscleProfile?.secondary,
    ...(input.exerciseMuscleProfile?.groups ?? []),
  ].filter(Boolean).join(' '));

  const movementTokens = new Set([
    'squat',
    'deadlift',
    'hinge',
    'bench',
    'press',
    'row',
    'pull',
    'pulldown',
    'curl',
    'extension',
    'raise',
    'lunge',
    'thrust',
    'fly',
  ]);

  return (input.historySets ?? [])
    .filter((entry) => {
      if (entry.completed === false || entry.exerciseId === set.exerciseId) return false;
      if (positiveNumber(entry.actualWeight) == null) return false;

      const entryTokens = normalizeNameTokens(entry.exerciseName);
      const sharesMovement = [...targetTokens].some((token) => movementTokens.has(token) && entryTokens.has(token));
      const sharesMuscle = [...profileTokens].some((token) => entryTokens.has(token));
      return sharesMovement || sharesMuscle;
    })
    .sort((a, b) => {
      const aTime = a.performedAt ? new Date(a.performedAt).getTime() : 0;
      const bTime = b.performedAt ? new Date(b.performedAt).getTime() : 0;
      return bTime - aTime;
    });
}

function findRecentSessionSet(input: TrainingRecommendationInput, exerciseId?: string | null): TrainingSetInput | null {
  if (!exerciseId) return null;
  const sets = input.sessionSets ?? [];
  for (let index = sets.length - 1; index >= 0; index -= 1) {
    const set = sets[index];
    if (set.exerciseId === exerciseId && set.completed && !set.skipped) {
      return set;
    }
  }
  return null;
}

function latestHistoryLoad(input: TrainingRecommendationInput, set: TrainingSetInput, unit: WeightUnit): BaseLoad {
  const directHistory = getDirectHistory(input, set.exerciseId);
  const targetReps = targetRepsForSet(set);
  const directWithLoad = historyWithLoad(directHistory);
  const comparableDirect = targetReps != null
    ? directWithLoad.filter((entry) => {
      const reps = historyReps(entry);
      return reps != null && Math.abs(reps - targetReps) <= 2;
    })
    : directWithLoad;
  const directEntry = comparableDirect[0] ?? directWithLoad[0];

  if (directEntry) {
    const converted = representativeHistoryWeight(directEntry, targetReps, unit);
    if (converted != null) {
      const effortCount = directWithLoad.slice(0, 6).filter((entry) => historyEffort(entry) != null).length;
      const reps = historyReps(directEntry);
      const usesE1rm = targetReps != null && reps != null && Math.abs(targetReps - reps) >= 2;
      return {
        weight: converted,
        unit,
        source: usesE1rm ? 'e1rm' : 'exercise_history',
        confidence: effortCount >= 2 ? 'high' : historyEffort(directEntry) != null ? 'high' : 'medium',
      };
    }
  }

  const e1rm = getE1rmForExercise(input, set.exerciseId, unit);
  if (e1rm != null && targetReps != null) {
    return {
      weight: roundRecommendationWeight(e1rm / (1 + targetReps / 30), unit),
      unit,
      source: 'e1rm',
      confidence: 'medium',
    };
  }

  const similarEntry = getSimilarHistory(input, set)[0];
  const similarWeight = similarEntry ? representativeHistoryWeight(similarEntry, targetReps, unit) : null;
  if (similarWeight != null) {
    return {
      weight: similarWeight,
      unit,
      source: 'exercise_history',
      confidence: historyEffort(similarEntry) != null ? 'medium' : 'low',
    };
  }

  return {
    weight: null,
    unit,
    source: 'baseline',
    confidence: 'low',
  };
}

function getE1rmForExercise(input: TrainingRecommendationInput, exerciseId?: string | null, unit: WeightUnit = DEFAULT_WEIGHT_UNIT): number | null {
  if (!exerciseId) return null;
  const max = input.userMaxes?.find((entry) => entry.exerciseId === exerciseId && positiveNumber(entry.weight) != null);
  if (max?.weight) {
    const sourceUnit = normalizeUnit(max.unit, unit);
    return sourceUnit === unit ? max.weight : convertWeight(max.weight, sourceUnit, unit);
  }

  const directRecord = input.personalRecords?.find((entry) => {
    if (entry.exerciseId !== exerciseId) return false;
    return positiveNumber(entry.e1rm) != null || positiveNumber(entry.weight) != null;
  });
  const e1rm = positiveNumber(directRecord?.e1rm);
  if (e1rm != null) return unit === 'lbs' ? e1rm : convertWeight(e1rm, 'lbs', unit);
  const recordWeight = positiveNumber(directRecord?.weight);
  return recordWeight != null ? (unit === 'lbs' ? recordWeight : convertWeight(recordWeight, 'lbs', unit)) : null;
}

function prescriptionLoad(input: TrainingRecommendationInput, set: TrainingSetInput, unit: WeightUnit): BaseLoad | null {
  const prescribedWeight = positiveNumber(set.prescribedWeight);
  if (prescribedWeight != null) {
    return {
      weight: roundRecommendationWeight(prescribedWeight, unit),
      unit,
      source: 'prescription',
      confidence: getDirectHistory(input, set.exerciseId).length > 0 ? 'high' : 'medium',
    };
  }

  const percentage = positiveNumber(set.prescribedPercentage);
  const e1rm = getE1rmForExercise(input, set.exerciseId, unit);
  if (percentage != null && e1rm != null) {
    return {
      weight: roundRecommendationWeight(e1rm * (percentage / 100), unit),
      unit,
      source: 'prescription',
      confidence: 'medium',
    };
  }

  return null;
}

function resolveBaseLoad(input: TrainingRecommendationInput, set: TrainingSetInput, unit: WeightUnit): BaseLoad {
  const prescribed = prescriptionLoad(input, set, unit);
  if (prescribed) return prescribed;

  const history = latestHistoryLoad(input, set, unit);
  if (history.weight != null && set.touchedWeight !== true) {
    return history;
  }

  const existing = positiveNumber(set.weight);
  if (existing != null) {
    return {
      weight: roundRecommendationWeight(existing, unit),
      unit,
      source: 'baseline',
      confidence: history.weight != null ? history.confidence : getDirectHistory(input, set.exerciseId).length > 0 ? 'medium' : 'low',
    };
  }

  return history;
}

function isHardAttempt(
  effort: number | null,
  reps: number | null,
  targetRpe: number | null,
  targetReps: number | null
): boolean {
  const missedReps = targetReps != null && reps != null && reps < targetReps;
  if (targetRpe != null && effort != null && effort >= targetRpe + 1) return true;
  if (targetRpe != null && missedReps && effort != null && effort >= targetRpe - 0.25) return true;
  if (targetRpe == null && effort != null && effort >= 9.5) return true;
  return missedReps && (effort == null || effort >= 9);
}

function isEasyAttempt(
  effort: number | null,
  reps: number | null,
  targetRpe: number | null,
  targetReps: number | null
): boolean {
  if (targetRpe == null || effort == null) return false;
  if (targetReps != null && (reps == null || reps < targetReps)) return false;
  return effort <= targetRpe - 0.75;
}

function fatigueModifier(input: TrainingRecommendationInput, set: TrainingSetInput): PerformanceSignal {
  const targetRpe = targetRpeForSet(set);
  const targetReps = targetRepsForSet(set);
  const latestSessionSet = findRecentSessionSet(input, set.exerciseId);
  const completedSessionSets = (input.sessionSets ?? [])
    .filter((entry) => entry.exerciseId === set.exerciseId && entry.completed && !entry.skipped)
    .slice(-4);

  if (latestSessionSet) {
    const rpe = sessionEffort(latestSessionSet);
    const reps = finiteNumber(latestSessionSet.reps);
    const hardSetCount = completedSessionSets.filter((entry) => isHardAttempt(
      sessionEffort(entry),
      finiteNumber(entry.reps),
      targetRpe,
      targetReps
    )).length;

    if (isHardAttempt(rpe, reps, targetRpe, targetReps)) {
      const repeatedHard = hardSetCount >= 2;
      return {
        modifier: repeatedHard ? 0.875 : rpe != null && rpe >= 9.5 ? 0.9 : 0.95,
        restSeconds: repeatedHard ? 60 : 30,
        reason: repeatedHard
          ? 'Multiple sets for this lift ran over target effort. Pull load back and take more rest.'
          : rpe != null && targetRpe != null
            ? `Last set was ${rpe.toFixed(1)} RPE against a ${targetRpe.toFixed(1)} target.`
            : 'Last set missed the rep target. Pull load back before the next attempt.',
        source: 'session_fatigue',
        confidence: 'high',
      };
    }

    if (isEasyAttempt(rpe, reps, targetRpe, targetReps) && readinessModifier(input) >= 0.98) {
      return {
        modifier: 1.025,
        restSeconds: null,
        reason: `Last set landed under target effort at RPE ${rpe?.toFixed(1) ?? '--'}.`,
        source: 'session_fatigue',
        confidence: 'high',
      };
    }
  }

  const directHistory = historyWithLoad(getDirectHistory(input, set.exerciseId));
  const comparableHistory = targetReps != null
    ? directHistory.filter((entry) => {
      const reps = historyReps(entry);
      return reps != null && Math.abs(reps - targetReps) <= 2;
    })
    : directHistory;
  const recentHistory = (comparableHistory.length > 0 ? comparableHistory : directHistory).slice(0, 6);
  const scoredHistory = recentHistory.map((entry) => ({
    entry,
    effort: historyEffort(entry),
    reps: historyReps(entry),
  }));
  const latest = scoredHistory[0];
  const hardHistoryCount = scoredHistory.filter((entry) =>
    isHardAttempt(entry.effort, entry.reps, targetRpe, targetReps)
  ).length;
  const easyHistoryCount = scoredHistory.filter((entry) =>
    isEasyAttempt(entry.effort, entry.reps, targetRpe, targetReps)
  ).length;
  const historyConfidence: RecommendationConfidence =
    scoredHistory.filter((entry) => entry.effort != null).length >= 2 ? 'high' : latest?.effort != null ? 'high' : 'medium';

  if (latest && isHardAttempt(latest.effort, latest.reps, targetRpe, targetReps)) {
    const repeatedHard = hardHistoryCount >= 2;
    return {
      modifier: repeatedHard ? 0.95 : 0.975,
      restSeconds: repeatedHard ? 60 : 30,
      reason: repeatedHard
        ? 'Recent logged sets missed reps or ran hot against target effort.'
        : latest.effort != null && targetRpe != null
          ? `Last session overshot target effort at RPE ${latest.effort.toFixed(1)}.`
          : 'Last session missed the rep target.',
      source: 'exercise_history',
      confidence: historyConfidence,
    };
  }

  if (latest && isEasyAttempt(latest.effort, latest.reps, targetRpe, targetReps) && readinessModifier(input) >= 0.98) {
    return {
      modifier: easyHistoryCount >= 2 ? 1.05 : 1.025,
      restSeconds: null,
      reason: easyHistoryCount >= 2
        ? 'Recent logged sets have hit reps below target effort.'
        : `Last session hit reps below target effort at RPE ${latest.effort?.toFixed(1) ?? '--'}.`,
      source: 'exercise_history',
      confidence: historyConfidence,
    };
  }

  return {
    modifier: 1,
    restSeconds: null,
    reason: null,
    source: null,
    confidence: null,
  };
}

function buildSetRecommendation(input: TrainingRecommendationInput, set: TrainingSetInput): TrainingRecommendation {
  const unit = normalizeUnit(set.weightUnit, input.weightUnit);
  const base = resolveBaseLoad(input, set, unit);
  const readiness = readinessModifier(input);
  const fatigue = fatigueModifier(input, set);
  const targetReps = targetRepsForSet(set);
  const hasExplicitPrescription = positiveNumber(set.prescribedWeight) != null || positiveNumber(set.prescribedPercentage) != null;
  const combinedModifier = clamp(readiness * fatigue.modifier, 0.82, 1.08);
  const baseWeight = base.weight;
  const suggestedWeight = baseWeight != null
    ? roundRecommendationWeight(baseWeight * combinedModifier, unit)
    : null;
  const currentWeight = positiveNumber(set.weight);
  const delta = baseWeight && suggestedWeight ? (suggestedWeight - baseWeight) / baseWeight : 0;
  const shouldApplyWeight =
    suggestedWeight != null &&
    (currentWeight == null || Math.abs(suggestedWeight - currentWeight) >= (unit === 'kg' ? KG_INCREMENT : LBS_INCREMENT));
  const apply: TrainingRecommendationApplyPatch | undefined = shouldApplyWeight
    ? {
      blockId: set.blockId,
      exerciseId: set.exerciseId,
      setId: set.setId,
      weight: suggestedWeight,
      weightUnit: unit,
      ...(targetReps != null && set.reps == null ? { reps: targetReps } : {}),
      ...(fatigue.restSeconds != null ? { restSeconds: fatigue.restSeconds } : {}),
    }
    : fatigue.restSeconds != null
      ? {
        blockId: set.blockId,
        exerciseId: set.exerciseId,
        setId: set.setId,
        restSeconds: fatigue.restSeconds,
      }
      : undefined;

  let action: RecommendationAction = 'maintain_load';
  if (delta >= 0.018) action = 'increase_load';
  if (delta <= -0.018) action = 'reduce_load';
  if (baseWeight == null && targetReps != null) action = 'maintain_load';
  if (fatigue.restSeconds != null && Math.abs(delta) < 0.018) action = 'add_rest';

  let severity: RecommendationSeverity = 'info';
  if (action === 'add_rest') severity = 'watch';
  if (action === 'increase_load' || action === 'reduce_load') severity = 'adjust';
  if (delta <= -0.08 || (finiteNumber(input.readiness?.score) ?? 100) <= 45) severity = 'deload';

  const confidence = fatigue.confidence ?? base.confidence;
  const source = fatigue.source ?? (combinedModifier < 0.99 || combinedModifier > 1.01 ? 'readiness' : base.source);
  const readinessScore = finiteNumber(input.readiness?.score);
  const reasons: string[] = [];

  if (baseWeight == null) {
    reasons.push('No direct load history yet, so this stays conservative.');
  } else if (hasExplicitPrescription && suggestedWeight != null && Math.abs(suggestedWeight - baseWeight) > 0) {
    reasons.push(`Prescription stays ${formatWeight(baseWeight, unit)}; apply ${formatWeight(suggestedWeight, unit)} only if this set feels right.`);
  } else if (fatigue.reason) {
    reasons.push(fatigue.reason);
  } else if (readinessScore != null && readiness !== 1) {
    reasons.push(`Readiness is ${Math.round(readinessScore)}, so load is nudged ${readiness < 1 ? 'down' : 'up'}.`);
  } else if (base.source === 'exercise_history') {
    reasons.push('Based on recent completed sets for this exercise.');
  } else if (base.source === 'e1rm') {
    reasons.push('Estimated from max strength data and target reps.');
  } else if (base.source === 'prescription') {
    reasons.push('Using the program prescription as the base target.');
  } else if (base.source === 'baseline' && set.touchedWeight === true) {
    reasons.push('Using your edited load as the base target.');
  } else {
    reasons.push('Establish today’s baseline and adjust after the set.');
  }

  if (fatigue.reason && readinessScore != null && readiness !== 1) {
    reasons.push(`Readiness is ${Math.round(readinessScore)}, so the target is also nudged ${readiness < 1 ? 'down' : 'up'}.`);
  }

  if (fatigue.restSeconds != null && !reasons.some((reason) => /rest/i.test(reason))) {
    reasons.push(`Add ${fatigue.restSeconds}s before the next attempt.`);
  }

  const title =
    action === 'increase_load'
      ? 'Nudge Load Up'
      : action === 'reduce_load'
        ? 'Pull Load Back'
        : action === 'add_rest'
          ? 'Add Rest'
          : baseWeight == null
            ? 'Establish Baseline'
            : 'Hold Target';

  return {
    id: stableId(['smart-target', set.exerciseId, set.setId, action, suggestedWeight, targetReps]),
    scope: 'next_set',
    action,
    severity,
    confidence,
    title,
    reason: reasons.join(' '),
    exerciseId: set.exerciseId,
    exerciseName: set.exerciseName,
    setId: set.setId,
    target: {
      weight: suggestedWeight,
      weightUnit: unit,
      reps: targetReps,
      restSeconds: fatigue.restSeconds,
      prescribedWeight: positiveNumber(set.prescribedWeight),
      prescribedPercentage: positiveNumber(set.prescribedPercentage),
    },
    apply,
    source,
  };
}

function buildSessionRecommendation(input: TrainingRecommendationInput): TrainingRecommendation | null {
  const completed = (input.sessionSets ?? []).filter((set) => set.completed && !set.skipped);
  if (completed.length < 3) return null;

  const rpes = completed.map((set) => finiteNumber(set.rpe)).filter((value): value is number => value != null);
  const avgRpe = rpes.length > 0 ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null;
  const readinessScore = finiteNumber(input.readiness?.score);

  if ((avgRpe != null && avgRpe >= 9) || (readinessScore != null && readinessScore <= 50)) {
    return {
      id: stableId(['session', 'trim', completed.length, Math.round(avgRpe ?? 0), Math.round(readinessScore ?? 0)]),
      scope: 'session',
      action: readinessScore != null && readinessScore <= 45 ? 'deload' : 'trim_volume',
      severity: readinessScore != null && readinessScore <= 45 ? 'deload' : 'adjust',
      confidence: avgRpe != null ? 'high' : 'medium',
      title: readinessScore != null && readinessScore <= 45 ? 'Consider Deload' : 'Trim If Needed',
      reason: avgRpe != null
        ? `Average effort is ${avgRpe.toFixed(1)} RPE. Keep the next work conservative.`
        : `Readiness is ${Math.round(readinessScore ?? 0)}. Keep the next work conservative.`,
      source: avgRpe != null ? 'session_fatigue' : 'readiness',
      apply: { setCountDelta: -1 },
    };
  }

  if (avgRpe != null && avgRpe <= 7 && completed.length >= 5 && readinessModifier(input) >= 0.98) {
    return {
      id: stableId(['session', 'progress', completed.length, Math.round(avgRpe * 10)]),
      scope: 'session',
      action: 'add_volume',
      severity: 'info',
      confidence: 'medium',
      title: 'Progress Next Time',
      reason: `Session effort averaged ${avgRpe.toFixed(1)} RPE. A small next-session progression is reasonable.`,
      source: 'session_fatigue',
      apply: { setCountDelta: 1 },
    };
  }

  return null;
}

export function buildProgramTuneUpRecommendation(input: TrainingRecommendationInput): TrainingRecommendation | null {
  if (!input.program) return null;

  const history = (input.historySets ?? []).filter((set) => set.completed !== false);
  const rpes = history.map((set) => finiteNumber(set.actualRPE)).filter((value): value is number => value != null);
  const avgRpe = rpes.length > 0 ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null;
  const readinessScore = finiteNumber(input.readiness?.score);
  const programId = input.program.id;

  if ((readinessScore != null && readinessScore <= 52) || (avgRpe != null && avgRpe >= 9)) {
    return {
      id: stableId(['program', programId, 'deload', Math.round(readinessScore ?? 0), Math.round((avgRpe ?? 0) * 10)]),
      scope: 'program',
      action: readinessScore != null && readinessScore <= 45 ? 'deload' : 'trim_volume',
      severity: readinessScore != null && readinessScore <= 45 ? 'deload' : 'adjust',
      confidence: history.length >= 8 || readinessScore != null ? 'medium' : 'low',
      title: 'Stage Easier Targets',
      reason: avgRpe != null && avgRpe >= 9
        ? `Recent logged sets average ${avgRpe.toFixed(1)} RPE. Review a lighter next-week setup.`
        : `Readiness is ${Math.round(readinessScore ?? 0)}. Review a lighter next-week setup.`,
      source: avgRpe != null ? 'program_load' : 'readiness',
      apply: { setCountDelta: -1 },
    };
  }

  if (history.length >= 8 && avgRpe != null && avgRpe <= 7.2 && readinessModifier(input) >= 0.98) {
    return {
      id: stableId(['program', programId, 'increase', Math.round(avgRpe * 10)]),
      scope: 'program',
      action: 'increase_load',
      severity: 'info',
      confidence: 'medium',
      title: 'Stage Small Progression',
      reason: `Recent work is averaging ${avgRpe.toFixed(1)} RPE. Review a small next-week load bump.`,
      source: 'program_load',
      apply: {},
    };
  }

  return {
    id: stableId(['program', programId, 'hold']),
    scope: 'program',
    action: 'hold_program',
    severity: 'info',
    confidence: history.length >= 4 ? 'medium' : 'low',
    title: 'Hold Program',
    reason: history.length >= 4
      ? 'Recent work does not justify changing the plan yet.'
      : 'Not enough recent logged work to tune the plan safely.',
    source: 'baseline',
  };
}

export function buildTrainingRecommendations(input: TrainingRecommendationInput): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];

  if (input.currentSet && !input.currentSet.completed && !input.currentSet.skipped) {
    recommendations.push(buildSetRecommendation(input, input.currentSet));
  }

  const sessionRecommendation = buildSessionRecommendation(input);
  if (sessionRecommendation) recommendations.push(sessionRecommendation);

  const programRecommendation = buildProgramTuneUpRecommendation(input);
  if (programRecommendation) recommendations.push(programRecommendation);

  return recommendations.sort((a, b) => {
    const severityRank: Record<RecommendationSeverity, number> = {
      deload: 0,
      adjust: 1,
      watch: 2,
      info: 3,
    };
    return severityRank[a.severity] - severityRank[b.severity];
  });
}

function cloneProgram(program: ProgramTemplate): ProgramTemplate {
  return JSON.parse(JSON.stringify(program)) as ProgramTemplate;
}

function adjustSetTemplate(set: SetTemplate, recommendation: TrainingRecommendation): SetTemplate {
  const next = { ...set };
  const reduce = recommendation.action === 'deload' || recommendation.action === 'trim_volume' || recommendation.action === 'reduce_load';
  const increase = recommendation.action === 'increase_load' || recommendation.action === 'add_volume';
  const reductionFactor = recommendation.action === 'deload' ? 0.9 : 0.95;

  if (reduce) {
    if (positiveNumber(next.fixedWeight) != null) {
      next.fixedWeight = roundRecommendationWeight(Number(next.fixedWeight) * reductionFactor, 'lbs');
    }
    if (positiveNumber(next.targetPercentage) != null) {
      next.targetPercentage = Number(clamp(Number(next.targetPercentage) * reductionFactor, 40, 95).toFixed(1));
    }
    if (finiteNumber(next.targetRPE) != null) {
      next.targetRPE = Number(clamp(Number(next.targetRPE) - (recommendation.action === 'deload' ? 1 : 0.5), 5, 10).toFixed(1));
    }
    if (finiteNumber(next.targetRIR) != null) {
      next.targetRIR = Number(clamp(Number(next.targetRIR) + (recommendation.action === 'deload' ? 1 : 0.5), 0, 6).toFixed(1));
    }
    if (next.restSeconds != null) {
      next.restSeconds = Math.min(300, next.restSeconds + 30);
    }
  }

  if (increase) {
    if (positiveNumber(next.fixedWeight) != null) {
      next.fixedWeight = roundRecommendationWeight(Number(next.fixedWeight) * 1.025, 'lbs');
    }
    if (positiveNumber(next.targetPercentage) != null) {
      next.targetPercentage = Number(clamp(Number(next.targetPercentage) + 2.5, 40, 95).toFixed(1));
    }
    if (finiteNumber(next.targetRPE) != null) {
      next.targetRPE = Number(clamp(Number(next.targetRPE) + 0.5, 5, 10).toFixed(1));
    }
    if (finiteNumber(next.targetRIR) != null) {
      next.targetRIR = Number(clamp(Number(next.targetRIR) - 0.5, 0, 6).toFixed(1));
    }
  }

  return next;
}

export function applyProgramTuneUp(program: ProgramTemplate, recommendation: TrainingRecommendation): ProgramTemplate {
  if (recommendation.scope !== 'program' || recommendation.action === 'hold_program') {
    return cloneProgram(program);
  }

  const next = cloneProgram(program);
  next.weeks = next.weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => ({
      ...day,
      sets: day.sets.map((set) => adjustSetTemplate(set, recommendation)),
      blocks: day.blocks?.map((block) => ({
        ...block,
        exercises: block.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => adjustSetTemplate(set, recommendation)),
        })),
      })),
    })),
  }));
  return next;
}

export function recommendationHasApplyPatch(recommendation: TrainingRecommendation | null | undefined): boolean {
  if (!recommendation?.apply) return false;
  return Object.keys(recommendation.apply).some((key) => recommendation.apply?.[key as keyof TrainingRecommendationApplyPatch] !== undefined);
}
