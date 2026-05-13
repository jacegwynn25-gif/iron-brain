import type { SetLog } from '../types';
import { convertWeight } from '../units';
import { rpeAdjusted1RM } from './one-rep-max';

export function calculateSetVolumeLbs(set: Pick<SetLog, 'actualWeight' | 'actualReps' | 'weightUnit'>): number | null {
  const reps = Number(set.actualReps) || 0;
  const weight = Number(set.actualWeight) || 0;
  if (reps <= 0 || weight <= 0) return null;
  const weightLbs = convertWeight(weight, set.weightUnit ?? 'lbs', 'lbs');
  return weightLbs * reps;
}

export function calculateSetE1RMLbs(set: Pick<SetLog, 'actualWeight' | 'actualReps' | 'actualRPE' | 'weightUnit'>): number | null {
  const reps = Number(set.actualReps) || 0;
  const weight = Number(set.actualWeight) || 0;
  if (reps <= 0 || weight <= 0) return null;
  const weightLbs = convertWeight(weight, set.weightUnit ?? 'lbs', 'lbs');
  return rpeAdjusted1RM(weightLbs, reps, set.actualRPE);
}
