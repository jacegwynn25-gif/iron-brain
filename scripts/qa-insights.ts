import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildExerciseCatalog } from '../app/lib/exercises/catalog';
import { defaultExercises } from '../app/lib/programs';
import type { WorkoutSession } from '../app/lib/types';
import {
  buildCanonicalAnalyticsAudit,
  buildCanonicalAnalyticsSets,
  isVerifiedVolumeSet,
  isVerifiedStrengthSet,
  summarizeCanonicalAnalyticsSets,
} from '../app/lib/stats/canonical-sets';
import { calculate1RMLeaderboard, calculateVolumeLeaderboard } from '../app/lib/stats/one-rep-max';
import { convertWeight } from '../app/lib/units';

const catalog = buildExerciseCatalog(defaultExercises, []);

function workout(
  id: string,
  exerciseId: string,
  weight: number,
  reps: number,
  rpe: number | null,
  unit: 'lbs' | 'kg' = 'lbs'
): WorkoutSession {
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
        actualRPE: rpe ?? undefined,
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

{
  const sets = buildCanonicalAnalyticsSets([
    workout('missing_rpe_fixture', 'squat', 225, 5, null),
    workout('rpe_fixture', 'squat', 225, 5, 8),
  ], { catalog });
  const leaderboard = calculate1RMLeaderboard(sets.filter(isVerifiedStrengthSet).map((set) => ({
    weight: set.weightLbs,
    reps: set.reps,
    rpe: set.rpe,
    exerciseId: `${set.exerciseKey}_${set.sourceWorkoutId}`,
    exerciseName: set.exerciseName,
    date: set.date,
  })), { minSets: 1 });

  const noRpeEstimate = leaderboard.find((entry) => entry.exerciseId.endsWith('missing_rpe_fixture'))?.estimated1RM;
  const rpeEstimate = leaderboard.find((entry) => entry.exerciseId.endsWith('rpe_fixture'))?.estimated1RM;

  assert.equal(noRpeEstimate, 263, '225x5 without RPE should use normal Epley, not assumed-RPE inflation');
  assert.equal(rpeEstimate, 278, '225x5 @ RPE 8 should use RPE-adjusted Epley');
}

{
  const sets = buildCanonicalAnalyticsSets([
    workout('single_volume_fixture', 'bench_press', 185, 8, null),
  ], { catalog });
  const volumeLeaderboard = calculateVolumeLeaderboard(sets.filter(isVerifiedVolumeSet).map((set) => ({
    weight: set.weightLbs,
    reps: set.reps,
    rpe: set.rpe,
    exerciseId: set.exerciseKey,
    exerciseName: set.exerciseName,
    date: set.date,
  })), { minSets: 1 });
  const audit = buildCanonicalAnalyticsAudit(sets);

  assert.equal(volumeLeaderboard[0]?.setCount, 1, 'single-set volume leaders should be visible');
  assert.equal(volumeLeaderboard[0]?.totalVolume, 1480, 'volume should be weight x reps in canonical units');
  assert.equal(audit.includedSets, 1, 'audit should count the single completed working set');
  assert.equal(audit.excludedSets, 0, 'audit should not exclude a valid single working set');
}

{
  const insightsSource = readFileSync('app/components/AdvancedAnalyticsDashboard.tsx', 'utf8');
  assert.ok(insightsSource.includes('useWorkoutDataContext'), 'Insights must consume shared workout provider data');
  assert.ok(insightsSource.includes('useRecoveryState'), 'Insights must use shared readiness source');
  assert.ok(!insightsSource.includes('getUnifiedReadiness'), 'Insights must not carry a separate blended readiness score');
}

console.log('✅ Insights analytics QA passed');
