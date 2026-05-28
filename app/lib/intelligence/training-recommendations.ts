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
export type RecommendationDataSufficiency = 'baseline' | 'limited' | 'enough' | 'high';
export type RecommendationEvidenceSource =
  | 'direct_history'
  | 'similar_movement'
  | 'max_e1rm'
  | 'program_prescription'
  | 'current_session'
  | 'readiness'
  | 'load_pressure'
  | 'program_trend'
  | 'baseline';

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
  evidenceSource?: RecommendationEvidenceSource;
  evidenceCount?: number;
  confidenceReason?: string;
  dataSufficiency?: RecommendationDataSufficiency;
  blockedReason?: string;
  source:
    | 'prescription'
    | 'exercise_history'
    | 'session_fatigue'
    | 'readiness'
    | 'e1rm'
    | 'program_load'
    | 'load_pressure'
    | 'performance_trend'
    | 'baseline';
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
  setIndex?: number | null;
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
  skipped?: boolean | null;
  setType?: string | null;
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
  preferHistoryOverPrescription?: boolean | null;
}

type BaseLoad = {
  weight: number | null;
  unit: WeightUnit;
  source: TrainingRecommendation['source'];
  confidence: RecommendationConfidence;
  basis: 'prescription' | 'direct_history' | 'similar_history' | 'e1rm' | 'current_session' | 'current' | 'none';
};

type PerformanceSignal = {
  modifier: number;
  restSeconds: number | null;
  repDelta?: number | null;
  reason: string | null;
  source: TrainingRecommendation['source'] | null;
  confidence: RecommendationConfidence | null;
};

type LocalLoadPressureSignal = {
  modifier: number;
  ratio: number | null;
  reason: string | null;
  source: TrainingRecommendation['source'] | null;
  confidence: RecommendationConfidence | null;
};

const LBS_INCREMENT = 5;
const KG_INCREMENT = 2.5;
const SMALL_LBS_INCREMENT = 2.5;
const SMALL_KG_INCREMENT = 1;
const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lbs';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOAD_SPIKE_WATCH_RATIO = 1.35;
const LOAD_SPIKE_MAJOR_RATIO = 1.6;
const BODYWEIGHT_KEYWORDS = [
  'bodyweight',
  'pull-up',
  'pull up',
  'chin-up',
  'chin up',
  'dip',
  'plank',
  'ab wheel',
  'push-up',
  'push up',
];

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
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
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

function inferEquipmentKind(value: string | null | undefined): 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'unknown' {
  const lower = (value ?? '').toLowerCase();
  if (/\b(bodyweight|pull[-\s]?up|chin[-\s]?up|push[-\s]?up|dip|plank|crunch|sit[-\s]?up)\b/.test(lower)) return 'bodyweight';
  if (/\b(db|dumbbell|dumbbells)\b/.test(lower)) return 'dumbbell';
  if (/\b(cable|pulldown|pushdown|pressdown)\b/.test(lower)) return 'cable';
  if (/\b(machine|smith|hack squat|leg press|pec deck)\b/.test(lower)) return 'machine';
  if (/\b(bb|barbell|ez bar|trap bar|t bar|landmine|squat|deadlift|bench|row|press)\b/.test(lower)) return 'barbell';
  return 'unknown';
}

function recommendationWeightIncrement(unit: WeightUnit, set?: Pick<TrainingSetInput, 'exerciseId' | 'exerciseName'> | null): number {
  const equipment = inferEquipmentKind(set?.exerciseName) !== 'unknown'
    ? inferEquipmentKind(set?.exerciseName)
    : inferEquipmentKind(set?.exerciseId);
  if (unit === 'kg') {
    return equipment === 'dumbbell' || equipment === 'machine' || equipment === 'cable'
      ? SMALL_KG_INCREMENT
      : KG_INCREMENT;
  }
  return equipment === 'dumbbell' || equipment === 'machine' || equipment === 'cable'
    ? SMALL_LBS_INCREMENT
    : LBS_INCREMENT;
}

export function roundRecommendationWeight(value: number, unit: WeightUnit): number {
  const increment = unit === 'kg' ? KG_INCREMENT : LBS_INCREMENT;
  const rounded = Math.round(value / increment) * increment;
  return unit === 'kg' ? Number(rounded.toFixed(2)) : Math.round(rounded);
}

function roundSetWeight(value: number, unit: WeightUnit, set?: Pick<TrainingSetInput, 'exerciseId' | 'exerciseName'> | null): number {
  const increment = recommendationWeightIncrement(unit, set);
  const rounded = Math.round(value / increment) * increment;
  return unit === 'kg' || !Number.isInteger(increment) ? Number(rounded.toFixed(2)) : Math.round(rounded);
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

function prescribedRepsTarget(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return value > 0 ? Math.round(value) : null;
  }
  if (!value) return null;
  const matches = String(value).match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const parsed = Number(matches[0]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
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

function isLoadAdjustableSet(set: TrainingSetInput): boolean {
  const type = (set.type ?? '').toLowerCase();
  return type !== 'warmup';
}

function isLoadAdjustableHistorySet(set: TrainingHistorySet): boolean {
  const type = (set.setType ?? '').toLowerCase();
  return type !== 'warmup';
}

function isPerformedTrainingSet(
  set: TrainingSetInput | null | undefined,
  options: { requireLoad?: boolean; allowWarmup?: boolean } = {}
): set is TrainingSetInput {
  if (!set || set.completed !== true || set.skipped === true) return false;
  if (!options.allowWarmup && !isLoadAdjustableSet(set)) return false;
  const reps = positiveNumber(set.reps);
  if (reps == null) return false;
  if (options.requireLoad && positiveNumber(set.weight) == null) return false;
  return true;
}

function isPerformedHistorySet(
  set: TrainingHistorySet | null | undefined,
  options: { requireLoad?: boolean; allowWarmup?: boolean } = {}
): set is TrainingHistorySet {
  if (!set || set.completed !== true || set.skipped === true) return false;
  if (!options.allowWarmup && !isLoadAdjustableHistorySet(set)) return false;
  const reps = positiveNumber(set.actualReps);
  if (reps == null) return false;
  if (options.requireLoad && positiveNumber(set.actualWeight) == null) return false;
  return true;
}

function isBodyweightOnlySet(set: TrainingSetInput): boolean {
  const lowerName = (set.exerciseName ?? '').toLowerCase();
  if (lowerName.includes('weighted')) return false;
  const looksBodyweight = BODYWEIGHT_KEYWORDS.some((keyword) => lowerName.includes(keyword));
  if (!looksBodyweight) return false;

  return (
    positiveNumber(set.weight) == null &&
    positiveNumber(set.prescribedWeight) == null &&
    positiveNumber(set.prescribedPercentage) == null
  );
}

function timestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(nowMs: number, thenMs: number): number {
  if (!thenMs) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - thenMs) / MS_PER_DAY);
}

