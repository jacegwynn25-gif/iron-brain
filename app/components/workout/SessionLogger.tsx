'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Dumbbell,
  FileText,
  History,
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

function buildMockProgram(): ProgramTemplate {
  return {
    id: 'focus_mode_program',
    name: 'Focus Mode Session',
    isCustom: true,
    weeks: [
      {
        weekNumber: 1,
        days: [
          {
            dayOfWeek: 'Mon',
            name: 'Full Body Focus',
            sets: [
              { exerciseId: 'bench_press', setIndex: 1, prescribedReps: '10', setType: 'warmup' },
              { exerciseId: 'bench_press', setIndex: 2, prescribedReps: '8', setType: 'straight' },
              { exerciseId: 'bench_press', setIndex: 3, prescribedReps: '8', setType: 'straight' },
              { exerciseId: 'squat', setIndex: 1, prescribedReps: '8', setType: 'warmup' },
              { exerciseId: 'squat', setIndex: 2, prescribedReps: '6', setType: 'straight' },
              { exerciseId: 'squat', setIndex: 3, prescribedReps: '6', setType: 'straight' },
              { exerciseId: 'row', setIndex: 1, prescribedReps: '12', setType: 'warmup' },
              { exerciseId: 'row', setIndex: 2, prescribedReps: '10', setType: 'straight' },
              { exerciseId: 'row', setIndex: 3, prescribedReps: '10', setType: 'straight' },
            ],
          },
        ],
      },
    ],
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

function getExerciseProgress(exercise: Exercise): { done: number; total: number } {
  const total = exercise.sets.length;
  const done = exercise.sets.filter((set) => set.completed).length;
  return { done, total };
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

export default function SessionLogger() {
  const { readiness } = useRecoveryState();
  const readinessModifier = readiness?.modifier ?? 0.85;
  const readinessScore = readiness?.score ?? 35;

  const mockProgram = useMemo(() => buildMockProgram(), []);
  const {
    state: session,
    dispatch,
    toggleComplete,
    addSet,
    updateNote,
    setActiveCell,
  } = useWorkoutSession(mockProgram, readinessModifier);

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [restContext, setRestContext] = useState<{
    blockId: string;
    exerciseId: string;
    setId: string;
    wasLastSet: boolean;
  } | null>(null);

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
    setViewMode('cockpit');
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

  const lastWeight = focusContext
    ? parsePreviousWeight(focusContext.set.previous) ?? getLastWeight(focusContext.exerciseId)
    : 200;
  const weightValue = focusContext?.set.weight ?? 0;
  const repsValue = focusContext?.set.reps ?? 8;
  const rpeValue = focusContext?.set.rpe ?? null;

  const nextSetIndex = nextSetContext
    ? nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id)
    : null;
  const nextSetNumber = (nextSetIndex ?? 0) + 1;

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
            >
              <div className="px-4 pt-12 pb-4">
                <p className="text-zinc-500 text-xs uppercase tracking-[0.25em]">Session Readiness</p>
                <p className="text-6xl font-black text-white">{Math.round(readinessScore)}</p>
              </div>

              <div className="space-y-6 px-4">
                {exerciseRefs.map((entry) => {
                  const progress = getExerciseProgress(entry.exercise);
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
                          {Array.from({ length: progress.total }).map((_, index) => (
                            <span
                              key={`${entry.exercise.id}-dot-${index}`}
                              className={`h-2 w-2 rounded-full ${index < progress.done ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  disabled
                  className="w-full text-zinc-600 font-bold tracking-widest uppercase"
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

                <div className="grid grid-cols-2 gap-6">
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
