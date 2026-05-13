/* eslint-disable no-console */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/lib/supabase/database.types';
import type { SetLog, WorkoutSession, WeightUnit } from '../app/lib/types';
import {
  buildCanonicalAnalyticsSets,
  isVerifiedVolumeSet,
} from '../app/lib/stats/canonical-sets';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

type SetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  | 'id'
  | 'workout_session_id'
  | 'exercise_id'
  | 'exercise_slug'
  | 'actual_weight'
  | 'weight_unit'
  | 'actual_reps'
  | 'actual_rpe'
  | 'completed'
  | 'set_type'
  | 'e1rm'
  | 'volume_load'
  | 'performed_at'
> & {
  workout_sessions?: { user_id: string | null } | { user_id: string | null }[] | null;
};

type BackfillArgs = {
  apply: boolean;
  userId?: string;
  limit: number;
};

const BACKFILL_PAGE_SIZE = 1000;
const SET_LOG_COLUMNS = `
  id,
  workout_session_id,
  exercise_id,
  exercise_slug,
  actual_weight,
  weight_unit,
  actual_reps,
  actual_rpe,
  completed,
  set_type,
  e1rm,
  volume_load,
  performed_at,
  workout_sessions!inner(user_id)
`;

function parseArgs(): BackfillArgs {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const userIdIndex = args.indexOf('--user-id');
  const limitIndex = args.indexOf('--limit');
  const parsedLimit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 5000;

  return {
    apply,
    userId: userIdIndex >= 0 ? args[userIdIndex + 1] : undefined,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5000,
  };
}

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase URL/key. Provide NEXT_PUBLIC_SUPABASE_URL and a service-role or anon key.');
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function rowToWorkout(row: SetLogRow): WorkoutSession {
  const exerciseId = row.exercise_slug || row.exercise_id || 'unknown_exercise';
  const weightUnit: WeightUnit = row.weight_unit === 'kg' ? 'kg' : 'lbs';
  const set: SetLog = {
    id: row.id,
    exerciseId,
    exerciseName: row.exercise_slug || undefined,
    setIndex: 1,
    prescribedReps: '0',
    actualWeight: row.actual_weight,
    weightUnit,
    actualReps: row.actual_reps,
    actualRPE: row.actual_rpe,
    completed: row.completed !== false,
    setType: row.set_type === 'warmup' ? 'warmup' : 'straight',
    timestamp: row.performed_at ?? undefined,
  };

  return {
    id: row.workout_session_id ?? `set_${row.id}`,
    programId: '',
    programName: '',
    cycleNumber: 0,
    weekNumber: 0,
    dayOfWeek: '',
    dayName: '',
    date: row.performed_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    startTime: row.performed_at ?? undefined,
    endTime: row.performed_at ?? undefined,
    sets: [set],
    createdAt: row.performed_at ?? new Date().toISOString(),
    updatedAt: row.performed_at ?? new Date().toISOString(),
  };
}

function shouldUpdateMetric(currentValue: number | null, nextValue: number): boolean {
  if (!Number.isFinite(nextValue) || nextValue <= 0) return false;
  if (currentValue == null || !Number.isFinite(Number(currentValue))) return true;
  const current = Number(currentValue);
  const delta = Math.abs(current - nextValue);
  return delta / Math.max(Math.abs(nextValue), 1) > 0.02;
}

async function main() {
  const args = parseArgs();
  const client = makeClient();
  const mode = args.apply ? 'APPLY' : 'DRY RUN';

  console.log(`Analytics metric backfill: ${mode}`);
  if (args.userId) console.log(`User filter: ${args.userId}`);

  const rows: SetLogRow[] = [];
  let offset = 0;

  while (rows.length < args.limit) {
    const remaining = args.limit - rows.length;
    const pageSize = Math.min(BACKFILL_PAGE_SIZE, remaining);
    let query = client
      .from('set_logs')
      .select(SET_LOG_COLUMNS)
      .eq('completed', true)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (args.userId) {
      query = query.eq('workout_sessions.user_id', args.userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const pageRows = (data ?? []) as SetLogRow[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
    offset += pageSize;
  }
  let changedRows = 0;
  let anomalyRows = 0;
  let appliedRows = 0;

  for (const row of rows) {
    const canonical = buildCanonicalAnalyticsSets([rowToWorkout(row)])[0];
    if (!canonical) continue;

    if (canonical.isAnomaly) {
      anomalyRows += 1;
      console.log(`anomaly ${row.id}: ${canonical.exerciseKey} ${canonical.rawWeight}${canonical.rawWeightUnit} x ${canonical.reps} (${canonical.anomalyReason})`);
      continue;
    }

    if (!isVerifiedVolumeSet(canonical)) continue;

    const nextE1rm = Math.round(canonical.estimated1RMLbs * 10) / 10;
    const nextVolume = Math.round(canonical.volumeLoadLbs);
    const updateE1rm = shouldUpdateMetric(row.e1rm, nextE1rm);
    const updateVolume = shouldUpdateMetric(row.volume_load, nextVolume);

    if (!updateE1rm && !updateVolume) continue;

    changedRows += 1;
    console.log(
      `update ${row.id}: e1rm ${row.e1rm ?? 'null'} -> ${nextE1rm}, volume ${row.volume_load ?? 'null'} -> ${nextVolume}`
    );

    if (args.apply) {
      const { error: updateError } = await client
        .from('set_logs')
        .update({
          e1rm: nextE1rm,
          volume_load: nextVolume,
        })
        .eq('id', row.id);

      if (updateError) throw updateError;
      appliedRows += 1;
    }
  }

  console.log(`Scanned: ${rows.length}`);
  console.log(`Would update: ${changedRows}`);
  console.log(`Applied: ${appliedRows}`);
  console.log(`Anomalies reported: ${anomalyRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
