import type {
  DayTemplate,
  ProgramBlockExerciseTemplate,
  ProgramBlockTemplate,
  ProgramTemplate,
  SetTemplate,
} from '../types';

function cloneSet(setTemplate: SetTemplate): SetTemplate {
  return {
    ...setTemplate,
    dropSetWeights: setTemplate.dropSetWeights ? [...setTemplate.dropSetWeights] : undefined,
    clusterReps: setTemplate.clusterReps ? [...setTemplate.clusterReps] : undefined,
  };
}

function cloneBlockExercise(exercise: ProgramBlockExerciseTemplate): ProgramBlockExerciseTemplate {
  return {
    ...exercise,
    sets: (exercise.sets ?? []).map(cloneSet),
  };
}

function cloneBlocks(blocks: ProgramBlockTemplate[]): ProgramBlockTemplate[] {
  return blocks.map((block) => ({
    ...block,
    exercises: (block.exercises ?? []).map(cloneBlockExercise),
  }));
}

function isSupersetSet(setTemplate: SetTemplate): boolean {
  return (
    setTemplate.setType === 'superset' ||
    setTemplate.setType === 'giant' ||
    Boolean(setTemplate.supersetGroup)
  );
}

export function setsToProgramBlocks(sets: SetTemplate[]): ProgramBlockTemplate[] {
  const blocks: ProgramBlockTemplate[] = [];
  const blockMap = new Map<string, number>();

  for (const setTemplate of sets) {
    const exerciseId = setTemplate.exerciseId;
    if (!exerciseId) continue;

    const superset = isSupersetSet(setTemplate);
    const blockKey = superset
      ? `superset:${setTemplate.supersetGroup ?? `inline-${setTemplate.setIndex}`}`
      : `single:${exerciseId}`;
    const blockType: ProgramBlockTemplate['type'] = superset ? 'superset' : 'single';

    let blockIndex = blockMap.get(blockKey);
    if (blockIndex == null) {
      blockIndex = blocks.length;
      blockMap.set(blockKey, blockIndex);
      blocks.push({
        id: `block_${blockKey.replace(/[^a-z0-9:_-]+/gi, '_')}`,
        type: blockType,
        exercises: [],
      });
    }

    const block = blocks[blockIndex];
    let exercise = block.exercises.find((entry) => entry.exerciseId === exerciseId);
    if (!exercise) {
      const slot = block.type === 'superset' ? (block.exercises.length === 0 ? 'A1' : 'A2') : undefined;
      exercise = {
        id: `${block.id}_${exerciseId}`,
        exerciseId,
        slot,
        sets: [],
      };
      block.exercises.push(exercise);
    }

    exercise.sets.push(cloneSet(setTemplate));
  }

  for (const block of blocks) {
    if (block.type !== 'superset') continue;
    block.rounds = block.exercises.reduce((max, entry) => Math.max(max, entry.sets.length), 0);
    block.exercises = block.exercises.slice(0, 2).map((entry, index) => ({
      ...entry,
      slot: index === 0 ? 'A1' : 'A2',
    }));
  }

  return blocks;
}

export function blocksToProgramSets(blocks: ProgramBlockTemplate[]): SetTemplate[] {
  const sets: SetTemplate[] = [];

  for (const block of blocks) {
    if (block.type === 'superset') {
      const sortedExercises = [...block.exercises].sort((a, b) => {
        if (a.slot === b.slot) return 0;
        if (a.slot === 'A1') return -1;
        if (b.slot === 'A1') return 1;
        return 0;
      });
      const rounds = block.rounds ?? sortedExercises.reduce((max, entry) => Math.max(max, entry.sets.length), 0);

      for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
        for (const exercise of sortedExercises) {
          const sourceSet = exercise.sets[roundIndex];
          if (!sourceSet) continue;

          sets.push({
            ...cloneSet(sourceSet),
            exerciseId: exercise.exerciseId,
            setIndex: sets.length + 1,
            setType: sourceSet.setType ?? 'superset',
            supersetGroup: sourceSet.supersetGroup ?? block.id,
          });
        }
      }
      continue;
    }

    for (const exercise of block.exercises) {
      for (const sourceSet of exercise.sets) {
        sets.push({
          ...cloneSet(sourceSet),
          exerciseId: exercise.exerciseId,
          setIndex: sets.length + 1,
        });
      }
    }
  }

  return sets;
}

function normalizeDayStructure(day: DayTemplate, dayIndex: number): { day: DayTemplate; changed: boolean } {
  let changed = false;
  const normalizedName = day.name?.trim() || `Session ${dayIndex + 1}`;
  const normalizedSessionIndex = day.sessionIndex ?? dayIndex + 1;
  const initialSets = Array.isArray(day.sets) ? day.sets.map(cloneSet) : [];
  let nextSets = initialSets;
  const currentBlocks = Array.isArray(day.blocks) ? cloneBlocks(day.blocks) : [];
  let nextBlocks = currentBlocks;

  if (nextSets.length > 0) {
    const derivedBlocks = setsToProgramBlocks(nextSets);
    if (JSON.stringify(derivedBlocks) !== JSON.stringify(currentBlocks)) {
      changed = true;
    }
    nextBlocks = derivedBlocks;
  } else if (nextBlocks.length > 0) {
    nextSets = blocksToProgramSets(nextBlocks);
    changed = true;
  }

  if (day.name !== normalizedName) changed = true;
  if (day.sessionIndex !== normalizedSessionIndex) changed = true;
  if (day.blocks == null) changed = true;

  return {
    day: {
      ...day,
      name: normalizedName,
      sessionIndex: normalizedSessionIndex,
      sets: nextSets,
      blocks: nextBlocks,
    },
    changed,
  };
}

export function normalizeProgramStructure(program: ProgramTemplate): {
  program: ProgramTemplate;
  changed: boolean;
} {
  let changed = false;

  const weeks = (program.weeks ?? []).map((week) => {
    const days = (week.days ?? []).map((day, dayIndex) => {
      const normalized = normalizeDayStructure(day, dayIndex);
      if (normalized.changed) changed = true;
      return normalized.day;
    });
    return { ...week, days };
  });

  const schemaVersion = 2;
  if (program.schemaVersion !== schemaVersion) changed = true;

  return {
    program: {
      ...program,
      schemaVersion,
      weeks,
    },
    changed,
  };
}
