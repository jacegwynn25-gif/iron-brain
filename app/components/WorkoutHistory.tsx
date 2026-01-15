'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, History, Trophy, TrendingUp } from 'lucide-react';
import { WorkoutSession, SetLog, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import { useAuth } from '../lib/supabase/auth-context';
import { getCustomExercises } from '../lib/exercises/custom-exercises';

interface WorkoutHistoryProps {
  workoutHistory: WorkoutSession[];
  onHistoryUpdate: () => void;
}

export default function WorkoutHistory({ workoutHistory, onHistoryUpdate }: WorkoutHistoryProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<WorkoutSession | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  useEffect(() => {
    let isMounted = true;
    getCustomExercises(user?.id || null)
      .then(exercises => {
        if (!isMounted) return;
        setCustomExercises(exercises);
      })
      .catch(err => {
        console.error('Failed to load custom exercises:', err);
        if (isMounted) {
          setCustomExercises([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    defaultExercises.forEach(ex => map.set(ex.id, ex.name));
    customExercises.forEach(ex => map.set(ex.id, ex.name));
    return map;
  }, [customExercises]);

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const getExerciseName = (exerciseId: string): string => {
    return exerciseNameById.get(exerciseId) || exerciseId;
  };

  const getExercisePRs = (exerciseId: string) => {
    const prs = storage.getPersonalRecords(exerciseId);
    return prs;
  };

  const checkIfPR = (set: SetLog, exerciseId: string): { type: string; icon: React.ReactNode } | null => {
    const prs = getExercisePRs(exerciseId);
    if (!prs) return null;

    const setDate = set.timestamp || '';
    const { maxWeight, maxReps, maxE1RM } = prs;

    // Check if this set IS the PR (within same day)
    if (
      maxWeight &&
      set.actualWeight === maxWeight.weight &&
      set.actualReps === maxWeight.reps &&
      setDate.startsWith(maxWeight.date.split('T')[0])
    ) {
      return { type: 'Weight PR', icon: <Trophy className="h-4 w-4" /> };
    }

    if (
      maxReps &&
      set.actualWeight === maxReps.weight &&
      set.actualReps === maxReps.reps &&
      setDate.startsWith(maxReps.date.split('T')[0])
    ) {
      return { type: 'Rep PR', icon: <Flame className="h-4 w-4" /> };
    }

    if (
      maxE1RM &&
      set.e1rm === maxE1RM.e1rm &&
      setDate.startsWith(maxE1RM.date.split('T')[0])
    ) {
      return { type: 'E1RM PR', icon: <TrendingUp className="h-4 w-4" /> };
    }

    return null;
  };

  const groupSetsByExercise = (sets: SetLog[]) => {
    const grouped: { [exerciseId: string]: SetLog[] } = {};
    for (const set of sets) {
      if (!grouped[set.exerciseId]) {
        grouped[set.exerciseId] = [];
      }
      grouped[set.exerciseId].push(set);
    }
    return grouped;
  };

  const calculateSessionStats = (session: WorkoutSession) => {
    const completedSets = session.sets.filter(s => s.completed);
    const totalVolume = completedSets.reduce((sum, set) => {
      return sum + ((set.actualWeight || 0) * (set.actualReps || 0));
    }, 0);
    const avgRPE = completedSets.length > 0
      ? completedSets.reduce((sum, set) => sum + (set.actualRPE || 0), 0) / completedSets.length
      : 0;

    return { totalVolume, avgRPE };
  };

  const deleteSession = (sessionId: string) => {
    const session = workoutHistory.find(w => w.id === sessionId);
    if (!session) return;
    setEditTarget(null);
    setDeleteTarget(session);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await storage.deleteWorkoutSession(deleteTarget.id);
      setDeleteTarget(null);
      onHistoryUpdate();
    } catch (err) {
      console.error('Failed to delete workout:', err);
      setDeleteError('Could not move workout to trash. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const toDateTime = (date: string, time: string) => {
    if (!date || !time) return null;
    const parsed = new Date(`${date}T${time}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const openEditSession = (session: WorkoutSession) => {
    setDeleteTarget(null);
    setEditTarget(session);
    setEditDate(session.date);
    setEditStartTime(formatTime(session.startTime));
    setEditDuration(session.durationMinutes ? String(session.durationMinutes) : '');
    setEditError(null);
  };

  const handleConfirmEdit = async () => {
    if (!editTarget) return;
    if (!editDate) {
      setEditError('Please choose a date.');
      return;
    }

    setEditBusy(true);
    setEditError(null);

    try {
      const resolvedStart = editStartTime || formatTime(editTarget.startTime);
      const resolvedDuration = editDuration ? parseInt(editDuration, 10) : editTarget.durationMinutes;
      const startDateTime = resolvedStart ? toDateTime(editDate, resolvedStart) : null;

      let endDateTime: Date | null = null;
      if (startDateTime && Number.isFinite(resolvedDuration)) {
        endDateTime = new Date(startDateTime.getTime() + (resolvedDuration as number) * 60000);
      } else if (editTarget.endTime) {
        const resolvedEnd = formatTime(editTarget.endTime);
        endDateTime = resolvedEnd ? toDateTime(editDate, resolvedEnd) : null;
      }

      const updates: Partial<WorkoutSession> = {
        date: editDate,
      };

      if (startDateTime) {
        updates.startTime = startDateTime.toISOString();
      }
      if (endDateTime) {
        updates.endTime = endDateTime.toISOString();
      }
      if (Number.isFinite(resolvedDuration)) {
        updates.durationMinutes = resolvedDuration as number;
      }

      await storage.updateWorkoutDetails(editTarget.id, updates);
      setEditTarget(null);
      onHistoryUpdate();
    } catch (err) {
      console.error('Failed to update workout details:', err);
      setEditError('Could not save changes. Please try again.');
    } finally {
      setEditBusy(false);
    }
  };

  const editEndTimeLabel = useMemo(() => {
    if (!editDate || !editTarget) return null;
    const resolvedStart = editStartTime || formatTime(editTarget.startTime);
    const resolvedDuration = editDuration ? parseInt(editDuration, 10) : editTarget.durationMinutes;
    if (!resolvedStart || !Number.isFinite(resolvedDuration)) return null;
    const startDateTime = toDateTime(editDate, resolvedStart);
    if (!startDateTime) return null;
    const endDateTime = new Date(startDateTime.getTime() + (resolvedDuration as number) * 60000);
    return endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [editDate, editStartTime, editDuration, editTarget]);

  const sortedHistory = useMemo(() => {
    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();
    return [...workoutHistory].sort((a, b) => getSortTime(b) - getSortTime(a));
  }, [workoutHistory]);

  if (sortedHistory.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
        <History className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h3 className="mb-2 text-xl font-semibold text-white">
          No Workouts Yet
        </h3>
        <p className="text-sm text-gray-400">
          Complete your first workout to see it here with detailed analytics and PR tracking.
        </p>
        <button
          onClick={() => router.push('/start')}
          className="mt-4 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        >
          Start a Workout
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
      {/* Header with Stats */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Workout History
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {sortedHistory.length} {sortedHistory.length === 1 ? 'session' : 'sessions'} completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {sortedHistory.reduce((sum, s) => sum + calculateSessionStats(s).totalVolume, 0).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-400">lbs total volume</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedHistory.map((session, sessionIdx) => {
          const isExpanded = expandedSessions.has(session.id);
          const stats = calculateSessionStats(session);
          const groupedSets = groupSetsByExercise(session.sets);
          const exerciseIds = Object.keys(groupedSets);

          return (
            <div
              key={session.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-md transition-all hover:shadow-xl animate-fadeIn"
              style={{ animationDelay: `${sessionIdx * 50}ms` }}
            >
              {/* Session Header */}
              <div
                className="cursor-pointer bg-white/5 border-b border-white/10 p-4 sm:p-5 transition-all hover:bg-white/10"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl sm:text-2xl font-semibold text-white">
                        {session.dayName}
                      </h3>
                      <span className="rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
                        {session.programName}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {parseLocalDate(session.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                          Sets
                        </p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {session.sets.filter(s => s.completed).length}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                          Volume
                        </p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {Math.round(stats.totalVolume / 1000)}k
                        </p>
                      </div>

                      {stats.avgRPE > 0 && (
                        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                            Avg RPE
                          </p>
                          <p className="mt-1 text-2xl font-bold text-white">
                            {stats.avgRPE.toFixed(1)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditSession(session);
                      }}
                      className="rounded-xl bg-white/10 border border-white/10 p-2.5 text-gray-300 transition-all hover:bg-white/15 active:scale-[0.98]"
                      title="Edit workout details"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.5 20.213 3 21l.787-4.5L16.862 4.487z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98]"
                      title="Delete workout"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className="rounded-full bg-white/10 border border-white/10 p-2 shadow-sm">
                      <svg
                        className={`h-6 w-6 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-white/10 bg-white/5 p-4 sm:p-5 animate-slideDown">
                  <div className="space-y-5">
                    {exerciseIds.map((exerciseId, exIdx) => {
                      const exerciseSets = groupedSets[exerciseId];
                      const completedSets = exerciseSets.filter(s => s.completed);
                      if (completedSets.length === 0) return null;

                      const exerciseName = getExerciseName(exerciseId);
                      const exerciseVolume = completedSets.reduce(
                        (sum, set) => sum + ((set.actualWeight || 0) * (set.actualReps || 0)),
                        0
                      );

                      return (
                        <div
                          key={exerciseId}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-sm"
                          style={{ animationDelay: `${exIdx * 100}ms` }}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-white">
                              {exerciseName}
                            </h4>
                            <div className="rounded-xl bg-purple-500/20 border border-purple-500/30 px-4 py-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                                Volume
                              </p>
                              <p className="text-lg font-semibold text-white">
                                {exerciseVolume.toLocaleString()} lbs
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {completedSets.map((set, idx) => {
                              const pr = checkIfPR(set, exerciseId);

                              return (
                                <div
                                  key={`${exerciseId}-${set.setIndex}-${idx}-${set.timestamp || idx}`}
                                  className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm transition-all hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-gray-300">
                                      {set.setIndex}
                                    </span>
                                    <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
                                      <span className="font-semibold text-white">
                                        {set.actualWeight} lbs
                                      </span>
                                      <span className="text-gray-500">×</span>
                                      <span className="font-semibold text-white">
                                        {set.actualReps} reps
                                      </span>
                                      {set.actualRPE && (
                                        <>
                                          <span className="text-gray-500">@</span>
                                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                            RPE {set.actualRPE}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                                    {set.e1rm && (
                                      <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-300">
                                        {Math.round(set.e1rm)} E1RM
                                      </span>
                                    )}
                                    {pr && (
                                      <span
                                        className="flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300"
                                        title={pr.type}
                                      >
                                        <span className="text-base leading-none">{pr.icon}</span>
                                        <span>PR!</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {session.notes && (
                    <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3">
                      <p className="text-sm font-medium text-gray-300">
                        Notes: {session.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <div className="p-6 sm:p-8 text-white">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Confirm Delete
            </div>
            <h3 className="text-2xl font-bold sm:text-3xl">Move workout to trash?</h3>
            <p className="mt-2 text-sm text-gray-300">
              You can restore it from Data / Recently Deleted within 30 days.
            </p>

            <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-sm font-semibold text-gray-300">Workout</p>
              <p className="text-lg font-semibold">{deleteTarget.dayName || 'Workout'}</p>
              <p className="text-sm text-gray-400">
                {deleteTarget.programName || 'Custom'} • {parseLocalDate(deleteTarget.date).toLocaleDateString()}
              </p>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
                {deleteError}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 p-6 sm:flex-row sm:justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteBusy}
              className="rounded-xl bg-gradient-to-r from-red-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {deleteBusy ? 'Moving...' : 'Move to Trash'}
            </button>
          </div>
        </div>
        </div>
      )}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <div className="p-6 sm:p-8 text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                Adjust Details
              </div>
              <h3 className="text-2xl font-bold sm:text-3xl">Edit workout date & time</h3>
              <p className="mt-2 text-sm text-gray-300">
                Backdate a workout or tweak the session timing. Stats will update automatically.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-sm font-semibold text-gray-300">Workout</p>
                  <p className="text-lg font-semibold">{editTarget.dayName || 'Workout'}</p>
                  <p className="text-sm text-gray-400">
                    {editTarget.programName || 'Custom'} • {parseLocalDate(editTarget.date).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-end">
                  <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300 w-full">
                    <span className="font-semibold text-white">Ends</span>{' '}
                    {editEndTimeLabel ? `around ${editEndTimeLabel}` : '-'}
                  </div>
                </div>
              </div>

              {editError && (
                <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
                  {editError}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 p-6 sm:flex-row sm:justify-end">
              <button
                onClick={() => setEditTarget(null)}
                disabled={editBusy}
                className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEdit}
                disabled={editBusy}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {editBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
