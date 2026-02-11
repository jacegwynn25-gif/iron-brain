import type { ProgramScheduleEvent, ProgramScheduleStatus } from '../types';
import { fetchJsonWithAuth } from '../api/authed-fetch';

type EventRow = {
  id: string;
  user_id: string;
  program_id: string;
  program_name: string;
  week_index: number;
  day_index: number;
  session_name: string;
  scheduled_date: string;
  status: ProgramScheduleStatus;
  completed_workout_session_id: string | null;
  completed_at: string | null;
  moved_from_date: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const mapEventRow = (row: EventRow): ProgramScheduleEvent => ({
  id: row.id,
  userId: row.user_id,
  programId: row.program_id,
  programName: row.program_name,
  weekIndex: row.week_index,
  dayIndex: row.day_index,
  sessionName: row.session_name,
  scheduledDate: row.scheduled_date,
  status: row.status,
  completedWorkoutSessionId: row.completed_workout_session_id,
  completedAt: row.completed_at,
  movedFromDate: row.moved_from_date,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type ScheduleQueryOptions = {
  from?: string;
  to?: string;
};

export async function listScheduleEvents(
  options: ScheduleQueryOptions = {}
): Promise<ProgramScheduleEvent[]> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await fetchJsonWithAuth<{ events: EventRow[] }>(`/api/calendar/events${suffix}`);
  return (payload.events ?? []).map(mapEventRow);
}

export type CreateScheduleEventInput = {
  programId: string;
  programName: string;
  weekIndex: number;
  dayIndex: number;
  sessionName: string;
  scheduledDate: string;
  status?: ProgramScheduleStatus;
  metadata?: Record<string, unknown>;
};

export async function createScheduleEvent(input: CreateScheduleEventInput): Promise<ProgramScheduleEvent> {
  const payload = await fetchJsonWithAuth<{ event: EventRow }>('/api/calendar/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return mapEventRow(payload.event);
}

export type UpdateScheduleEventInput = {
  id?: string;
  match?: {
    programId: string;
    weekIndex: number;
    dayIndex: number;
    scheduledDate: string;
  };
  scheduledDate?: string;
  status?: ProgramScheduleStatus;
  sessionName?: string;
  programName?: string;
  completedWorkoutSessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function updateScheduleEvent(input: UpdateScheduleEventInput): Promise<ProgramScheduleEvent> {
  const payload = await fetchJsonWithAuth<{ event: EventRow }>('/api/calendar/events', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return mapEventRow(payload.event);
}

export async function deleteScheduleEvent(eventId: string): Promise<void> {
  await fetchJsonWithAuth<{ ok: boolean }>(`/api/calendar/events?id=${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}
