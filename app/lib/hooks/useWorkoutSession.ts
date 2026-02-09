import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { ProgramTemplate, SetTemplate } from '../types';
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

type UpdateSetPayload = Partial<Pick<SessionSet, 'weight' | 'reps' | 'rpe' | 'type'>>;

type WorkoutSessionAction =
  | {
      type: 'INITIALIZE_SESSION';
      payload: {
        program: ProgramTemplate;
        readinessModifier: number;
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
      type: 'ADD_EXERCISE';
      payload: {
        name: string;
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

function roundToNearestFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function clampRpe(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.min(10, Math.max(1, value));
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

function getMockHistory(exerciseId: string): number {
  void exerciseId;
  const mockPool = [185, 195, 205, 215, 225, 235, 245];
  const index = Math.floor(Math.random() * mockPool.length);
  return mockPool[index] ?? 225;
}

function getLastWeightForExercise(historyMap: Map<string, number>, exerciseId: string): number {
  if (!historyMap.has(exerciseId)) {
    historyMap.set(exerciseId, getMockHistory(exerciseId));
  }
  return historyMap.get(exerciseId) ?? 225;
}

function buildSessionSetFromTemplate(
  templateSet: SetTemplate,
  lastWeight: number,
  readinessModifier: number,
  defaults?: {
    supersetGroup?: string | null;
  }
): SessionSet {
  const cluster = parseClusterConfig(templateSet);
  const repsTarget = parseRepsTarget(templateSet.prescribedReps);
  const mappedSetType = mapTemplateSetType(templateSet);
  const effectiveReps = cluster && cluster.reps.length > 0 ? cluster.reps[0] : repsTarget;

  return {
    id: createId('set'),
    type: mappedSetType,
    weight:
      mappedSetType === 'working'
        ? roundToNearestFive(lastWeight * readinessModifier)
        : null,
    reps: effectiveReps,
    rpe: clampRpe(templateSet.targetRPE ?? null),
    tempo: parseTempoCue(templateSet),
    supersetGroup: templateSet.supersetGroup ?? defaults?.supersetGroup ?? null,
    cluster,
    completed: false,
    previous: `${lastWeight}x${effectiveReps ?? 8}`,
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
      const maxSets = block.exercises.reduce((max, exercise) => Math.max(max, exercise.sets.length), 0);

      for (let round = 0; round < maxSets; round += 1) {
        for (const exercise of block.exercises) {
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

function buildBlocksFromProgram(program: ProgramTemplate, readinessModifier: number): Block[] {
  const sortedWeeks = [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const day = sortedWeeks[0]?.days[0];
  if (!day) return [];

  const mockHistoryByExercise = new Map<string, number>();

  if (Array.isArray(day.blocks) && day.blocks.length > 0) {
    const blocksFromSchema: Block[] = [];

    for (const templateBlock of day.blocks) {
      const sessionBlock: Block = {
        id: createId('block'),
        type: templateBlock.type === 'superset' ? 'superset' : 'single',
        rounds: templateBlock.rounds ?? null,
        transitionSeconds: templateBlock.transitionSeconds ?? null,
        restAfterRoundSeconds: templateBlock.restAfterRoundSeconds ?? null,
        exercises: [],
      };

      for (const templateExercise of templateBlock.exercises ?? []) {
        const exerciseId = templateExercise.exerciseId || createId('exercise');
        const lastWeight = getLastWeightForExercise(mockHistoryByExercise, exerciseId);
        const setsForExercise = (templateExercise.sets ?? []).map((templateSet) =>
          buildSessionSetFromTemplate(
            templateSet,
            lastWeight,
            readinessModifier,
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
          name: formatExerciseName(exerciseId),
          slot: templateExercise.slot,
          notes: templateExercise.notes ?? '',
          historyNote: `Last session: ${lastWeight}x${setsForExercise[0]?.reps ?? 8}`,
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
    const lastWeight = getLastWeightForExercise(mockHistoryByExercise, exerciseId);
    const sessionSet = buildSessionSetFromTemplate(templateSet, lastWeight, readinessModifier);
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
        name: formatExerciseName(exerciseId),
        notes: '',
        historyNote: `Last session: ${lastWeight}x${repsTarget ?? 8}`,
        sets: [],
      };
      block.exercises.push(exercise);
    }

    exercise.sets.push(sessionSet);
  }

  return blocks;
}

function createInitialSessionState(program: ProgramTemplate, readinessModifier: number): SessionState {
  const blocks = buildBlocksFromProgram(program, readinessModifier);
  const firstSetRef = findFirstSetRef(blocks);

  return {
    status: 'active',
    startTime: new Date(),
    blocks,
    activeCell: firstSetRef ? toActiveCell(firstSetRef, 'weight') : null,
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

function workoutSessionReducer(state: SessionState, action: WorkoutSessionAction): SessionState {
  switch (action.type) {
    case 'INITIALIZE_SESSION': {
      return createInitialSessionState(action.payload.program, action.payload.readinessModifier);
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

      if (updates.weight !== undefined) set.weight = updates.weight;
      if (updates.reps !== undefined) set.reps = updates.reps;
      if (updates.rpe !== undefined) set.rpe = clampRpe(updates.rpe);
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

    case 'ADD_SET': {
      const blocks = cloneBlocks(state.blocks);
      const exercise = exerciseByIds(blocks, action.payload.blockId, action.payload.exerciseId);
      if (!exercise) return state;

      const lastSet = exercise.sets[exercise.sets.length - 1] ?? null;
      const newSet: SessionSet = {
        id: createId('set'),
        type: lastSet?.type ?? 'working',
        weight: lastSet?.weight ?? null,
        reps: lastSet?.reps ?? null,
        rpe: lastSet?.rpe ?? null,
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
            ? `${lastSet.weight}x${lastSet.reps}`
            : (lastSet?.previous ?? null),
      };

      exercise.sets.push(newSet);

      return {
        ...state,
        blocks,
        activeCell: {
          blockId: action.payload.blockId,
          exerciseId: action.payload.exerciseId,
          setId: newSet.id,
          field: 'weight',
        },
      };
    }

    case 'ADD_EXERCISE': {
      const blocks = cloneBlocks(state.blocks);
      const blockId = createId('block');
      const exerciseId = createId('exercise');
      const setId = createId('set');
      const newSet: SessionSet = {
        id: setId,
        type: 'working',
        weight: null,
        reps: 8,
        rpe: null,
        tempo: null,
        supersetGroup: null,
        cluster: null,
        completed: false,
        previous: null,
      };
      const newExercise: Exercise = {
        id: exerciseId,
        name: action.payload.name,
        notes: '',
        historyNote: null,
        sets: [newSet],
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

export function useWorkoutSession(program: ProgramTemplate, readinessModifier: number) {
  const [state, dispatch] = useReducer(
    workoutSessionReducer,
    undefined,
    () => createInitialSessionState(program, readinessModifier)
  );

  useEffect(() => {
    dispatch({
      type: 'INITIALIZE_SESSION',
      payload: {
        program,
        readinessModifier,
      },
    });
  }, [program, readinessModifier]);

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

  const addSet = useCallback((blockId: string, exerciseId: string) => {
    dispatch({
      type: 'ADD_SET',
      payload: { blockId, exerciseId },
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

  const addExercise = useCallback((name: string) => {
    dispatch({
      type: 'ADD_EXERCISE',
      payload: { name },
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
    addSet,
    removeSet,
    updateNote,
    addExercise,
    removeExercise,
    setActiveCell,
    finishSession,
  };
}
