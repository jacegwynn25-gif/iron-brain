import assert from 'node:assert/strict';
import {
  applyProgramTuneUp,
  buildProgramTuneUpRecommendation,
  buildTrainingRecommendations,
  type TrainingRecommendation,
  type TrainingRecommendationInput,
} from '../app/lib/intelligence/training-recommendations';
import {
  mapSetLogsToTrainingSetInputs,
  mapWorkoutHistoryToTrainingHistory,
} from '../app/lib/intelligence/training-inputs';
import { calculateMuscleFatigue } from '../app/lib/fatigueModel';
import { storage } from '../app/lib/storage';
import { buildWarmupPlan, calculatePlateLoad } from '../app/lib/workout-tools';
import type { ProgramTemplate } from '../app/lib/types';

function nextSetRecommendation(input: TrainingRecommendationInput): TrainingRecommendation {
  const recommendation = buildTrainingRecommendations(input).find((entry) => entry.scope === 'next_set');
  assert.ok(recommendation, 'expected a next-set recommendation');
  return recommendation;
}

const baseSet = {
  blockId: 'block_a',
  exerciseId: 'back_squat',
  exerciseName: 'Back Squat',
  setId: 'set_a',
  setIndex: 1,
  weightUnit: 'lbs' as const,
  completed: false,
  skipped: false,
};
const asyncChecks: Promise<void>[] = [];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function installMemoryStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

function squatHistory(daysAgo: number, overrides: Partial<NonNullable<TrainingRecommendationInput['historySets']>[number]> = {}) {
  return {
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    actualWeight: 225,
    weightUnit: 'lbs' as const,
    actualReps: 5,
    actualRPE: 8,
    prescribedReps: '5',
    prescribedRPE: 8,
    completed: true,
    performedAt: isoDaysAgo(daysAgo),
    ...overrides,
  };
}

{
  const plateLoad = calculatePlateLoad({ targetWeight: 185, unit: 'lbs' });
  assert.equal(plateLoad.actualWeight, 185);
  assert.equal(plateLoad.delta, 0);
  assert.deepEqual(plateLoad.platesPerSide, [
    { weight: 45, count: 1 },
    { weight: 25, count: 1 },
  ]);
  const oddLoad = calculatePlateLoad({ targetWeight: 188, unit: 'lbs' });
  assert.equal(oddLoad.actualWeight, 190);
  assert.equal(oddLoad.delta, 2);

  const kgLoad = calculatePlateLoad({ targetWeight: 102.5, unit: 'kg' });
  assert.equal(kgLoad.actualWeight, 102.5);
  assert.deepEqual(kgLoad.platesPerSide, [
    { weight: 25, count: 1 },
    { weight: 15, count: 1 },
    { weight: 1.25, count: 1 },
  ]);

  const warmups = buildWarmupPlan({ targetWeight: 225, targetReps: 5, unit: 'lbs' });
  assert.deepEqual(
    warmups.map((set) => `${set.weight}x${set.reps}`),
    ['45x10', '90x8', '125x5', '160x3', '185x1']
  );
  assert.ok(warmups.every((set) => set.weight < 225));
}

