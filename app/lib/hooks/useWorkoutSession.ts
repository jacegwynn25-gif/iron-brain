import { useCallback, useMemo, useReducer } from 'react';
import type { ProgramTemplate, SetTemplate, WeightUnit } from '../types';
import { KG_TO_LBS } from '../units';
import type {
  ActiveCell,
  Block,
  Exercise,
  SessionState,
  Set as SessionSet,
  SetType,
} from '../types/session';

type SetRef = {
  blockId: string;
  exerciseId: string;
  setId: string;
};

export type ReadinessLoadModifiers = {
  overall: number;
  upperBody: number;
  lowerBody: number;
};

type UpdateSetPayload = Partial<Pick<SessionSet, 'weight' | 'weightUnit' | 'reps' | 'rpe' | 'type' | 'notes'>>;

export interface UseWorkoutSessionOptions {
  resolveExerciseName?: (exerciseId: string) => string;
  initialState?: SessionState;
  readinessLoadModifiers?: ReadinessLoadModifiers;
}

type WorkoutSessionAction =
  | {
    type: 'INITIALIZE_SESSION';
	    payload: {
	      program: ProgramTemplate;
	      readinessModifier: number;
	      resolveExerciseName?: (exerciseId: string) => string;
	      readinessLoadModifiers?: ReadinessLoadModifiers;
	    };
	  }
  | {
    type: 'UPDATE_SET';
    payload: {
      blockId: string;
      exerciseId: string;
      setId: string;
      updates: UpdateSetPayload;
    };
  }
  | {
    type: 'HYDRATE_SESSION';
    payload: SessionState;
  }
  | {
    type: 'TOGGLE_COMPLETE';
    payload: {
      blockId: string;
      exerciseId: string;
      setId: string;
    };
  }
  | {
    type: 'ADD_SET';
    payload: {
      blockId: string;
      exerciseId: string;
    };
  }
  | {
    type: 'INSERT_WARMUP_SETS';
    payload: {
      blockId: string;
      exerciseId: string;
      beforeSetId: string;
      warmups: Array<{
        weight: number;
        reps: number;
        weightUnit: WeightUnit;
      }>;
    };
  }
  | {
    type: 'SKIP_SET';
    payload: {
      blockId: string;
      exerciseId: string;
      setId: string;
    };
  }
  | {
    type: 'ADD_EXERCISE';
    payload: {
      name: string;
      exerciseId?: string;
      setCount?: number;
    };
  }
  | {
    type: 'REMOVE_EXERCISE';
    payload: {
      blockId: string;
      exerciseId: string;
    };
  }
  | {
    type: 'REMOVE_SET';
    payload: {
      blockId: string;
      exerciseId: string;
      setId: string;
    };
  }
  | {
    type: 'UPDATE_NOTE';
    payload: {
      blockId: string;
      exerciseId: string;
      notes: string;
    };
  }
  | {
    type: 'SET_ACTIVE_CELL';
    payload: ActiveCell | null;
  }
  | {
    type: 'FINISH_SESSION';
  };

