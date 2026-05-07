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
      completed: true,
      performedAt: `2026-05-0${Math.min(index + 1, 9)}T12:00:00.000Z`,
    })),
    readiness: { score: 72, modifier: 1 },
  });

  assert.ok(recommendation);
  assert.equal(recommendation?.scope, 'program');
  assert.notEqual(recommendation?.action, 'hold_program');
  const tuned = applyProgramTuneUp(program, recommendation!);
  assert.equal(tuned.weeks[0]?.days[0]?.sets[0]?.fixedWeight, 190);
}

console.log('✅ Smart training recommendation QA passed');