{
  const fatigue = calculateMuscleFatigue([
    {
      exerciseId: 'back_squat',
      exerciseName: 'Back Squat',
      setIndex: 1,
      prescribedReps: '5',
      prescribedRPE: 8,
      actualWeight: 225,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 9.5,
      completed: true,
      reachedFailure: true,
    },
  ], ['quads']);
  const contributor = fatigue[0]?.contributingSets[0];

  assert.ok(contributor);
  assert.equal(contributor.volumeLoad, 1125);
  assert.equal(contributor.reachedFailure, true);
  assert.equal(contributor.actualRPE, 9.5);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, reps: 8, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.confidence, 'low');
  assert.equal(recommendation.dataSufficiency, 'baseline');
  assert.equal(recommendation.evidenceSource, 'baseline');
  assert.equal(recommendation.target?.weight, null);
  assert.match(recommendation.reason, /No direct load history/i);
  assert.match(recommendation.confidenceReason ?? '', /no usable history/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedWeight: 200, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [],
    readiness: { score: 45, modifier: 0.9 },
  });

  assert.equal(recommendation.target?.prescribedWeight, 200);
  assert.equal(recommendation.target?.weight, 180);
  assert.equal(recommendation.apply?.weight, 180);
  assert.equal(recommendation.action, 'reduce_load');
  assert.match(recommendation.reason, /Prescription stays 200 LBS/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'working_set', weight: 225, reps: 5, prescribedWeight: 225, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'warmup_set', type: 'warmup', weight: 95, reps: 8, rpe: 5, completed: true },
      { ...baseSet, setId: 'working_set', weight: 225, reps: 5, prescribedWeight: 225, prescribedRPE: 8, completed: false },
    ],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 225);
  assert.equal(recommendation.evidenceSource, 'program_prescription');
  assert.doesNotMatch(recommendation.reason, /set you just logged/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, reps: 5, prescribedPercentage: 80, prescribedRPE: 8 },
    personalRecords: [{ exerciseId: 'back_squat', recordType: 'max_e1rm', e1rm: 300 }],
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
    weightUnit: 'lbs',
  });

  assert.equal(recommendation.target?.weight, 240);
  assert.equal(recommendation.target?.prescribedPercentage, 80);
  assert.equal(recommendation.confidence, 'medium');
  assert.equal(recommendation.evidenceSource, 'program_prescription');
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, weightUnit: 'kg', reps: 5, prescribedPercentage: 80, prescribedRPE: 8 },
    personalRecords: [{ exerciseId: 'back_squat', recordType: 'max_e1rm', e1rm: 300 }],
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
    weightUnit: 'kg',
  });

  assert.equal(recommendation.target?.weightUnit, 'kg');
  assert.equal(recommendation.target?.weight, 110);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6.5,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 78, modifier: 1 },
  });

  assert.equal(recommendation.action, 'increase_load');
  assert.equal(recommendation.apply?.weight, 205);
  assert.equal(recommendation.evidenceSource, 'direct_history');
  assert.equal(recommendation.dataSufficiency, 'limited');
  assert.match(recommendation.reason, /below target effort/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 225, reps: 5, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'set_prev', weight: 225, reps: 5, rpe: 10, completed: true },
      { ...baseSet, setId: 'set_a', weight: 225, reps: 5, rpe: null, completed: false },
    ],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.equal(recommendation.apply?.weight, 205);
  assert.equal(recommendation.apply?.restSeconds, 30);
  assert.match(recommendation.reason, /Last set was 10\.0 RPE/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 185, reps: 6, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [],
    readiness: { score: 48, modifier: 0.93, source: 'oura' },
  });

  assert.equal(recommendation.action, 'maintain_load');
  assert.equal(recommendation.apply, undefined);
  assert.doesNotMatch(recommendation.reason, /oura/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'selected_set', weight: 225, reps: 5, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'other_set', weight: 225, reps: 5, rpe: 10, completed: true },
      { ...baseSet, setId: 'selected_set', weight: 225, reps: 5, rpe: null, completed: false },
    ],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.apply?.setId, 'selected_set');
}