interface SessionPayload {
  status: 'finished';
  startTime: string;
  endTime: string;
  blocks: Block[];
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const LBS_INCREMENT = 5;
const KG_INCREMENT = 0.25;
const DEFAULT_QUICK_START_TARGET_RPE = 8;

function roundToIncrement(value: number, unit: WeightUnit): number {
  const increment = unit === 'kg' ? KG_INCREMENT : LBS_INCREMENT;
  return Math.round(value / increment) * increment;
}

function clampRpe(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.min(10, Math.max(1, value));
}

function clampRir(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.min(10, Math.max(0, value));
}

function positiveTarget(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return value;
}

function normalizeReadinessModifiers(
  readinessModifier: number,
  modifiers?: ReadinessLoadModifiers
): ReadinessLoadModifiers {
  return {
    overall: modifiers?.overall ?? readinessModifier,
    upperBody: modifiers?.upperBody ?? modifiers?.overall ?? readinessModifier,
    lowerBody: modifiers?.lowerBody ?? modifiers?.overall ?? readinessModifier,
  };
}

function getExerciseReadinessModifier(exerciseName: string, modifiers: ReadinessLoadModifiers): number {
  const lowerName = exerciseName.toLowerCase();
  if (/\b(squat|deadlift|rdl|lunge|leg|quad|hamstring|glute|calf|hip|hinge)\b/.test(lowerName)) {
    return modifiers.lowerBody;
  }
  if (/\b(bench|press|row|pull|chin|lat|chest|back|shoulder|delt|bicep|tricep|arm|curl|extension|fly|raise)\b/.test(lowerName)) {
    return modifiers.upperBody;
  }
  return modifiers.overall;
}

function shouldAutoAdjustLoad(setType: SetType): boolean {
  return setType === 'working' || setType === 'failure' || setType === 'drop';
}

function getE1rmLbsForExercise(exerciseId: string): number | null {
  const prs = storage.getPersonalRecords(exerciseId);
  const e1rm = prs?.maxE1RM?.e1rm;
  return e1rm && e1rm > 0 ? e1rm : null;
}

function estimatePercentageWeight(
  templateSet: SetTemplate,
  exerciseId: string,
  weightUnit: WeightUnit
): number | null {
  const percentage = positiveTarget(templateSet.targetPercentage ?? null);
  if (percentage == null) return null;

  const e1rmLbs = getE1rmLbsForExercise(exerciseId);
  if (e1rmLbs == null) return null;

  const baseMaxLbs = templateSet.prescriptionMethod === 'percentage_tm'
    ? e1rmLbs * 0.9
    : e1rmLbs;
  const prescribedLbs = baseMaxLbs * (percentage / 100);
  const prescribed = weightUnit === 'kg' ? prescribedLbs / KG_TO_LBS : prescribedLbs;
  return roundToIncrement(prescribed, weightUnit);
}

function resolvePrescribedWeight(
  templateSet: SetTemplate,
  exerciseId: string,
  weightUnit: WeightUnit
): number | null {
  if (templateSet.prescriptionMethod === 'fixed_weight') {
    return positiveTarget(templateSet.fixedWeight ?? null);
  }
  if (
    templateSet.prescriptionMethod === 'percentage_1rm' ||
    templateSet.prescriptionMethod === 'percentage_tm'
  ) {
    return estimatePercentageWeight(templateSet, exerciseId, weightUnit);
  }
  return null;
}

function parseTempoCue(templateSet: SetTemplate): string | null {
  if (templateSet.tempo?.trim()) return templateSet.tempo.trim();
  const note = templateSet.notes?.trim();
  if (!note) return null;
  const match = note.match(/\b(\d+)\s*-\s*(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?\b/);
  if (!match) return null;
  const topPause = match[4] ?? '0';
  return `${match[1]}-${match[2]}-${match[3]}-${topPause}`;
}

function parseClusterConfig(templateSet: SetTemplate): SessionSet['cluster'] {
  const reps = templateSet.clusterReps?.filter((entry) => Number.isFinite(entry) && entry > 0) ?? [];
  if (reps.length === 0 && templateSet.setType !== 'cluster') return null;
  const safeReps = reps.length > 0 ? reps : [2, 2, 2];
  const restSeconds = templateSet.clusterRestSeconds && templateSet.clusterRestSeconds > 0
    ? templateSet.clusterRestSeconds
    : 20;
  return { reps: safeReps, restSeconds };
}

function parseRepsTarget(prescribedReps: string | undefined): number | null {
  if (!prescribedReps) return null;

  const matches = prescribedReps.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const parsed = Number(matches[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapTemplateSetType(templateSet: SetTemplate): SetType {
  if (templateSet.setType === 'warmup') return 'warmup';
  if (templateSet.setType === 'drop') return 'drop';
  if (templateSet.setType === 'amrap') return 'failure';
  return 'working';
}

function isSupersetTemplateSet(templateSet: SetTemplate): boolean {
  return (
    templateSet.setType === 'superset' ||
    templateSet.setType === 'giant' ||
    Boolean(templateSet.supersetGroup)
  );
}

function getBlockIdentity(templateSet: SetTemplate): { key: string; type: 'single' | 'superset' } {
  if (isSupersetTemplateSet(templateSet)) {
    return {
      key: `superset:${templateSet.supersetGroup ?? `inline-${templateSet.setIndex}`}`,
      type: 'superset',
    };
  }

  return {
    key: `single:${templateSet.exerciseId}`,
    type: 'single',
  };
}

import { storage } from '../storage';

type ExerciseHistoryCue = {
  weight: number | null;
  note: string | null;
};

function getLastCueForExercise(
  historyMap: Map<string, ExerciseHistoryCue>,
  exerciseId: string,
  unit: WeightUnit,
  targetReps?: number | null
): ExerciseHistoryCue {
  if (!historyMap.has(exerciseId)) {
    // Try to get actual history for this exercise
    const lastWorkout = storage.getLastWorkoutForExercise(exerciseId);
    const previousNote = lastWorkout?.bestSet.notes?.trim() || null;

    if (lastWorkout && lastWorkout.bestSet && lastWorkout.bestSet.actualWeight != null) {
      const bestSet = lastWorkout.bestSet;
      const actualWeight = Number(bestSet.actualWeight);
      const recordedUnit = bestSet.weightUnit ?? 'lbs';

      // Convert if necessary to match the requested unit
      let convertedWeight = actualWeight;
      if (unit !== recordedUnit) {
        convertedWeight = unit === 'lbs'
          ? actualWeight * KG_TO_LBS
          : actualWeight / KG_TO_LBS;
      }
      historyMap.set(exerciseId, {
        weight: roundToIncrement(convertedWeight, unit),
        note: previousNote,
      });
    } else {
      // No recent history — check for 1RM data
      const prs = storage.getPersonalRecords(exerciseId);
      if (prs && prs.maxE1RM && prs.maxE1RM.e1rm > 0) {
        // We have an estimated 1RM. Use it to suggest weight for targetReps.
        // Default to 8 reps if not specified.
        const reps = targetReps ?? 8;
        const e1rm = prs.maxE1RM.e1rm; // e1rm is stored in lbs in the PR object

        const suggestedWeightLbs = e1rm / (1 + reps / 30); // Reverse Epley

        // Convert to requested unit
        const suggestedWeight = unit === 'kg' ? suggestedWeightLbs / KG_TO_LBS : suggestedWeightLbs;

        const rounded = roundToIncrement(suggestedWeight, unit);
        historyMap.set(exerciseId, { weight: rounded, note: previousNote });
      } else {
        // Truly no data
        historyMap.set(exerciseId, { weight: null, note: previousNote });
      }
    }
  }
  return historyMap.get(exerciseId) ?? { weight: null, note: null };
}

function buildSessionSetFromTemplate(
  templateSet: SetTemplate,
  historyCue: ExerciseHistoryCue,
  readinessModifier: number,
  weightUnit: WeightUnit,
  exerciseId: string,
  defaults?: {
    supersetGroup?: string | null;
  }
): SessionSet {
  const cluster = parseClusterConfig(templateSet);
  const repsTarget = parseRepsTarget(templateSet.prescribedReps);
  const mappedSetType = mapTemplateSetType(templateSet);
  const effectiveReps = cluster && cluster.reps.length > 0 ? cluster.reps[0] : repsTarget;
  const prescriptionMethod = templateSet.prescriptionMethod ?? 'rpe';
  const prescribedRPE = prescriptionMethod === 'rpe' ? clampRpe(templateSet.targetRPE ?? null) : null;
  const prescribedRIR = prescriptionMethod === 'rir' ? clampRir(templateSet.targetRIR ?? null) : null;
  const prescribedPercentage =
    prescriptionMethod === 'percentage_1rm' || prescriptionMethod === 'percentage_tm'
      ? positiveTarget(templateSet.targetPercentage ?? null)
      : null;
  const prescribedWeight = resolvePrescribedWeight(templateSet, exerciseId, weightUnit);
  const prescribedSeconds =
    prescriptionMethod === 'time_based' ? positiveTarget(templateSet.targetSeconds ?? null) : null;

  const baseWeight = prescribedWeight ?? historyCue.weight;
  const shouldAdjust = shouldAutoAdjustLoad(mappedSetType);
  const computedWeight = baseWeight != null && shouldAdjust
    ? roundToIncrement(baseWeight * readinessModifier, weightUnit)
    : prescribedWeight;

  return {
    id: createId('set'),
    type: mappedSetType,
    weight: computedWeight,
    weightUnit,
    reps: effectiveReps,
    rpe: prescribedRPE,
    prescribedRPE,
    prescribedRIR,
    prescribedPercentage,
    prescribedWeight,
    prescribedSeconds,
    touchedWeight: false,
    touchedReps: false,
    touchedRpe: false,
    tempo: parseTempoCue(templateSet),
    supersetGroup: templateSet.supersetGroup ?? defaults?.supersetGroup ?? null,
    cluster,
    completed: false,
    previous: historyCue.weight != null ? `${historyCue.weight}${weightUnit} x ${effectiveReps ?? 8}` : null,
    previousNote: historyCue.note,
    notes: '',
  };
}

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
    })),
  }));
}

