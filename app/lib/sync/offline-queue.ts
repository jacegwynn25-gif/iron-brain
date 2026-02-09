'use client';

import type { ProgramTemplate, WorkoutSession } from '../types';
import { supabase } from '../supabase/client';
import type { Json } from '../supabase/database.types';
import { logger } from '../logger';
import { isValidUuid } from '../uuid';
import { resolveExerciseIds, upsertPersonalRecordsForSetLogs } from '../supabase/workouts';

const QUEUE_KEY = 'iron_brain_sync_queue';
const SYNCED_WORKOUT_IDS_KEY = 'iron-brain:synced-workout-ids';
const MAX_RETRIES = 5;

type WorkoutMetadata = {
  programId?: string;
  programName?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: string;
  dayName?: string;
};

export type QueueOperation = 'create' | 'update' | 'delete';
export type QueueTable = 'workout_sessions' | 'custom_programs';

export interface QueueItem {
  id: string;
  operation: QueueOperation;
  table: QueueTable;
  data: unknown;
  timestamp: string;
  retries: number;
}

const setQueue = (queue: QueueItem[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export function queueOperation(operation: QueueOperation, table: QueueItem['table'], data: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    const queue = getQueue();
    const item: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      operation,
      table,
      data,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    queue.push(item);
    setQueue(queue);
  } catch (err) {
    console.error('Failed to queue operation:', err);
  }
}

export function getQueue(): QueueItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? (JSON.parse(stored) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

export function removeFromQueue(itemId: string): void {
  try {
    const queue = getQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    setQueue(filtered);
  } catch (err) {
    console.error('Failed to remove from queue:', err);
  }
}

const incrementRetries = (item: QueueItem): void => {
  try {
    const queue = getQueue();
    const index = queue.findIndex(q => q.id === item.id);
    if (index === -1) return;
    const nextRetries = (queue[index].retries ?? 0) + 1;
    if (nextRetries > MAX_RETRIES) {
      queue.splice(index, 1);
    } else {
      queue[index] = {
        ...queue[index],
        retries: nextRetries,
      };
    }
    setQueue(queue);
  } catch (err) {
    console.error('Failed to update queue retries:', err);
  }
};

const markWorkoutAsSynced = (workoutId: string) => {
  try {
    const stored = localStorage.getItem(SYNCED_WORKOUT_IDS_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(workoutId)) {
      ids.push(workoutId);
      localStorage.setItem(SYNCED_WORKOUT_IDS_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    logger.debug('Failed to mark workout as synced:', err);
  }
};

const syncWorkoutToCloud = async (
  client: typeof supabase,
  session: WorkoutSession,
  userId: string
): Promise<void> => {
  const workoutUuid = session.id.startsWith('session_')
    ? session.id.substring(8)
    : session.id;

  const metadata: WorkoutMetadata = {};
  if (session.programId) metadata.programId = session.programId;
  if (session.programName) metadata.programName = session.programName;
  if (session.cycleNumber) metadata.cycleNumber = session.cycleNumber;
  if (session.weekNumber) metadata.weekNumber = session.weekNumber;
  if (session.dayOfWeek) metadata.dayOfWeek = session.dayOfWeek;
  if (session.dayName) metadata.dayName = session.dayName;

  const { error: sessionError } = await client
    .from('workout_sessions')
    .upsert({
      id: workoutUuid,
      user_id: userId,
      name: session.programName || 'Workout',
      date: session.date,
      start_time: session.startTime,
      end_time: session.endTime,
      duration_minutes: session.durationMinutes,
      bodyweight: session.bodyweight,
      notes: session.notes,
      metadata,
      status: 'completed',
      total_sets: session.sets?.filter((set) => set.completed !== false).length || 0,
      total_reps:
        session.sets?.reduce(
          (sum, s) => sum + (s.completed === false ? 0 : (s.actualReps || 0)),
          0
        ) || 0,
      total_volume_load:
        session.sets?.reduce(
          (sum, s) =>
            sum +
            (s.completed === false ? 0 : ((s.actualWeight || 0) * (s.actualReps || 0))),
          0
        ) || 0,
      average_rpe: (() => {
        const completed = session.sets?.filter((set) => set.completed !== false) ?? [];
        if (completed.length === 0) return null;
        return (
          completed.reduce((sum, s) => sum + (s.actualRPE || 0), 0) / completed.length
        );
      })(),
    });

  if (sessionError) {
    throw sessionError;
  }

  await client
    .from('set_logs')
    .delete()
    .eq('workout_session_id', workoutUuid);

  if (session.sets && session.sets.length > 0) {
    const exerciseRefs = Array.from(
      new Set(session.sets.map((set) => set.exerciseId).filter(Boolean))
    );
    const exerciseIdByRef = await resolveExerciseIds(client, exerciseRefs);

    const setLogs = session.sets.map((set, index) => ({
      id: set.id && isValidUuid(set.id) ? set.id : undefined,
      workout_session_id: workoutUuid,
      exercise_id: exerciseIdByRef.get(set.exerciseId) ?? null,
      exercise_slug: set.exerciseId,
      program_set_id: null,
      order_index: index,
      set_index: set.setIndex || index + 1,
      prescribed_reps: set.prescribedReps,
      prescribed_rpe: set.prescribedRPE,
      prescribed_rir: set.prescribedRIR,
      prescribed_percentage: set.prescribedPercentage,
      actual_weight: set.actualWeight,
      weight_unit: set.weightUnit === 'kg' ? 'kg' : 'lbs',
      actual_reps: set.actualReps,
      actual_rpe: set.actualRPE,
      actual_rir: set.actualRIR,
      e1rm: set.e1rm,
      volume_load: set.actualWeight && set.actualReps ? set.actualWeight * set.actualReps : null,
      set_type: set.setType || 'straight',
      tempo: set.tempo,
      rest_seconds: set.restTakenSeconds,
      actual_seconds: set.setDurationSeconds,
      notes: set.notes,
      performed_at: set.timestamp ?? session.endTime ?? new Date().toISOString(),
      completed: set.completed !== false,
      skipped: set.completed === false,
    }));

    const { data: insertedSetRows, error: setsError } = await client
      .from('set_logs')
      .insert(setLogs)
      .select('id, exercise_id, actual_weight, actual_reps, e1rm, volume_load, completed, performed_at');

    if (setsError) {
      throw setsError;
    }

    try {
      await upsertPersonalRecordsForSetLogs(userId, insertedSetRows ?? [], client);
    } catch (prError) {
      console.error('Failed to update personal records during queue sync:', prError);
    }
  }

  markWorkoutAsSynced(session.id);
};

const syncProgramToCloud = async (
  client: typeof supabase,
  program: ProgramTemplate,
  userId: string
): Promise<void> => {
  const programData: Json = JSON.parse(JSON.stringify(program));

  const { error } = await client.from('custom_programs').upsert({
    id: program.id,
    user_id: userId,
    program_data: programData,
    name: program.name,
    is_custom: program.isCustom ?? true,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
};

const deleteProgramFromCloud = async (
  client: typeof supabase,
  programId: string,
  userId: string
): Promise<void> => {
  const { error } = await client
    .from('custom_programs')
    .delete()
    .eq('id', programId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};

export async function processQueue(
  client: typeof supabase,
  userId: string
): Promise<{ processed: number; failed: number }> {
  const supabaseClient = client || supabase;
  if (!userId || !isOnline()) return { processed: 0, failed: 0 };
  const queue = getQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const payload = (item.data && typeof item.data === 'object')
        ? (item.data as Record<string, unknown>)
        : {};

      if (item.table === 'workout_sessions') {
        const session = (payload.session ?? payload) as WorkoutSession;
        if (!session) {
          removeFromQueue(item.id);
          continue;
        }
        await syncWorkoutToCloud(supabaseClient, session, userId);
      } else if (item.table === 'custom_programs') {
        if (item.operation === 'delete') {
          const programId = (payload.programId ?? payload.id) as string | undefined;
          if (!programId) {
            removeFromQueue(item.id);
            continue;
          }
          await deleteProgramFromCloud(supabaseClient, programId, userId);
        } else {
          const program = (payload.program ?? payload) as ProgramTemplate;
          if (!program?.id) {
            removeFromQueue(item.id);
            continue;
          }
          await syncProgramToCloud(supabaseClient, program, userId);
        }
      } else {
        logger.debug(`Skipping unsupported queue table: ${item.table}`);
        removeFromQueue(item.id);
        continue;
      }

      removeFromQueue(item.id);
      processed++;
    } catch (err) {
      failed++;
      incrementRetries(item);
      logger.debug('Failed to process queue item:', err);
    }
  }

  return { processed, failed };
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function setupOnlineListener(onOnline: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onOnline();
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