{
  const tricepsSet = {
    blockId: 'block_triceps',
    exerciseId: 'triceps_extension',
    exerciseName: 'Triceps Extension',
    setId: 'triceps_next',
    setIndex: 2,
    weight: 45,
    weightUnit: 'lbs' as const,
    reps: 10,
    prescribedWeight: 45,
    prescribedRPE: 8,
    completed: false,
    skipped: false,
    touchedWeight: false,
    touchedReps: false,
  };
  const recommendation = nextSetRecommendation({
    currentSet: tricepsSet,
    historySets: [{
      exerciseId: 'triceps_extension',
      exerciseName: 'Triceps Extension',
      actualWeight: 45,
      weightUnit: 'lbs',
      actualReps: 10,
      actualRPE: 8,
      completed: true,
      performedAt: isoDaysAgo(2),
    }],
    sessionSets: [
      {
        ...tricepsSet,
        setId: 'triceps_prev',
        weight: 30,
        reps: 11,
        rpe: 8,
        prescribedWeight: null,
        completed: true,
      },
      tricepsSet,
    ],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.equal(recommendation.target?.weight, 30);
  assert.equal(recommendation.apply?.weight, 30);
  assert.equal(recommendation.evidenceSource, 'current_session');
  assert.equal(recommendation.source, 'session_fatigue');
  assert.match(recommendation.reason, /set you just logged/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'next_heavy_drop', weight: 225, reps: 6, prescribedRPE: 8, completed: false },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'wide_rep_prev', weight: 200, reps: 12, rpe: 10, completed: true },
      { ...baseSet, setId: 'next_heavy_drop', weight: 225, reps: 6, prescribedRPE: 8, completed: false },
    ],
    readiness: { score: 90, modifier: 1.025 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.ok((recommendation.target?.weight ?? 999) <= 200);
  assert.equal(recommendation.apply?.weight, 180);
  assert.match(recommendation.reason, /Last set was 10\.0 RPE/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'next_easy_cap', weight: 225, reps: 6, prescribedRPE: 8, completed: false },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'easy_wide_rep_prev', weight: 200, reps: 12, rpe: 6, completed: true },
      { ...baseSet, setId: 'next_easy_cap', weight: 225, reps: 6, prescribedRPE: 8, completed: false },
    ],
    readiness: { score: 90, modifier: 1.025 },
  });

  assert.equal(recommendation.action, 'increase_load');
  assert.equal(recommendation.target?.weight, 205);
  assert.equal(recommendation.apply?.weight, 205);
  assert.notEqual(recommendation.target?.weight, 240);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'next_missed_no_rpe', weight: 205, reps: 6, prescribedRPE: 8, completed: false },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'missed_no_rpe_prev', weight: 200, reps: 4, rpe: null, completed: true },
      { ...baseSet, setId: 'next_missed_no_rpe', weight: 205, reps: 6, prescribedRPE: 8, completed: false },
    ],
    readiness: { score: 78, modifier: 1 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.ok((recommendation.target?.weight ?? 999) <= 200);
  assert.equal(recommendation.apply?.restSeconds, 30);
}

{
  const hardRecommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'next_rir_hard', weight: 205, reps: 6, prescribedRIR: 2, completed: false },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'rir_hard_prev', weight: 200, reps: 6, rir: 0, completed: true },
      { ...baseSet, setId: 'next_rir_hard', weight: 205, reps: 6, prescribedRIR: 2, completed: false },
    ],
    readiness: { score: 78, modifier: 1 },
  });
  assert.equal(hardRecommendation.action, 'reduce_load');
  assert.ok((hardRecommendation.target?.weight ?? 999) <= 200);

  const easyRecommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'next_rir_easy', weight: 200, reps: 6, prescribedRIR: 2, completed: false },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'rir_easy_prev', weight: 200, reps: 6, rir: 4, completed: true },
      { ...baseSet, setId: 'next_rir_easy', weight: 200, reps: 6, prescribedRIR: 2, completed: false },
    ],
    readiness: { score: 82, modifier: 1 },
  });
  assert.equal(easyRecommendation.action, 'increase_load');
  assert.equal(easyRecommendation.target?.weight, 205);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 205, reps: 5, prescribedRPE: 8, touchedWeight: false },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 225,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 225);
  assert.equal(recommendation.apply?.weight, 225);
  assert.match(recommendation.reason, /recent completed sets/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8, touchedWeight: false },
    historySets: [{
      id: 'skipped_fake_history',
      exerciseId: 'back_squat',
      actualWeight: 405,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6,
      completed: false,
      skipped: true,
      performedAt: '2026-05-07T12:00:00.000Z',
    }, {
      id: 'real_history',
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      skipped: false,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 200);
  assert.notEqual(recommendation.target?.weight, 405);
  assert.equal(recommendation.evidenceCount, 1);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, setId: 'skip_current_next', weight: 205, reps: 5, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [
      { ...baseSet, setId: 'real_prev', weight: 200, reps: 5, rpe: 8, completed: true, skipped: false },
      { ...baseSet, setId: 'skip_prev', weight: 405, reps: 5, rpe: 6, completed: true, skipped: true },
      { ...baseSet, setId: 'skip_current_next', weight: 205, reps: 5, prescribedRPE: 8, completed: false },
    ],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 200);
  assert.equal(recommendation.evidenceSource, 'current_session');
}

