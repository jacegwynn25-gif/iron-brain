import { NextRequest, NextResponse } from 'next/server';
import { createUuid } from '@/app/lib/uuid';
import { FEATURES } from '@/app/lib/features';
import type { ProgramTemplate } from '@/app/lib/types';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import type { Database } from '@/app/lib/supabase/database.types';

const ensureEnabled = () => {
  if (!FEATURES.coachCollab) {
    return NextResponse.json({ error: 'Coach collaboration is disabled' }, { status: 404 });
  }
  return null;
};

const toIsoDate = (value: Date) => value.toISOString().split('T')[0];

const coerceProgram = (value: unknown): ProgramTemplate | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  if (!Array.isArray(record.weeks)) return null;
  return value as ProgramTemplate;
};

type ProgramAssignmentRow = Database['public']['Tables']['program_assignments']['Row'];
type ProgramAssignmentInsert = Database['public']['Tables']['program_assignments']['Insert'];
type CustomProgramInsert = Database['public']['Tables']['custom_programs']['Insert'];

export async function GET(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = request.nextUrl.searchParams.get('role');
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('program_assignments')
    .select('*')
    .or(`coach_user_id.eq.${user.id},client_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (role === 'coach') query = query.eq('coach_user_id', user.id);
  if (role === 'client') query = query.eq('client_user_id', user.id);

  const { data: assignments, error } = await query;
  if (error) {
    console.error('Failed to list assignments:', error);
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
  }

  const rows = (assignments ?? []) as ProgramAssignmentRow[];
  const coachClientIds = Array.from(
    new Set(
      rows
        .filter((row) => row.coach_user_id === user.id)
        .map((row) => row.client_user_id)
        .filter((value) => typeof value === 'string')
    )
  );

  const summaryByClient: Record<
    string,
    {
      planned30: number;
      completed30: number;
      skipped30: number;
      moved30: number;
      workoutSessions30: number;
      adherenceRate30: number;
    }
  > = {};

  if (coachClientIds.length > 0) {
    const cutoffDate = toIsoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
    const [scheduleResult, workoutResult] = await Promise.all([
      supabase
        .from('program_schedule_events')
        .select('user_id,status')
        .in('user_id', coachClientIds)
        .gte('scheduled_date', cutoffDate),
      supabase
        .from('workout_sessions')
        .select('user_id,id')
        .in('user_id', coachClientIds)
        .gte('date', cutoffDate)
        .is('deleted_at', null),
    ]);

    if (!scheduleResult.error) {
      ((scheduleResult.data ?? []) as Array<{ user_id: string; status: string }>).forEach((event) => {
        if (!summaryByClient[event.user_id]) {
          summaryByClient[event.user_id] = {
            planned30: 0,
            completed30: 0,
            skipped30: 0,
            moved30: 0,
            workoutSessions30: 0,
            adherenceRate30: 0,
          };
        }
        summaryByClient[event.user_id].planned30 += 1;
        if (event.status === 'completed') summaryByClient[event.user_id].completed30 += 1;
        if (event.status === 'skipped') summaryByClient[event.user_id].skipped30 += 1;
        if (event.status === 'moved') summaryByClient[event.user_id].moved30 += 1;
      });
    }

    if (!workoutResult.error) {
      ((workoutResult.data ?? []) as Array<{ user_id: string }>).forEach((workout) => {
        if (!summaryByClient[workout.user_id]) {
          summaryByClient[workout.user_id] = {
            planned30: 0,
            completed30: 0,
            skipped30: 0,
            moved30: 0,
            workoutSessions30: 0,
            adherenceRate30: 0,
          };
        }
        summaryByClient[workout.user_id].workoutSessions30 += 1;
      });
    }

    Object.values(summaryByClient).forEach((summary) => {
      summary.adherenceRate30 =
        summary.planned30 > 0 ? Math.round((summary.completed30 / summary.planned30) * 100) : 0;
    });
  }

  return NextResponse.json({
    assignments: rows,
    summaryByClient,
  });
}

export async function POST(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const clientUserId = typeof payload.clientUserId === 'string' ? payload.clientUserId.trim() : '';
  const program = coerceProgram(payload.program);
  if (!clientUserId) return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 });
  if (!program) return NextResponse.json({ error: 'program is required' }, { status: 400 });
  if (clientUserId === user.id) return NextResponse.json({ error: 'Cannot assign to yourself' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: link, error: linkError } = await supabase
    .from('coach_client_links')
    .select('id,status')
    .eq('coach_user_id', user.id)
    .eq('client_user_id', clientUserId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (linkError) {
    console.error('Failed to check accepted coach/client link:', linkError);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: 'Accepted coach/client link is required before assignment' }, { status: 403 });
  }

  const assignmentId = createUuid();
  const assignedProgramId = `assigned_${createUuid()}`;
  const assignedAt = new Date().toISOString();

  const programSnapshot: ProgramTemplate = {
    ...program,
    id: assignedProgramId,
    isCustom: true,
    sourceType: 'assigned',
    sourceAssignmentId: assignmentId,
    assignedByUserId: user.id,
    assignedAt,
  };

  const insertProgramRow: CustomProgramInsert = {
    id: assignedProgramId,
    user_id: clientUserId,
    name: programSnapshot.name,
    program_data: JSON.parse(JSON.stringify(programSnapshot)),
    is_custom: true,
  };
  const { error: programInsertError } = await supabase
    .from('custom_programs')
    .insert(insertProgramRow);

  if (programInsertError) {
    console.error('Failed to insert assigned custom program:', programInsertError);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }

  const assignmentInsert: ProgramAssignmentInsert = {
    id: assignmentId,
    coach_user_id: user.id,
    client_user_id: clientUserId,
    link_id: link.id,
    source_program_id: program.id,
    source_program_name: program.name,
    assigned_program_id: assignedProgramId,
    program_snapshot: JSON.parse(JSON.stringify(programSnapshot)),
    status: 'assigned',
    assigned_at: assignedAt,
    metadata: {
      assigned_program_id: assignedProgramId,
    },
  };
  const { data: assignment, error: assignmentError } = await supabase
    .from('program_assignments')
    .insert(assignmentInsert)
    .select('*')
    .single();

  if (assignmentError) {
    console.error('Failed to insert assignment row:', assignmentError);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }

  return NextResponse.json(
    {
      assignment,
      assignedProgramId,
    },
    { status: 201 }
  );
}