function buildTraversalOrder(blocks: Block[]): SetRef[] {
  const order: SetRef[] = [];

  for (const block of blocks) {
    if (block.type === 'superset') {
      const exercises = [...block.exercises].sort((a, b) => {
        const rankA = a.slot === 'A1' ? 0 : a.slot === 'A2' ? 1 : 9;
        const rankB = b.slot === 'A1' ? 0 : b.slot === 'A2' ? 1 : 9;
        return rankA - rankB;
      });
      const maxSets = exercises.reduce((max, exercise) => Math.max(max, exercise.sets.length), 0);

      for (let round = 0; round < maxSets; round += 1) {
        for (const exercise of exercises) {
          const set = exercise.sets[round];
          if (!set) continue;

          order.push({
            blockId: block.id,
            exerciseId: exercise.id,
            setId: set.id,
          });
        }
      }

      continue;
    }

    for (const exercise of block.exercises) {
      for (const set of exercise.sets) {
        order.push({
          blockId: block.id,
          exerciseId: exercise.id,
          setId: set.id,
        });
      }
    }
  }

  return order;
}

function findSetLocation(blocks: Block[], ref: SetRef): {
  blockIndex: number;
  exerciseIndex: number;
  setIndex: number;
} | null {
  const blockIndex = blocks.findIndex((block) => block.id === ref.blockId);
  if (blockIndex === -1) return null;

  const exerciseIndex = blocks[blockIndex].exercises.findIndex((exercise) => exercise.id === ref.exerciseId);
  if (exerciseIndex === -1) return null;

  const setIndex = blocks[blockIndex].exercises[exerciseIndex].sets.findIndex((set) => set.id === ref.setId);
  if (setIndex === -1) return null;

  return { blockIndex, exerciseIndex, setIndex };
}

