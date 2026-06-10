'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Dumbbell,
  Edit3,
  Flame,
  History,
  Trash2,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { WorkoutSession, SetLog, CustomExercise, WeightUnit } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import { useAuth } from '../lib/supabase/auth-context';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { buildExerciseCatalog, resolveExerciseDisplayName } from '../lib/exercises/catalog';
import { useBodyScrollLock } from '../lib/hooks/useBodyScrollLock';
import { useUnitPreference } from '../lib/hooks/useUnitPreference';
import { convertWeight } from '../lib/units';

interface WorkoutHistoryProps {
  workoutHistory: WorkoutSession[];
  onHistoryUpdate: () => void;
  compactHeader?: boolean;
  isLoading?: boolean;
}

type EditableWorkoutSet = {
  localId: string;
  sourceId?: string;
  weightUnit: WeightUnit;
  actualWeight: string;
  actualReps: string;
  actualRPE: string;
  completed: boolean;
  skipped?: boolean;
  notes: string;
  setType?: SetLog['setType'];
  timestamp?: string;
};

type EditableWorkoutExercise = {
  localId: string;
  exerciseId: string;
  exerciseName: string;
  sets: EditableWorkoutSet[];
};

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
};

const slugifyExerciseId = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `exercise_${Math.random().toString(36).slice(2, 8)}`;

const normalizeSessionKey = (id: string) => (id.startsWith('session_') ? id.substring(8) : id);