{
  installMemoryStorage();
  const now = isoDaysAgo(1);
  const session = {
    id: 'legacy_smart_session',
    programId: 'qa',
    programName: 'QA',
    cycleNumber: 1,
    weekNumber: 1,
    dayOfWeek: 'Mon',
    dayName: 'Lower',
    date: now.split('T')[0],
    startTime: now,
    endTime: now,
    durationMinutes: 40,
    sets: [{
      id: 'legacy_real_set',
      exerciseId: 'back_squat',
      exerciseName: 'Back Squat',
      setIndex: 1,
      prescribedReps: '5',
      prescribedRPE: 8,
      actualWeight: 200,
      weightUnit: 'lbs' as const,
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      skipped: false,
      e1rm: 240,
      volumeLoad: 1000,
      timestamp: now,
    }, {
      id: 'legacy_skipped_set',
      exerciseId: 'back_squat',
      exerciseName: 'Back Squat',
      setIndex: 2,
      prescribedReps: '5',
      prescribedRPE: 8,
      actualWeight: 405,
      weightUnit: 'lbs' as const,
      actualReps: 5,
      actualRPE: 6,
      completed: true,
      skipped: true,
      e1rm: 470,
      volumeLoad: 2025,
      timestamp: now,
    }],
    totalVolumeLoad: 1000,
    averageRPE: 8,
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem('iron_brain_workout_history__default', JSON.stringify([session]));

  const historyInputs = mapWorkoutHistoryToTrainingHistory([session]);
  const skippedHistory = historyInputs.find((set) => set.id === 'legacy_skipped_set');
  assert.equal(skippedHistory?.completed, false);
  assert.equal(skippedHistory?.actualWeight, null);
  assert.equal(skippedHistory?.actualReps, null);
  assert.equal(skippedHistory?.actualRPE, null);
  assert.equal(skippedHistory?.e1rm, null);

  const sessionInputs = mapSetLogsToTrainingSetInputs(session.sets);
  const skippedSession = sessionInputs.find((set) => set.setId === 'legacy_skipped_set');
  assert.equal(skippedSession?.completed, false);
  assert.equal(skippedSession?.weight, null);
  assert.equal(skippedSession?.reps, null);

  asyncChecks.push(storage.suggestWeight('back_squat', 5, 8, [{
    id: 'hard_current_session_set',
    exerciseId: 'back_squat',
    exerciseName: 'Back Squat',
    setIndex: 1,
    prescribedReps: '5',
    prescribedRPE: 8,
    actualWeight: 200,
    weightUnit: 'lbs' as const,
    actualReps: 5,
    actualRPE: 10,
    completed: true,
    skipped: false,
    timestamp: now,
  }]).then((legacySuggestion) => {
    assert.ok(legacySuggestion);
    assert.equal(legacySuggestion.basedOn, 'rpe_adjustment');
    assert.ok(legacySuggestion.suggestedWeight <= 200);
  }));

  const legacyProgression = storage.analyzeProgressionReadiness('back_squat', 5, 8);
  assert.equal(legacyProgression.status, 'maintain');
  assert.notEqual(legacyProgression.status, 'ready');
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [{
      id: 'same_set_id',
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }, {
      id: 'same_set_id',
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.evidenceCount, 1);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 205, reps: 5, prescribedRPE: 8, touchedWeight: true },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 225,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 205);
  assert.equal(recommendation.apply, undefined);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 30, reps: 10, prescribedWeight: 45, prescribedRPE: 8, touchedWeight: true },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 45,
      weightUnit: 'lbs',
      actualReps: 10,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 75, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, 30);
  assert.equal(recommendation.apply, undefined);
  assert.match(recommendation.reason, /edited load/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [0, 1].map((offset) => ({
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6.8,
      completed: true,
      performedAt: `2026-05-0${6 - offset}T12:00:00.000Z`,
    })),
    sessionSets: [],
    readiness: { score: 82, modifier: 1 },
  });

  assert.equal(recommendation.action, 'increase_load');
  assert.equal(recommendation.apply?.weight, 210);
  assert.match(recommendation.reason, /Recent logged sets have hit reps/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [0, 1].map((offset) => ({
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: offset === 0 ? 4 : 5,
      actualRPE: 9.2,
      completed: true,
      performedAt: `2026-05-0${6 - offset}T12:00:00.000Z`,
    })),
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.equal(recommendation.apply?.weight, 190);
  assert.equal(recommendation.apply?.restSeconds, 60);
  assert.match(recommendation.reason, /Recent logged sets missed reps/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 95, reps: 8, prescribedRPE: 6, type: 'warmup' },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 225,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6.5,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 92, modifier: 1.05 },
  });

  assert.equal(recommendation.action, 'maintain_load');
  assert.equal(recommendation.target?.weight, 95);
  assert.equal(recommendation.apply, undefined);
  assert.match(recommendation.reason, /Warm-up sets stay as written/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: {
      ...baseSet,
      exerciseId: 'pull_up',
      exerciseName: 'Pull-Up',
      weight: null,
      reps: 8,
      prescribedRPE: 8,
    },
    historySets: [{
      exerciseId: 'lat_pulldown',
      exerciseName: 'Lat Pulldown',
      actualWeight: 160,
      weightUnit: 'lbs',
      actualReps: 8,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, null);
  assert.equal(recommendation.apply, undefined);
  assert.match(recommendation.reason, /Bodyweight sets stay focused/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: {
      ...baseSet,
      exerciseId: 'shoulder_press',
      exerciseName: 'Shoulder Press',
      weight: null,
      reps: 8,
      prescribedRPE: 8,
    },
    historySets: [{
      exerciseId: 'bench_press',
      exerciseName: 'Bench Press',
      actualWeight: 225,
      weightUnit: 'lbs',
      actualReps: 8,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.target?.weight, null);
  assert.equal(recommendation.apply, undefined);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: {
      ...baseSet,
      exerciseId: 'barbell_row',
      exerciseName: 'Barbell Row',
      weight: null,
      reps: 8,
      prescribedRPE: 8,
    },
    historySets: [{
      exerciseId: 'cable_row',
      exerciseName: 'Cable Row',
      actualWeight: 120,
      weightUnit: 'lbs',
      actualReps: 8,
      actualRPE: 8,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.confidence, 'low');
  assert.equal(recommendation.target?.weight, 120);
  assert.equal(recommendation.apply, undefined);
  assert.equal(recommendation.evidenceSource, 'similar_movement');
  assert.match(recommendation.blockedReason ?? '', /Similar-movement/i);
  assert.match(recommendation.reason, /similar movement history/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6.5,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 62, modifier: 1, source: 'manual' },
  });

  assert.notEqual(recommendation.action, 'increase_load');
  assert.equal(recommendation.apply?.weight, undefined);
  assert.match(recommendation.reason, /load increases are blocked/i);
  assert.match(recommendation.blockedReason ?? '', /Low readiness blocks/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 8 },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 6.5,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 62, modifier: 0.95, source: 'training' },
  });

  assert.equal(recommendation.action, 'increase_load');
  assert.equal(recommendation.apply?.weight, 205);
  assert.doesNotMatch(recommendation.reason, /load increases are blocked/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRIR: 2 },
    historySets: [{
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRIR: 4,
      completed: true,
      performedAt: '2026-05-06T12:00:00.000Z',
    }],
    sessionSets: [],
    readiness: { score: 80, modifier: 1 },
  });

  assert.equal(recommendation.action, 'increase_load');
  assert.equal(recommendation.apply?.weight, 205);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 225, reps: 5, prescribedRPE: 8 },
    historySets: [
      ...Array.from({ length: 8 }, (_, index) => squatHistory(1 + (index % 4), { id: `acute_${index}` })),
      ...Array.from({ length: 8 }, (_, index) => squatHistory(10 + index * 2, { id: `chronic_${index}` })),
    ],
    sessionSets: [],
    readiness: { score: 80, modifier: 1 },
  });

  assert.equal(recommendation.action, 'reduce_load');
  assert.equal(recommendation.source, 'load_pressure');
  assert.equal(recommendation.apply?.weight, 210);
  assert.match(recommendation.reason, /above its recent weekly baseline|above baseline/i);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 225, reps: 5, prescribedRPE: 8 },
    historySets: Array.from({ length: 4 }, (_, index) => squatHistory(1 + index)),
    sessionSets: [],
    readiness: { score: 80, modifier: 1 },
  });

  assert.equal(recommendation.action, 'maintain_load');
  assert.equal(recommendation.source, 'exercise_history');
  assert.equal(recommendation.apply, undefined);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: 200, reps: 5, prescribedRPE: 6 },
    historySets: [
      squatHistory(1, { actualWeight: 200, actualRPE: 5.0, prescribedRPE: 6 }),
      squatHistory(3, { actualWeight: 200, actualRPE: 5.2, prescribedRPE: 6 }),
    ],
    sessionSets: [],
    readiness: { score: 90, modifier: 1.025 },
  });

  assert.notEqual(recommendation.action, 'increase_load');
  assert.notEqual(recommendation.apply?.weight, 210);
}