function getSetByRef(blocks: Block[], ref: SetRef): SessionSet | null {
  const location = findSetLocation(blocks, ref);
  if (!location) return null;
  return blocks[location.blockIndex].exercises[location.exerciseIndex].sets[location.setIndex] ?? null;
}

function toActiveCell(ref: SetRef, field: ActiveCell['field'] = 'weight'): ActiveCell {
  return {
    blockId: ref.blockId,
    exerciseId: ref.exerciseId,
    setId: ref.setId,
    field,
  };
}

function findFirstSetRef(blocks: Block[]): SetRef | null {
  const order = buildTraversalOrder(blocks);
  return order[0] ?? null;
}

function hasCompletedOrTouchedSets(blocks: Block[]): boolean {
  return blocks.some((block) =>
    block.exercises.some((exercise) =>
      exercise.sets.some((set) => set.completed || set.touchedWeight || set.touchedReps || set.touchedRpe)
    )
  );
}

function hasUserSessionEdits(state: SessionState): boolean {
  return Boolean(state.structureDirty) || hasCompletedOrTouchedSets(state.blocks);
}

function findFirstIncompleteSetRef(blocks: Block[]): SetRef | null {
  const order = buildTraversalOrder(blocks);
  for (const ref of order) {
    const set = getSetByRef(blocks, ref);
    if (set && !set.completed) {
      return ref;
    }
  }

  return null;
}

function findNextIncompleteSetRef(blocks: Block[], current: SetRef): SetRef | null {
  const order = buildTraversalOrder(blocks);
  const currentIndex = order.findIndex(
    (ref) =>
      ref.blockId === current.blockId &&
      ref.exerciseId === current.exerciseId &&
      ref.setId === current.setId
  );

  if (currentIndex === -1) return findFirstIncompleteSetRef(blocks);

  for (let index = currentIndex + 1; index < order.length; index += 1) {
    const candidate = order[index];
    const set = getSetByRef(blocks, candidate);

    if (set && !set.completed) {
      return candidate;
    }
  }

  return null;
}