export default function WorkoutHistory({
  workoutHistory,
  onHistoryUpdate,
  compactHeader = false,
  isLoading = false,
}: WorkoutHistoryProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { weightUnit } = useUnitPreference();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [contentEditTarget, setContentEditTarget] = useState<WorkoutSession | null>(null);
  const [contentWorkoutName, setContentWorkoutName] = useState('');
  const [contentWorkoutNotes, setContentWorkoutNotes] = useState('');
  const [contentExercises, setContentExercises] = useState<EditableWorkoutExercise[]>([]);
  const [contentNewExerciseName, setContentNewExerciseName] = useState('');
  const [contentEditBusy, setContentEditBusy] = useState(false);
  const [contentEditError, setContentEditError] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const isAnyModalOpen = Boolean(deleteTarget || contentEditTarget);
  useBodyScrollLock(isAnyModalOpen, 'history-modal');

  useEffect(() => {
    let isMounted = true;
    getCustomExercises(user?.id || null)
      .then(exercises => {
        if (!isMounted) return;
        setCustomExercises(exercises);
      })
      .catch(() => {
        if (isMounted) {
          setCustomExercises([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const exerciseCatalog = useMemo(
    () => buildExerciseCatalog(defaultExercises, customExercises),
    [customExercises]
  );
  const exerciseIdByName = useMemo(() => {
    const map = new Map<string, string>();
    exerciseCatalog.entriesById.forEach((entry, id) => {
      map.set(entry.name.toLowerCase(), id);
    });
    return map;
  }, [exerciseCatalog]);

  const resolveExerciseName = (exerciseId: string, cachedName?: string) =>
    resolveExerciseDisplayName(exerciseId, {
      catalog: exerciseCatalog,
      cachedName,
    });

  const createEmptyEditableSet = (unit: WeightUnit): EditableWorkoutSet => ({
    localId: createLocalId(),
    weightUnit: unit,
    actualWeight: '',
    actualReps: '',
    actualRPE: '',
    completed: false,
    notes: '',
    setType: 'straight',
    timestamp: new Date().toISOString(),
  });

  const buildEditableExercises = (session: WorkoutSession): EditableWorkoutExercise[] => {
    const map = new Map<string, EditableWorkoutExercise>();
    const normalizedSets = [...session.sets].sort((a, b) => {
      if (a.exerciseId === b.exerciseId) return (a.setIndex || 0) - (b.setIndex || 0);
      return a.exerciseId.localeCompare(b.exerciseId);
    });

    normalizedSets.forEach((set) => {
      const exerciseId = set.exerciseId || slugifyExerciseId(set.exerciseName || 'exercise');
      const exerciseName = resolveExerciseName(exerciseId, set.exerciseName);

      if (!map.has(exerciseId)) {
        map.set(exerciseId, {
          localId: createLocalId(),
          exerciseId,
          exerciseName,
          sets: [],
        });
      }

      const entry = map.get(exerciseId)!;
      entry.sets.push({
        localId: createLocalId(),
        sourceId: set.id,
        weightUnit: set.weightUnit ?? weightUnit,
        actualWeight: set.actualWeight != null ? String(set.actualWeight) : '',
        actualReps: set.actualReps != null ? String(set.actualReps) : '',
        actualRPE: set.actualRPE != null ? String(set.actualRPE) : '',
        completed: set.completed === true && set.skipped !== true,
        skipped: set.skipped === true,
        notes: set.notes ?? '',
        setType: set.setType ?? 'straight',
        timestamp: set.timestamp,
      });
    });

    if (map.size === 0) {
      return [
        {
          localId: createLocalId(),
          exerciseId: 'exercise',
          exerciseName: 'Exercise',
          sets: [createEmptyEditableSet(weightUnit)],
        },
      ];
    }

    return Array.from(map.values());
  };

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
        if (!set.completed || set.skipped) return;
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
    const sessionKey = normalizeSessionKey(sessionId);
    setExpandedSessions((current) => {
      const next = new Set(current);
      if (next.has(sessionKey)) {
        next.delete(sessionKey);
      } else {
        next.add(sessionKey);
      }
      return next;
    });
  };

  const getExerciseName = (exerciseId: string, cachedName?: string): string => {
    return resolveExerciseName(exerciseId, cachedName);
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

  const formatWeightValue = (value: number, unit: WeightUnit) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: unit === 'kg' ? 2 : 1,
    }).format(value);

  const calculateSessionStats = (session: WorkoutSession) => {
    const completedSets = session.sets.filter(s => s.completed && !s.skipped);
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

  const getSessionSourceLabel = (session: WorkoutSession) => {
    const programName = (session.programName || '').trim();
    if (programName && programName.toLowerCase() !== 'custom' && programName.toLowerCase() !== 'workout') {
      return programName;
    }
    if (session.programId) {
      return programName || 'Program session';
    }
    return 'Freestyle';
  };

  const formatSessionDate = (session: WorkoutSession) =>
    parseLocalDate(session.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatSessionTimeRange = (session: WorkoutSession) => {
    const start = session.startTime
      ? new Date(session.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;
    const end = session.endTime
      ? new Date(session.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;

    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    return 'Time not set';
  };

  const formatDurationLabel = (minutes?: number) => {
    if (!minutes || !Number.isFinite(minutes)) return 'No duration';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes % 60);
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const deleteSession = (sessionId: string) => {
    const session = workoutHistory.find(w => w.id === sessionId);
    if (!session) return;
    setContentEditTarget(null);
    setDeleteTarget(session);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const moved = await storage.deleteWorkoutSession(target.id, target);
      if (!moved) {
        throw new Error('Workout could not be moved to trash');
      }
      setExpandedSessions(prev => {
        const next = new Set(prev);
        next.delete(normalizeSessionKey(target.id));
        return next;
      });
      setDeleteTarget(null);
      setDeleteBusy(false);
      // Fire cloud re-sync in the background — don't block UI
      void onHistoryUpdate();
    } catch {
      setDeleteError('Could not move workout to trash. Please try again.');
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

  const openContentEditSession = (session: WorkoutSession) => {
    setDeleteTarget(null);
    setContentEditTarget(session);
    setContentWorkoutName(session.dayName || 'Workout');
    setContentWorkoutNotes(session.notes ?? '');
    setContentExercises(buildEditableExercises(session));
    setContentNewExerciseName('');
    setEditDate(session.date);
    setEditStartTime(formatTime(session.startTime));
    setEditDuration(session.durationMinutes ? String(session.durationMinutes) : '');
    setContentEditError(null);
  };

  const handleAddExerciseToContentEdit = () => {
    const exerciseName = contentNewExerciseName.trim();
    if (!exerciseName) return;

    const resolvedExerciseId = exerciseIdByName.get(exerciseName.toLowerCase()) ?? slugifyExerciseId(exerciseName);
    const existingIndex = contentExercises.findIndex((entry) => entry.exerciseId === resolvedExerciseId);

    if (existingIndex !== -1) {
      setContentEditError('Exercise already exists in this workout.');
      return;
    }

    setContentExercises((current) => [
      ...current,
      {
        localId: createLocalId(),
        exerciseId: resolvedExerciseId,
        exerciseName,
        sets: [createEmptyEditableSet(weightUnit)],
      },
    ]);
    setContentNewExerciseName('');
    setContentEditError(null);
  };

  const handleRemoveExerciseFromContentEdit = (exerciseLocalId: string) => {
    setContentExercises((current) => current.filter((exercise) => exercise.localId !== exerciseLocalId));
  };

  const handleAddSetToContentEditExercise = (exerciseLocalId: string) => {
    setContentExercises((current) =>
      current.map((exercise) =>
        exercise.localId === exerciseLocalId
          ? {
            ...exercise,
            sets: [...exercise.sets, createEmptyEditableSet(weightUnit)],
          }
          : exercise
      )
    );
  };

  const handleRemoveSetFromContentEditExercise = (exerciseLocalId: string, setLocalId: string) => {
    setContentExercises((current) =>
      current.map((exercise) => {
        if (exercise.localId !== exerciseLocalId) return exercise;
        if (exercise.sets.length <= 1) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.filter((set) => set.localId !== setLocalId),
        };
      })
    );
  };

  const handleContentSetFieldChange = (
    exerciseLocalId: string,
    setLocalId: string,
    field: keyof Pick<EditableWorkoutSet, 'actualWeight' | 'actualReps' | 'actualRPE' | 'completed' | 'notes'>
      | 'weightUnit',
    value: string | boolean
  ) => {
    setContentExercises((current) =>
      current.map((exercise) => {
        if (exercise.localId !== exerciseLocalId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set) => {
            if (set.localId !== setLocalId) return set;
            if (field === 'completed') {
              return { ...set, completed: Boolean(value) };
            }
            if (field === 'weightUnit') {
              return { ...set, weightUnit: value === 'kg' ? 'kg' : 'lbs' };
            }
            return { ...set, [field]: String(value) };
          }),
        };
      })
    );
  };

  const handleConfirmContentEdit = async () => {
    if (!contentEditTarget) return;
    if (!editDate) {
      setContentEditError('Please choose a date.');
      return;
    }

    setContentEditBusy(true);
    setContentEditError(null);

    try {
      const parsedDuration = editDuration.trim() ? parseInt(editDuration, 10) : contentEditTarget.durationMinutes;
      if (editDuration.trim() && (!Number.isFinite(parsedDuration) || Number(parsedDuration) < 1)) {
        setContentEditError('Duration must be at least 1 minute.');
        setContentEditBusy(false);
        return;
      }

      const resolvedStart = editStartTime || formatTime(contentEditTarget.startTime);
      const startDateTime = resolvedStart ? toDateTime(editDate, resolvedStart) : null;
      let endDateTime: Date | null = null;

      if (startDateTime && Number.isFinite(parsedDuration)) {
        endDateTime = new Date(startDateTime.getTime() + Number(parsedDuration) * 60000);
      } else if (contentEditTarget.endTime) {
        const resolvedEnd = formatTime(contentEditTarget.endTime);
        endDateTime = resolvedEnd ? toDateTime(editDate, resolvedEnd) : null;
      }

      const nextSets: SetLog[] = [];
      const nowIso = new Date().toISOString();

      contentExercises.forEach((exercise) => {
        const usableSets = exercise.sets
          .map((set) => {
            const parsedWeight = set.actualWeight.trim() === '' ? null : Number(set.actualWeight);
            const parsedReps = set.actualReps.trim() === '' ? null : Number(set.actualReps);
            const parsedRpe = set.actualRPE.trim() === '' ? null : Number(set.actualRPE);
            const normalizedWeight =
              parsedWeight != null && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : null;
            const normalizedReps =
              parsedReps != null && Number.isFinite(parsedReps) ? Math.max(0, Math.round(parsedReps)) : null;
            const normalizedRpe =
              parsedRpe != null && Number.isFinite(parsedRpe)
                ? Math.max(1, Math.min(10, Math.round(parsedRpe * 2) / 2))
                : null;
            const meaningfulInput =
              (normalizedWeight != null && normalizedWeight > 0) ||
              (normalizedReps != null && normalizedReps > 0) ||
              normalizedRpe != null ||
              set.notes.trim().length > 0;
            const completed = set.completed || meaningfulInput;

            if (!meaningfulInput && !set.completed) {
              return null;
            }

            return {
              sourceId: set.sourceId,
              weightUnit: set.weightUnit,
              actualWeight: normalizedWeight,
              actualReps: normalizedReps,
              actualRPE: normalizedRpe,
              notes: set.notes.trim(),
              completed,
              skipped: false,
              setType: set.setType,
              timestamp: set.timestamp ?? nowIso,
            };
          })
          .filter((set): set is NonNullable<typeof set> => set !== null);

        usableSets.forEach((set, index) => {
          nextSets.push({
            id: set.sourceId,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            setIndex: index + 1,
            prescribedReps: set.actualReps != null ? String(set.actualReps) : '0',
            prescribedRPE: set.actualRPE,
            actualWeight: set.actualWeight,
            weightUnit: set.weightUnit,
            actualReps: set.actualReps,
            actualRPE: set.actualRPE,
            completed: set.completed,
            skipped: set.skipped,
            notes: set.notes || undefined,
            setType: set.setType ?? 'straight',
            timestamp: set.timestamp,
          });
        });
      });

      if (nextSets.length === 0) {
        setContentEditError('Add at least one set with values before saving.');
        setContentEditBusy(false);
        return;
      }

      const contentUpdates: Partial<WorkoutSession> = {
        date: editDate,
        dayName: contentWorkoutName.trim() || contentEditTarget.dayName,
        notes: contentWorkoutNotes.trim() || undefined,
        sets: nextSets,
      };
      if (startDateTime) contentUpdates.startTime = startDateTime.toISOString();
      if (endDateTime) contentUpdates.endTime = endDateTime.toISOString();
      if (Number.isFinite(parsedDuration)) contentUpdates.durationMinutes = Number(parsedDuration);

      await storage.updateWorkoutSessionContent(contentEditTarget.id, contentUpdates);

      setContentEditTarget(null);
      onHistoryUpdate();
    } catch {
      setContentEditError('Could not save workout edits. Please try again.');
    } finally {
      setContentEditBusy(false);
    }
  };

  const editEndTimeLabel = useMemo(() => {
    if (!editDate || !contentEditTarget) return null;
    const resolvedStart = editStartTime || formatTime(contentEditTarget.startTime);
    const resolvedDuration = editDuration ? parseInt(editDuration, 10) : contentEditTarget.durationMinutes;
    if (!resolvedStart || !Number.isFinite(resolvedDuration)) return null;
    const startDateTime = toDateTime(editDate, resolvedStart);
    if (!startDateTime) return null;
    const endDateTime = new Date(startDateTime.getTime() + (resolvedDuration as number) * 60000);
    return endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [contentEditTarget, editDate, editStartTime, editDuration]);

  const sortedHistory = useMemo(() => {
    const getSortTime = (session: WorkoutSession) =>
      new Date(session.endTime || session.startTime || session.date).getTime();
    return [...workoutHistory].sort((a, b) => getSortTime(b) - getSortTime(a));
  }, [workoutHistory]);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-zinc-500">Loading History</p>
        <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500/70" />
        </div>
      </div>
    );
  }

  if (sortedHistory.length === 0) {
    return (
      <div className="py-14 text-center">
        <History className="mx-auto mb-4 h-11 w-11 text-zinc-600" />
        <h3 className="iron-display mb-2 text-2xl text-white">
          No workouts yet
        </h3>
        <p className="mx-auto max-w-xs text-sm leading-5 text-zinc-500">
          Completed sessions will show up here with volume, PRs, and set history.
        </p>
        <button
          onClick={() => router.push('/start')}
          className="liquid-action-button mt-6 inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-4 text-xs font-black italic tracking-tight text-zinc-950 transition-all active:scale-[0.98]"
        >
          <span>Start workout</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {!compactHeader && (
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
        )}

        <div className="space-y-6">
          {sortedHistory.map((session, sessionIdx) => {
            const sessionKey = normalizeSessionKey(session.id);
            const isExpanded = expandedSessions.has(sessionKey);
            const stats = calculateSessionStats(session);
            const groupedSets = groupSetsByExercise(session.sets);
            const exerciseIds = Object.keys(groupedSets);
            const completedSetCount = session.sets.filter(s => s.completed && !s.skipped).length;
            const completedExerciseCount = exerciseIds.filter((exerciseId) =>
              groupedSets[exerciseId].some((set) => set.completed && !set.skipped)
            ).length;
            const sourceLabel = getSessionSourceLabel(session);

            return (
              <article
                key={sessionKey}
                className="stagger-item overflow-hidden rounded-[1.25rem] border border-zinc-900 bg-zinc-950/65 shadow-[0_24px_54px_rgba(0,0,0,0.35)]"
                style={{ animationDelay: `${sessionIdx * 50}ms` }}
              >
                {/* Session Header */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleSession(session.id)}
                      className="min-w-0 flex-1 touch-manipulation text-left"
                      aria-expanded={isExpanded}
                      aria-controls={`history-details-${sessionKey}`}
                    >
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                        <Dumbbell className="h-3.5 w-3.5 text-emerald-300" />
                        <span className="min-w-0 truncate">{sourceLabel}</span>
                      </div>
                      <h3 className="text-xl font-black italic leading-tight tracking-tight text-zinc-100 sm:text-2xl">
                        {session.dayName || 'Workout'}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-zinc-500" />
                          {formatSessionDate(session)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4 text-zinc-500" />
                          {formatSessionTimeRange(session)}
                        </span>
                        <span>{formatDurationLabel(session.durationMinutes)}</span>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openContentEditSession(session)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-200 transition-colors hover:border-emerald-400/40 hover:text-emerald-200 active:scale-[0.98]"
                        title="Edit workout"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSession(session.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-rose-300 transition-colors hover:border-rose-400/40 hover:text-rose-200 active:scale-[0.98]"
                        title="Delete workout"
                        aria-label="Delete workout"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-4 divide-x divide-zinc-900 border-y border-zinc-900 py-3">
                    <div className="px-2 first:pl-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Exercises</p>
                      <p className="mt-1 text-xl font-black text-white">{completedExerciseCount}</p>
                    </div>
                    <div className="px-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Sets</p>
                      <p className="mt-1 text-xl font-black text-white">{completedSetCount}</p>
                    </div>
                    <div className="px-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Volume</p>
                      <p className="mt-1 text-xl font-black text-white">{Math.round(stats.totalVolume / 1000)}k</p>
                    </div>
                    <div className="px-2 last:pr-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Avg RPE</p>
                      <p className="mt-1 text-xl font-black text-white">{stats.avgRPE > 0 ? stats.avgRPE.toFixed(1) : '-'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSession(session.id)}
                    className="mt-3 flex min-h-11 w-full touch-manipulation items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950/55 px-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:border-zinc-800 hover:text-zinc-100 active:scale-[0.99]"
                    aria-expanded={isExpanded}
                    aria-controls={`history-details-${sessionKey}`}
                  >
                    {isExpanded ? 'Hide details' : 'View details'}
                    <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    id={`history-details-${sessionKey}`}
                    data-testid="history-session-details"
                    className="border-t border-zinc-900 px-4 pb-5 pt-5 sm:px-5"
                  >
                    <div className="space-y-6">
                      {exerciseIds.map((exerciseId, exIdx) => {
                        const exerciseSets = groupedSets[exerciseId];
                        const completedSets = exerciseSets.filter(s => s.completed && !s.skipped);
                        if (completedSets.length === 0) return null;

                        const exerciseName = getExerciseName(exerciseId, exerciseSets[0]?.exerciseName);
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
                            className="border-b border-zinc-900/50 pb-6"
                            style={{ animationDelay: `${exIdx * 100}ms` }}
                          >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-lg font-bold italic text-zinc-100">
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
                                  ? Number(set.actualWeight)
                                  : null;
                                const displayE1RM = set.e1rm != null
                                  ? Number(set.e1rm)
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
                                            ? `${formatWeightValue(displayWeight, fromUnit)} ${fromUnit}`
                                            : `— ${fromUnit}`}
                                        </span>
                                        <span className="text-zinc-500">×</span>
                                        <span className="font-semibold text-white">
                                          {set.actualReps} reps
                                        </span>
                                        {set.actualRPE && (
                                          <>
                                            <span className="text-zinc-500">@</span>
                                            <span className="text-xs font-semibold text-amber-300">
                                              RPE {set.actualRPE}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                                      {set.e1rm && (
                                        <span className="text-xs font-semibold text-sky-300">
                                          {displayE1RM != null && Number.isFinite(displayE1RM)
                                            ? `${Math.round(displayE1RM)} e1RM`
                                            : 'E1RM'}
                                        </span>
                                      )}
                                      {pr && (
                                        <span
                                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"
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
              </article>
            );
          })}
        </div>
      </div>
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4"
          data-swipe-scope="local"
        >
          <div className="w-full max-w-lg max-h-[calc(100dvh-0.5rem)] overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950/90 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:max-h-[90dvh] sm:rounded-3xl">
            <div className="p-6 sm:p-8 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-rose-300">
                Confirm Delete
              </p>
              <h3 className="mt-2 text-2xl font-black italic tracking-tight sm:text-3xl">MOVE WORKOUT TO TRASH?</h3>
              <p className="mt-2 text-sm text-zinc-400">
                You can restore it from Data / Recently Deleted within 30 days.
              </p>

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">Workout</p>
                <p className="mt-1 text-lg font-black italic tracking-tight">{deleteTarget.dayName || 'Workout'}</p>
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
            <div className="flex flex-col gap-3 border-t border-zinc-800 bg-zinc-900/40 p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:p-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-xs font-black italic uppercase tracking-tight text-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="rounded-xl bg-rose-400 px-6 py-3 text-xs font-black italic uppercase tracking-tight text-zinc-950 shadow-lg shadow-rose-500/15 transition-colors hover:bg-rose-300 active:bg-rose-500 disabled:opacity-50"
              >
                {deleteBusy ? 'MOVING...' : 'MOVE TO TRASH'}
              </button>
            </div>
          </div>
        </div>
      )}
      {contentEditTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4"
          data-swipe-scope="local"
        >
          <div className="flex w-full max-w-5xl max-h-[100dvh] flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:max-h-[90dvh] sm:rounded-3xl">
            <div className="flex-1 overflow-y-auto overscroll-contain p-6 pb-8 text-white sm:p-8">
              <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-300">
                Workout Editor
              </p>
              <h3 className="text-2xl font-black sm:text-3xl">Edit workout</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Update the session details, exercises, and set values in one place.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Workout Name
                  </label>
                  <input
                    type="text"
                    value={contentWorkoutName}
                    onChange={(e) => setContentWorkoutName(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Start
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Duration
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Minutes"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Ends
                  </label>
                  <div className="flex min-h-12 items-center rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 text-sm font-semibold text-zinc-300">
                    {editEndTimeLabel ?? '-'}
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Add Exercise
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Exercise name"
                      value={contentNewExerciseName}
                      onChange={(e) => setContentNewExerciseName(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddExerciseToContentEdit}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-950 transition-all active:scale-[0.98]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
                    Notes
                  </label>
                  <textarea
                    value={contentWorkoutNotes}
                    onChange={(e) => setContentWorkoutNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-5">
                {contentExercises.map((exercise) => (
                  <div key={exercise.localId} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-white">{exercise.exerciseName}</p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                          {exercise.exerciseId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExerciseFromContentEdit(exercise.localId)}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300 transition-all active:scale-[0.98]"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-3">
                      {exercise.sets.map((set, setIndex) => (
                        <div key={set.localId} className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-12">
                          <div className="sm:col-span-1 flex items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-zinc-300">
                            #{setIndex + 1}
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Weight
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={set.actualWeight}
                              onChange={(e) =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'actualWeight', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Unit
                            </label>
                            <select
                              value={set.weightUnit}
                              onChange={(e) =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'weightUnit', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="lbs">lbs</option>
                              <option value="kg">kg</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Reps
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={set.actualReps}
                              onChange={(e) =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'actualReps', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              RPE
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="0.5"
                              value={set.actualRPE}
                              onChange={(e) =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'actualRPE', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Completed
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'completed', !set.completed)
                              }
                              className={`w-full rounded-lg border px-2 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${set.completed
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                : 'border-zinc-800 bg-zinc-900/70 text-zinc-400'
                                }`}
                            >
                              {set.completed ? 'Yes' : 'No'}
                            </button>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Remove
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveSetFromContentEditExercise(exercise.localId, set.localId)}
                              className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-300 transition-colors hover:text-rose-200"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={set.notes}
                              onChange={(e) =>
                                handleContentSetFieldChange(exercise.localId, set.localId, 'notes', e.target.value)
                              }
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSetToContentEditExercise(exercise.localId)}
                      className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 transition-all active:scale-[0.98]"
                    >
                      Add Set
                    </button>
                  </div>
                ))}
              </div>

              {contentEditError && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
                  {contentEditError}
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-col gap-3 border-t border-zinc-800 bg-zinc-900/40 p-6 pb-[calc(env(safe-area-inset-bottom)+1.2rem)] sm:flex-row sm:justify-end sm:p-6">
              <button
                onClick={() => setContentEditTarget(null)}
                disabled={contentEditBusy}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmContentEdit}
                disabled={contentEditBusy}
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {contentEditBusy ? 'Saving...' : 'Save Workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
