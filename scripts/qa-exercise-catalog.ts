/* eslint-disable no-console */
import assert from 'node:assert/strict';

import { defaultExercises } from '../app/lib/programs';
import {
  buildExerciseCatalog,
  inferCustomExerciseDefaults,
  resolveExerciseMuscleProfile,
} from '../app/lib/exercises/catalog';
import type { CustomExercise } from '../app/lib/types';

function assertProfile(
  label: string,
  actual: ReturnType<typeof resolveExerciseMuscleProfile>,
  expected: ReturnType<typeof resolveExerciseMuscleProfile>
) {
  assert.deepEqual(actual, expected, label);
  console.log(`✅ ${label}`);
}

function assertDefaults(
  label: string,
  name: string,
  expected: Partial<ReturnType<typeof inferCustomExerciseDefaults>>
) {
  const actual = inferCustomExerciseDefaults(name);
  assert.deepEqual(
    {
      equipment: actual.equipment,
      exerciseType: actual.exerciseType,
      primaryMuscles: actual.primaryMuscles,
      secondaryMuscles: actual.secondaryMuscles,
      movementPattern: actual.movementPattern,
      defaultRestSeconds: actual.defaultRestSeconds,
    },
    {
      equipment: expected.equipment ?? actual.equipment,
      exerciseType: expected.exerciseType ?? actual.exerciseType,
      primaryMuscles: expected.primaryMuscles ?? actual.primaryMuscles,
      secondaryMuscles: expected.secondaryMuscles ?? actual.secondaryMuscles,
      movementPattern: expected.movementPattern ?? actual.movementPattern,
      defaultRestSeconds: expected.defaultRestSeconds ?? actual.defaultRestSeconds,
    },
    label
  );
  console.log(`✅ ${label}`);
}

const badStoredChestRow: CustomExercise = {
  id: 'custom_chest_supported_row',
  userId: 'qa',
  name: 'Chest Supported Row',
  slug: 'chest-supported-row',
  equipment: 'machine',
  exerciseType: 'compound',
  primaryMuscles: ['Chest'],
  secondaryMuscles: [],
  movementPattern: 'push',
  trackWeight: true,
  trackReps: true,
  trackTime: false,
  defaultRestSeconds: 90,
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
};

const catalog = buildExerciseCatalog(defaultExercises, [badStoredChestRow]);

assertProfile(
  'default chest-supported row resolves as back/biceps',
  resolveExerciseMuscleProfile({ id: 'row_chest_supported', name: 'Chest-Supported Row' }, { catalog }),
  { primary: 'back', secondary: 'biceps' }
);

assertProfile(
  'custom chest-supported row ignores bad stored chest metadata',
  resolveExerciseMuscleProfile({ id: badStoredChestRow.id, name: badStoredChestRow.name }, { catalog }),
  { primary: 'back', secondary: 'biceps' }
);

assertProfile(
  'unknown chest-supported row resolves from movement before support descriptor',
  resolveExerciseMuscleProfile({ id: 'custom_unknown_row', name: 'Dumbbell Chest Supported Row' }),
  { primary: 'back', secondary: 'biceps' }
);

assertProfile(
  'custom upright row resolves as shoulders/back',
  resolveExerciseMuscleProfile({ id: 'custom_upright_row', name: 'Cable Upright Row' }),
  { primary: 'shoulders', secondary: 'back' }
);

assertDefaults('create form infers chest-supported row defaults', 'Dumbbell Chest Supported Row', {
  equipment: 'dumbbell',
  exerciseType: 'compound',
  primaryMuscles: ['Back'],
  secondaryMuscles: ['Biceps'],
  movementPattern: 'pull',
  defaultRestSeconds: 150,
});

assertDefaults('create form infers cable fly defaults', 'Cable Chest Fly', {
  equipment: 'cable',
  exerciseType: 'isolation',
  primaryMuscles: ['Chest'],
  secondaryMuscles: [],
  movementPattern: 'push',
  defaultRestSeconds: 90,
});

assertDefaults('create form infers leg press defaults', 'Leg Press', {
  equipment: 'machine',
  exerciseType: 'compound',
  primaryMuscles: ['Quads'],
  secondaryMuscles: ['Glutes'],
  movementPattern: 'squat',
  defaultRestSeconds: 180,
});

assertDefaults('create form infers romanian deadlift defaults', 'Barbell Romanian Deadlift', {
  equipment: 'barbell',
  exerciseType: 'compound',
  primaryMuscles: ['Hamstrings'],
  secondaryMuscles: ['Glutes'],
  movementPattern: 'hinge',
  defaultRestSeconds: 180,
});

assertDefaults('create form infers face pull defaults', 'Cable Face Pull', {
  equipment: 'cable',
  exerciseType: 'isolation',
  primaryMuscles: ['Shoulders'],
  secondaryMuscles: ['Back'],
  movementPattern: 'pull',
  defaultRestSeconds: 75,
});

console.log('✅ Exercise catalog QA passed');
