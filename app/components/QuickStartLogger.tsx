'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Check,
  ChevronDown,
  Clock,
  Dumbbell,
  Trash2,
} from 'lucide-react';
import type { WorkoutSession, SetLog, Exercise, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { createUuid } from '../lib/uuid';
import { formatLocalDate } from '../lib/dateUtils';
import RestTimer from './RestTimer';
import { useAuth } from '../lib/supabase/auth-context';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import CreateExerciseModal from './program-builder/CreateExerciseModal';
import WorkoutSummary from './WorkoutSummary';

interface QuickStartSet {
  id: string;
  weight: number | null;
  reps: number | null;
  trackingMethod: 'rpe' | 'rir' | 'percentage_1rm' | 'fixed';
  trackingValue: number | null;
  completed: boolean;
  notes?: string;
}

interface QuickStartExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseData: Exercise | null;
  sets: QuickStartSet[];
  isExpanded: boolean;
}

interface QuickStartLoggerProps {
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
}

const TRACKING_DEFAULTS: Record<QuickStartSet['trackingMethod'], number | null> = {
  rpe: 8,
  rir: 2,
  percentage_1rm: 75,
  fixed: null,
};

export default function QuickStartLogger({ onComplete, onCancel }: QuickStartLoggerProps) {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<QuickStartExercise[]>([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('Quick Workout');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionStartTime] = useState(() => new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [restExerciseName, setRestExerciseName] = useState('Rest');
  const [restContext, setRestContext] = useState<{
    exerciseId: string;
    exerciseName: string;
    isLastSet: boolean;
  } | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInitialName, setCustomInitialName] = useState('');
  const [summarySession, setSummarySession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem('iron_brain_hide_bottom_nav', 'false');
      } catch (error) {
        console.error('Failed to reset bottom nav on unload:', error);
      }
    };
    try {
      localStorage.setItem('iron_brain_hide_bottom_nav', 'true');
      window.dispatchEvent(new Event('iron_brain_nav_visibility'));
      window.addEventListener('beforeunload', handleBeforeUnload);
    } catch (error) {
      console.error('Failed to hide bottom nav:', error);
    }
    return () => {
      try {
        localStorage.setItem('iron_brain_hide_bottom_nav', 'false');
        window.dispatchEvent(new Event('iron_brain_nav_visibility'));
        window.removeEventListener('beforeunload', handleBeforeUnload);
      } catch (error) {
        console.error('Failed to restore bottom nav:', error);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getCustomExercises(user?.id || null)
      .then((list) => {
        if (!mounted) return;
        setCustomExercises(list);
      })
      .catch((error) => {
        console.error('Failed to load custom exercises:', error);
        if (mounted) setCustomExercises([]);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const customToExercise = useCallback((exercise: CustomExercise): Exercise => {
    const muscleGroups = Array.from(
      new Set([...(exercise.primaryMuscles || []), ...(exercise.secondaryMuscles || [])])
    );
    return {
      id: exercise.id,
      name: exercise.name,
      type: exercise.exerciseType === 'compound' ? 'compound' : 'isolation',
      muscleGroups,
      equipment: exercise.equipment ? [exercise.equipment] : undefined,
    };
  }, []);

  const allExercises = useMemo(() => {
    const custom = customExercises.map(customToExercise);
    return [...custom, ...defaultExercises];
  }, [customExercises, customToExercise]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return allExercises.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return allExercises
      .filter((ex) =>
        ex.name.toLowerCase().includes(query) ||
        ex.muscleGroups?.some((m) => m.toLowerCase().includes(query))
      )
      .slice(0, 20);
  }, [searchQuery, allExercises]);

  const recentExercises = useMemo(() => {
    const history = storage.getWorkoutHistory();
    const exerciseIds = new Set<string>();
    const recent: Exercise[] = [];

    for (const workout of history.slice(-10).reverse()) {
      for (const set of workout.sets) {
        if (!exerciseIds.has(set.exerciseId)) {
          exerciseIds.add(set.exerciseId);
          const ex = allExercises.find((e) => e.id === set.exerciseId);
          if (ex) recent.push(ex);
          if (recent.length >= 5) break;
        }
      }
      if (recent.length >= 5) break;
    }

    return recent;
  }, [allExercises]);

  const createEmptySet = (): QuickStartSet => ({
    id: `set_${createUuid()}`,
    weight: null,
    reps: null,
    trackingMethod: 'rpe',
    trackingValue: TRACKING_DEFAULTS.rpe,
    completed: false,
  });

  const addExercise = useCallback((exercise: Exercise) => {
    const newExercise: QuickStartExercise = {
      id: `ex_${createUuid()}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseData: exercise,
      sets: [createEmptySet()],
      isExpanded: true,
    };

    setExercises((prev) => [...prev, newExercise]);
    setShowExercisePicker(false);
    setSearchQuery('');
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet = createEmptySet();
          if (lastSet) {
            newSet.weight = lastSet.weight;
            newSet.trackingMethod = lastSet.trackingMethod;
            newSet.trackingValue = lastSet.trackingValue;
          }
          return { ...ex, sets: [...ex.sets, newSet] };
        }
        return ex;
      })
    );
  }, []);

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<QuickStartSet>) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          return {
            ...ex,
            sets: ex.sets.map((set) =>
              set.id === setId ? { ...set, ...updates } : set
            ),
          };
        }
        return ex;
      })
    );
  }, []);

  const logSet = useCallback((exerciseId: string, setId: string) => {
    let restDetails: { exerciseName: string; exerciseType?: Exercise['type']; isLastSet: boolean } | null = null;

    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const setIndex = ex.sets.findIndex((set) => set.id === setId);
        const isLastSet = setIndex === ex.sets.length - 1;
        restDetails = {
          exerciseName: ex.exerciseName,
          exerciseType: ex.exerciseData?.type,
          isLastSet,
        };
        return {
          ...ex,
          sets: ex.sets.map((set) =>
            set.id === setId ? { ...set, completed: true } : set
          ),
        };
      })
    );

    if (!restDetails) return;

    setRestExerciseName(restDetails.exerciseName || 'Rest');
    if (restDetails.exerciseType === 'compound') {
      setRestDuration(150);
    } else {
      setRestDuration(90);
    }
    setRestContext({
      exerciseId,
      exerciseName: restDetails.exerciseName,
      isLastSet: restDetails.isLastSet,
    });
    setShowRestTimer(true);
  }, []);

  const deleteSet = useCallback((exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          const newSets = ex.sets.filter((set) => set.id !== setId);
          return {
            ...ex,
            sets: newSets.length > 0 ? newSets : [createEmptySet()],
          };
        }
        return ex;
      })
    );
  }, []);

  const deleteExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  }, []);

  const toggleExercise = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId ? { ...ex, isExpanded: !ex.isExpanded } : ex
      )
    );
  }, []);

  const stats = useMemo(() => {
    let totalSets = 0;
    let completedSets = 0;
    let totalVolume = 0;

    for (const ex of exercises) {
      for (const set of ex.sets) {
        const hasInputs = set.weight !== null && set.reps !== null;
        if (set.completed) {
          completedSets += 1;
        }
        if (set.completed || hasInputs) {
          totalSets += 1;
          totalVolume += (set.weight ?? 0) * (set.reps ?? 0);
        }
      }
    }

    return { totalSets, completedSets, totalVolume };
  }, [exercises]);

  const finishWorkout = useCallback(() => {
    const resolvedName = workoutName.trim() || 'Quick Workout';
    const now = new Date();
    const setLogs: SetLog[] = [];

    for (const ex of exercises) {
      let exerciseSetIndex = 1;
      for (const set of ex.sets) {
        const hasInputs = set.weight !== null && set.reps !== null;
        if (!set.completed && !hasInputs) continue;

        const repsString = set.reps !== null ? String(set.reps) : '';
        const percentValue = set.trackingMethod === 'percentage_1rm' ? set.trackingValue : null;

        setLogs.push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          setIndex: exerciseSetIndex,
          prescribedReps: repsString,
          prescribedRPE: set.trackingMethod === 'rpe' ? set.trackingValue ?? undefined : undefined,
          prescribedRIR: set.trackingMethod === 'rir' ? set.trackingValue ?? undefined : undefined,
          prescribedPercentage: percentValue ?? undefined,
          actualWeight: set.weight ?? undefined,
          actualReps: set.reps ?? undefined,
          actualRPE: set.trackingMethod === 'rpe' ? set.trackingValue ?? undefined : undefined,
          actualRIR: set.trackingMethod === 'rir' ? set.trackingValue ?? undefined : undefined,
          completed: true,
          timestamp: now.toISOString(),
          weightUnit: 'lbs',
          loadType: 'absolute',
          e1rm: set.weight !== null && set.reps !== null
            ? Math.round(set.weight * (1 + set.reps / 30) * 10) / 10
            : undefined,
          volumeLoad: set.weight !== null && set.reps !== null ? set.weight * set.reps : undefined,
          setType: 'straight',
        });

        exerciseSetIndex += 1;
      }
    }

    if (setLogs.length === 0) {
      return;
    }

    const session: WorkoutSession = {
      id: `session_${createUuid()}`,
      programId: 'quick_start',
      programName: 'Quick Start',
      cycleNumber: 1,
      weekNumber: 1,
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
      dayName: resolvedName,
      date: formatLocalDate(now),
      startTime: sessionStartTime.toISOString(),
      endTime: now.toISOString(),
      sets: setLogs,
      createdAt: sessionStartTime.toISOString(),
      updatedAt: now.toISOString(),
      durationMinutes: Math.round((now.getTime() - sessionStartTime.getTime()) / 60000),
      totalVolumeLoad: stats.totalVolume,
    };

    onComplete(session);
    setSummarySession(session);
  }, [exercises, sessionStartTime, stats.totalVolume, onComplete, workoutName]);

  const handleRestAdvance = useCallback((addExtraSet: boolean) => {
    if (addExtraSet && restContext) {
      addSet(restContext.exerciseId);
    }
    setShowRestTimer(false);
    setRestContext(null);
  }, [addSet, restContext]);

  const handleCreateCustom = useCallback(() => {
    setCustomInitialName(searchQuery.trim());
    setShowCustomModal(true);
    setShowExercisePicker(false);
  }, [searchQuery]);

  const handleCustomCreated = useCallback((exercise: CustomExercise) => {
    setCustomExercises((prev) => [exercise, ...prev]);
    addExercise(customToExercise(exercise));
    setShowCustomModal(false);
    setSearchQuery('');
  }, [addExercise, customToExercise]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top pb-32">
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{workoutName.trim() || 'Quick Workout'}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(elapsedSeconds)}
              </span>
              <span>•</span>
              {stats.totalSets > 0 ? (
                <span>{stats.completedSets}/{stats.totalSets} sets</span>
              ) : (
                <span>0 sets</span>
              )}
              {stats.totalVolume > 0 && (
                <>
                  <span>•</span>
                  <span>{(stats.totalVolume / 1000).toFixed(1)}k lbs</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Workout Name
          </label>
          <input
            value={workoutName}
            onChange={(event) => setWorkoutName(event.target.value)}
            placeholder="Quick Workout"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white text-sm font-medium focus:border-purple-500 focus:outline-none"
          />
        </div>

        {exercises.map((exercise) => {
          const totalLoggedSets = exercise.sets.filter(
            (set) => set.completed || (set.weight !== null && set.reps !== null)
          ).length;
          const completedSets = exercise.sets.filter((set) => set.completed).length;
          const progressText = totalLoggedSets > 0 ? `${completedSets}/${totalLoggedSets} sets` : '0 sets';

          return (
            <div
              key={exercise.id}
              className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                <button
                  onClick={() => toggleExercise(exercise.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Dumbbell className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{exercise.exerciseName}</h3>
                    <p className="text-xs text-gray-500">{progressText}</p>
                  </div>
                </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteExercise(exercise.id)}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                  aria-label="Remove exercise"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleExercise(exercise.id)}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                  aria-label={exercise.isExpanded ? 'Collapse exercise' : 'Expand exercise'}
                >
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${
                      exercise.isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {exercise.isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {exercise.sets.map((set, setIndex) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    setNumber={setIndex + 1}
                    onUpdate={(updates) => updateSet(exercise.id, set.id, updates)}
                    onLog={() => logSet(exercise.id, set.id)}
                    onDelete={() => deleteSet(exercise.id, set.id)}
                    showDelete={exercise.sets.length > 1}
                  />
                ))}

                <button
                  onClick={() => addSet(exercise.id)}
                  className="w-full py-2 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm font-medium hover:border-purple-500/50 hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Set
                </button>
              </div>
            )}
            </div>
          );
        })}

        <button
          onClick={() => setShowExercisePicker(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-white/20 text-gray-400 font-semibold hover:border-purple-500/50 hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>

        {exercises.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">Start Your Workout</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add exercises and log sets as you go
            </p>
            <button
              onClick={() => setShowExercisePicker(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-500 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
            >
              Add First Exercise
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent safe-bottom">
        <button
          onClick={finishWorkout}
          disabled={stats.totalSets === 0}
          className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
            stats.totalSets === 0
              ? 'bg-white/10 text-gray-500'
              : 'bg-gradient-to-r from-emerald-600 to-green-500 shadow-emerald-500/20 active:scale-[0.98]'
          }`}
        >
          <Check className="w-5 h-5" />
          {stats.totalSets === 0
            ? 'Log a set to finish'
            : `Finish Workout (${stats.totalSets} sets)`}
        </button>
      </div>

      {showExercisePicker && (
        <ExercisePicker
          exercises={filteredExercises}
          recentExercises={recentExercises}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={addExercise}
          onClose={() => {
            setShowExercisePicker(false);
            setSearchQuery('');
          }}
          onCreateCustom={handleCreateCustom}
        />
      )}

      <CreateExerciseModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onCreate={handleCustomCreated}
        initialName={customInitialName}
        userId={user?.id ?? null}
      />

      <RestTimer
        isActive={showRestTimer}
        duration={restDuration}
        onComplete={handleRestAdvance}
        onSkip={handleRestAdvance}
        isLastSetOfExercise={restContext?.isLastSet ?? false}
        exerciseName={restExerciseName}
      />

      {summarySession && (
        <WorkoutSummary
          session={summarySession}
          onClose={() => {
            setSummarySession(null);
            onCancel();
          }}
        />
      )}
    </div>
  );
}

interface SetRowProps {
  set: QuickStartSet;
  setNumber: number;
  onUpdate: (updates: Partial<QuickStartSet>) => void;
  onLog: () => void;
  onDelete: () => void;
  showDelete: boolean;
}

function formatTrackingLabel(method: QuickStartSet['trackingMethod']) {
  if (method === 'percentage_1rm') return '%1RM';
  if (method === 'fixed') return 'None';
  return method.toUpperCase();
}

function formatTrackingValue(method: QuickStartSet['trackingMethod'], value: number | null) {
  if (value === null) return '';
  if (method === 'percentage_1rm') return `${value}%`;
  return `${value}`;
}

function SetRow({ set, setNumber, onUpdate, onLog, onDelete, showDelete }: SetRowProps) {
  const trackingOptions = [
    { value: 'rpe', label: 'RPE', defaultValue: TRACKING_DEFAULTS.rpe },
    { value: 'rir', label: 'RIR', defaultValue: TRACKING_DEFAULTS.rir },
    { value: 'percentage_1rm', label: '% 1RM', defaultValue: TRACKING_DEFAULTS.percentage_1rm },
    { value: 'fixed', label: 'None', defaultValue: TRACKING_DEFAULTS.fixed },
  ] as const;

  if (set.completed) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm text-gray-400">Set {setNumber}</span>
        <span className="text-white font-semibold">{set.weight ?? '--'} lbs</span>
        <span className="text-gray-400">×</span>
        <span className="text-white font-semibold">{set.reps ?? '--'}</span>
        {set.trackingMethod !== 'fixed' && set.trackingValue !== null && (
          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
            {formatTrackingLabel(set.trackingMethod)} {formatTrackingValue(set.trackingMethod, set.trackingValue)}
          </span>
        )}
      </div>
    );
  }

  const canLog = set.reps !== null && set.weight !== null;

  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">
          {setNumber}
        </span>
        <span className="text-sm text-gray-400 flex-1">Set {setNumber}</span>
        {showDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Weight</label>
          <input
            type="number"
            value={set.weight ?? ''}
            onChange={(event) =>
              onUpdate({ weight: event.target.value ? Number(event.target.value) : null })
            }
            placeholder="0"
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Reps</label>
          <input
            type="number"
            value={set.reps ?? ''}
            onChange={(event) =>
              onUpdate({ reps: event.target.value ? Number(event.target.value) : null })
            }
            placeholder="0"
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Method</label>
          <select
            value={set.trackingMethod}
            onChange={(event) => {
              const nextMethod = event.target.value as QuickStartSet['trackingMethod'];
              onUpdate({
                trackingMethod: nextMethod,
                trackingValue: TRACKING_DEFAULTS[nextMethod],
              });
            }}
            className="w-full px-2 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
          >
            {trackingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {set.trackingMethod !== 'fixed' && (
            <div className="mt-2">
              <label className="text-xs text-gray-500 mb-1 block">
                {set.trackingMethod === 'percentage_1rm' ? '% of 1RM' : 'Target'}
              </label>
              <input
                type="number"
                value={set.trackingValue ?? ''}
                onChange={(event) =>
                  onUpdate({ trackingValue: event.target.value ? Number(event.target.value) : null })
                }
                placeholder={String(TRACKING_DEFAULTS[set.trackingMethod] ?? '')}
                step={set.trackingMethod === 'rpe' ? 0.5 : 1}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onLog}
        disabled={!canLog}
        className={`w-full py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
          canLog
            ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]'
            : 'bg-white/10 text-gray-500'
        }`}
      >
        <Check className="w-4 h-4" />
        Log Set
      </button>
    </div>
  );
}

interface ExercisePickerProps {
  exercises: Exercise[];
  recentExercises: Exercise[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
  onCreateCustom: () => void;
}

function ExercisePicker({
  exercises,
  recentExercises,
  searchQuery,
  onSearchChange,
  onSelect,
  onClose,
  onCreateCustom,
}: ExercisePickerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="h-full flex flex-col bg-zinc-950 safe-top">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search exercises..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!searchQuery && recentExercises.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Recent
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => onSelect(ex)}
                    className="px-3 py-1.5 bg-white/10 rounded-full text-sm text-white hover:bg-purple-500/20 hover:text-purple-300 transition-colors"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {searchQuery ? 'Results' : 'All Exercises'}
            </h3>
            <div className="space-y-1">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full px-4 py-3 bg-white/5 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{ex.name}</div>
                    <div className="text-xs text-gray-500">
                      {ex.muscleGroups?.join(', ') || 'No muscles specified'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {searchQuery && exercises.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No exercises found</p>
              <button
                onClick={onCreateCustom}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl font-medium hover:bg-purple-500/30 transition-colors"
              >
                {`Create "${searchQuery}" as custom exercise`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
