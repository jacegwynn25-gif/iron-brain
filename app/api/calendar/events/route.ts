import { NextRequest, NextResponse } from 'next/server';
import { isValidUuid } from '@/app/lib/uuid';
import { FEATURES } from '@/app/lib/features';
import { getSupabaseAdmin, getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import type { Database } from '@/app/lib/supabase/database.types';
import type { ProgramScheduleStatus } from '@/app/lib/types';

const STATUS_VALUES: ProgramScheduleStatus[] = ['scheduled', 'completed', 'skipped', 'moved'];
const STATUS_SET = new Set<ProgramScheduleStatus>(STATUS_VALUES);

type MatchPayload = {
  programId?: string;
  weekIndex?: number;
  dayIndex?: number;
  scheduledDate?: string;
};

const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
};

const normalizeStatus = (value: unknown): ProgramScheduleStatus | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase() as ProgramScheduleStatus;
  return STATUS_SET.has(normalized) ? normalized : null;
};

const normalizeSessionId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('session_') ? trimmed.slice('session_'.length) : trimmed;
  return isValidUuid(normalized) ? normalized : null;
};

const ensureEnabled = () => {
  if (!FEATURES.programCalendar) {
    return NextResponse.json({ error: 'Program calendar is disabled' }, { status: 404 });
  }
  return null;
};

type ProgramScheduleEventRow = Database['public']['Tables']['program_schedule_events']['Row'];
type ProgramScheduleEventInsert = Database['public']['Tables']['program_schedule_events']['Insert'];
type ProgramScheduleEventUpdate = Database['public']['Tables']['program_schedule_events']['Update'];

export async function GET(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const from = normalizeDate(request.nextUrl.searchParams.get('from'));
  const to = normalizeDate(request.nextUrl.searchParams.get('to'));

  let query = supabase
    .from('program_schedule_events')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (from) query = query.gte('scheduled_date', from);
  if (to) query = query.lte('scheduled_date', to);

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load calendar events:', error);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
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

  const scheduledDate = normalizeDate(payload.scheduledDate);
  const status = normalizeStatus(payload.status) ?? 'scheduled';
  const programId = typeof payload.programId === 'string' ? payload.programId.trim() : '';
  const programName = typeof payload.programName === 'string' ? payload.programName.trim() : '';
  const sessionName = typeof payload.sessionName === 'string' ? payload.sessionName.trim() : '';
  const weekIndex = Number(payload.weekIndex ?? 0);
  const dayIndex = Number(payload.dayIndex ?? 0);

  if (!scheduledDate) return NextResponse.json({ error: 'scheduledDate is required (YYYY-MM-DD)' }, { status: 400 });
  if (!programId) return NextResponse.json({ error: 'programId is required' }, { status: 400 });
  if (!programName) return NextResponse.json({ error: 'programName is required' }, { status: 400 });
  if (!sessionName) return NextResponse.json({ error: 'sessionName is required' }, { status: 400 });
  if (!Number.isFinite(weekIndex) || weekIndex < 0) return NextResponse.json({ error: 'weekIndex must be >= 0' }, { status: 400 });
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return NextResponse.json({ error: 'dayIndex must be >= 0' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const metadata =
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? (payload.metadata as ProgramScheduleEventInsert['metadata'])
      : {};
  const insertRow: ProgramScheduleEventInsert = {
    user_id: user.id,
    program_id: programId,
    program_name: programName,
    week_index: Math.trunc(weekIndex),
    day_index: Math.trunc(dayIndex),
    session_name: sessionName,
    scheduled_date: scheduledDate,
    status,
    metadata,
  };

  const { data, error } = await supabase
    .from('program_schedule_events')
    .upsert(insertRow, { onConflict: 'user_id,program_id,week_index,day_index,scheduled_date' })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create/update calendar event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
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

  const supabase = getSupabaseAdmin();
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  const match = (payload.match && typeof payload.match === 'object' ? payload.match : null) as MatchPayload | null;
  let existing: ProgramScheduleEventRow | null = null;

  if (id) {
    const { data, error } = await supabase
      .from('program_schedule_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('Failed to fetch schedule event for patch:', error);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
    existing = data;
  } else if (match) {
    const scheduledDate = normalizeDate(match.scheduledDate);
    if (!scheduledDate || typeof match.programId !== 'string') {
      return NextResponse.json({ error: 'match requires programId + scheduledDate' }, { status: 400 });
    }
    const weekIndex = Number(match.weekIndex ?? 0);
    const dayIndex = Number(match.dayIndex ?? 0);

    const { data, error } = await supabase
      .from('program_schedule_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('program_id', match.programId)
      .eq('week_index', Math.trunc(weekIndex))
      .eq('day_index', Math.trunc(dayIndex))
      .eq('scheduled_date', scheduledDate)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Failed to match schedule event for patch:', error);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }
    existing = data;
  }

  if (!existing) return NextResponse.json({ error: 'Schedule event not found' }, { status: 404 });

  const nextDate = normalizeDate(payload.scheduledDate);
  const nextStatus = normalizeStatus(payload.status);
  const updates: ProgramScheduleEventUpdate = {};

  if (nextDate) {
    updates.scheduled_date = nextDate;
    if (existing.scheduled_date && existing.scheduled_date !== nextDate) {
      updates.moved_from_date = existing.scheduled_date;
      if (!nextStatus) updates.status = 'moved';
    }
  }
  if (nextStatus) {
    updates.status = nextStatus;
    updates.completed_at = nextStatus === 'completed' ? new Date().toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'completedWorkoutSessionId')) {
    updates.completed_workout_session_id = normalizeSessionId(payload.completedWorkoutSessionId);
  }
  if (typeof payload.sessionName === 'string' && payload.sessionName.trim()) {
    updates.session_name = payload.sessionName.trim();
  }
  if (typeof payload.programName === 'string' && payload.programName.trim()) {
    updates.program_name = payload.programName.trim();
  }
  if (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)) {
    updates.metadata = payload.metadata as ProgramScheduleEventUpdate['metadata'];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ event: existing });
  }

  const { data: updated, error: updateError } = await supabase
    .from('program_schedule_events')
    .update(updates)
    .eq('id', existing.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Failed to update calendar event:', updateError);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }

  return NextResponse.json({ event: updated });
}

export async function DELETE(request: NextRequest) {
  const disabled = ensureEnabled();
  if (disabled) return disabled;

  const user = await getSupabaseUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('program_schedule_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to delete calendar event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
