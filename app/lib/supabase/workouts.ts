import { supabase } from './client';
import type { Database } from './database.types';

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'id' | 'exercise_id' | 'actual_weight' | 'actual_reps' | 'actual_rpe' | 'e1rm' | 'volume_load'
>;

type SupabaseSetLogSummaryRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'actual_reps' | 'volume_load' | 'actual_rpe' | 'actual_weight' | 'e1rm' | 'performed_at'
>;

type PersonalRecordRow = Pick<
  Database['public']['Tables']['personal_records']['Row'],
  'id' | 'weight' | 'reps' | 'e1rm' | 'volume'
>;

export interface CreateWorkoutSessionData {
  user_program_id?: string;
  program_day_id?: string;
  name: string;
  date: string;
  bodyweight?: number;
  notes?: string;
}

export interface CreateSetLogData {
  workout_session_id: string;
  exercise_id: string;
  program_set_id?: string;
  order_index: number;
  set_index: number;
  prescribed_reps?: string;
  prescribed_rpe?: number;
  prescribed_rir?: number;
  prescribed_percentage?: number;
  actual_weight?: number;
  actual_reps?: number;
  actual_rpe?: number;
  actual_rir?: number;
  e1rm?: number;
  volume_load?: number;
  set_type?: string;
  tempo?: string;
  actual_seconds?: number;
  rest_seconds?: number;
  notes?: string;
  completed?: boolean;
  skipped?: boolean;
}

