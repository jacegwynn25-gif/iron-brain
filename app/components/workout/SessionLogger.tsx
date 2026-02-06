'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Dumbbell,
  FileText,
  History,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProgramTemplate } from '@/app/lib/types';
import type { ActiveCell, Block, Exercise, Set as SessionSet } from '@/app/lib/types/session';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import { useWorkoutSession } from '@/app/lib/hooks/useWorkoutSession';
import HardyStepper from '@/app/components/workout/controls/HardyStepper';
import RpeSlider from '@/app/components/workout/controls/RpeSlider';
import GlassKeypad from '@/app/components/workout/controls/GlassKeypad';
import RestTimer from '@/app/components/RestTimer';
import { getLastWeight } from '@/app/lib/workout/mock-last-weight';

type ViewMode = 'overview' | 'cockpit' | 'rest';

type ExerciseRef = {
  blockId: string;
  blockType: Block['type'];
  exercise: Exercise;
};

const REST_DURATION_SECONDS = 90;

type CommonExercise = {
  id: string;
  name: string;
  target: 'push' | 'pull' | 'legs' | 'core';
};

const COMMON_EXERCISES: CommonExercise[] = [
  { id: 'back_squat', name: 'Back Squat', target: 'legs' },
  { id: 'deadlift', name: 'Deadlift', target: 'legs' },
  { id: 'bench_press', name: 'Bench Press', target: 'push' },
  { id: 'overhead_press', name: 'Overhead Press', target: 'push' },
  { id: 'pull_up', name: 'Pull-up', target: 'pull' },
  { id: 'chin_up', name: 'Chin-up', target: 'pull' },
  { id: 'barbell_row', name: 'Barbell Row', target: 'pull' },
  { id: 'dumbbell_row', name: 'Dumbbell Row', target: 'pull' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', target: 'pull' },
  { id: 'dips', name: 'Dip', target: 'push' },
  { id: 'tricep_extension', name: 'Tricep Extension', target: 'push' },
  { id: 'bicep_curl', name: 'Bicep Curl', target: 'pull' },
  { id: 'leg_press', name: 'Leg Press', target: 'legs' },
  { id: 'lunges', name: 'Lunge', target: 'legs' },
  { id: 'split_squat', name: 'Split Squat', target: 'legs' },
  { id: 'calf_raise', name: 'Calf Raise', target: 'legs' },
  { id: 'hip_thrust', name: 'Hip Thrust', target: 'legs' },
  { id: 'leg_extension', name: 'Leg Extension', target: 'legs' },
  { id: 'leg_curl', name: 'Leg Curl', target: 'legs' },
  { id: 'face_pull', name: 'Face Pull', target: 'pull' },
  { id: 'lateral_raise', name: 'Lateral Raise', target: 'push' },
  { id: 'plank', name: 'Plank', target: 'core' },
  { id: 'ab_wheel', name: 'Ab Wheel', target: 'core' },
];

function createQuickStartProgram(): ProgramTemplate {
  return {
    id: 'qs',
    name: 'Quick Start',
    isCustom: true,
    weeks: [],
  };
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function parsePreviousWeight(previous: string | null): number | null {
  if (!previous) return null;
  const match = previous.match(/^\d+(\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

type ExerciseStyle = {
  icon: LucideIcon;
  color: string;
  label: string;
};

const getExerciseStyle = (name: string): ExerciseStyle => {
  const lower = name.toLowerCase();
  if (['bench', 'press', 'push'].some((keyword) => lower.includes(keyword))) {
    return { icon: ArrowUp, color: 'text-sky-400', label: 'PUSH' };
  }
  if (['row', 'pull', 'chin', 'curl'].some((keyword) => lower.includes(keyword))) {
    return { icon: ArrowDown, color: 'text-indigo-400', label: 'PULL' };
  }
  if (['squat', 'leg', 'lunge', 'deadlift'].some((keyword) => lower.includes(keyword))) {
    return { icon: Activity, color: 'text-emerald-400', label: 'LEGS' };
  }
  return { icon: Dumbbell, color: 'text-zinc-400', label: 'LIFT' };
};

const isBodyweight = (name: string): boolean => {
  const lower = name.toLowerCase();
  return [
    'bodyweight',
    'pull-up',
    'pull up',
    'chin-up',
    'chin up',
    'dip',
    'plank',
    'ab wheel',
  ].some((keyword) => lower.includes(keyword));
};

function findSetByActiveCell(blocks: Block[], activeCell: ActiveCell | null) {
  if (!activeCell) return null;
  const block = blocks.find((entry) => entry.id === activeCell.blockId);
  if (!block) return null;
  const exercise = block.exercises.find((entry) => entry.id === activeCell.exerciseId);
  if (!exercise) return null;
  const set = exercise.sets.find((entry) => entry.id === activeCell.setId);
  if (!set) return null;
  return { block, exercise, set };
}

function getFocusSet(exercise: Exercise, activeCell: ActiveCell | null, blockId: string): SessionSet | null {
  if (
    activeCell &&
    activeCell.blockId === blockId &&
    activeCell.exerciseId === exercise.id
  ) {
    const activeSet = exercise.sets.find((set) => set.id === activeCell.setId);
    if (activeSet) return activeSet;
  }

  return exercise.sets.find((set) => !set.completed) ?? exercise.sets[exercise.sets.length - 1] ?? null;
}

type SessionLoggerProps = {
  initialData?: ProgramTemplate;
};

export default function SessionLogger({ initialData }: SessionLoggerProps) {
  const router = useRouter();
  const { readiness } = useRecoveryState();
  const readinessModifier = readiness?.modifier ?? 0.85;
  const readinessScore = readiness?.score ?? 35;

  const initialProgram = useMemo(() => initialData ?? createQuickStartProgram(), [initialData]);
  const {
    state: session,
    dispatch,
    toggleComplete,
    addSet,
    updateNote,
    addExercise,
    setActiveCell,
  } = useWorkoutSession(initialProgram, readinessModifier);

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [restContext, setRestContext] = useState<{
    blockId: string;
    exerciseId: string;
    setId: string;
    wasLastSet: boolean;
  } | null>(null);
  const overviewScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const completedSets = useMemo(() => {
    return session.blocks.flatMap((block) =>
      block.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed))
    );
  }, [session.blocks]);

  const completedSetCount = completedSets.length;

  const totalVolume = useMemo(() => {
    return completedSets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
  }, [completedSets]);

  const volumeDisplay = useMemo(() => {
    return new Intl.NumberFormat('en-US').format(Math.round(totalVolume));
  }, [totalVolume]);

  const pulseVolumes = useMemo(() => {
    return completedSets.map((set) => ({
      set,
      volume: (set.weight ?? 0) * (set.reps ?? 0),
    }));
  }, [completedSets]);

  const maxPulseVolume = useMemo(() => {
    return Math.max(1, ...pulseVolumes.map((entry) => entry.volume));
  }, [pulseVolumes]);

  const prCount = useMemo(() => {
    return completedSets.filter((set) => (set.rpe ?? 0) >= 9).length;
  }, [completedSets]);

  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - session.startTime.getTime()) / 60000)
  );

  const completedExercises = useMemo(() => {
    return session.blocks
      .flatMap((block) => block.exercises)
      .map((exercise) => ({
        name: exercise.name,
        count: exercise.sets.filter((set) => set.completed).length,
      }))
      .filter((exercise) => exercise.count > 0);
  }, [session.blocks]);

  const exerciseRefs = useMemo<ExerciseRef[]>(() => {
    return session.blocks.flatMap((block) =>
      block.exercises.map((exercise) => ({
        blockId: block.id,
        blockType: block.type,
        exercise,
      }))
    );
  }, [session.blocks]);

  const focusedRef = useMemo(() => {
    if (!focusedExerciseId) return null;
    return exerciseRefs.find((entry) => entry.exercise.id === focusedExerciseId) ?? null;
  }, [exerciseRefs, focusedExerciseId]);

  const focusedSet = useMemo(() => {
    if (!focusedRef) return null;
    return getFocusSet(focusedRef.exercise, session.activeCell, focusedRef.blockId);
  }, [focusedRef, session.activeCell]);

  const focusContext = useMemo(() => {
    if (!focusedRef || !focusedSet) return null;
    return {
      blockId: focusedRef.blockId,
      exerciseId: focusedRef.exercise.id,
      setId: focusedSet.id,
      set: focusedSet,
      exercise: focusedRef.exercise,
    };
  }, [focusedRef, focusedSet]);

  const nextSetContext = useMemo(() => findSetByActiveCell(session.blocks, session.activeCell), [session.blocks, session.activeCell]);

  useEffect(() => {
    setIsKeypadOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (!isAddMovementOpen) return;
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(focusTimer);
  }, [isAddMovementOpen]);

  useEffect(() => {
    if (!focusedRef || viewMode !== 'cockpit') return;

    const hasIncomplete = focusedRef.exercise.sets.some((set) => !set.completed);
    if (hasIncomplete) return;

    if (session.activeCell?.exerciseId && session.activeCell.exerciseId !== focusedRef.exercise.id) {
      setFocusedExerciseId(session.activeCell.exerciseId);
    }
  }, [focusedRef, session.activeCell, viewMode]);

  useEffect(() => {
    if (!focusContext) return;
    setNotesDraft(focusContext.exercise.notes ?? '');
  }, [focusContext]);

  const handleOpenFocus = (entry: ExerciseRef) => {
    const targetSet = entry.exercise.sets.find((set) => !set.completed) ?? entry.exercise.sets[0] ?? null;

    if (targetSet) {
      setActiveCell({
        blockId: entry.blockId,
        exerciseId: entry.exercise.id,
        setId: targetSet.id,
        field: 'weight',
      });
    } else {
      addSet(entry.blockId, entry.exercise.id);
    }

    setFocusedExerciseId(entry.exercise.id);
    setViewMode('cockpit');
  };

  const applySetUpdate = (field: 'weight' | 'reps' | 'rpe', nextValue: number | null) => {
    if (!focusContext) return;

    dispatch({
      type: 'UPDATE_SET',
      payload: {
        blockId: focusContext.blockId,
        exerciseId: focusContext.exerciseId,
        setId: focusContext.setId,
        updates:
          field === 'weight'
            ? { weight: nextValue }
            : field === 'reps'
              ? { reps: nextValue == null ? null : Math.max(0, Math.round(nextValue)) }
              : { rpe: nextValue == null ? null : Math.max(1, Math.min(10, Math.round(nextValue * 2) / 2)) },
      },
    });
  };

  const handleWeightChange = (nextValue: number) => {
    applySetUpdate('weight', Math.max(0, nextValue));
  };

  const handleRepsChange = (nextValue: number) => {
    applySetUpdate('reps', Math.max(0, Math.round(nextValue)));
  };

  const handleRpeChange = (nextValue: number) => {
    applySetUpdate('rpe', nextValue);
  };

  const handleLogSet = () => {
    if (!focusContext) return;

    const setIndex = focusContext.exercise.sets.findIndex((set) => set.id === focusContext.setId);
    const wasLastSet = setIndex === focusContext.exercise.sets.length - 1;

    setRestContext({
      blockId: focusContext.blockId,
      exerciseId: focusContext.exerciseId,
      setId: focusContext.setId,
      wasLastSet,
    });

    toggleComplete(focusContext.blockId, focusContext.exerciseId, focusContext.setId);
    setViewMode('rest');
  };

  const handleContinue = () => {
    if (nextSetContext && restContext && nextSetContext.exercise.id === restContext.exerciseId) {
      setViewMode('cockpit');
    } else {
      setViewMode('overview');
      setFocusedExerciseId(null);
    }
  };

  const handleAddBonusSet = () => {
    if (!restContext) return;
    addSet(restContext.blockId, restContext.exerciseId);
    setRestContext((current) => (current ? { ...current, wasLastSet: false } : current));
    setViewMode('cockpit');
  };

  const handleOpenNotes = () => {
    setIsNotesOpen(true);
  };

  const handleSaveNotes = () => {
    if (focusContext) {
      updateNote(focusContext.blockId, focusContext.exerciseId, notesDraft);
    }
    setIsNotesOpen(false);
  };

  const handleFinishWorkout = () => {
    if (completedSetCount === 0) {
      const confirmExit = window.confirm('Exit without saving this session?');
      if (confirmExit) {
        router.push('/');
      }
      return;
    }
    setIsSummaryOpen(true);
  };

  const handleShare = async () => {
    const text = `IRON BRAIN SESSION\nVolume: ${volumeDisplay}lbs\nDuration: ${durationMinutes}min\n\nCompleted with Iron Brain app.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Iron Brain Session', text });
      } catch {
        // no-op
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());
  }, []);

  const handleAddMovement = (name: string) => {
    addExercise(name);
    setIsAddMovementOpen(false);
    setSearchQuery('');
    setTimeout(() => {
      overviewScrollRef.current?.scrollTo({
        top: overviewScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  };

  const lastWeight = focusContext
    ? parsePreviousWeight(focusContext.set.previous) ?? getLastWeight(focusContext.exerciseId)
    : 200;
  const weightValue = focusContext?.set.weight ?? 0;
  const repsValue = focusContext?.set.reps ?? 8;
  const rpeValue = focusContext?.set.rpe ?? null;
  const bodyweightExercise = focusedRef ? isBodyweight(focusedRef.exercise.name) : false;

  const nextSetIndex = nextSetContext
    ? nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id)
    : null;
  const nextSetNumber = (nextSetIndex ?? 0) + 1;

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return COMMON_EXERCISES;
    return COMMON_EXERCISES.filter((exercise) => exercise.name.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <>
      <div className="relative w-full h-[100dvh] bg-zinc-950 text-white flex flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full overflow-y-auto pb-20 space-y-8"
              ref={overviewScrollRef}
            >
              <div className="px-4 pt-12 pb-4">
                <p className="text-zinc-500 text-xs uppercase tracking-[0.25em]">Session Readiness</p>
                <p className="text-6xl font-black text-white">{Math.round(readinessScore)}</p>
              </div>

              <div className="space-y-6 px-4">
                {exerciseRefs.map((entry) => {
                  const style = getExerciseStyle(entry.exercise.name);
                  const StyleIcon = style.icon;

                  return (
                    <button
                      key={entry.exercise.id}
                      type="button"
                      onClick={() => handleOpenFocus(entry)}
                      className="group relative w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <StyleIcon className={`h-4 w-4 ${style.color}`} />
                            <span className={`text-xs font-bold tracking-[0.2em] ${style.color}`}>{style.label}</span>
                          </div>
                          <p className="text-3xl font-black italic text-white">{entry.exercise.name}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {entry.exercise.sets.map((set) => (
                            <span
                              key={set.id}
                              className={`h-2 w-2 rounded-full ${set.completed ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsAddMovementOpen(true)}
                  className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Exercise
                </button>
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={handleFinishWorkout}
                  className="w-full bg-emerald-500 text-zinc-950 font-black tracking-widest uppercase py-4 rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
                >
                  Finish Workout
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'cockpit' && (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full flex flex-col overflow-hidden relative select-none touch-none pb-32"
            >
            <header className="mb-6 flex items-center gap-4 px-4">
              <button
                type="button"
                onClick={() => {
                  setViewMode('overview');
                  setFocusedExerciseId(null);
                }}
                className="inline-flex items-center text-zinc-400 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </button>

              <div>
                {focusedRef && (() => {
                  const style = getExerciseStyle(focusedRef.exercise.name);
                  const StyleIcon = style.icon;
                  return (
                    <div className="mb-1 flex items-center gap-2">
                      <StyleIcon className={`h-4 w-4 ${style.color}`} />
                      <span className={`text-xs font-bold tracking-[0.2em] ${style.color}`}>{style.label}</span>
                    </div>
                  );
                })()}
                <h2 className="text-4xl font-black text-white">{focusedRef?.exercise.name ?? 'Exercise'}</h2>
              </div>
            </header>

            <div className="px-4 mt-6">
              <div className="flex flex-col justify-center gap-6">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-500 text-xs uppercase">Current Set</p>
                  <p className="text-zinc-500 text-xs">Prev {focusContext?.set.previous ?? '--'}</p>
                </div>

                <div className={`grid gap-6 ${bodyweightExercise ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {!bodyweightExercise && (
                    <HardyStepper
                      layout="vertical"
                      value={weightValue}
                      onChange={handleWeightChange}
                      step={0.5}
                      label="LBS"
                      onLabelClick={() => {
                        if (!focusContext) return;
                        setActiveCell({
                          blockId: focusContext.blockId,
                          exerciseId: focusContext.exerciseId,
                          setId: focusContext.setId,
                          field: 'weight',
                        });
                        setIsKeypadOpen(true);
                      }}
                    />
                  )}

                  <HardyStepper
                    layout="vertical"
                    value={repsValue}
                    onChange={handleRepsChange}
                    step={1}
                    label="REPS"
                    onLabelClick={() => {
                      if (!focusContext) return;
                      setActiveCell({
                        blockId: focusContext.blockId,
                        exerciseId: focusContext.exerciseId,
                        setId: focusContext.setId,
                        field: 'reps',
                      });
                      setIsKeypadOpen(true);
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-100 text-sm font-bold">RPE {rpeValue?.toFixed(1) ?? '--'}</p>
                    <p className="text-zinc-400 text-sm">RIR {rpeValue == null ? '--' : Math.max(0, Math.round((10 - rpeValue) * 10) / 10)}</p>
                  </div>
                  <div>
                    <RpeSlider value={rpeValue} onChange={handleRpeChange} />
                  </div>
                </div>
              </div>
            </div>

            <footer className="w-full px-4 mt-12">
              <div className="w-full h-20 bg-zinc-900/80 rounded-[2.5rem] flex items-center p-2 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex-1 h-full flex items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-800/50 transition-colors active:scale-95 cursor-pointer"
                >
                  <History className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={handleLogSet}
                  disabled={!focusContext}
                  className="flex-[2] mx-2 h-full bg-emerald-500 hover:bg-emerald-400 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-xl tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
                >
                  LOG SET
                </button>

                <button
                  type="button"
                  onClick={handleOpenNotes}
                  className="flex-1 h-full flex items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-800/50 transition-colors active:scale-95 cursor-pointer"
                >
                  <FileText className="w-7 h-7" />
                </button>
              </div>
            </footer>
          </motion.div>
        )}

          {viewMode === 'rest' && (
            <motion.div
              key="rest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 w-full flex flex-col overflow-hidden"
            >
              <RestTimer
                isActive={viewMode === 'rest'}
                duration={REST_DURATION_SECONDS}
                onComplete={(addExtra) => {
                  if (addExtra) {
                    handleAddBonusSet();
                  } else {
                    handleContinue();
                  }
                }}
                nextSetInfo={{
                  exerciseName: nextSetContext?.exercise.name,
                  setNumber: nextSetNumber,
                  weight: nextSetContext?.set.weight ?? undefined,
                  reps: nextSetContext?.set.reps ?? undefined,
                }}
                isLastSetOfExercise={Boolean(restContext?.wasLastSet)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-0 z-50 bg-zinc-950 p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-white text-xl font-black">History</p>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              {(focusedRef?.exercise.sets ?? []).map((set, index) => (
                <div key={set.id} className="border-b border-zinc-900 py-4">
                  <p className="text-white font-bold">{set.previous ?? `Set ${index + 1}`}</p>
                  <p className="text-zinc-400 text-sm uppercase tracking-[0.2em]">Type: {set.type}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNotesOpen && (
          <motion.div
            key="notes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-950 p-6 flex flex-col justify-center"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-xl font-black">Session Notes</h3>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="w-full resize-none rounded-2xl bg-zinc-900 p-4 text-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                placeholder="Add notes for this exercise..."
                rows={8}
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400 hover:text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddMovementOpen && (
          <motion.div
            key="add-movement"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-zinc-950 p-6 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-white">ADD MOVEMENT</h3>
              <button
                type="button"
                onClick={() => setIsAddMovementOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-3xl text-white placeholder:text-zinc-800 focus:outline-none"
              />
            </div>

            <div className="mt-8 flex-1 overflow-y-auto">
              {filteredExercises.map((exercise) => {
                const style = getExerciseStyle(exercise.name);
                const StyleIcon = style.icon;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                  onClick={() => handleAddMovement(exercise.name)}
                    className="w-full py-4 border-b border-zinc-900 text-left"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <StyleIcon className={`h-4 w-4 ${style.color}`} />
                      <span className={`text-xs font-bold tracking-[0.2em] ${style.color}`}>{style.label}</span>
                    </div>
                    <p className="text-white text-xl font-bold">{exercise.name}</p>
                  </button>
                );
              })}

              {searchQuery.trim().length > 0 && filteredExercises.length === 0 && (
                <button
                  type="button"
                  onClick={() => handleAddMovement(searchQuery.trim())}
                  className="mt-6 text-emerald-400 text-lg font-semibold"
                >
                  Create &quot;{searchQuery.trim()}&quot;
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSummaryOpen && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto text-white"
          >
            <div className="pt-[calc(env(safe-area-inset-top)+3rem)] px-6 pb-48">
              <div className="mx-auto w-full max-w-xl">
                <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500 text-center">
                  SESSION COMPLETE
                </p>
                <p className="mt-3 text-xs font-mono text-zinc-500 text-center">{formattedDate}</p>

                <div className="mt-8 text-center">
                  <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500">Total Volume</p>
                  <p className="mt-4 text-6xl font-black italic text-white">{volumeDisplay} LBS</p>
                </div>

                <div className="h-48 w-full flex items-end justify-center gap-1 my-8">
                  {pulseVolumes.map((entry) => {
                    const rpe = entry.set.rpe ?? null;
                    const color =
                      rpe == null
                        ? 'bg-zinc-700'
                        : rpe < 7
                          ? 'bg-sky-500'
                          : rpe < 9
                            ? 'bg-violet-500'
                            : 'bg-rose-500';

                    return (
                      <div
                        key={entry.set.id}
                        className={`flex-1 w-full max-w-4 rounded-t-sm ${color}`}
                        style={{ height: `${(entry.volume / maxPulseVolume) * 100}%` }}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500">Volume</p>
                    <p className="mt-2 text-2xl font-black text-white">{volumeDisplay}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500">Time</p>
                    <p className="mt-2 text-2xl font-black text-white">{durationMinutes}M</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-500">PRs</p>
                    <p className="mt-2 text-2xl font-black text-white">{prCount}</p>
                  </div>
                </div>

                <div className="mt-10 border-t border-dashed border-zinc-800 pt-4 space-y-2 text-sm text-zinc-400 font-mono">
                  {completedExercises.length === 0 && <p>NO SETS LOGGED.</p>}
                  {completedExercises.map((exercise) => (
                    <div key={exercise.name} className="flex items-center gap-3">
                      <span className="uppercase">{exercise.name}</span>
                      <span className="flex-1 border-b border-dashed border-zinc-800" />
                      <span className="uppercase">{exercise.count} sets</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[110] bg-zinc-950 border-t border-zinc-900 px-6 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full rounded-2xl bg-zinc-900 py-4 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
                >
                  Finish & Exit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassKeypad
        isOpen={isKeypadOpen}
        onClose={() => setIsKeypadOpen(false)}
        onValueChange={(value) => {
          if (!session.activeCell) return;
          const parsed = value.trim() === '' ? null : Number(value);
          if (parsed != null && Number.isNaN(parsed)) return;

          if (session.activeCell.field === 'weight') {
            applySetUpdate('weight', parsed);
          } else if (session.activeCell.field === 'reps') {
            applySetUpdate('reps', parsed);
          } else {
            applySetUpdate('rpe', parsed);
          }
        }}
        onIncrement={(amount) => {
          if (!session.activeCell) return;

          if (session.activeCell.field === 'weight') {
            const base = weightValue;
            applySetUpdate('weight', Math.max(0, roundToFive(base + amount)));
          } else if (session.activeCell.field === 'reps') {
            const base = repsValue;
            applySetUpdate('reps', Math.max(0, Math.round(base + amount)));
          } else {
            const base = rpeValue ?? 1;
            applySetUpdate('rpe', Math.min(10, Math.max(1, Math.round((base + amount) * 2) / 2)));
          }
        }}
        onNext={() => {
          if (session.activeCell) {
            if (session.activeCell.field === 'weight') {
              applySetUpdate('weight', weightValue);
            } else if (session.activeCell.field === 'reps') {
              applySetUpdate('reps', repsValue);
            } else {
              applySetUpdate('rpe', rpeValue ?? 1);
            }
          }
          handleLogSet();
          setIsKeypadOpen(false);
        }}
        type={session.activeCell?.field === 'reps' ? 'reps' : session.activeCell?.field === 'rpe' ? 'rpe' : 'weight'}
      />
    </>
  );
}
