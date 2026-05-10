import assert from 'node:assert/strict';
import {
  applyProgramTuneUp,
  buildProgramTuneUpRecommendation,
  buildTrainingRecommendations,
  type TrainingRecommendation,
  type TrainingRecommendationInput,
} from '../app/lib/intelligence/training-recommendations';
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

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
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
  const recommendation = nextSetRecommendation({
    currentSet: { ...baseSet, weight: null, reps: 8, prescribedRPE: 8 },
    historySets: [],
    sessionSets: [],
    readiness: { score: 72, modifier: 1 },
  });

  assert.equal(recommendation.confidence, 'low');
  assert.equal(recommendation.target?.weight, null);
  assert.match(recommendation.reason, /No direct load history/i);
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
  assert.equal(recommendation.target?.weight, 108.75);
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

  assert.equal(recommendation.action, 'reduce_load');
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
  assert.match(recommendation.reason, /similar movement history/i);
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
      ...Array.from({ length: 8 }, (_, index) => squatHistory(1 + (index % 4))),
      ...Array.from({ length: 8 }, (_, index) => squatHistory(10 + index * 2)),
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

console.log('✅ Smart training recommendation QA passed');