{
  const recommendation = nextSetRecommendation({
    currentSet: {
      ...baseSet,
      exerciseId: 'pull_up',
      exerciseName: 'Pull-Up',
      weight: null,
      reps: 8,
      prescribedRPE: 8,
    },
    historySets: [1, 3].map((daysAgo) => ({
      exerciseId: 'pull_up',
      exerciseName: 'Pull-Up',
      actualWeight: null,
      weightUnit: 'lbs' as const,
      actualReps: 8,
      actualRPE: 6.5,
      prescribedReps: '8',
      prescribedRPE: 8,
      completed: true,
      performedAt: isoDaysAgo(daysAgo),
    })),
    sessionSets: [],
    readiness: { score: 82, modifier: 1 },
  });

  assert.equal(recommendation.action, 'adjust_reps');
  assert.equal(recommendation.target?.reps, 9);
  assert.equal(recommendation.apply?.reps, 9);
}

{
  const recommendations = buildTrainingRecommendations({
    sessionSets: Array.from({ length: 5 }, (_, index) => ({
      ...baseSet,
      setId: `deload_${index}`,
      weight: 185,
      reps: 5,
      rpe: 6.2,
      prescribedRPE: 6,
      completed: true,
    })),
    historySets: [],
    readiness: { score: 82, modifier: 1 },
  });

  assert.equal(recommendations.some((entry) => entry.scope === 'session' && entry.action === 'add_volume'), false);
}