function buildBlocksFromProgram(
  program: ProgramTemplate,
  readinessModifier: number,
  weightUnit: WeightUnit,
  resolveExerciseName: (exerciseId: string) => string,
  readinessLoadModifiers?: ReadinessLoadModifiers
): Block[] {
  const sortedWeeks = [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const day = sortedWeeks[0]?.days[0];
  if (!day) return [];

  const mockHistoryByExercise = new Map<string, ExerciseHistoryCue>();
  const loadModifiers = normalizeReadinessModifiers(readinessModifier, readinessLoadModifiers);

  if (Array.isArray(day.blocks) && day.blocks.length > 0) {
    const blocksFromSchema: Block[] = [];

    for (const templateBlock of day.blocks) {
      const templateExercises =
        templateBlock.type === 'superset'
          ? [...(templateBlock.exercises ?? [])].sort((a, b) => {
            const rankA = a.slot === 'A1' ? 0 : a.slot === 'A2' ? 1 : 9;
            const rankB = b.slot === 'A1' ? 0 : b.slot === 'A2' ? 1 : 9;
            return rankA - rankB;
          })
          : templateBlock.exercises ?? [];
      const sessionBlock: Block = {
        id: createId('block'),
        type: templateBlock.type === 'superset' ? 'superset' : 'single',
        rounds: templateBlock.rounds ?? null,
        transitionSeconds: templateBlock.transitionSeconds ?? null,
        restAfterRoundSeconds: templateBlock.restAfterRoundSeconds ?? null,
        exercises: [],
      };

      for (const templateExercise of templateExercises) {
        const exerciseId = templateExercise.exerciseId || createId('exercise');
        const exerciseName = resolveExerciseName(exerciseId);
        const exerciseReadinessModifier = getExerciseReadinessModifier(exerciseName, loadModifiers);
        const firstSetReps = parseRepsTarget(templateExercise.sets?.[0]?.prescribedReps);
        const historyCue = getLastCueForExercise(mockHistoryByExercise, exerciseId, weightUnit, firstSetReps);
        const setsForExercise = (templateExercise.sets ?? []).map((templateSet) =>
          buildSessionSetFromTemplate(
            templateSet,
            historyCue,
            exerciseReadinessModifier,
            weightUnit,
            exerciseId,
            templateBlock.type === 'superset'
              ? {
                supersetGroup: templateSet.supersetGroup ?? templateBlock.id,
              }
              : undefined
          )
        );

        if (setsForExercise.length === 0) continue;

        sessionBlock.exercises.push({
          id: exerciseId,
          name: exerciseName,
          slot: templateExercise.slot,
          notes: templateExercise.notes ?? '',
          historyNote: historyCue.weight != null ? `Last session: ${historyCue.weight}${weightUnit} x ${setsForExercise[0]?.reps ?? 8}` : null,
          sets: setsForExercise,
        });
      }

      if (sessionBlock.exercises.length > 0) {
        blocksFromSchema.push(sessionBlock);
      }
    }

    if (blocksFromSchema.length > 0) {
      return blocksFromSchema;
    }
  }

  const blocks: Block[] = [];
  const blockIndexByKey = new Map<string, number>();

  for (const templateSet of day.sets) {
    const exerciseId = templateSet.exerciseId || createId('exercise');
    const exerciseName = resolveExerciseName(exerciseId);
    const exerciseReadinessModifier = getExerciseReadinessModifier(exerciseName, loadModifiers);
    const targetReps = parseRepsTarget(templateSet.prescribedReps);
    const historyCue = getLastCueForExercise(mockHistoryByExercise, exerciseId, weightUnit, targetReps);
    const sessionSet = buildSessionSetFromTemplate(templateSet, historyCue, exerciseReadinessModifier, weightUnit, exerciseId);
    const repsTarget = sessionSet.reps;

    const blockIdentity = getBlockIdentity(templateSet);
    const existingBlockIndex = blockIndexByKey.get(blockIdentity.key);

    let block: Block;
    if (existingBlockIndex == null) {
      block = {
        id: createId('block'),
        type: blockIdentity.type,
        exercises: [],
      };
      blockIndexByKey.set(blockIdentity.key, blocks.length);
      blocks.push(block);
    } else {
      block = blocks[existingBlockIndex];
    }

    let exercise = block.exercises.find((entry) => entry.id === exerciseId);
    if (!exercise) {
      exercise = {
        id: exerciseId,
        name: exerciseName,
        notes: '',
        historyNote: historyCue.weight != null ? `Last session: ${historyCue.weight}${weightUnit} x ${repsTarget ?? 8}` : null,
        sets: [],
      };
      block.exercises.push(exercise);
    }

    exercise.sets.push(sessionSet);
  }

  return blocks;
}

function createInitialSessionState(
  program: ProgramTemplate,
  readinessModifier: number,
  weightUnit: WeightUnit,
  resolveExerciseName: (exerciseId: string) => string = formatExerciseName,
  readinessLoadModifiers?: ReadinessLoadModifiers
): SessionState {
  const blocks = buildBlocksFromProgram(program, readinessModifier, weightUnit, resolveExerciseName, readinessLoadModifiers);
  const firstSetRef = findFirstSetRef(blocks);

  return {
    status: 'active',
    startTime: new Date(),
    blocks,
    activeCell: firstSetRef ? toActiveCell(firstSetRef, 'weight') : null,
    structureDirty: false,
  };
}

function normalizeSessionState(state: SessionState, fallbackWeightUnit: WeightUnit): SessionState {
  return {
    ...state,
    structureDirty: Boolean(state.structureDirty),
    blocks: state.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((exercise) => ({
        ...exercise,
        notes: exercise.notes ?? '',
        historyNote: exercise.historyNote ?? null,
        sets: exercise.sets.map((set) => ({
          ...set,
          weightUnit: set.weightUnit ?? fallbackWeightUnit,
          prescribedRPE: set.prescribedRPE ?? null,
          prescribedRIR: set.prescribedRIR ?? null,
          prescribedPercentage: set.prescribedPercentage ?? null,
          prescribedWeight: set.prescribedWeight ?? null,
          prescribedSeconds: set.prescribedSeconds ?? null,
          previousNote: set.previousNote ?? null,
          notes: set.notes ?? '',
        })),
      })),
    })),
  };
}

function exerciseByIds(blocks: Block[], blockId: string, exerciseId: string): Exercise | null {
  const block = blocks.find((entry) => entry.id === blockId);
  if (!block) return null;
  return block.exercises.find((entry) => entry.id === exerciseId) ?? null;
}

function buildSessionPayload(state: SessionState): SessionPayload | null {
  const firstIncomplete = findFirstIncompleteSetRef(state.blocks);
  if (firstIncomplete) {
    return null;
  }

  return {
    status: 'finished',
    startTime: state.startTime.toISOString(),
    endTime: new Date().toISOString(),
    blocks: cloneBlocks(state.blocks),
  };
}