// Create a new workout session
export async function createWorkoutSession(data: CreateWorkoutSessionData) {
  const { data: session, error } = await supabase
    .from('workout_sessions')
    .insert({
      ...data,
      status: 'in_progress',
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  if (!session) throw new Error('Workout session not returned');
  return session;
}

// Update a workout session
export async function updateWorkoutSession(
  sessionId: string,
  data: Partial<CreateWorkoutSessionData> & {
    end_time?: string;
    duration_minutes?: number;
    total_volume_load?: number;
    total_sets?: number;
    total_reps?: number;
    average_rpe?: number;
    status?: 'in_progress' | 'completed' | 'abandoned';
  }
) {
  const { data: session, error } = await supabase
    .from('workout_sessions')
    .update(data)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  if (!session) throw new Error('Workout session not returned');
  return session;
}

// Complete a workout session
export async function completeWorkoutSession(sessionId: string) {
  // Calculate summary stats
  const { data: sets } = await supabase
    .from('set_logs')
    .select('actual_reps, volume_load, actual_rpe')
    .eq('workout_session_id', sessionId)
    .eq('completed', true);

  const totalSets = sets?.length || 0;
  const setsTyped = (sets ?? []) as SupabaseSetLogSummaryRow[];
  const totalReps = setsTyped.reduce((sum, set) => sum + (set.actual_reps || 0), 0);
  const totalVolume = setsTyped.reduce((sum, set) => sum + (set.volume_load || 0), 0);
  const avgRpe =
    setsTyped.length > 0
      ? setsTyped.reduce((sum, set) => sum + (set.actual_rpe || 0), 0) / setsTyped.length
      : 0;

  // Get start time to calculate duration
  const { data: session } = await supabase
    .from('workout_sessions')
    .select('start_time')
    .eq('id', sessionId)
    .single();

  const startTime = session?.start_time ? new Date(session.start_time) : new Date();
  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  return updateWorkoutSession(sessionId, {
    status: 'completed',
    end_time: endTime.toISOString(),
    duration_minutes: durationMinutes,
    total_sets: totalSets,
    total_reps: totalReps,
    total_volume_load: totalVolume,
    average_rpe: avgRpe,
  });
}

// Add a set to a workout
export async function createSetLog(data: CreateSetLogData) {
  const { data: setLog, error } = await supabase
    .from('set_logs')
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  // Check if this is a new personal record
  const setLogRow = setLog as SupabaseSetLogRow | null;
  if (setLogRow?.exercise_id && data.completed !== false) {
    await checkAndUpdatePersonalRecords(
      setLogRow.exercise_id,
      setLogRow.actual_weight ?? undefined,
      setLogRow.actual_reps ?? undefined,
      setLogRow.e1rm ?? undefined,
      setLogRow.volume_load ?? undefined,
      setLogRow.id
    );
  }

  return setLog;
}

// Update a set log
export async function updateSetLog(
  setLogId: string,
  data: Partial<CreateSetLogData>
) {
  const { data: setLog, error } = await supabase
    .from('set_logs')
    .update(data)
    .eq('id', setLogId)
    .select()
    .single();

  if (error) throw error;

  // Re-check personal records if weight/reps changed
  const updatedSetLog = setLog as SupabaseSetLogRow | null;
  if (updatedSetLog?.exercise_id && (data.actual_weight || data.actual_reps)) {
    await checkAndUpdatePersonalRecords(
      updatedSetLog.exercise_id,
      updatedSetLog.actual_weight ?? undefined,
      updatedSetLog.actual_reps ?? undefined,
      updatedSetLog.e1rm ?? undefined,
      updatedSetLog.volume_load ?? undefined,
      updatedSetLog.id
    );
  }

  return setLog;
}

// Delete a set log
export async function deleteSetLog(setLogId: string) {
  const { error } = await supabase.from('set_logs').delete().eq('id', setLogId);

  if (error) throw error;
}

// Check and update personal records
async function checkAndUpdatePersonalRecords(
  exerciseId: string,
  weight?: number,
  reps?: number,
  e1rm?: number,
  volume?: number,
  setLogId?: string
) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  const recordTypes: Array<{
    type: 'max_weight' | 'max_reps' | 'max_e1rm' | 'max_volume';
    value: number;
  }> = [];

  if (weight) recordTypes.push({ type: 'max_weight', value: weight });
  if (reps) recordTypes.push({ type: 'max_reps', value: reps });
  if (e1rm) recordTypes.push({ type: 'max_e1rm', value: e1rm });
  if (volume) recordTypes.push({ type: 'max_volume', value: volume });

  for (const { type, value } of recordTypes) {
    // Get current record
    const { data: currentRecord } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .eq('record_type', type)
      .eq('is_current', true)
      .single();

    const currentValue =
      type === 'max_weight'
        ? (currentRecord as PersonalRecordRow | null)?.weight
        : type === 'max_reps'
        ? (currentRecord as PersonalRecordRow | null)?.reps
        : type === 'max_e1rm'
        ? (currentRecord as PersonalRecordRow | null)?.e1rm
        : (currentRecord as PersonalRecordRow | null)?.volume;

    // If new record, update
    if (!currentRecord || value > (currentValue || 0)) {
      // Mark old record as not current
      if (currentRecord) {
        const recordRow = currentRecord as PersonalRecordRow;
        await supabase
          .from('personal_records')
          .update({ is_current: false })
          .eq('id', recordRow.id);
      }

      // Create new record
      await supabase.from('personal_records').insert({
        user_id: userId,
        exercise_id: exerciseId,
        record_type: type,
        weight,
        reps,
        e1rm,
        volume,
        set_log_id: setLogId,
        is_current: true,
      });
    }
  }
}

// Update exercise stats after a workout
export async function updateExerciseStats(exerciseId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  // Get all sets for this exercise
  const { data: sets } = await supabase
    .from('set_logs')
    .select('actual_weight, actual_reps, actual_rpe, e1rm, volume_load, performed_at')
    .eq('exercise_id', exerciseId)
    .eq('completed', true);

  if (!sets || sets.length === 0) return;

  const setsTyped = (sets ?? []) as SupabaseSetLogSummaryRow[];
  const totalSets = setsTyped.length;
  const totalReps = setsTyped.reduce((sum, set) => sum + (set.actual_reps || 0), 0);
  const totalVolume = setsTyped.reduce((sum, set) => sum + (set.volume_load || 0), 0);

  const avgWeight =
    setsTyped.reduce((sum, set) => sum + (set.actual_weight || 0), 0) / totalSets;
  const avgReps = totalReps / totalSets;
  const avgRpe =
    setsTyped.reduce((sum, set) => sum + (set.actual_rpe || 0), 0) / totalSets;

  const bestWeight = Math.max(...setsTyped.map((s) => s.actual_weight || 0));
  const bestReps = Math.max(...setsTyped.map((s) => s.actual_reps || 0));
  const bestE1rm = Math.max(...setsTyped.map((s) => s.e1rm || 0));

  const lastPerformed = setsTyped
    .map((set) => set.performed_at)
    .filter((value): value is string => typeof value === 'string')
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  // Upsert stats
  const { error } = await supabase.from('exercise_stats').upsert(
    {
      user_id: userId,
      exercise_id: exerciseId,
      total_sets: totalSets,
      total_reps: totalReps,
      total_volume: totalVolume,
      avg_weight: avgWeight,
      avg_reps: avgReps,
      avg_rpe: avgRpe,
      best_weight: bestWeight,
      best_reps: bestReps,
      best_e1rm: bestE1rm,
      last_performed_at: lastPerformed,
      times_performed: totalSets,
    },
    { onConflict: 'user_id,exercise_id' }
  );

  if (error) throw error;
}
