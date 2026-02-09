import { supabase } from './client';
import type { Database, TablesInsert } from './database.types';
import { isValidUuid } from '../uuid';
import { convertWeight } from '../units';

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'id' | 'exercise_id' | 'actual_weight' | 'weight_unit' | 'actual_reps' | 'actual_rpe' | 'e1rm' | 'volume_load'
>;

type SupabaseSetLogSummaryRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'actual_reps' | 'volume_load' | 'actual_rpe' | 'actual_weight' | 'weight_unit' | 'e1rm' | 'performed_at'
>;

type PersonalRecordRow = Pick<
  Database['public']['Tables']['personal_records']['Row'],
  'id' | 'exercise_id' | 'record_type' | 'weight' | 'reps' | 'e1rm' | 'volume'
>;

type PersonalRecordType = 'max_weight' | 'max_reps' | 'max_e1rm' | 'max_volume';

type SetLogPrCandidate = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  'id' | 'exercise_id' | 'actual_weight' | 'weight_unit' | 'actual_reps' | 'e1rm' | 'volume_load' | 'completed' | 'performed_at'
>;

const PERSONAL_RECORD_TYPES: PersonalRecordType[] = ['max_weight', 'max_reps', 'max_e1rm', 'max_volume'];

export interface PersonalRecordHit {
  exerciseId: string;
  recordType: PersonalRecordType;
  previousValue: number | null;
  newValue: number;
  setLogId: string | null;
}

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
  weight_unit?: 'lbs' | 'kg';
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

export async function resolveExerciseIds(
  client: typeof supabase,
  exerciseRefs: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const refs = Array.from(new Set(exerciseRefs.filter(Boolean)));
  if (refs.length === 0) return map;

  const { data: bySlug, error: slugError } = await client
    .from('exercises')
    .select('id, slug')
    .in('slug', refs);

  if (slugError) {
    console.warn('Could not resolve exercises by slug:', slugError.message);
  } else {
    for (const row of bySlug ?? []) {
      if (row.slug) map.set(row.slug, row.id);
    }
  }

  const uuidRefs = refs.filter((value) => isValidUuid(value));
  if (uuidRefs.length > 0) {
    const { data: byId, error: idError } = await client
      .from('exercises')
      .select('id, slug')
      .in('id', uuidRefs);

    if (idError) {
      console.warn('Could not resolve exercises by id:', idError.message);
    } else {
      for (const row of byId ?? []) {
        map.set(row.id, row.id);
        if (row.slug) map.set(row.slug, row.id);
      }
    }
  }

  return map;
}

function getRecordValueForType(
  row: Pick<PersonalRecordRow, 'weight' | 'reps' | 'e1rm' | 'volume'>,
  type: PersonalRecordType
): number {
  if (type === 'max_weight') return Number(row.weight) || 0;
  if (type === 'max_reps') return Number(row.reps) || 0;
  if (type === 'max_e1rm') return Number(row.e1rm) || 0;
  return Number(row.volume) || 0;
}

function buildSetRecordTypes(setLog: SetLogPrCandidate): Array<{ type: PersonalRecordType; value: number }> {
  const weightRaw = Number(setLog.actual_weight) || 0;
  const reps = Number(setLog.actual_reps) || 0;
  const e1rmRaw = Number(setLog.e1rm) || 0;
  const unit = setLog.weight_unit ?? 'lbs';
  const weight = weightRaw > 0 ? convertWeight(weightRaw, unit, 'lbs') : 0;
  const e1rm = e1rmRaw > 0 ? convertWeight(e1rmRaw, unit, 'lbs') : 0;
  const volume = weight > 0 && reps > 0 ? weight * reps : 0;
  const entries: Array<{ type: PersonalRecordType; value: number }> = [];

  if (weight > 0) entries.push({ type: 'max_weight', value: weight });
  if (reps > 0) entries.push({ type: 'max_reps', value: reps });
  if (e1rm > 0) entries.push({ type: 'max_e1rm', value: e1rm });
  if (volume > 0) entries.push({ type: 'max_volume', value: volume });
  return entries;
}