function historyDedupKey(set: TrainingHistorySet): string {
  if (set.id) return `id:${set.id}`;
  return [
    set.workoutSessionId ?? 'session',
    set.exerciseId ?? 'exercise',
    set.setIndex ?? 'set',
    set.performedAt ?? 'time',
    set.actualWeight ?? 'weight',
    set.actualReps ?? 'reps',
  ].join('|');
}

function getHistorySets(input: TrainingRecommendationInput): TrainingHistorySet[] {
  const seen = new Set<string>();
  const history: TrainingHistorySet[] = [];
  for (const set of input.historySets ?? []) {
    const key = historyDedupKey(set);
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(set);
  }
  return history;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lowerConfidence(
  current: RecommendationConfidence,
  next: RecommendationConfidence | null | undefined
): RecommendationConfidence {
  if (!next) return current;
  const rank: Record<RecommendationConfidence, number> = { high: 3, medium: 2, low: 1 };
  return rank[next] < rank[current] ? next : current;
}

function dataSufficiencyFromCount(count: number): RecommendationDataSufficiency {
  if (count >= 8) return 'high';
  if (count >= 3) return 'enough';
  if (count >= 1) return 'limited';
  return 'baseline';
}

function describeEvidenceSource(source: RecommendationEvidenceSource): string {
  if (source === 'direct_history') return 'direct exercise history';
  if (source === 'similar_movement') return 'similar movement history';
  if (source === 'max_e1rm') return 'max/e1RM data';
  if (source === 'program_prescription') return 'program prescription';
  if (source === 'current_session') return 'current session sets';
  if (source === 'readiness') return 'readiness input';
  if (source === 'load_pressure') return 'recent load pressure';
  if (source === 'program_trend') return 'program trend';
  return 'baseline';
}

function buildConfidenceReason(
  confidence: RecommendationConfidence,
  evidenceSource: RecommendationEvidenceSource,
  evidenceCount: number,
  dataSufficiency: RecommendationDataSufficiency
): string {
  if (dataSufficiency === 'baseline') {
    return 'Low confidence: no usable history yet, so this is a conservative baseline.';
  }

  const source = describeEvidenceSource(evidenceSource);
  if (confidence === 'high') {
    return `High confidence: ${evidenceCount} usable ${source} signals support this target.`;
  }
  if (confidence === 'medium') {
    return `Medium confidence: ${source} supports the target, but the sample is still building.`;
  }
  return `Low confidence: using ${source} as a starting point until direct history improves.`;
}

function modifierCapForConfidence(
  modifier: number,
  confidence: RecommendationConfidence,
  hasExplicitPrescription: boolean
): number {
  if (confidence === 'high') return clamp(modifier, 0.85, 1.08);
  if (confidence === 'medium') return clamp(modifier, 0.88, 1.055);
  return clamp(modifier, hasExplicitPrescription ? 0.88 : 0.92, 1);
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
  const source = input.readiness?.source?.toLowerCase() ?? null;

  if (source && source !== 'manual') {
    return 1;
  }

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
  return getHistorySets(input)
    .filter((set) => isPerformedHistorySet(set) && set.exerciseId === exerciseId)
    .sort((a, b) => {
      return timestampMs(b.performedAt) - timestampMs(a.performedAt);
    });
}

function historyWithLoad(history: TrainingHistorySet[]): TrainingHistorySet[] {
  return history.filter((entry) => isPerformedHistorySet(entry, { requireLoad: true }));
}

function inferMovementFamily(value: string | null | undefined): string | null {
  const lower = (value ?? '').toLowerCase();
  if (/\b(quad|leg extension)\b/.test(lower)) return 'squat';
  if (/\b(hamstring|leg curl)\b/.test(lower)) return 'hinge';
  if (/\b(calf|calves)\b/.test(lower)) return 'calf';
  if (/\b(ab|abs|core|crunch|sit[-\s]?up|plank|hanging knee|leg raise)\b/.test(lower)) return 'core';
  if (/\b(lunge|split squat|step[-\s]?up)\b/.test(lower)) return 'lunge';
  if (/\b(squat|leg press|hack squat)\b/.test(lower)) return 'squat';
  if (/\b(deadlift|rdl|romanian|hinge|good morning)\b/.test(lower)) return 'hinge';
  if (/\b(hip thrust|glute bridge)\b/.test(lower)) return 'hip-thrust';
  if (/\b(row)\b/.test(lower)) return 'row';
  if (/\b(pull[-\s]?up|chin[-\s]?up|pulldown|lat pull)\b/.test(lower)) return 'vertical-pull';
  if (/\b(overhead|military|shoulder press|arnold)\b/.test(lower)) return 'vertical-press';
  if (/\b(bench|chest press|push[-\s]?up)\b/.test(lower)) return 'horizontal-press';
  if (/\b(fly|flye|pec deck)\b/.test(lower)) return 'fly';
  if (/\b(curl)\b/.test(lower)) return 'curl';
  if (/\b(pushdown|pressdown|skull|tricep|triceps|extension)\b/.test(lower)) return 'triceps-extension';
  if (/\b(lateral raise|front raise|rear delt|reverse fly)\b/.test(lower)) return 'delt-raise';
  return null;
}

function movementFamilyForSet(set: TrainingSetInput): string | null {
  return inferMovementFamily(set.exerciseName) ?? inferMovementFamily(set.exerciseId);
}

function movementFamilyForHistory(entry: TrainingHistorySet): string | null {
  return inferMovementFamily(entry.exerciseName) ?? inferMovementFamily(entry.exerciseId);
}

function getSimilarHistory(input: TrainingRecommendationInput, set: TrainingSetInput): TrainingHistorySet[] {
  const targetFamily = movementFamilyForSet(set);
  if (!targetFamily) return [];

  return getHistorySets(input)
    .filter((entry) => {
      if (!isPerformedHistorySet(entry, { requireLoad: true }) || entry.exerciseId === set.exerciseId) return false;

      return movementFamilyForHistory(entry) === targetFamily;
    })
    .sort((a, b) => {
      return timestampMs(b.performedAt) - timestampMs(a.performedAt);
    });
}

function historyLoadScore(entry: TrainingHistorySet): number | null {
  if (!isPerformedHistorySet(entry, { requireLoad: true })) return null;
  const reps = historyReps(entry);
  if (reps == null) return null;

  const rawWeight = positiveNumber(entry.actualWeight);
  if (rawWeight == null) return null;

  const unit = normalizeUnit(entry.weightUnit, DEFAULT_WEIGHT_UNIT);
  const weightLbs = unit === 'lbs' ? rawWeight : convertWeight(rawWeight, unit, 'lbs');
  const effort = historyEffort(entry) ?? 7;
  const effortFactor = clamp(effort / 8, 0.65, 1.25);

  return (weightLbs * reps * effortFactor) / 1000;
}

function historyE1rmLbs(entry: TrainingHistorySet): number | null {
  if (!isPerformedHistorySet(entry, { requireLoad: true })) return null;
  const explicit = positiveNumber(entry.e1rm);
  if (explicit != null) return explicit;
  const reps = historyReps(entry);
  const rawWeight = positiveNumber(entry.actualWeight);
  if (rawWeight == null || reps == null) return null;
  const unit = normalizeUnit(entry.weightUnit, DEFAULT_WEIGHT_UNIT);
  const weightLbs = unit === 'lbs' ? rawWeight : convertWeight(rawWeight, unit, 'lbs');
  return e1rmFromLoad(weightLbs, reps);
}

function localLoadPressure(input: TrainingRecommendationInput, set: TrainingSetInput): LocalLoadPressureSignal {
  const targetFamily = movementFamilyForSet(set);
  if (!targetFamily) {
    return {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  const nowMs = Date.now();
  const familyHistory = getHistorySets(input)
    .map((entry) => {
      const performedAt = timestampMs(entry.performedAt);
      const load = historyLoadScore(entry);
      return { entry, performedAt, load };
    })
    .filter(({ entry, performedAt, load }) => {
      if (!isPerformedHistorySet(entry, { requireLoad: true }) || performedAt === 0 || load == null || load <= 0) return false;
      const ageDays = daysBetween(nowMs, performedAt);
      return ageDays <= 35 && movementFamilyForHistory(entry) === targetFamily;
    });

  if (familyHistory.length < 4) {
    return {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  const acuteLoad = familyHistory
    .filter(({ performedAt }) => daysBetween(nowMs, performedAt) <= 7)
    .reduce((sum, entry) => sum + (entry.load ?? 0), 0);
  const chronicHistory = familyHistory.filter(({ performedAt }) => daysBetween(nowMs, performedAt) <= 28);
  const chronicLoad = chronicHistory.reduce((sum, entry) => sum + (entry.load ?? 0), 0);
  const weeklyBaseline = chronicLoad / 4;
  const oldestChronic = chronicHistory.reduce(
    (oldest, entry) => Math.min(oldest, entry.performedAt),
    Number.POSITIVE_INFINITY
  );
  const baselineAgeDays = Number.isFinite(oldestChronic) ? daysBetween(nowMs, oldestChronic) : 0;
  const confidence: RecommendationConfidence =
    chronicHistory.length >= 8 && baselineAgeDays >= 21
      ? 'high'
      : chronicHistory.length >= 4 && baselineAgeDays >= 14
        ? 'medium'
        : 'low';

  if (weeklyBaseline <= 0) {
    return {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  const ratio = acuteLoad / weeklyBaseline;
  if (confidence === 'low') {
    return {
      modifier: 1,
      ratio,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  if (ratio >= LOAD_SPIKE_MAJOR_RATIO) {
    return {
      modifier: 0.94,
      ratio,
      reason: `This movement pattern is ${Math.round((ratio - 1) * 100)}% above its recent weekly baseline, so the target is recovery-managed.`,
      source: 'load_pressure',
      confidence,
    };
  }

  if (ratio >= LOAD_SPIKE_WATCH_RATIO) {
    return {
      modifier: 0.97,
      ratio,
      reason: `Recent ${targetFamily.replace('-', ' ')} load is above baseline. Hold effort honest before pushing.`,
      source: 'load_pressure',
      confidence,
    };
  }

  if (ratio <= 0.65 && acuteLoad > 0) {
    return {
      modifier: 1.01,
      ratio,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  return {
    modifier: 1,
    ratio,
    reason: null,
    source: null,
    confidence: null,
  };
}

function globalLoadPressure(history: TrainingHistorySet[]): LocalLoadPressureSignal {
  const nowMs = Date.now();
  const loadEntries = history
    .map((entry) => ({
      performedAt: timestampMs(entry.performedAt),
      load: historyLoadScore(entry),
    }))
    .filter((entry) => {
      if (entry.performedAt === 0 || entry.load == null || entry.load <= 0) return false;
      return daysBetween(nowMs, entry.performedAt) <= 35;
    });

  if (loadEntries.length < 6) {
    return {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  const acuteLoad = loadEntries
    .filter((entry) => daysBetween(nowMs, entry.performedAt) <= 7)
    .reduce((sum, entry) => sum + (entry.load ?? 0), 0);
  const chronicEntries = loadEntries.filter((entry) => daysBetween(nowMs, entry.performedAt) <= 28);
  const chronicLoad = chronicEntries.reduce((sum, entry) => sum + (entry.load ?? 0), 0);
  const weeklyBaseline = chronicLoad / 4;
  if (weeklyBaseline <= 0) {
    return {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  }

  const oldestChronic = chronicEntries.reduce(
    (oldest, entry) => Math.min(oldest, entry.performedAt),
    Number.POSITIVE_INFINITY
  );
  const baselineAgeDays = Number.isFinite(oldestChronic) ? daysBetween(nowMs, oldestChronic) : 0;
  const confidence: RecommendationConfidence =
    chronicEntries.length >= 12 && baselineAgeDays >= 21
      ? 'high'
      : chronicEntries.length >= 6 && baselineAgeDays >= 14
        ? 'medium'
        : 'low';

  const ratio = acuteLoad / weeklyBaseline;
  return {
    modifier: ratio >= LOAD_SPIKE_MAJOR_RATIO ? 0.94 : ratio >= LOAD_SPIKE_WATCH_RATIO ? 0.97 : 1,
    ratio,
    reason: ratio >= LOAD_SPIKE_MAJOR_RATIO
      ? `Overall workload is ${Math.round((ratio - 1) * 100)}% above the recent weekly baseline.`
      : ratio >= LOAD_SPIKE_WATCH_RATIO
        ? 'Overall workload is running above the recent weekly baseline.'
        : null,
    source: ratio >= LOAD_SPIKE_WATCH_RATIO ? 'load_pressure' : null,
    confidence: ratio >= LOAD_SPIKE_WATCH_RATIO ? confidence : null,
  };
}

function findRecentSessionSet(input: TrainingRecommendationInput, exerciseId?: string | null): TrainingSetInput | null {
  if (!exerciseId) return null;
  const sets = input.sessionSets ?? [];
  for (let index = sets.length - 1; index >= 0; index -= 1) {
    const set = sets[index];
    if (set.exerciseId === exerciseId && isPerformedTrainingSet(set, { requireLoad: true })) {
      return set;
    }
  }
  return null;
}

function completedSessionSetCount(input: TrainingRecommendationInput, exerciseId?: string | null): number {
  if (!exerciseId) return 0;
  return (input.sessionSets ?? []).filter((set) =>
    set.exerciseId === exerciseId && isPerformedTrainingSet(set)
  ).length;
}

function loadPressureEvidenceCount(input: TrainingRecommendationInput, set?: TrainingSetInput | null): number {
  const nowMs = Date.now();
  const targetFamily = set ? movementFamilyForSet(set) : null;
  return getHistorySets(input).filter((entry) => {
    const performedAt = timestampMs(entry.performedAt);
    if (!isPerformedHistorySet(entry, { requireLoad: true }) || performedAt === 0 || historyLoadScore(entry) == null) return false;
    if (daysBetween(nowMs, performedAt) > 35) return false;
    return targetFamily ? movementFamilyForHistory(entry) === targetFamily : true;
  }).length;
}

function maxEvidenceCount(input: TrainingRecommendationInput, exerciseId?: string | null): number {
  if (!exerciseId) return 0;
  const maxCount = (input.userMaxes ?? []).filter((entry) => entry.exerciseId === exerciseId && positiveNumber(entry.weight) != null).length;
  const prCount = (input.personalRecords ?? []).filter((entry) =>
    entry.exerciseId === exerciseId && (positiveNumber(entry.e1rm) != null || positiveNumber(entry.weight) != null)
  ).length;
  return maxCount + prCount;
}

function resolveSetEvidence(
  input: TrainingRecommendationInput,
  set: TrainingSetInput,
  base: BaseLoad,
  source: TrainingRecommendation['source'],
  hasExplicitPrescription: boolean,
): { evidenceSource: RecommendationEvidenceSource; evidenceCount: number; dataSufficiency: RecommendationDataSufficiency } {
  let evidenceSource: RecommendationEvidenceSource = 'baseline';
  let evidenceCount = 0;

  if (source === 'session_fatigue') {
    evidenceSource = 'current_session';
    evidenceCount = completedSessionSetCount(input, set.exerciseId);
  } else if (source === 'load_pressure') {
    evidenceSource = 'load_pressure';
    evidenceCount = loadPressureEvidenceCount(input, set);
  } else if (source === 'readiness') {
    evidenceSource = 'readiness';
    evidenceCount = finiteNumber(input.readiness?.score) != null ? 1 : 0;
  } else if (hasExplicitPrescription || base.basis === 'prescription') {
    evidenceSource = 'program_prescription';
    evidenceCount = Math.max(1, getDirectHistory(input, set.exerciseId).length);
  } else if (base.basis === 'direct_history') {
    evidenceSource = base.source === 'e1rm' ? 'max_e1rm' : 'direct_history';
    evidenceCount = getDirectHistory(input, set.exerciseId).length;
  } else if (base.basis === 'similar_history') {
    evidenceSource = 'similar_movement';
    evidenceCount = getSimilarHistory(input, set).length;
  } else if (base.basis === 'e1rm') {
    evidenceSource = 'max_e1rm';
    evidenceCount = maxEvidenceCount(input, set.exerciseId);
  } else if (base.basis === 'current_session') {
    evidenceSource = 'current_session';
    evidenceCount = completedSessionSetCount(input, set.exerciseId);
  }

  return {
    evidenceSource,
    evidenceCount,
    dataSufficiency: dataSufficiencyFromCount(evidenceCount),
  };
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
        confidence: effortCount >= 2 ? 'high' : 'medium',
        basis: 'direct_history',
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
      basis: 'e1rm',
    };
  }

  const similarEntry = getSimilarHistory(input, set)[0];
  const similarWeight = similarEntry ? representativeHistoryWeight(similarEntry, targetReps, unit) : null;
  if (similarWeight != null) {
    return {
      weight: similarWeight,
      unit,
      source: 'exercise_history',
      confidence: 'low',
      basis: 'similar_history',
    };
  }

  return {
    weight: null,
    unit,
    source: 'baseline',
    confidence: 'low',
    basis: 'none',
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
      basis: 'prescription',
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
      basis: 'prescription',
    };
  }

  return null;
}

function currentSessionLoad(input: TrainingRecommendationInput, set: TrainingSetInput, unit: WeightUnit): BaseLoad | null {
  const latestSessionSet = findRecentSessionSet(input, set.exerciseId);
  const rawWeight = positiveNumber(latestSessionSet?.weight);
  if (!latestSessionSet || rawWeight == null) return null;
  const sourceUnit = normalizeUnit(latestSessionSet.weightUnit, unit);
  const converted = sourceUnit === unit ? rawWeight : convertWeight(rawWeight, sourceUnit, unit);

  return {
    weight: roundSetWeight(converted, unit, set),
    unit,
    source: 'session_fatigue',
    confidence: 'high',
    basis: 'current_session',
  };
}

function resolveBaseLoad(input: TrainingRecommendationInput, set: TrainingSetInput, unit: WeightUnit): BaseLoad {
  const existing = positiveNumber(set.weight);
  if (!isLoadAdjustableSet(set)) {
    return {
      weight: existing != null ? roundRecommendationWeight(existing, unit) : null,
      unit,
      source: 'baseline',
      confidence: 'low',
      basis: existing != null ? 'current' : 'none',
    };
  }

  if (set.touchedWeight === true && existing != null) {
    return {
      weight: roundRecommendationWeight(existing, unit),
      unit,
      source: 'baseline',
      confidence: 'high',
      basis: 'current',
    };
  }

  if (set.touchedWeight !== true) {
    const currentSession = currentSessionLoad(input, set, unit);
    if (currentSession) return currentSession;
  }

  const history = latestHistoryLoad(input, set, unit);
  if (input.preferHistoryOverPrescription === true && history.weight != null && history.basis !== 'similar_history' && set.touchedWeight !== true) {
    return history;
  }

  const prescribed = prescriptionLoad(input, set, unit);
  if (prescribed) return prescribed;

  if (history.weight != null && history.basis !== 'similar_history' && set.touchedWeight !== true) {
    return history;
  }

  if (existing != null) {
    return {
      weight: roundRecommendationWeight(existing, unit),
      unit,
      source: 'baseline',
      confidence: history.weight != null ? history.confidence : getDirectHistory(input, set.exerciseId).length > 0 ? 'medium' : 'low',
      basis: 'current',
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

function isProgressionTarget(targetRpe: number | null): boolean {
  return targetRpe == null || targetRpe >= 7;
}

function fatigueModifier(input: TrainingRecommendationInput, set: TrainingSetInput): PerformanceSignal {
  const targetRpe = targetRpeForSet(set);
  const targetReps = targetRepsForSet(set);
  const latestSessionSet = findRecentSessionSet(input, set.exerciseId);
  const completedSessionSets = (input.sessionSets ?? [])
    .filter((entry) => entry.exerciseId === set.exerciseId && isPerformedTrainingSet(entry))
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
      const missedTarget = targetReps != null && reps != null && reps < targetReps;
      return {
        modifier: repeatedHard ? 0.875 : rpe != null && rpe >= 9.5 ? 0.9 : 0.95,
        restSeconds: repeatedHard ? 60 : 30,
        repDelta: missedTarget ? -1 : null,
        reason: repeatedHard
          ? 'Multiple sets for this lift ran over target effort. Pull load back and take more rest.'
          : rpe != null && targetRpe != null
            ? `Last set was ${rpe.toFixed(1)} RPE against a ${targetRpe.toFixed(1)} target.`
            : 'Last set missed the rep target. Pull load back before the next attempt.',
        source: 'session_fatigue',
        confidence: 'high',
      };
    }

    if (isProgressionTarget(targetRpe) && isEasyAttempt(rpe, reps, targetRpe, targetReps) && readinessModifier(input) >= 0.98) {
      return {
        modifier: 1.025,
        restSeconds: null,
        repDelta: 1,
        reason: `Last set landed under target effort at RPE ${rpe?.toFixed(1) ?? '--'}.`,
        source: 'session_fatigue',
        confidence: 'high',
      };
    }
  }

  const directHistoryAll = getDirectHistory(input, set.exerciseId);
  const directHistoryWithLoad = historyWithLoad(directHistoryAll);
  const directHistory = directHistoryWithLoad.length > 0
    ? directHistoryWithLoad
    : directHistoryAll.filter((entry) => historyReps(entry) != null);
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
  const trendValues = recentHistory
    .map((entry) => historyE1rmLbs(entry))
    .filter((value): value is number => value != null);
  const recentTrend = average(trendValues.slice(0, 2));
  const olderTrend = average(trendValues.slice(2, 6));

  if (
    recentTrend != null &&
    olderTrend != null &&
    olderTrend > 0 &&
    recentTrend <= olderTrend * 0.94 &&
    hardHistoryCount >= 1
  ) {
    return {
      modifier: 0.97,
      restSeconds: 30,
      reason: 'Recent estimated strength for this lift is trending down while effort is high. Hold the target and take extra rest.',
      source: 'performance_trend',
      confidence: historyConfidence,
    };
  }

  if (latest && isHardAttempt(latest.effort, latest.reps, targetRpe, targetReps)) {
    const repeatedHard = hardHistoryCount >= 2;
    const missedTarget = targetReps != null && latest.reps != null && latest.reps < targetReps;
    return {
      modifier: repeatedHard ? 0.95 : 0.975,
      restSeconds: repeatedHard ? 60 : 30,
      repDelta: missedTarget ? -1 : null,
      reason: repeatedHard
        ? 'Recent logged sets missed reps or ran hot against target effort.'
        : latest.effort != null && targetRpe != null
          ? `Last session overshot target effort at RPE ${latest.effort.toFixed(1)}.`
          : 'Last session missed the rep target.',
      source: 'exercise_history',
      confidence: historyConfidence,
    };
  }

  if (latest && isProgressionTarget(targetRpe) && isEasyAttempt(latest.effort, latest.reps, targetRpe, targetReps) && readinessModifier(input) >= 0.98) {
    return {
      modifier: easyHistoryCount >= 2 ? 1.05 : 1.025,
      restSeconds: null,
      repDelta: easyHistoryCount >= 2 ? 1 : null,
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
    repDelta: null,
    reason: null,
    source: null,
    confidence: null,
  };
}

function buildSetRecommendation(input: TrainingRecommendationInput, set: TrainingSetInput): TrainingRecommendation {
  const unit = normalizeUnit(set.weightUnit, input.weightUnit);
  const base = resolveBaseLoad(input, set, unit);
  const anchoredToCurrentSession = base.basis === 'current_session';
  const canAdjustSet = isLoadAdjustableSet(set);
  const canAdjustLoad = canAdjustSet && !isBodyweightOnlySet(set);
  const targetRpe = targetRpeForSet(set);
  const rawReadiness = readinessModifier(input);
  const readiness = canAdjustLoad
    ? anchoredToCurrentSession || !isProgressionTarget(targetRpe)
      ? Math.min(1, rawReadiness)
      : rawReadiness
    : 1;
  const fatigue = canAdjustSet ? fatigueModifier(input, set) : {
    modifier: 1,
    restSeconds: null,
    repDelta: null,
    reason: null,
    source: null,
    confidence: null,
  };
  const targetReps = targetRepsForSet(set);
  const hasExplicitPrescription = positiveNumber(set.prescribedWeight) != null || positiveNumber(set.prescribedPercentage) != null;
  const pressure = canAdjustLoad
    ? localLoadPressure(input, set)
    : {
      modifier: 1,
      ratio: null,
      reason: null,
      source: null,
      confidence: null,
    };
  const signalConfidence = fatigue.confidence ?? base.confidence;
  const confidence = lowerConfidence(signalConfidence, pressure.source ? pressure.confidence : null);
  const readinessScore = finiteNumber(input.readiness?.score);
  const hasManualReadiness = input.readiness?.source?.toLowerCase() === 'manual';
  const lowReadinessBlocksIncrease = hasManualReadiness && readinessScore != null && readinessScore < 70;
  const pressureModifier = anchoredToCurrentSession ? Math.min(1, pressure.modifier) : pressure.modifier;
  let combinedModifier = modifierCapForConfidence(
    readiness * fatigue.modifier * pressureModifier,
    confidence,
    hasExplicitPrescription
  );
  if (lowReadinessBlocksIncrease && combinedModifier > 1) {
    combinedModifier = 1;
  }
  const baseWeight = base.weight;
  const suggestedWeight = baseWeight != null && canAdjustLoad
    ? roundSetWeight(baseWeight * combinedModifier, unit, set)
    : canAdjustSet ? null : baseWeight;
  const currentWeight = positiveNumber(set.weight);
  const delta = baseWeight && suggestedWeight ? (suggestedWeight - baseWeight) / baseWeight : 0;
  const currentDelta = currentWeight && suggestedWeight ? (suggestedWeight - currentWeight) / currentWeight : delta;
  const actionDelta = Math.abs(delta) >= 0.018 ? delta : currentDelta;
  const repDelta = fatigue.repDelta ?? null;
  const shouldPreferRepAdjustment =
    repDelta != null &&
    targetReps != null &&
    (baseWeight == null || !canAdjustLoad || Math.abs(delta) < 0.018);
  const suggestedReps =
    shouldPreferRepAdjustment && targetReps != null
      ? Math.max(1, Math.min(50, targetReps + repDelta))
      : targetReps;
  const shouldApplyWeight =
    canAdjustLoad &&
    confidence !== 'low' &&
    set.touchedWeight !== true &&
    base.basis !== 'similar_history' &&
    suggestedWeight != null &&
    (currentWeight == null || Math.abs(suggestedWeight - currentWeight) >= recommendationWeightIncrement(unit, set));
  const shouldApplyReps =
    set.touchedReps !== true &&
    suggestedReps != null &&
    targetReps != null &&
    suggestedReps !== targetReps &&
    (shouldPreferRepAdjustment || !shouldApplyWeight);
  const shouldApplyRest = fatigue.restSeconds != null;
  const apply: TrainingRecommendationApplyPatch | undefined =
    shouldApplyWeight || shouldApplyReps || shouldApplyRest
      ? {
        blockId: set.blockId,
        exerciseId: set.exerciseId,
        setId: set.setId,
        ...(shouldApplyWeight ? { weight: suggestedWeight, weightUnit: unit } : {}),
        ...(shouldApplyReps ? { reps: suggestedReps } : {}),
        ...(shouldApplyWeight && targetReps != null && set.reps == null ? { reps: targetReps } : {}),
        ...(shouldApplyRest ? { restSeconds: fatigue.restSeconds } : {}),
      }
      : undefined;

  let action: RecommendationAction = 'maintain_load';
  if (actionDelta >= 0.018) action = 'increase_load';
  if (actionDelta <= -0.018) action = 'reduce_load';
  if (shouldApplyReps && Math.abs(delta) < 0.018) action = 'adjust_reps';
  if (baseWeight == null && targetReps != null) action = 'maintain_load';
  if (shouldApplyReps && (baseWeight == null || !canAdjustLoad)) action = 'adjust_reps';
  if (fatigue.restSeconds != null && Math.abs(delta) < 0.018 && !shouldApplyReps) action = 'add_rest';

  let severity: RecommendationSeverity = 'info';
  if (action === 'add_rest') severity = 'watch';
  if (action === 'increase_load' || action === 'reduce_load' || action === 'adjust_reps') severity = 'adjust';
  if (delta <= -0.08 || (hasManualReadiness && (finiteNumber(input.readiness?.score) ?? 100) <= 45) || (pressure.ratio ?? 0) >= 1.75) severity = 'deload';

  const source = fatigue.source ?? pressure.source ?? (readiness !== 1 && hasManualReadiness ? 'readiness' : base.source);
  const evidence = resolveSetEvidence(input, set, base, source, hasExplicitPrescription);
  const confidenceReason = buildConfidenceReason(
    confidence,
    evidence.evidenceSource,
    evidence.evidenceCount,
    evidence.dataSufficiency
  );
  const blockedReason =
    set.touchedWeight === true && canAdjustLoad && suggestedWeight != null && currentWeight != null && suggestedWeight !== currentWeight
      ? 'Load was edited manually, so Iron Brain will not overwrite it.'
      : set.touchedReps === true && shouldPreferRepAdjustment
        ? 'Reps were edited manually, so Iron Brain will not overwrite them.'
        : base.basis === 'similar_history' && suggestedWeight != null
          ? 'Similar-movement load is read-only until direct history exists.'
          : lowReadinessBlocksIncrease && readiness * fatigue.modifier * pressureModifier > 1
            ? 'Low readiness blocks load increases today.'
            : undefined;
  const reasons: string[] = [];

  if (!canAdjustSet) {
    reasons.push('Warm-up sets stay as written.');
  } else {
    if (!canAdjustLoad) {
      reasons.push('Bodyweight sets stay focused on reps and effort.');
    } else if (baseWeight == null) {
      reasons.push('No direct load history yet, so this stays conservative.');
    } else if (hasExplicitPrescription && suggestedWeight != null && Math.abs(suggestedWeight - baseWeight) > 0) {
      reasons.push(`Prescription stays ${formatWeight(baseWeight, unit)}; apply ${formatWeight(suggestedWeight, unit)} only if this set feels right.`);
    }

    if (fatigue.reason) {
      reasons.push(fatigue.reason);
    }

    if (pressure.reason) {
      reasons.push(pressure.reason);
    }

    if (readinessScore != null && readiness !== 1) {
      reasons.push(`Readiness is ${Math.round(readinessScore)}, so load is nudged ${readiness < 1 ? 'down' : 'up'}.`);
    }

    if (lowReadinessBlocksIncrease && readiness * fatigue.modifier * pressureModifier > 1) {
      reasons.push('Readiness is below 70, so load increases are blocked today.');
    }

    if (shouldApplyReps && suggestedReps != null && targetReps != null) {
      reasons.push(`Rep target moves from ${targetReps} to ${suggestedReps}.`);
    }

    if (reasons.length === 0) {
      if (base.source === 'exercise_history') {
        reasons.push(base.basis === 'similar_history'
          ? 'No direct history yet; using similar movement history as a low-confidence starting point.'
          : 'Based on recent completed sets for this exercise.');
      } else if (base.source === 'e1rm') {
        reasons.push('Estimated from max strength data and target reps.');
      } else if (base.source === 'prescription') {
        reasons.push('Using the program prescription as the base target.');
      } else if (base.basis === 'current_session') {
        reasons.push('Anchored to the set you just logged for this exercise.');
      } else if (base.source === 'baseline' && set.touchedWeight === true) {
        reasons.push('Using your edited load as the base target.');
      } else {
        reasons.push('Establish today’s baseline and adjust after the set.');
      }
    }
  }

  if (fatigue.restSeconds != null && !reasons.some((reason) => /rest/i.test(reason))) {
    reasons.push(`Add ${fatigue.restSeconds}s before the next attempt.`);
  }

  const title =
    action === 'increase_load'
      ? 'Nudge Load Up'
      : action === 'reduce_load'
        ? 'Pull Load Back'
        : action === 'adjust_reps'
          ? suggestedReps != null && targetReps != null && suggestedReps > targetReps ? 'Add Reps' : 'Trim Reps'
          : action === 'add_rest'
            ? 'Add Rest'
            : baseWeight == null
              ? 'Establish Baseline'
              : 'Hold Target';

  return {
    id: stableId(['smart-target', set.exerciseId, set.setId, action, suggestedWeight, suggestedReps]),
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
      reps: suggestedReps,
      restSeconds: fatigue.restSeconds,
      prescribedWeight: positiveNumber(set.prescribedWeight),
      prescribedPercentage: positiveNumber(set.prescribedPercentage),
    },
    apply,
    evidenceSource: evidence.evidenceSource,
    evidenceCount: evidence.evidenceCount,
    dataSufficiency: evidence.dataSufficiency,
    confidenceReason,
    blockedReason,
    source,
  };
}

function buildSessionRecommendation(input: TrainingRecommendationInput): TrainingRecommendation | null {
  const completed = (input.sessionSets ?? []).filter((set) => isPerformedTrainingSet(set));
  if (completed.length < 3) return null;

  const rpes = completed.map((set) => finiteNumber(set.rpe)).filter((value): value is number => value != null);
  const avgRpe = rpes.length > 0 ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length : null;
  const targetGaps = completed
    .map((set) => {
      const effort = sessionEffort(set);
      const target = targetRpeForSet(set);
      return effort != null && target != null ? effort - target : null;
    })
    .filter((value): value is number => value != null);
  const avgTargetGap = average(targetGaps);
  const readinessScore = finiteNumber(input.readiness?.score);
  const hasManualReadiness = input.readiness?.source?.toLowerCase() === 'manual';
  const pressure = globalLoadPressure(getHistorySets(input).filter((set) => isPerformedHistorySet(set)));

  if (
    (avgRpe != null && avgRpe >= 9) ||
    (avgTargetGap != null && avgTargetGap >= 0.75) ||
    (hasManualReadiness && readinessScore != null && readinessScore <= 50) ||
    (pressure.source === 'load_pressure' && pressure.confidence !== 'low')
  ) {
    const source: TrainingRecommendation['source'] =
      pressure.source ?? (avgRpe != null || avgTargetGap != null ? 'session_fatigue' : 'readiness');
    const evidenceSource: RecommendationEvidenceSource =
      source === 'load_pressure' ? 'load_pressure' : source === 'readiness' ? 'readiness' : 'current_session';
    const evidenceCount = source === 'load_pressure' ? loadPressureEvidenceCount(input) : completed.length;
    const dataSufficiency = dataSufficiencyFromCount(evidenceCount);
    const confidence: RecommendationConfidence =
      pressure.confidence ?? (targetGaps.length >= 3 || avgRpe != null ? 'high' : 'medium');
    const reason = avgTargetGap != null && avgTargetGap >= 0.75
      ? `Session effort averaged ${avgTargetGap.toFixed(1)} RPE above target. Keep the next work conservative.`
      : pressure.source === 'load_pressure' && pressure.reason
        ? `${pressure.reason} Keep the next work conservative.`
        : avgRpe != null
          ? `Average effort is ${avgRpe.toFixed(1)} RPE. Keep the next work conservative.`
          : `Readiness is ${Math.round(readinessScore ?? 0)}. Keep the next work conservative.`;
    return {
      id: stableId(['session', 'trim', completed.length, Math.round(avgRpe ?? 0), Math.round(readinessScore ?? 0)]),
      scope: 'session',
      action: hasManualReadiness && readinessScore != null && readinessScore <= 45 ? 'deload' : 'trim_volume',
      severity: hasManualReadiness && readinessScore != null && readinessScore <= 45 ? 'deload' : 'adjust',
      confidence,
      title: hasManualReadiness && readinessScore != null && readinessScore <= 45 ? 'Consider Deload' : 'Trim If Needed',
      reason,
      source,
      evidenceSource,
      evidenceCount,
      dataSufficiency,
      confidenceReason: buildConfidenceReason(confidence, evidenceSource, evidenceCount, dataSufficiency),
      apply: { setCountDelta: -1 },
    };
  }

  if (
    avgRpe != null &&
    avgRpe <= 7 &&
    (avgTargetGap == null || avgTargetGap <= -0.75) &&
    completed.length >= 5 &&
    readinessModifier(input) >= 0.98 &&
    (pressure.ratio == null || pressure.ratio <= 1.25)
  ) {
    const evidenceCount = completed.length;
    const dataSufficiency = dataSufficiencyFromCount(evidenceCount);
    const confidence: RecommendationConfidence = targetGaps.length >= 3 ? 'high' : 'medium';
    return {
      id: stableId(['session', 'progress', completed.length, Math.round(avgRpe * 10)]),
      scope: 'session',
      action: 'add_volume',
      severity: 'info',
      confidence,
      title: 'Progress Next Time',
      reason: avgTargetGap != null
        ? `Session landed ${Math.abs(avgTargetGap).toFixed(1)} RPE under target. A small next-session progression is reasonable.`
        : `Session effort averaged ${avgRpe.toFixed(1)} RPE. A small next-session progression is reasonable.`,
      source: 'session_fatigue',
      evidenceSource: 'current_session',
      evidenceCount,
      dataSufficiency,
      confidenceReason: buildConfidenceReason(confidence, 'current_session', evidenceCount, dataSufficiency),
      apply: { setCountDelta: 1 },
    };
  }

  return null;
}

export function buildProgramTuneUpRecommendation(input: TrainingRecommendationInput): TrainingRecommendation | null {
  if (!input.program) return null;

  const nowMs = Date.now();
  const history = getHistorySets(input)
    .filter((set) => isPerformedHistorySet(set))
    .sort((a, b) => timestampMs(b.performedAt) - timestampMs(a.performedAt));
  const recentHistory = history.filter((set) => {
    const performedAt = timestampMs(set.performedAt);
    return performedAt === 0 || daysBetween(nowMs, performedAt) <= 21;
  });
  const effortHistory = recentHistory.filter((set) => historyEffort(set) != null);
  const rpes = effortHistory.map((set) => historyEffort(set)).filter((value): value is number => value != null);
  const avgRpe = average(rpes);
  const targetedSets = recentHistory
    .map((set) => {
      const targetReps = prescribedRepsTarget(set.prescribedReps);
      const actualReps = historyReps(set);
      const targetRpe = set.prescribedRPE ?? (set.prescribedRIR != null ? 10 - set.prescribedRIR : null);
      const effort = historyEffort(set);
      return { targetReps, actualReps, targetRpe, effort };
    })
    .filter((set) => set.targetReps != null && set.actualReps != null);
  const missedRate = targetedSets.length > 0
    ? targetedSets.filter((set) => (set.actualReps ?? 0) < (set.targetReps ?? 0)).length / targetedSets.length
    : 0;
  const easyRate = targetedSets.length > 0
    ? targetedSets.filter((set) =>
      set.targetRpe != null &&
      set.effort != null &&
      (set.actualReps ?? 0) >= (set.targetReps ?? 0) &&
      set.effort <= set.targetRpe - 0.75
    ).length / targetedSets.length
    : 0;
  const readinessScore = finiteNumber(input.readiness?.score);
  const hasManualReadiness = input.readiness?.source?.toLowerCase() === 'manual';
  const pressure = globalLoadPressure(history);
  const programId = input.program.id;
  const lowReadiness = hasManualReadiness && readinessScore != null && readinessScore <= 52;
  const highEffort = rpes.length >= 4 && avgRpe != null && avgRpe >= 8.8;
  const missedEnough = targetedSets.length >= 6 && missedRate >= 0.25;
  const spiking = pressure.source === 'load_pressure' && pressure.confidence !== 'low';

  if (lowReadiness || highEffort || missedEnough || spiking) {
    const reasonParts = [
      highEffort && avgRpe != null ? `Recent work is averaging ${avgRpe.toFixed(1)} RPE` : null,
      missedEnough ? `${Math.round(missedRate * 100)}% of targeted sets missed reps` : null,
      spiking ? pressure.reason : null,
      lowReadiness ? `readiness is ${Math.round(readinessScore ?? 0)}` : null,
    ].filter(Boolean);
    const shouldDeload = (hasManualReadiness && readinessScore != null && readinessScore <= 45) || (spiking && (pressure.ratio ?? 0) >= 1.75);
    const source: TrainingRecommendation['source'] = spiking ? 'load_pressure' : highEffort || missedEnough ? 'program_load' : 'readiness';
    const evidenceSource: RecommendationEvidenceSource =
      source === 'load_pressure' ? 'load_pressure' : source === 'readiness' ? 'readiness' : 'program_trend';
    const evidenceCount = source === 'readiness'
      ? 1
      : source === 'load_pressure'
        ? loadPressureEvidenceCount(input)
        : Math.max(rpes.length, targetedSets.length);
    const dataSufficiency = dataSufficiencyFromCount(evidenceCount);
    const confidence: RecommendationConfidence =
      pressure.confidence ?? (rpes.length >= 8 || targetedSets.length >= 8 || readinessScore != null ? 'medium' : 'low');

    return {
      id: stableId(['program', programId, 'deload', Math.round(readinessScore ?? 0), Math.round((avgRpe ?? 0) * 10)]),
      scope: 'program',
      action: shouldDeload ? 'deload' : 'trim_volume',
      severity: shouldDeload ? 'deload' : 'adjust',
      confidence,
      title: shouldDeload ? 'Stage Deload Review' : 'Stage Easier Targets',
      reason: `${reasonParts.join('; ')}. Review a lighter next-week setup before saving.`,
      source,
      evidenceSource,
      evidenceCount,
      dataSufficiency,
      confidenceReason: buildConfidenceReason(confidence, evidenceSource, evidenceCount, dataSufficiency),
      apply: { setCountDelta: -1 },
    };
  }

  if (
    rpes.length >= 8 &&
    avgRpe != null &&
    avgRpe <= 7.2 &&
    missedRate <= 0.1 &&
    easyRate >= 0.3 &&
    readinessModifier(input) >= 0.98 &&
    (pressure.ratio == null || pressure.ratio <= 1.25)
  ) {
    const evidenceCount = Math.max(rpes.length, targetedSets.length);
    const dataSufficiency = dataSufficiencyFromCount(evidenceCount);
    return {
      id: stableId(['program', programId, 'increase', Math.round(avgRpe * 10)]),
      scope: 'program',
      action: 'increase_load',
      severity: 'info',
      confidence: 'medium',
      title: 'Stage Small Progression',
      reason: `Recent work is averaging ${avgRpe.toFixed(1)} RPE with reps hit cleanly. Review a small next-week load bump.`,
      source: 'program_load',
      evidenceSource: 'program_trend',
      evidenceCount,
      dataSufficiency,
      confidenceReason: buildConfidenceReason('medium', 'program_trend', evidenceCount, dataSufficiency),
      apply: {},
    };
  }

  const holdEvidenceCount = recentHistory.length;
  const holdDataSufficiency = dataSufficiencyFromCount(holdEvidenceCount);
  const holdConfidence: RecommendationConfidence = recentHistory.length >= 4 ? 'medium' : 'low';
  return {
    id: stableId(['program', programId, 'hold']),
    scope: 'program',
    action: 'hold_program',
    severity: 'info',
    confidence: holdConfidence,
    title: 'Hold Program',
    reason: recentHistory.length >= 4
      ? 'Recent work does not justify changing the plan yet.'
      : 'Not enough recent logged work to tune the plan safely.',
    source: 'baseline',
    evidenceSource: recentHistory.length >= 4 ? 'program_trend' : 'baseline',
    evidenceCount: holdEvidenceCount,
    dataSufficiency: holdDataSufficiency,
    confidenceReason: buildConfidenceReason(
      holdConfidence,
      recentHistory.length >= 4 ? 'program_trend' : 'baseline',
      holdEvidenceCount,
      holdDataSufficiency
    ),
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
  if (next.setType === 'warmup') return next;

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