function workoutSessionReducer(
  state: SessionState,
  action: WorkoutSessionAction,
  weightUnit: WeightUnit,
  resolveExerciseName: (exerciseId: string) => string
): SessionState {
  switch (action.type) {
    case 'HYDRATE_SESSION': {
      return normalizeSessionState(action.payload, weightUnit);
    }

    case 'INITIALIZE_SESSION': {
      // Guard against accidental data loss when inputs (program/readiness) change mid-session.
      // If the user has changed data or structure, NEVER reinitialize.
      if (hasUserSessionEdits(state)) {
        return state;
      }

      return createInitialSessionState(
        action.payload.program,
        action.payload.readinessModifier,
        weightUnit,
        action.payload.resolveExerciseName ?? resolveExerciseName,
        action.payload.readinessLoadModifiers
      );
    }


    case 'UPDATE_SET': {
      const blocks = cloneBlocks(state.blocks);
      const location = findSetLocation(blocks, {
        blockId: action.payload.blockId,
        exerciseId: action.payload.exerciseId,
        setId: action.payload.setId,
      });

      if (!location) return state;

      const set = blocks[location.blockIndex].exercises[location.exerciseIndex].sets[location.setIndex];
      const updates = action.payload.updates;

      if (updates.weight !== undefined) {
        set.weight = updates.weight;
        set.touchedWeight = true;
      }
      if (updates.weightUnit !== undefined) {
        set.weightUnit = updates.weightUnit;
      }
      if (updates.reps !== undefined) {
        set.reps = updates.reps;
        set.touchedReps = true;
      }
      if (updates.rpe !== undefined) {
        set.rpe = clampRpe(updates.rpe);
        set.touchedRpe = true;
      }
      if (updates.notes !== undefined) {
        set.notes = updates.notes;
      }
      if (updates.type !== undefined) set.type = updates.type;

      return {
        ...state,
        blocks,
      };
    }

    case 'TOGGLE_COMPLETE': {
      const blocks = cloneBlocks(state.blocks);
      const ref: SetRef = {
        blockId: action.payload.blockId,
        exerciseId: action.payload.exerciseId,
        setId: action.payload.setId,
      };
      const location = findSetLocation(blocks, ref);

      if (!location) return state;

      const set = blocks[location.blockIndex].exercises[location.exerciseIndex].sets[location.setIndex];
      set.completed = !set.completed;

      if (!set.completed) {
        return {
          ...state,
          blocks,
          activeCell: toActiveCell(ref, 'weight'),
        };
      }

      const nextRef = findNextIncompleteSetRef(blocks, ref);

      return {
        ...state,
        blocks,
        activeCell: nextRef ? toActiveCell(nextRef, 'weight') : null,
      };
    }

    case 'SKIP_SET': {
      const blocks = cloneBlocks(state.blocks);
      const ref: SetRef = {
        blockId: action.payload.blockId,
        exerciseId: action.payload.exerciseId,
        setId: action.payload.setId,
      };
      const location = findSetLocation(blocks, ref);

      if (!location) return state;

      const set = blocks[location.blockIndex].exercises[location.exerciseIndex].sets[location.setIndex];
      // Mark as skipped, and also completed so iterators move past it
      set.skipped = true;
      set.completed = true;

      const nextRef = findNextIncompleteSetRef(blocks, ref);

      return {
        ...state,
        blocks,
        activeCell: nextRef ? toActiveCell(nextRef, 'weight') : null,
      };
    }

    case 'ADD_SET': {
      const blocks = cloneBlocks(state.blocks);
      const exercise = exerciseByIds(blocks, action.payload.blockId, action.payload.exerciseId);
      if (!exercise) return state;

      const lastSet = exercise.sets[exercise.sets.length - 1] ?? null;
      const newSet: SessionSet = {
        id: createId('set'),
        type: lastSet?.type ?? 'working',
        weight: lastSet?.weight ?? null,
        weightUnit: lastSet?.weightUnit ?? weightUnit,
        reps: lastSet?.reps ?? null,
        rpe: null,
        prescribedRPE: lastSet?.prescribedRPE ?? lastSet?.rpe ?? DEFAULT_QUICK_START_TARGET_RPE,
        prescribedRIR: lastSet?.prescribedRIR ?? null,
        prescribedPercentage: lastSet?.prescribedPercentage ?? null,
        prescribedWeight: lastSet?.prescribedWeight ?? null,
        prescribedSeconds: lastSet?.prescribedSeconds ?? null,
        touchedWeight: false,
        touchedReps: false,
        touchedRpe: false,
        tempo: lastSet?.tempo ?? null,
        supersetGroup: lastSet?.supersetGroup ?? null,
        cluster: lastSet?.cluster
          ? {
            reps: [...lastSet.cluster.reps],
            restSeconds: lastSet.cluster.restSeconds,
          }
          : null,
        completed: false,
        previous:
          lastSet?.weight != null && lastSet.reps != null
            ? `${lastSet.weight}${lastSet.weightUnit ?? weightUnit} x ${lastSet.reps}`
            : (lastSet?.previous ?? null),
        previousNote: lastSet?.notes?.trim() || lastSet?.previousNote || null,
        notes: '',
      };

      exercise.sets.push(newSet);

      return {
        ...state,
        blocks,
        structureDirty: true,
        activeCell: {
          blockId: action.payload.blockId,
          exerciseId: action.payload.exerciseId,
          setId: newSet.id,
          field: 'weight',
        },
      };
    }

    case 'INSERT_WARMUP_SETS': {
      const blocks = cloneBlocks(state.blocks);
      const exercise = exerciseByIds(blocks, action.payload.blockId, action.payload.exerciseId);
      if (!exercise || action.payload.warmups.length === 0) return state;

      const insertIndex = exercise.sets.findIndex((set) => set.id === action.payload.beforeSetId);
      if (insertIndex === -1) return state;

      const warmupSets: SessionSet[] = action.payload.warmups.map((warmup, index) => ({
        id: createId('set'),
        type: 'warmup',
        weight: Math.max(0, warmup.weight),
        weightUnit: warmup.weightUnit,
        reps: Math.max(1, Math.round(warmup.reps)),
        rpe: null,
        prescribedRPE: 5,
        prescribedRIR: null,
        prescribedPercentage: null,
        prescribedWeight: Math.max(0, warmup.weight),
        prescribedSeconds: null,
        touchedWeight: false,
        touchedReps: false,
        touchedRpe: false,
        tempo: null,
        supersetGroup: null,
        cluster: null,
        completed: false,
        previous: null,
        previousNote: index === 0 ? exercise.historyNote : null,
        notes: '',
      }));

      exercise.sets.splice(insertIndex, 0, ...warmupSets);

      return {
        ...state,
        blocks,
        structureDirty: true,
        activeCell: {
          blockId: action.payload.blockId,
          exerciseId: action.payload.exerciseId,
          setId: warmupSets[0].id,
          field: 'weight',
        },
      };
    }

    case 'ADD_EXERCISE': {
      const blocks = cloneBlocks(state.blocks);
      const blockId = createId('block');
      const exerciseId = action.payload.exerciseId ?? createId('exercise');
      const count = Math.max(1, action.payload.setCount ?? 1);
      const sets: SessionSet[] = Array.from({ length: count }, () => ({
        id: createId('set'),
        type: 'working' as const,
        weight: null,
        weightUnit,
        reps: 8,
        rpe: null,
        prescribedRPE: DEFAULT_QUICK_START_TARGET_RPE,
        prescribedRIR: null,
        prescribedPercentage: null,
        prescribedWeight: null,
        prescribedSeconds: null,
        touchedWeight: false,
        touchedReps: false,
        touchedRpe: false,
        tempo: null,
        supersetGroup: null,
        cluster: null,
        completed: false,
        previous: null,
        previousNote: null,
        notes: '',
      }));
      const newExercise: Exercise = {
        id: exerciseId,
        name: action.payload.name,
        notes: '',
        historyNote: null,
        sets,
      };
      const newBlock: Block = {
        id: blockId,
        type: 'single',
        exercises: [newExercise],
      };

      blocks.push(newBlock);

      return {
        ...state,
        blocks,
        structureDirty: true,
      };
    }

    case 'REMOVE_EXERCISE': {
      const blocks = cloneBlocks(state.blocks);
      const blockIndex = blocks.findIndex((block) => block.id === action.payload.blockId);
      if (blockIndex === -1) return state;
      const block = blocks[blockIndex];
      const exerciseIndex = block.exercises.findIndex(
        (exercise) => exercise.id === action.payload.exerciseId
      );
      if (exerciseIndex === -1) return state;

      if (block.exercises.length > 1) {
        block.exercises.splice(exerciseIndex, 1);
      } else {
        blocks.splice(blockIndex, 1);
      }

      let activeCell = state.activeCell;
      if (activeCell && activeCell.blockId === action.payload.blockId) {
        if (activeCell.exerciseId === action.payload.exerciseId) {
          activeCell = null;
        }
      }

      return {
        ...state,
        blocks,
        structureDirty: true,
        activeCell,
      };
    }

    case 'REMOVE_SET': {
      const blocks = cloneBlocks(state.blocks);
      const exercise = exerciseByIds(blocks, action.payload.blockId, action.payload.exerciseId);
      if (!exercise) return state;

      const removeIndex = exercise.sets.findIndex((set) => set.id === action.payload.setId);
      if (removeIndex === -1) return state;
      if (exercise.sets.length <= 1) return state;

      exercise.sets.splice(removeIndex, 1);

      if (!state.activeCell || state.activeCell.setId !== action.payload.setId) {
        return {
          ...state,
          blocks,
          structureDirty: true,
        };
      }

      const fallbackSet = exercise.sets[removeIndex] ?? exercise.sets[removeIndex - 1] ?? null;
      const fallbackRef = fallbackSet
        ? {
          blockId: action.payload.blockId,
          exerciseId: action.payload.exerciseId,
          setId: fallbackSet.id,
        }
        : findFirstSetRef(blocks);

      return {
        ...state,
        blocks,
        structureDirty: true,
        activeCell: fallbackRef ? toActiveCell(fallbackRef, 'weight') : null,
      };
    }

    case 'UPDATE_NOTE': {
      const blocks = cloneBlocks(state.blocks);
      const exercise = exerciseByIds(blocks, action.payload.blockId, action.payload.exerciseId);
      if (!exercise) return state;

      exercise.notes = action.payload.notes;

      return {
        ...state,
        blocks,
      };
    }

    case 'SET_ACTIVE_CELL': {
      return {
        ...state,
        activeCell: action.payload,
      };
    }

    case 'FINISH_SESSION': {
      const payload = buildSessionPayload(state);
      if (!payload) {
        const firstIncomplete = findFirstIncompleteSetRef(state.blocks);
        return {
          ...state,
          status: 'active',
          activeCell: firstIncomplete ? toActiveCell(firstIncomplete, 'weight') : state.activeCell,
        };
      }

      return {
        ...state,
        status: 'finished',
        activeCell: null,
      };
    }

    default:
      return state;
  }
}