export async function upsertPersonalRecordsForSetLogs(
  userId: string,
  setLogs: SetLogPrCandidate[],
  client: typeof supabase = supabase
): Promise<PersonalRecordHit[]> {
  if (!userId || setLogs.length === 0) return [];

  const completedSets = setLogs.filter(
    (setLog) => setLog.completed !== false && typeof setLog.exercise_id === 'string' && setLog.exercise_id.length > 0
  );
  if (completedSets.length === 0) return [];

  const exerciseIds = Array.from(new Set(completedSets.map((setLog) => setLog.exercise_id as string)));

  const { data: existingRows, error: existingError } = await client
    .from('personal_records')
    .select('id, exercise_id, record_type, weight, reps, e1rm, volume')
    .eq('user_id', userId)
    .eq('is_current', true)
    .in('exercise_id', exerciseIds)
    .in('record_type', PERSONAL_RECORD_TYPES);

  if (existingError) throw existingError;

  const existingByKey = new Map<string, PersonalRecordRow>();
  for (const row of (existingRows ?? []) as PersonalRecordRow[]) {
    if (!row.exercise_id || !row.record_type) continue;
    existingByKey.set(`${row.exercise_id}:${row.record_type}`, row);
  }

  const bestSetByKey = new Map<string, { setLog: SetLogPrCandidate; type: PersonalRecordType; value: number }>();
  for (const setLog of completedSets) {
    const exerciseId = setLog.exercise_id as string;
    for (const record of buildSetRecordTypes(setLog)) {
      const key = `${exerciseId}:${record.type}`;
      const current = bestSetByKey.get(key);
      if (!current || record.value > current.value) {
        bestSetByKey.set(key, { setLog, type: record.type, value: record.value });
      }
    }
  }

  const hits: PersonalRecordHit[] = [];

  for (const [key, best] of bestSetByKey.entries()) {
    const existing = existingByKey.get(key);
    const previousValue = existing ? getRecordValueForType(existing, best.type) : null;
    if (previousValue != null && best.value <= previousValue) {
      continue;
    }

    if (existing?.id) {
      const { error: deactivateError } = await client
        .from('personal_records')
        .update({ is_current: false })
        .eq('id', existing.id);

      if (deactivateError) throw deactivateError;
    }

    const unit = best.setLog.weight_unit ?? 'lbs';
    const weight = best.setLog.actual_weight != null
      ? convertWeight(best.setLog.actual_weight, unit, 'lbs')
      : null;
    const e1rm = best.setLog.e1rm != null
      ? convertWeight(best.setLog.e1rm, unit, 'lbs')
      : null;
    const volume = best.setLog.volume_load != null
      ? Number(best.setLog.volume_load)
      : weight != null && best.setLog.actual_reps != null
        ? weight * Number(best.setLog.actual_reps)
        : null;

    const insertPayload: TablesInsert<'personal_records'> = {
      user_id: userId,
      exercise_id: best.setLog.exercise_id,
      record_type: best.type,
      weight,
      reps: best.setLog.actual_reps ?? null,
      e1rm,
      volume,
      set_log_id: best.setLog.id ?? null,
      achieved_at: best.setLog.performed_at ?? new Date().toISOString(),
      is_current: true,
    };

    const { error: insertError } = await client.from('personal_records').insert(insertPayload);
    if (insertError) throw insertError;

    hits.push({
      exerciseId: best.setLog.exercise_id as string,
      recordType: best.type,
      previousValue,
      newValue: best.value,
      setLogId: best.setLog.id ?? null,
    });
  }

  return hits;
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await upsertPersonalRecordsForSetLogs(user.id, [
        {
          id: setLogRow.id,
          exercise_id: setLogRow.exercise_id,
          actual_weight: setLogRow.actual_weight,
          weight_unit: setLogRow.weight_unit,
          actual_reps: setLogRow.actual_reps,
          e1rm: setLogRow.e1rm,
          volume_load: setLogRow.volume_load,
          completed: true,
          performed_at: new Date().toISOString(),
        },
      ]);
    }
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await upsertPersonalRecordsForSetLogs(user.id, [
        {
          id: updatedSetLog.id,
          exercise_id: updatedSetLog.exercise_id,
          actual_weight: updatedSetLog.actual_weight,
          weight_unit: updatedSetLog.weight_unit,
          actual_reps: updatedSetLog.actual_reps,
          e1rm: updatedSetLog.e1rm,
          volume_load: updatedSetLog.volume_load,
          completed: true,
          performed_at: new Date().toISOString(),
        },
      ]);
    }
  }

  return setLog;
}

// Delete a set log
export async function deleteSetLog(setLogId: string) {
  const { error } = await supabase.from('set_logs').delete().eq('id', setLogId);

  if (error) throw error;
}

// Update exercise stats after a workout
export async function updateExerciseStats(exerciseId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;

  // Get all sets for this exercise
  const { data: sets } = await supabase
    .from('set_logs')
    .select('actual_weight, weight_unit, actual_reps, actual_rpe, e1rm, volume_load, performed_at')
    .eq('exercise_id', exerciseId)
    .eq('completed', true);

  if (!sets || sets.length === 0) return;

  const setsTyped = (sets ?? []) as SupabaseSetLogSummaryRow[];
  const totalSets = setsTyped.length;
  const totalReps = setsTyped.reduce((sum, set) => sum + (set.actual_reps || 0), 0);
  const totalVolume = setsTyped.reduce((sum, set) => sum + (set.volume_load || 0), 0);

  const weightValues = setsTyped.map((set) => {
    const weight = set.actual_weight || 0;
    if (!weight) return 0;
    return convertWeight(weight, set.weight_unit ?? 'lbs', 'lbs');
  });
  const e1rmValues = setsTyped.map((set) => {
    const e1rm = set.e1rm || 0;
    if (!e1rm) return 0;
    return convertWeight(e1rm, set.weight_unit ?? 'lbs', 'lbs');
  });

  const avgWeight = weightValues.reduce((sum, weight) => sum + weight, 0) / totalSets;
  const avgReps = totalReps / totalSets;
  const avgRpe =
    setsTyped.reduce((sum, set) => sum + (set.actual_rpe || 0), 0) / totalSets;

  const bestWeight = Math.max(...weightValues);
  const bestReps = Math.max(...setsTyped.map((s) => s.actual_reps || 0));
  const bestE1rm = Math.max(...e1rmValues);

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
