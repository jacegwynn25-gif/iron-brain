import type { SetLog, WorkoutSession } from '../types';
import type { TrainingHistorySet, TrainingPersonalRecord, TrainingSetInput } from './training-recommendations';

type LocalPersonalRecords = {
  maxWeight?: { weight: number; reps: number };
  maxReps?: { weight: number; reps: number };
  maxE1RM?: { weight: number; reps: number; e1rm: number };
  maxVolume?: { weight: number; reps: number; volume: number };
} | null;

function performed(set: Pick<SetLog, 'completed' | 'skipped'>): boolean {
  return set.completed === true && set.skipped !== true;
}

export function mapWorkoutHistoryToTrainingHistory(
  sessions: WorkoutSession[],
  options: { limit?: number } = {}
): TrainingHistorySet[] {
  const history = options.limit != null ? sessions.slice(0, options.limit) : sessions;

  return history.flatMap((session) =>
    session.sets.map((set) => {
      const completed = performed(set);
      return {
        id: set.id,
        workoutSessionId: session.id,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        setIndex: set.setIndex,
        actualWeight: completed ? set.actualWeight ?? null : null,
        weightUnit: set.weightUnit,
        actualReps: completed ? set.actualReps ?? null : null,
        actualRPE: completed ? set.actualRPE ?? null : null,
        actualRIR: completed ? set.actualRIR ?? null : null,
        prescribedReps: set.prescribedReps,
        prescribedRPE: set.prescribedRPE,
        prescribedRIR: set.prescribedRIR,
        prescribedPercentage: set.prescribedPercentage,
        prescribedWeight: set.prescribedWeight,
        e1rm: completed ? set.e1rm ?? null : null,
        completed,
        skipped: set.skipped,
        setType: set.setType,
        performedAt: set.timestamp ?? session.endTime ?? session.startTime ?? session.date,
      };
    })
  );
}

export function mapSetLogsToTrainingSetInputs(sets: SetLog[]): TrainingSetInput[] {
  return sets.map((set) => {
    const completed = performed(set);
    return {
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      setId: set.id,
      setIndex: set.setIndex,
      weight: completed ? set.actualWeight ?? null : null,
      weightUnit: set.weightUnit,
      reps: completed ? set.actualReps ?? null : null,
      rpe: completed ? set.actualRPE ?? null : null,
      rir: completed ? set.actualRIR ?? null : null,
      prescribedRPE: set.prescribedRPE,
      prescribedRIR: set.prescribedRIR,
      prescribedPercentage: set.prescribedPercentage,
      prescribedWeight: set.prescribedWeight,
      completed,
      skipped: set.skipped,
      type: set.setType,
    };
  });
}

export function mapLocalPersonalRecordsToTrainingRecords(
  exerciseId: string | null | undefined,
  records: LocalPersonalRecords
): TrainingPersonalRecord[] {
  if (!exerciseId || !records) return [];

  const mapped: Array<TrainingPersonalRecord | null> = [
    records.maxWeight
      ? {
        exerciseId,
        recordType: 'max_weight',
        weight: records.maxWeight.weight,
        reps: records.maxWeight.reps,
      }
      : null,
    records.maxReps
      ? {
        exerciseId,
        recordType: 'max_reps',
        weight: records.maxReps.weight,
        reps: records.maxReps.reps,
      }
      : null,
    records.maxE1RM
      ? {
        exerciseId,
        recordType: 'max_e1rm',
        weight: records.maxE1RM.weight,
        reps: records.maxE1RM.reps,
        e1rm: records.maxE1RM.e1rm,
      }
      : null,
    records.maxVolume
      ? {
        exerciseId,
        recordType: 'max_volume',
        weight: records.maxVolume.weight,
        reps: records.maxVolume.reps,
        volume: records.maxVolume.volume,
      }
      : null,
  ];

  return mapped.filter((record): record is TrainingPersonalRecord => record != null);
}
