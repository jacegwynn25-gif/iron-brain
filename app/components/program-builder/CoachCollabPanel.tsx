'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Link2, Send, UserCheck } from 'lucide-react';
import type { CoachClientLink, ProgramAssignment, ProgramTemplate } from '@/app/lib/types';
import {
  createCoachClientLink,
  createProgramAssignment,
  listCoachClientLinks,
  listProgramAssignments,
  updateCoachClientLink,
} from '@/app/lib/collab/collab-api';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { trackUiEvent } from '@/app/lib/analytics/ui-events';

type CoachCollabPanelProps = {
  programs: ProgramTemplate[];
};

export default function CoachCollabPanel({ programs }: CoachCollabPanelProps) {
  const { user } = useAuth();
  const [links, setLinks] = useState<CoachClientLink[]>([]);
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [summaryByClient, setSummaryByClient] = useState<
    Record<
      string,
      {
        planned30: number;
        completed30: number;
        skipped30: number;
        moved30: number;
        workoutSessions30: number;
        adherenceRate30: number;
      }
    >
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientUserIdInput, setClientUserIdInput] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [nextLinks, nextAssignments] = await Promise.all([
        listCoachClientLinks(),
        listProgramAssignments(),
      ]);
      setLinks(nextLinks);
      setAssignments(nextAssignments.assignments);
      setSummaryByClient(nextAssignments.summaryByClient);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const coachAcceptedClients = useMemo(
    () =>
      links.filter(
        (link) => link.coachUserId === user?.id && link.status === 'accepted'
      ),
    [links, user?.id]
  );

  const incomingPendingLinks = useMemo(
    () =>
      links.filter(
        (link) => link.clientUserId === user?.id && link.status === 'pending'
      ),
    [links, user?.id]
  );

  const coachAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.coachUserId === user?.id),
    [assignments, user?.id]
  );

  const clientAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.clientUserId === user?.id),
    [assignments, user?.id]
  );

  useEffect(() => {
    if (!selectedProgramId && programs.length > 0) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    if (!selectedClientId && coachAcceptedClients.length > 0) {
      setSelectedClientId(coachAcceptedClients[0].clientUserId);
    }
  }, [coachAcceptedClients, selectedClientId]);

  const handleCreateLink = async () => {
    if (!clientUserIdInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCoachClientLink(clientUserIdInput.trim());
      if (user?.id) {
        void trackUiEvent(
          {
            name: 'collab_link_created',
            source: 'collaboration',
            properties: { clientUserId: clientUserIdInput.trim() },
          },
          user.id
        );
      }
      setClientUserIdInput('');
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create link');
    } finally {
      setBusy(false);
    }
  };

  const handleRespondLink = async (linkId: string, status: 'accepted' | 'rejected' | 'revoked') => {
    setBusy(true);
    setError(null);
    try {
      await updateCoachClientLink(linkId, status);
      if (user?.id) {
        void trackUiEvent(
          {
            name: 'collab_link_status_updated',
            source: 'collaboration',
            properties: { linkId, status },
          },
          user.id
        );
      }
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update link');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignProgram = async () => {
    if (!selectedClientId || !selectedProgramId) return;
    const selectedProgram = programs.find((program) => program.id === selectedProgramId);
    if (!selectedProgram) return;
    setBusy(true);
    setError(null);
    try {
      await createProgramAssignment(selectedClientId, selectedProgram);
      if (user?.id) {
        void trackUiEvent(
          {
            name: 'collab_program_assigned',
            source: 'collaboration',
            properties: {
              clientUserId: selectedClientId,
              programId: selectedProgram.id,
            },
          },
          user.id
        );
      }
      await loadData();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Failed to assign program');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 border-b border-zinc-900 py-6">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-zinc-400" />
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Coach Collaboration</p>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-zinc-500" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Create Coach/Client Link</p>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={clientUserIdInput}
            onChange={(event) => setClientUserIdInput(event.target.value)}
            placeholder="Client User ID"
            className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCreateLink()}
            disabled={busy || !clientUserIdInput.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-950 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            Link
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-zinc-500" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Incoming Requests</p>
        </div>
        <div className="mt-3 space-y-2">
          {incomingPendingLinks.length === 0 && (
            <p className="text-sm text-zinc-500">No pending requests.</p>
          )}
          {incomingPendingLinks.map((link) => (
            <div key={link.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-sm font-semibold text-zinc-200">Coach: {link.coachUserId}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleRespondLink(link.id, 'accepted')}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => void handleRespondLink(link.id, 'rejected')}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Assign Program Snapshot</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Client
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              {coachAcceptedClients.length === 0 && <option value="">No accepted clients</option>}
              {coachAcceptedClients.map((link) => (
                <option key={link.id} value={link.clientUserId}>
                  {link.clientUserId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Program
            <select
              value={selectedProgramId}
              onChange={(event) => setSelectedProgramId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleAssignProgram()}
          disabled={busy || !selectedClientId || !selectedProgramId}
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-950 disabled:opacity-60"
        >
          Assign Program
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Coach Client Overview (30 Days)</p>
        <div className="mt-3 space-y-2">
          {coachAcceptedClients.length === 0 && (
            <p className="text-sm text-zinc-500">No accepted clients yet.</p>
          )}
          {coachAcceptedClients.map((link) => {
            const summary = summaryByClient[link.clientUserId];
            return (
              <div key={`summary-${link.id}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm font-semibold text-zinc-100">{link.clientUserId}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Planned {summary?.planned30 ?? 0} • Completed {summary?.completed30 ?? 0} • Adherence{' '}
                  {summary?.adherenceRate30 ?? 0}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Assignments Sent</p>
          <div className="mt-3 space-y-2">
            {coachAssignments.length === 0 && <p className="text-sm text-zinc-500">No assignments sent yet.</p>}
            {coachAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm font-semibold text-zinc-100">{assignment.sourceProgramName}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Client {assignment.clientUserId} • {assignment.status}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Assignments Received</p>
          <div className="mt-3 space-y-2">
            {clientAssignments.length === 0 && <p className="text-sm text-zinc-500">No assignments received yet.</p>}
            {clientAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm font-semibold text-zinc-100">{assignment.sourceProgramName}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Coach {assignment.coachUserId} • {assignment.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(loading || error) && (
        <p className={`text-xs ${error ? 'text-rose-400' : 'text-zinc-500'}`}>
          {error ?? 'Loading collaboration data...'}
        </p>
      )}
    </section>
  );
}
