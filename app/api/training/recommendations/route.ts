import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import {
  buildTrainingRecommendations,
  type TrainingHistorySet,
  type TrainingPersonalRecord,
  type TrainingReadinessInput,
  type TrainingRecommendationInput,
  type TrainingUserMax,
} from '@/app/lib/intelligence/training-recommendations';

type CloudSetRow = {
  id: string;
  workout_session_id: string | null;
  exercise_id: string | null;
  exercise_slug: string | null;
  actual_weight: number | null;
  weight_unit: string | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  actual_rir: number | null;
  prescribed_reps: string | null;
  prescribed_rpe: number | null;
  prescribed_rir: number | null;
  prescribed_percentage: number | null;
  prescribed_weight: number | null;
  e1rm: number | null;
  completed: boolean | null;
  skipped: boolean | null;
  performed_at: string | null;
};

type CloudSessionRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  set_logs?: CloudSetRow[] | null;
};

type ManualContextRow = {
  subjective_readiness: number | null;
  source: string | null;
};

type PersonalRecordRow = {
  exercise_id: string | null;
  record_type: string | null;
  weight: number | null;
  reps: number | null;
  e1rm: number | null;
  volume: number | null;
};

type UserMaxRow = {
  exercise_id: string | null;
  exercise_name: string | null;
  weight: number | null;
  unit: string | null;
};

function mapCloudHistory(sessions: CloudSessionRow[]): TrainingHistorySet[] {
  return sessions.flatMap((session) =>
    (session.set_logs ?? []).map((set) => ({
      id: set.id,
      workoutSessionId: set.workout_session_id ?? session.id,
      exerciseId: set.exercise_slug ?? set.exercise_id,
      actualWeight: set.actual_weight,
      weightUnit: set.weight_unit,
      actualReps: set.actual_reps,
      actualRPE: set.actual_rpe,
      actualRIR: set.actual_rir,
      prescribedReps: set.prescribed_reps,
      prescribedRPE: set.prescribed_rpe,
      prescribedRIR: set.prescribed_rir,
      prescribedPercentage: set.prescribed_percentage,
      prescribedWeight: set.prescribed_weight,
      e1rm: set.e1rm,
      completed: set.completed !== false && set.skipped !== true,
      skipped: set.skipped,
      performedAt: set.performed_at ?? session.end_time ?? session.start_time ?? session.date,
    }))
  );
}

function mapPersonalRecords(rows: PersonalRecordRow[]): TrainingPersonalRecord[] {
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    recordType: row.record_type,
    weight: row.weight,
    reps: row.reps,
    e1rm: row.e1rm,
    volume: row.volume,
  }));
}

function mapUserMaxes(rows: UserMaxRow[]): TrainingUserMax[] {
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    weight: row.weight,
    unit: row.unit,
  }));
}

function mergeReadiness(
  bodyReadiness: TrainingReadinessInput | null | undefined,
  context: ManualContextRow | null
): TrainingReadinessInput | null | undefined {
  if (bodyReadiness?.score != null || bodyReadiness?.modifier != null) return bodyReadiness;
  if (!context || context.source?.toLowerCase() === 'oura' || context.subjective_readiness == null) {
    return bodyReadiness;
  }

  const score = Math.max(35, Math.min(98, Math.round(Number(context.subjective_readiness) * 10)));
  const modifier = score <= 42 ? 0.88 : score <= 55 ? 0.93 : score <= 68 ? 0.97 : score >= 88 ? 1.025 : 1;
  return {
    score,
    modifier,
    source: 'manual',
    focusAdjustments: {
      overallModifier: modifier,
      upperBodyModifier: modifier,
      lowerBodyModifier: modifier,
    },
  };
}

async function fetchCloudInputs(userId: string) {
  const supabase = getSupabaseAdmin();

  const [sessionsResult, recordsResult, maxesResult, contextResult] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select(`
        id,
        date,
        start_time,
        end_time,
        set_logs (
          id,
          workout_session_id,
          exercise_id,
          exercise_slug,
          actual_weight,
          weight_unit,
          actual_reps,
          actual_rpe,
          actual_rir,
          prescribed_reps,
          prescribed_rpe,
          prescribed_rir,
          prescribed_percentage,
          prescribed_weight,
          e1rm,
          completed,
          skipped,
          performed_at
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('personal_records')
      .select('exercise_id, record_type, weight, reps, e1rm, volume')
      .eq('user_id', userId)
      .eq('is_current', true)
      .limit(100),
    supabase
      .from('user_maxes')
      .select('exercise_id, exercise_name, weight, unit')
      .eq('user_id', userId)
      .limit(100),
    supabase
      .from('user_context_data')
      .select('subjective_readiness, source')
      .eq('user_id', userId)
      .or('source.is.null,source.neq.oura')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (recordsResult.error) throw recordsResult.error;
  if (maxesResult.error) throw maxesResult.error;
  if (contextResult.error) throw contextResult.error;

  return {
    historySets: mapCloudHistory((sessionsResult.data ?? []) as unknown as CloudSessionRow[]),
    personalRecords: mapPersonalRecords((recordsResult.data ?? []) as PersonalRecordRow[]),
    userMaxes: mapUserMaxes((maxesResult.data ?? []) as UserMaxRow[]),
    manualContext: (contextResult.data ?? null) as ManualContextRow | null,
  };
}

export async function POST(request: NextRequest) {
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TrainingRecommendationInput;
    const cloud = await fetchCloudInputs(user.id);
    const input: TrainingRecommendationInput = {
      ...body,
      historySets: [
        ...(body.historySets ?? []),
        ...cloud.historySets,
      ],
      personalRecords: [
        ...(body.personalRecords ?? []),
        ...cloud.personalRecords,
      ],
      userMaxes: [
        ...(body.userMaxes ?? []),
        ...cloud.userMaxes,
      ],
      readiness: mergeReadiness(body.readiness, cloud.manualContext),
    };

    return NextResponse.json({
      recommendations: buildTrainingRecommendations(input),
    });
  } catch (error) {
    console.error('Training recommendation error:', error);
    return NextResponse.json({ error: 'Failed to build recommendations' }, { status: 500 });
  }
}
