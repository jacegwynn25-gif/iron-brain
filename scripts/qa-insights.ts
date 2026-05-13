import assert from 'node:assert/strict';
import { buildExerciseCatalog } from '../app/lib/exercises/catalog';
import { defaultExercises } from '../app/lib/programs';
import type { WorkoutSession } from '../app/lib/types';
import {
  buildCanonicalAnalyticsSets,
  isVerifiedStrengthSet,
  summarizeCanonicalAnalyticsSets,
} from '../app/lib/stats/canonical-sets';
import { calculate1RMLeaderboard } from '../app/lib/stats/one-rep-max';
import { convertWeight } from '../app/lib/units';

const catalog = buildExerciseCatalog(defaultExercises, []);

function workout(id: string, exerciseId: string, weight: number, reps: number, rpe: number, unit: 'lbs' | 'kg' = 'lbs'): WorkoutSession {
  return {
    id,
    programId: 'qa-insights',
    programName: 'QA Insights',
    cycleNumber: 1,
    weekNumber: 1,
    dayOfWeek: 'Monday',
    dayName: 'Strength',
    date: '2026-05-12',
    startTime: '2026-05-12T12:00:00.000Z',
    endTime: '2026-05-12T13:00:00.000Z',
    sets: [
      {
        id: `${id}_set`,
        exerciseId,
        exerciseName: exerciseId === 'back_squat' ? 'Back Squat' : exerciseId,
        setIndex: 1,
        prescribedReps: String(reps),
        actualWeight: weight,
        weightUnit: unit,
        actualReps: reps,
        actualRPE: rpe,
        completed: true,
        setType: 'straight',
      },
    ],
    createdAt: '2026-05-12T12:00:00.000Z',
    updatedAt: '2026-05-12T13:00:00.000Z',
  };
}

{
  const sets = buildCanonicalAnalyticsSets([
    workout('real_275x3', 'back_squat', 275, 3, 8),
  ], { catalog });
  const verified = sets.filter(isVerifiedStrengthSet);
  const leaderboard = calculate1RMLeaderboard(verified.map((set) => ({
    weight: set.weightLbs,
    reps: set.reps,
    rpe: set.rpe,
    exerciseId: set.exerciseKey,
    exerciseName: set.exerciseName,
    date: set.date,
  })), { minSets: 1 });

  assert.equal(leaderboard[0]?.exerciseId, 'squat');
  assert.ok((leaderboard[0]?.estimated1RM ?? 0) > 300, '275x3 should produce a 300+ lb squat e1RM');
}

{
  const sets = buildCanonicalAnalyticsSets([
    workout('bogus_26x4', 'squat', 26, 4, 8),
    workout('real_290x4', 'squat', 290, 4, 9.5),
  ], { catalog });
  const summary = summarizeCanonicalAnalyticsSets(sets);
  const verified = sets.filter(isVerifiedStrengthSet);
  const leaderboard = calculate1RMLeaderboard(verified.map((set) => ({
    weight: set.weightLbs,
    reps: set.reps,
    rpe: set.rpe,
    exerciseId: set.exerciseKey,
    exerciseName: set.exerciseName,
    date: set.date,
  })), { minSets: 1 });

  assert.equal(summary.anomalousSets, 1);
  assert.equal(summary.anomalyCounts.suspicious_barbell_weight, 1);
  assert.equal(leaderboard[0]?.bestSet.weight, 290);
  assert.notEqual(leaderboard[0]?.estimated1RM, 158);
}

{
  const sets = buildCanonicalAnalyticsSets([
    workout('null_stored_metric_fixture', 'squat', 275, 3, 8),
  ], { catalog });
  assert.ok(sets[0]?.estimated1RMLbs && sets[0].estimated1RMLbs > 300, 'e1RM should be recomputed from set data');
}

{
  const sets = buildCanonicalAnalyticsSets([
    workout('kg_fixture', 'squat', 125, 3, 8, 'kg'),
  ], { catalog });
  const displayKg = convertWeight(sets[0].weightLbs, 'lbs', 'kg');
  assert.ok(Math.abs(displayKg - 125) < 0.01, 'kg display should convert exactly once from canonical lbs');
}

console.log('✅ Insights analytics QA passed');
