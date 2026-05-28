import type { SetLog } from '../types';
import { convertWeight } from '../units';
import { rpeAdjusted1RM } from './one-rep-max';

type SetMetricInput = Pick<SetLog, 'actualWeight' | 'actualReps' | 'weightUnit'> &
  Partial<Pick<SetLog, 'actualRPE' | 'completed' | 'skipped' | 'setType'>>;

export function isPerformedSetLog(
  set: Partial<Pick<SetLog, 'completed' | 'skipped' | 'setType' | 'actualReps' | 'actualWeight'>>,
  options: { requireLoad?: boolean; allowWarmup?: boolean } = {}
): boolean {
  if (set.completed !== true || set.skipped === true) return false;
  if (!options.allowWarmup && set.setType === 'warmup') return false;

  const reps = Number(set.actualReps) || 0;
  if (reps <= 0) return false;

  if (options.requireLoad) {
    const weight = Number(set.actualWeight) || 0;
    if (weight <= 0) return false;
  }

  return true;
}

export function calculateSetVolumeLbs(set: SetMetricInput): number | null {
  if (set.completed === false || set.skipped === true) return null;
  const reps = Number(set.actualReps) || 0;
  const weight = Number(set.actualWeight) || 0;
  if (reps <= 0 || weight <= 0) return null;
  const weightLbs = convertWeight(weight, set.weightUnit ?? 'lbs', 'lbs');
  return weightLbs * reps;
}

export function calculateSetE1RMLbs(set: SetMetricInput): number | null {
  if (set.completed === false || set.skipped === true) return null;
  const reps = Number(set.actualReps) || 0;
  const weight = Number(set.actualWeight) || 0;
  if (reps <= 0 || weight <= 0) return null;
  const weightLbs = convertWeight(weight, set.weightUnit ?? 'lbs', 'lbs');
  return rpeAdjusted1RM(weightLbs, reps, set.actualRPE);
}
