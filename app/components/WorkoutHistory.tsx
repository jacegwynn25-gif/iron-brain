'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, History, Trophy, TrendingUp } from 'lucide-react';
import { WorkoutSession, SetLog, CustomExercise, WeightUnit } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import { useAuth } from '../lib/supabase/auth-context';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { useUnitPreference } from '../lib/hooks/useUnitPreference';
import { convertWeight } from '../lib/units';

interface WorkoutHistoryProps {
  workoutHistory: WorkoutSession[];
  onHistoryUpdate: () => void;
}

export default function WorkoutHistory({ workoutHistory, onHistoryUpdate }: WorkoutHistoryProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { weightUnit } = useUnitPreference();
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

  const personalRecordsByExercise = useMemo(() => {
    type PersonalRecordSnapshot = {
      maxWeight: { weight: number; reps: number; date: string };
      maxReps: { weight: number; reps: number; date: string };
      maxE1RM: { e1rm: number; weight: number; reps: number; date: string };
      maxVolume: { volume: number; weight: number; reps: number; date: string };
    };

    const toLbs = (value: number | null | undefined, unit?: WeightUnit) =>
      value != null ? convertWeight(Number(value), unit ?? 'lbs', 'lbs') : 0;

    const map = new Map<string, PersonalRecordSnapshot>();
    workoutHistory.forEach((session) => {
      const sessionDate = session.date || '';
      session.sets.forEach((set) => {
        if (!set.completed) return;
        const exerciseId = set.exerciseId;
        const reps = Number(set.actualReps ?? 0);
        const weightLbs = toLbs(set.actualWeight, set.weightUnit);
        const e1rmLbs = set.e1rm != null ? toLbs(set.e1rm, set.weightUnit) : 0;
        const volume = weightLbs * reps;
        const date = set.timestamp || sessionDate || '';

        if (!map.has(exerciseId)) {
          map.set(exerciseId, {
            maxWeight: { weight: weightLbs, reps, date },
            maxReps: { weight: weightLbs, reps, date },
            maxE1RM: { e1rm: e1rmLbs, weight: weightLbs, reps, date },
            maxVolume: { volume, weight: weightLbs, reps, date },
          });
        }

        const record = map.get(exerciseId)!;
        if (weightLbs > record.maxWeight.weight) {
          record.maxWeight = { weight: weightLbs, reps, date };
        }
        if (reps > record.maxReps.reps) {
          record.maxReps = { weight: weightLbs, reps, date };
        }
        if (e1rmLbs > record.maxE1RM.e1rm) {
          record.maxE1RM = { e1rm: e1rmLbs, weight: weightLbs, reps, date };
        }
        if (volume > record.maxVolume.volume) {
          record.maxVolume = { volume, weight: weightLbs, reps, date };
        }
      });
    });

    return map;
  }, [workoutHistory]);

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
    return personalRecordsByExercise.get(exerciseId) ?? null;
  };

  const checkIfPR = (
    set: SetLog,
    exerciseId: string,
    sessionDate?: string
  ): { type: string; icon: React.ReactNode } | null => {
    const prs = getExercisePRs(exerciseId);
    if (!prs) return null;

    const setDate = set.timestamp || sessionDate || '';
    const { maxWeight, maxReps, maxE1RM } = prs;
    const almostEqual = (a: number, b: number) => Math.abs(a - b) < 0.01;
    const setWeightLbs = set.actualWeight != null
      ? convertWeight(Number(set.actualWeight), set.weightUnit ?? 'lbs', 'lbs')
      : null;
    const setE1rmLbs = set.e1rm != null
      ? convertWeight(Number(set.e1rm), set.weightUnit ?? 'lbs', 'lbs')
      : null;

    // Check if this set IS the PR (within same day)
    if (
      maxWeight &&
      setWeightLbs != null &&
      almostEqual(setWeightLbs, maxWeight.weight) &&
      set.actualReps === maxWeight.reps &&
      setDate.startsWith(maxWeight.date.split('T')[0])
    ) {
      return { type: 'Weight PR', icon: <Trophy className="h-4 w-4" /> };
    }

    if (
      maxReps &&
      setWeightLbs != null &&
      almostEqual(setWeightLbs, maxReps.weight) &&
      set.actualReps === maxReps.reps &&
      setDate.startsWith(maxReps.date.split('T')[0])
    ) {
      return { type: 'Rep PR', icon: <Flame className="h-4 w-4" /> };
    }

    if (
      maxE1RM &&
      setE1rmLbs != null &&
      almostEqual(setE1rmLbs, maxE1RM.e1rm) &&
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
      const reps = typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0);
      const rawWeight = typeof set.actualWeight === 'number' ? set.actualWeight : Number(set.actualWeight ?? 0);
      if (!Number.isFinite(reps) || reps <= 0) return sum;
      if (!Number.isFinite(rawWeight) || rawWeight <= 0) return sum;
      const fromUnit = set.weightUnit ?? 'lbs';
      const displayWeight = convertWeight(rawWeight, fromUnit, weightUnit);
      return sum + (displayWeight * reps);
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
      <div className="py-16 text-center">
        <History className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
        <h3 className="mb-2 text-2xl font-black text-white">
          No Workouts Yet
        </h3>
        <p className="text-sm text-zinc-500">
          Complete your first workout to see it here with detailed analytics and PR tracking.
        </p>
        <button
          onClick={() => router.push('/start')}
          className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
        >
          Start a Workout
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-500">
              Session Totals
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">Workout History</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {sortedHistory.length} {sortedHistory.length === 1 ? 'session' : 'sessions'} completed
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-3xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              {Math.round(sortedHistory.reduce((sum, s) => sum + calculateSessionStats(s).totalVolume, 0)).toLocaleString()}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
              {weightUnit} total volume
            </p>
          </div>
        </div>

        <div className="space-y-6">
        {sortedHistory.map((session, sessionIdx) => {
          const isExpanded = expandedSessions.has(session.id);
          const stats = calculateSessionStats(session);
          const groupedSets = groupSetsByExercise(session.sets);
          const exerciseIds = Object.keys(groupedSets);

          return (
            <div
              key={session.id}
              className="group border-b border-zinc-900 pb-6"
              style={{ animationDelay: `${sessionIdx * 50}ms` }}
            >
              {/* Session Header */}
              <div
                className="cursor-pointer py-4"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        {session.dayName || 'Workout'}
                      </h3>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-300">
                        {session.programName || 'Custom'}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
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

                    {/* Stats */}
                    <div className="mt-4 flex flex-wrap gap-6 text-sm">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                          Sets
                        </p>
                        <p className="mt-1 text-2xl font-black text-white">
                          {session.sets.filter(s => s.completed).length}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                          Volume
                        </p>
                        <p className="mt-1 text-2xl font-black text-white">
                          {Math.round(stats.totalVolume / 1000)}k
                        </p>
                      </div>

                      {stats.avgRPE > 0 && (
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                            Avg RPE
                          </p>
                          <p className="mt-1 text-2xl font-black text-white">
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
                      className="p-2 text-zinc-500 transition-colors hover:text-white active:scale-[0.98]"
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
                      className="p-2 text-rose-400 transition-colors hover:text-rose-300 active:scale-[0.98]"
                      title="Delete workout"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className="p-2">
                      <svg
                        className={`h-6 w-6 text-zinc-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                <div className="border-t border-zinc-900 pt-5">
                  <div className="space-y-6">
                    {exerciseIds.map((exerciseId, exIdx) => {
                      const exerciseSets = groupedSets[exerciseId];
                      const completedSets = exerciseSets.filter(s => s.completed);
                      if (completedSets.length === 0) return null;

                      const exerciseName = getExerciseName(exerciseId);
                      const exerciseVolume = completedSets.reduce(
                        (sum, set) => {
                          const reps = typeof set.actualReps === 'number' ? set.actualReps : Number(set.actualReps ?? 0);
                          const rawWeight = typeof set.actualWeight === 'number' ? set.actualWeight : Number(set.actualWeight ?? 0);
                          if (!Number.isFinite(reps) || reps <= 0) return sum;
                          if (!Number.isFinite(rawWeight) || rawWeight <= 0) return sum;
                          const fromUnit = set.weightUnit ?? 'lbs';
                          const displayWeight = convertWeight(rawWeight, fromUnit, weightUnit);
                          return sum + (displayWeight * reps);
                        },
                        0
                      );

                      return (
                        <div
                          key={exerciseId}
                          className="border-b border-zinc-900 pb-6"
                          style={{ animationDelay: `${exIdx * 100}ms` }}
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-lg font-bold text-white">
                              {exerciseName}
                            </h4>
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                                Volume
                              </p>
                              <p className="text-lg font-black text-white">
                                {Math.round(exerciseVolume).toLocaleString()} {weightUnit}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {completedSets.map((set, idx) => {
                              const pr = checkIfPR(set, exerciseId, session.date);
                              const fromUnit = set.weightUnit ?? 'lbs';
                              const displayWeight = set.actualWeight != null
                                ? convertWeight(Number(set.actualWeight), fromUnit, weightUnit)
                                : null;
                              const displayE1RM = set.e1rm != null
                                ? convertWeight(Number(set.e1rm), fromUnit, weightUnit)
                                : null;

                              return (
                                <div
                                  key={`${exerciseId}-${set.setIndex}-${idx}-${set.timestamp || idx}`}
                                  className="group flex flex-col gap-3 border-b border-zinc-900 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-zinc-200">
                                      {set.setIndex}
                                    </span>
                                    <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
                                      <span className="font-semibold text-white">
                                        {displayWeight != null && Number.isFinite(displayWeight)
                                          ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(displayWeight)} ${weightUnit}`
                                          : `— ${weightUnit}`}
                                      </span>
                                      <span className="text-zinc-500">×</span>
                                      <span className="font-semibold text-white">
                                        {set.actualReps} reps
                                      </span>
                                      {set.actualRPE && (
                                        <>
                                          <span className="text-zinc-500">@</span>
                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                          RPE {set.actualRPE}
                                        </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                                    {set.e1rm && (
                                      <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                                        {displayE1RM != null && Number.isFinite(displayE1RM)
                                          ? `${Math.round(displayE1RM)} E1RM`
                                          : 'E1RM'}
                                      </span>
                                    )}
                                    {pr && (
                                      <span
                                        className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
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
                    <div className="mt-4 border-t border-zinc-900 pt-4">
                      <p className="text-sm font-medium text-zinc-400">
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
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="p-6 sm:p-8 text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.35em] text-rose-300">
                Confirm Delete
              </div>
              <h3 className="text-2xl font-black sm:text-3xl">Move workout to trash?</h3>
              <p className="mt-2 text-sm text-zinc-400">
                You can restore it from Data / Recently Deleted within 30 days.
              </p>

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Workout</p>
                <p className="text-lg font-bold">{deleteTarget.dayName || 'Workout'}</p>
                <p className="text-sm text-zinc-500">
                  {deleteTarget.programName || 'Custom'} • {parseLocalDate(deleteTarget.date).toLocaleDateString()}
                </p>
              </div>

              {deleteError && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-800 bg-zinc-900/40 p-6 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {deleteBusy ? 'Moving...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="p-6 sm:p-8 text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.35em] text-sky-300">
                Adjust Details
              </div>
              <h3 className="text-2xl font-black sm:text-3xl">Edit workout date & time</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Backdate a workout or tweak the session timing. Stats will update automatically.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Workout</p>
                  <p className="text-lg font-bold">{editTarget.dayName || 'Workout'}</p>
                  <p className="text-sm text-zinc-500">
                    {editTarget.programName || 'Custom'} • {parseLocalDate(editTarget.date).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-end">
                  <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
                    <span className="font-semibold text-white">Ends</span>{' '}
                    {editEndTimeLabel ? `around ${editEndTimeLabel}` : '-'}
                  </div>
                </div>
              </div>

              {editError && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
                  {editError}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-800 bg-zinc-900/40 p-6 sm:flex-row sm:justify-end">
              <button
                onClick={() => setEditTarget(null)}
                disabled={editBusy}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEdit}
                disabled={editBusy}
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
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
