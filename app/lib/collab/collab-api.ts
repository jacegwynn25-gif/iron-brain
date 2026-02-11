import type { CoachClientLink, CoachClientLinkStatus, ProgramAssignment, ProgramTemplate } from '../types';
import { fetchJsonWithAuth } from '../api/authed-fetch';

type LinkRow = {
  id: string;
  coach_user_id: string;
  client_user_id: string;
  status: CoachClientLinkStatus;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

type AssignmentRow = {
  id: string;
  coach_user_id: string;
  client_user_id: string;
  source_program_id: string;
  source_program_name: string;
  assigned_program_id: string | null;
  status: ProgramAssignment['status'];
  assigned_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClientSummary = Record<
  string,
  {
    planned30: number;
    completed30: number;
    skipped30: number;
    moved30: number;
    workoutSessions30: number;
    adherenceRate30: number;
  }
>;

const mapLinkRow = (row: LinkRow): CoachClientLink => ({
  id: row.id,
  coachUserId: row.coach_user_id,
  clientUserId: row.client_user_id,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  respondedAt: row.responded_at,
});

const mapAssignmentRow = (row: AssignmentRow): ProgramAssignment => ({
  id: row.id,
  coachUserId: row.coach_user_id,
  clientUserId: row.client_user_id,
  sourceProgramId: row.source_program_id,
  sourceProgramName: row.source_program_name,
  assignedProgramId: row.assigned_program_id,
  status: row.status,
  assignedAt: row.assigned_at,
  acceptedAt: row.accepted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listCoachClientLinks(
  status?: CoachClientLinkStatus
): Promise<CoachClientLink[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  const payload = await fetchJsonWithAuth<{ links: LinkRow[] }>(`/api/collab/links${suffix}`);
  return (payload.links ?? []).map(mapLinkRow);
}

export async function createCoachClientLink(clientUserId: string): Promise<CoachClientLink> {
  const payload = await fetchJsonWithAuth<{ link: LinkRow }>(`/api/collab/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientUserId }),
  });
  return mapLinkRow(payload.link);
}

export async function updateCoachClientLink(
  id: string,
  status: CoachClientLinkStatus
): Promise<CoachClientLink> {
  const payload = await fetchJsonWithAuth<{ link: LinkRow }>(`/api/collab/links/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return mapLinkRow(payload.link);
}

export async function listProgramAssignments(
  role?: 'coach' | 'client'
): Promise<{ assignments: ProgramAssignment[]; summaryByClient: ClientSummary }> {
  const suffix = role ? `?role=${encodeURIComponent(role)}` : '';
  const payload = await fetchJsonWithAuth<{ assignments: AssignmentRow[]; summaryByClient: ClientSummary }>(
    `/api/collab/assignments${suffix}`
  );
  return {
    assignments: (payload.assignments ?? []).map(mapAssignmentRow),
    summaryByClient: payload.summaryByClient ?? {},
  };
}

export async function createProgramAssignment(
  clientUserId: string,
  program: ProgramTemplate
): Promise<{ assignment: ProgramAssignment; assignedProgramId: string }> {
  const payload = await fetchJsonWithAuth<{ assignment: AssignmentRow; assignedProgramId: string }>(
    '/api/collab/assignments',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientUserId, program }),
    }
  );
  return {
    assignment: mapAssignmentRow(payload.assignment),
    assignedProgramId: payload.assignedProgramId,
  };
}
