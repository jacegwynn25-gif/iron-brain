'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CalendarDays, Clock3 } from 'lucide-react';
import type { ProgramScheduleEvent, ProgramScheduleStatus, ProgramTemplate } from '@/app/lib/types';
import {
  createScheduleEvent,
  deleteScheduleEvent,
  listScheduleEvents,
  updateScheduleEvent,
} from '@/app/lib/calendar/schedule-api';
import { getProgramProgress } from '@/app/lib/programs/progress';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { trackUiEvent } from '@/app/lib/analytics/ui-events';

type CalendarViewMode = 'month' | 'week';

type ProgramsCalendarViewProps = {
  programs: ProgramTemplate[];
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatIsoDate = (date: Date) => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getStatusClass = (status: ProgramScheduleStatus) => {
  if (status === 'completed') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'skipped') return 'border-rose-500/35 bg-rose-500/10 text-rose-200';
  if (status === 'moved') return 'border-amber-500/35 bg-amber-500/10 text-amber-200';
  return 'border-zinc-700 bg-zinc-900/50 text-zinc-200';
};

export default function ProgramsCalendarView({ programs }: ProgramsCalendarViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const namespaceId = user?.id ?? 'guest';
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [cursorDate, setCursorDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => formatIsoDate(new Date()));
  const [events, setEvents] = useState<ProgramScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleProgramId, setScheduleProgramId] = useState('');
  const [scheduleWeekIndex, setScheduleWeekIndex] = useState(0);
  const [scheduleDayIndex, setScheduleDayIndex] = useState(0);
  const [scheduleDate, setScheduleDate] = useState(() => formatIsoDate(new Date()));
  const [rescheduleMap, setRescheduleMap] = useState<Record<string, string>>({});

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === scheduleProgramId) ?? null,
    [programs, scheduleProgramId]
  );

  const selectedSessionName = useMemo(() => {
    if (!selectedProgram) return 'Session';
    const week = selectedProgram.weeks[scheduleWeekIndex] ?? selectedProgram.weeks[0];
    const day = week?.days[scheduleDayIndex] ?? week?.days[0];
    return day?.name || `Session ${scheduleDayIndex + 1}`;
  }, [selectedProgram, scheduleDayIndex, scheduleWeekIndex]);

  const monthLabel = useMemo(
    () => cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [cursorDate]
  );

  const visibleRange = useMemo(() => {
    if (viewMode === 'week') {
      const center = new Date(selectedDate);
      const start = addDays(center, -3);
      const end = addDays(center, 3);
      return { from: formatIsoDate(start), to: formatIsoDate(end) };
    }
    const monthStart = startOfMonth(cursorDate);
    const monthEnd = endOfMonth(cursorDate);
    const start = addDays(monthStart, -6);
    const end = addDays(monthEnd, 6);
    return { from: formatIsoDate(start), to: formatIsoDate(end) };
  }, [cursorDate, selectedDate, viewMode]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextEvents = await listScheduleEvents(visibleRange);
      setEvents(nextEvents);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load schedule';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [visibleRange]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!scheduleProgramId && programs.length > 0) {
      setScheduleProgramId(programs[0].id);
    }
  }, [programs, scheduleProgramId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ProgramScheduleEvent[]>();
    events.forEach((event) => {
      const key = event.scheduledDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    map.forEach((list) => {
      list.sort((a, b) => a.sessionName.localeCompare(b.sessionName));
    });
    return map;
  }, [events]);

  const dayCells = useMemo(() => {
    const monthStart = startOfMonth(cursorDate);
    const monthEnd = endOfMonth(cursorDate);
    const startOffset = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let index = 0; index < startOffset; index += 1) {
      cells.push({ date: addDays(monthStart, index - startOffset), inMonth: false });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push({ date: new Date(cursorDate.getFullYear(), cursorDate.getMonth(), day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const lastDate = cells[cells.length - 1]?.date ?? monthEnd;
      cells.push({ date: addDays(lastDate, 1), inMonth: false });
    }
    return cells;
  }, [cursorDate]);

  const selectedDateEvents = useMemo(
    () => eventsByDate.get(selectedDate) ?? [],
    [eventsByDate, selectedDate]
  );
  const weekCells = useMemo(() => {
    const center = new Date(selectedDate);
    const start = addDays(center, -3);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDate]);

  const refreshAndTrack = useCallback(
    async (eventName: string, properties: Record<string, unknown>) => {
      if (user?.id) {
        void trackUiEvent(
          {
            name: eventName,
            source: 'program_calendar',
            properties,
          },
          user.id
        );
      }
      await loadEvents();
    },
    [loadEvents, user?.id]
  );

  const handleCreateEvent = async () => {
    if (!selectedProgram) return;
    setSaving(true);
    setError(null);
    try {
      await createScheduleEvent({
        programId: selectedProgram.id,
        programName: selectedProgram.name,
        weekIndex: scheduleWeekIndex,
        dayIndex: scheduleDayIndex,
        sessionName: selectedSessionName,
        scheduledDate: scheduleDate,
        status: 'scheduled',
      });
      await refreshAndTrack('calendar_schedule_created', {
        programId: selectedProgram.id,
        weekIndex: scheduleWeekIndex,
        dayIndex: scheduleDayIndex,
        scheduledDate: scheduleDate,
      });
      setSelectedDate(scheduleDate);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to schedule session');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (eventId: string, status: ProgramScheduleStatus) => {
    setSaving(true);
    setError(null);
    try {
      await updateScheduleEvent({ id: eventId, status });
      await refreshAndTrack('calendar_event_status_updated', { eventId, status });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = async (event: ProgramScheduleEvent) => {
    const nextDate = rescheduleMap[event.id] ?? event.scheduledDate;
    if (!nextDate) return;
    setSaving(true);
    setError(null);
    try {
      await updateScheduleEvent({
        id: event.id,
        scheduledDate: nextDate,
      });
      await refreshAndTrack('calendar_event_rescheduled', {
        eventId: event.id,
        from: event.scheduledDate,
        to: nextDate,
      });
      setSelectedDate(nextDate);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteScheduleEvent(eventId);
      await refreshAndTrack('calendar_event_deleted', { eventId });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = (event: ProgramScheduleEvent) => {
    const matchedProgram = programs.find((program) => program.id === event.programId);
    const progress = matchedProgram
      ? getProgramProgress(matchedProgram, namespaceId)
      : { cycleNumber: 1 };
    router.push(
      `/workout/new?program_id=${encodeURIComponent(event.programId)}&week=${event.weekIndex}&day=${event.dayIndex}&cycle=${progress.cycleNumber}`
    );
  };

  return (
    <section className="border-b border-zinc-900 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-zinc-400" />
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Program Calendar</p>
        </div>
        <div className="inline-flex h-11 items-center rounded-full border border-zinc-800 p-1">
          {(['month', 'week'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`h-9 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.2em] ${
                viewMode === mode ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCursorDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="flex-1 text-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-300">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursorDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:text-zinc-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <div className="mb-2 grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              {label}
            </p>
          ))}
        </div>
        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-2">
            {dayCells.map((cell) => {
              const isoDate = formatIsoDate(cell.date);
              const dayEvents = eventsByDate.get(isoDate) ?? [];
              const isSelected = isoDate === selectedDate;
              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => setSelectedDate(isoDate)}
                  className={`min-h-[90px] rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-500/45 bg-emerald-500/10'
                      : cell.inMonth
                        ? 'border-zinc-800 bg-zinc-950/60'
                        : 'border-zinc-900 bg-zinc-950/20'
                  }`}
                >
                  <p className={`text-xs font-bold ${cell.inMonth ? 'text-zinc-200' : 'text-zinc-600'}`}>
                    {cell.date.getDate()}
                  </p>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={`block truncate rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${getStatusClass(event.status)}`}
                      >
                        {event.sessionName}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekCells.map((date) => {
              const isoDate = formatIsoDate(date);
              const dayEvents = eventsByDate.get(isoDate) ?? [];
              const isSelected = isoDate === selectedDate;
              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => setSelectedDate(isoDate)}
                  className={`min-h-[96px] rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-cyan-500/45 bg-cyan-500/10'
                      : 'border-zinc-800 bg-zinc-950/60'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-200">{date.getDate()}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {date.toLocaleDateString(undefined, { month: 'short' })}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {dayEvents.length} {dayEvents.length === 1 ? 'session' : 'sessions'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Schedule Session</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Program
            <select
              value={scheduleProgramId}
              onChange={(event) => setScheduleProgramId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Date
            <input
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            />
          </label>

          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Week Index
            <input
              type="number"
              min={0}
              value={scheduleWeekIndex}
              onChange={(event) => setScheduleWeekIndex(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            />
          </label>

          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Session Index
            <input
              type="number"
              min={0}
              value={scheduleDayIndex}
              onChange={(event) => setScheduleDayIndex(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Session: {selectedSessionName}</p>
        <button
          type="button"
          onClick={handleCreateEvent}
          disabled={saving || !selectedProgram}
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Add to Calendar'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-zinc-500" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Agenda • {selectedDate}</p>
        </div>
        <div className="mt-3 space-y-2">
          {selectedDateEvents.length === 0 && (
            <p className="text-sm text-zinc-500">No scheduled sessions for this date.</p>
          )}
          {selectedDateEvents.map((event) => (
            <article key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-100">{event.sessionName}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {event.programName} • Week {event.weekIndex + 1} • Session {event.dayIndex + 1}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStatusClass(event.status)}`}
                >
                  {event.status}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleStart(event)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200"
                >
                  Start Session
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickStatus(event.id, 'completed')}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200"
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickStatus(event.id, 'skipped')}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200"
                >
                  Mark Skipped
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(event.id)}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={rescheduleMap[event.id] ?? event.scheduledDate}
                  onChange={(next) =>
                    setRescheduleMap((current) => ({
                      ...current,
                      [event.id]: next.target.value,
                    }))
                  }
                  className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleReschedule(event)}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-700 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200"
                >
                  Reschedule
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {(loading || error) && (
        <p className={`mt-3 text-xs ${error ? 'text-rose-400' : 'text-zinc-500'}`}>
          {error ?? 'Loading schedule...'}
        </p>
      )}
    </section>
  );
}