{
  const program: ProgramTemplate = {
    id: 'qa_program',
    name: 'QA Program',
    weeks: [{
      weekNumber: 1,
      days: [{
        dayOfWeek: 'Mon',
        name: 'Lower',
        sets: [{
          exerciseId: 'back_squat',
          setIndex: 0,
          prescribedReps: '5',
          prescriptionMethod: 'fixed_weight',
          fixedWeight: 135,
          targetRPE: 6,
          setType: 'warmup',
        }, {
          exerciseId: 'back_squat',
          setIndex: 1,
          prescribedReps: '5',
          prescriptionMethod: 'fixed_weight',
          fixedWeight: 200,
          targetRPE: 8,
        }],
      }],
    }],
  };
  const recommendation = buildProgramTuneUpRecommendation({
    program,
    historySets: Array.from({ length: 8 }, (_, index) => ({
      exerciseId: 'back_squat',
      actualWeight: 200,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 9.5,
      prescribedReps: '5',
      prescribedRPE: 8,
      completed: true,
      performedAt: isoDaysAgo(index + 1),
    })),
    readiness: { score: 72, modifier: 1 },
  });

  assert.ok(recommendation);
  assert.equal(recommendation?.scope, 'program');
  assert.notEqual(recommendation?.action, 'hold_program');
  const tuned = applyProgramTuneUp(program, recommendation!);
  assert.equal(tuned.weeks[0]?.days[0]?.sets[0]?.fixedWeight, 135);
  assert.equal(tuned.weeks[0]?.days[0]?.sets[1]?.fixedWeight, 190);
}