export function useWorkoutSession(
  program: ProgramTemplate,
  readinessModifier: number,
  weightUnit: WeightUnit = 'lbs',
  options: UseWorkoutSessionOptions = {}
) {
  const resolveExerciseName = options.resolveExerciseName ?? formatExerciseName;
  const readinessLoadModifiers = options.readinessLoadModifiers;
  const [state, dispatch] = useReducer(
    (stateValue: SessionState, action: WorkoutSessionAction) =>
      workoutSessionReducer(stateValue, action, weightUnit, resolveExerciseName),
    program,
	    () => options.initialState
	      ? normalizeSessionState(options.initialState, weightUnit)
	      : createInitialSessionState(program, readinessModifier, weightUnit, resolveExerciseName, readinessLoadModifiers)
	  );

  const reinitializeSession = useCallback(() => {
    dispatch({
      type: 'INITIALIZE_SESSION',
      payload: {
	        program,
	        readinessModifier,
	        resolveExerciseName,
	        readinessLoadModifiers,
	      },
	    });
  }, [program, readinessModifier, resolveExerciseName, readinessLoadModifiers]);

  const updateSet = useCallback(
    (blockId: string, exerciseId: string, setId: string, updates: UpdateSetPayload) => {
      dispatch({
        type: 'UPDATE_SET',
        payload: { blockId, exerciseId, setId, updates },
      });
    },
    []
  );

  const toggleComplete = useCallback((blockId: string, exerciseId: string, setId: string) => {
    dispatch({
      type: 'TOGGLE_COMPLETE',
      payload: { blockId, exerciseId, setId },
    });
  }, []);

  const skipSet = useCallback((blockId: string, exerciseId: string, setId: string) => {
    dispatch({
      type: 'SKIP_SET',
      payload: { blockId, exerciseId, setId },
    });
  }, []);

  const addSet = useCallback((blockId: string, exerciseId: string) => {
    dispatch({
      type: 'ADD_SET',
      payload: { blockId, exerciseId },
    });
  }, []);

  const insertWarmupSets = useCallback((
    blockId: string,
    exerciseId: string,
    beforeSetId: string,
    warmups: Array<{ weight: number; reps: number; weightUnit: WeightUnit }>
  ) => {
    dispatch({
      type: 'INSERT_WARMUP_SETS',
      payload: { blockId, exerciseId, beforeSetId, warmups },
    });
  }, []);

  const removeSet = useCallback((blockId: string, exerciseId: string, setId: string) => {
    dispatch({
      type: 'REMOVE_SET',
      payload: { blockId, exerciseId, setId },
    });
  }, []);

  const updateNote = useCallback((blockId: string, exerciseId: string, notes: string) => {
    dispatch({
      type: 'UPDATE_NOTE',
      payload: { blockId, exerciseId, notes },
    });
  }, []);

  const addExercise = useCallback((name: string, setCount = 1, exerciseId?: string) => {
    dispatch({
      type: 'ADD_EXERCISE',
      payload: { name, setCount, exerciseId },
    });
  }, []);

  const removeExercise = useCallback((blockId: string, exerciseId: string) => {
    dispatch({
      type: 'REMOVE_EXERCISE',
      payload: { blockId, exerciseId },
    });
  }, []);

  const setActiveCell = useCallback((cell: ActiveCell | null) => {
    dispatch({
      type: 'SET_ACTIVE_CELL',
      payload: cell,
    });
  }, []);

  const finishSession = useCallback(() => {
    const payload = buildSessionPayload(state);
    dispatch({ type: 'FINISH_SESSION' });
    return payload;
  }, [state]);

  const canFinish = useMemo(() => !findFirstIncompleteSetRef(state.blocks), [state.blocks]);

  return {
    state,
    dispatch,
    canFinish,
    updateSet,
    toggleComplete,
    skipSet,
    addSet,
    insertWarmupSets,
    removeSet,
    updateNote,
    addExercise,
    removeExercise,
    setActiveCell,
    finishSession,
    reinitializeSession,
  };
}