{
  const program: ProgramTemplate = {
    id: 'qa_skipped_program',
    name: 'QA Skipped Program',
    weeks: [{
      weekNumber: 1,
      days: [{
        dayOfWeek: 'Mon',
        name: 'Lower',
        sets: [{
          exerciseId: 'back_squat',
          setIndex: 1,
          prescribedReps: '5',
          prescriptionMethod: 'fixed_weight',
          fixedWeight: 200,
          targetRPE: 8,
        }],
      }],
    }],
  };
  const recommendation = buildProgramTuneUpRecommendation({
    program,
    historySets: Array.from({ length: 8 }, (_, index) => ({
      exerciseId: 'back_squat',
      actualWeight: 405,
      weightUnit: 'lbs',
      actualReps: 5,
      actualRPE: 10,
      prescribedReps: '5',
      prescribedRPE: 8,
      completed: false,
      skipped: true,
      performedAt: isoDaysAgo(index + 1),
    })),
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation?.action, 'hold_program');
  assert.equal(recommendation?.evidenceCount, 0);
}

{
  const program: ProgramTemplate = {
    id: 'qa_null_readiness_program',
    name: 'QA Null Readiness Program',
    weeks: [{
      weekNumber: 1,
      days: [{
        dayOfWeek: 'Mon',
        name: 'Baseline',
        sets: [{
          exerciseId: 'back_squat',
          setIndex: 0,
          prescribedReps: '5',
          targetRPE: 8,
        }],
      }],
    }],
  };

  const recommendation = buildProgramTuneUpRecommendation({
    program,
    historySets: [],
    readiness: {
      score: null,
      modifier: null,
      focusAdjustments: {
        overallModifier: null,
        upperBodyModifier: null,
        lowerBodyModifier: null,
      },
    },
  });

  assert.equal(recommendation?.action, 'hold_program');
  assert.doesNotMatch(recommendation?.reason ?? '', /readiness is 0/i);
}

{
  // C2: %TM applies 0.9 factor in the engine (matches useWorkoutSession.estimatePercentageWeight).
  const tmRecommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, reps: 5, prescribedPercentage: 85, prescribedRPE: 8, prescriptionMethod: 'percentage_tm' },
    personalRecords: [{ exerciseId: 'back_squat', recordType: 'max_e1rm', e1rm: 300 }],
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
    weightUnit: 'lbs',
  });
  // 300 * 0.9 * 0.85 = 229.5 -> round to 5 lb = 230
  assert.equal(tmRecommendation.target?.weight, 230);

  const oneRmRecommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, reps: 5, prescribedPercentage: 85, prescribedRPE: 8, prescriptionMethod: 'percentage_1rm' },
    personalRecords: [{ exerciseId: 'back_squat', recordType: 'max_e1rm', e1rm: 300 }],
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
    weightUnit: 'lbs',
  });
  // 300 * 0.85 = 255
  assert.equal(oneRmRecommendation.target?.weight, 255);
  assert.notEqual(tmRecommendation.target?.weight, oneRmRecommendation.target?.weight);
}

Promise.all(asyncChecks)
  .then(() => {
    console.log('✅ Smart training recommendation QA passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
