'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  StickyNote,
  Timer,
} from 'lucide-react';
import type { ProgramTemplate } from '@/app/lib/types';
import type { ActiveCell, Block, Exercise, Set as SessionSet } from '@/app/lib/types/session';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import { useWorkoutSession } from '@/app/lib/hooks/useWorkoutSession';
import HardyStepper from '@/app/components/workout/controls/HardyStepper';
import RpeSlider from '@/app/components/workout/controls/RpeSlider';
import GlassKeypad from '@/app/components/workout/controls/GlassKeypad';
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
  const [restSeconds, setRestSeconds] = useState(REST_DURATION_SECONDS);
  const [lastCompleted, setLastCompleted] = useState<{
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
    if (viewMode === 'rest') {
      setRestSeconds(REST_DURATION_SECONDS);
    }
  }, [viewMode]);

  useEffect(() => {
    setIsKeypadOpen(false);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'rest') return;
    if (restSeconds <= 0) return;

    const timer = setInterval(() => {
      setRestSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [restSeconds, viewMode]);

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
    applySetUpdate('weight', Math.max(0, roundToFive(nextValue)));
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

    setLastCompleted({
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
    if (!lastCompleted) return;
    addSet(lastCompleted.blockId, lastCompleted.exerciseId);
    setViewMode('cockpit');
    setLastCompleted(null);
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
  const suggestedWeight = roundToFive(lastWeight * readinessModifier);
  const weightValue = focusContext?.set.weight ?? suggestedWeight;
  const repsValue = focusContext?.set.reps ?? 8;
  const rpeValue = focusContext?.set.rpe ?? null;

  const nextWeight = nextSetContext
    ? nextSetContext.set.weight ?? roundToFive((parsePreviousWeight(nextSetContext.set.previous) ?? getLastWeight(nextSetContext.exercise.id)) * readinessModifier)
    : null;
  const nextReps = nextSetContext?.set.reps ?? null;
  const nextSetIndex = nextSetContext
    ? nextSetContext.exercise.sets.findIndex((set) => set.id === nextSetContext.set.id)
    : null;

  return (
    <>
      <div className="relative min-h-[calc(100dvh-10rem)] overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-xl">
                <p className="text-zinc-400 text-xs uppercase">Daily Readiness</p>
                <div className="mt-1 flex items-end justify-between">
                  <p className="text-zinc-100 text-3xl font-bold">{Math.round(readinessScore)}</p>
                  <p className="text-zinc-400 text-sm">Modifier {readinessModifier.toFixed(2)}x</p>
                </div>
              </div>

              <div className="space-y-3">
                {exerciseRefs.map((entry) => {
                  const progress = getExerciseProgress(entry.exercise);

                  return (
                    <button
                      key={entry.exercise.id}
                      type="button"
                      onClick={() => handleOpenFocus(entry)}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900/40 p-4 text-left backdrop-blur-xl transition-colors hover:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-zinc-100 text-lg font-bold">{entry.exercise.name}</p>
                          <p className="text-zinc-400 text-xs uppercase">{entry.blockType === 'superset' ? 'Superset Block' : 'Single Block'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-zinc-100 text-sm font-bold">{progress.done}/{progress.total} Sets Done</p>
                          <p className="text-zinc-500 text-xs">Tap to enter Focus Mode</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-4 text-zinc-500 backdrop-blur-xl"
              >
                Finish Workout
              </button>
            </motion.div>
          )}

          {viewMode === 'cockpit' && (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-[calc(100dvh-10rem)] flex-col"
            >
              <header className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-3 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('overview');
                    setFocusedExerciseId(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-zinc-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <div>
                  <p className="text-zinc-400 text-xs uppercase">Focus Mode</p>
                  <h2 className="text-zinc-100 text-xl font-bold">{focusedRef?.exercise.name ?? 'Exercise'}</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-2 text-zinc-100"
                >
                  <History className="h-4 w-4" />
                </button>
              </header>

              <div className="flex-1 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-400 text-xs uppercase">Current Set</p>
                    <p className="text-zinc-500 text-xs">Prev {focusContext?.set.previous ?? '--'}</p>
                  </div>

                  <div className="mt-3 space-y-4">
                    <HardyStepper
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

                    <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-zinc-100 text-sm font-bold">RPE {rpeValue?.toFixed(1) ?? '--'}</p>
                        <p className="text-zinc-400 text-sm">RIR {rpeValue == null ? '--' : Math.max(0, Math.round((10 - rpeValue) * 10) / 10)}</p>
                      </div>
                      <div className="mt-3">
                        <RpeSlider value={rpeValue} onChange={handleRpeChange} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="mt-4 flex flex-col gap-3 pb-2">
                <button
                  type="button"
                  onClick={handleOpenNotes}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-3 text-zinc-100 backdrop-blur-xl"
                >
                  <StickyNote className="h-4 w-4" />
                  Notes
                </button>

                <button
                  type="button"
                  onClick={handleLogSet}
                  disabled={!focusContext}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-4 text-zinc-100 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Log Set
                </button>
              </footer>
            </motion.div>
          )}

          {viewMode === 'rest' && (
            <motion.div
              key="rest"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-[calc(100dvh-10rem)] flex-col justify-between"
            >
              <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-400 text-xs uppercase">Rest Mode</p>
                  <Timer className="h-5 w-5 text-zinc-300" />
                </div>
                <p className="mt-4 text-5xl font-bold text-zinc-100">{restSeconds}s</p>
                <p className="mt-2 text-zinc-400 text-sm">Auto-countdown started.</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-xl">
                <p className="text-zinc-400 text-xs uppercase">Up Next</p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-100 text-lg font-bold">{nextSetContext?.exercise.name ?? 'Next Exercise'}</p>
                    <p className="text-zinc-400 text-sm">
                      Set {nextSetIndex != null && nextSetIndex >= 0 ? nextSetIndex + 1 : '--'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-100 text-lg font-bold">{nextWeight ?? '--'} lbs</p>
                    <p className="text-zinc-400 text-sm">{nextReps ?? '--'} reps</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {lastCompleted?.wasLastSet && (
                  <button
                    type="button"
                    onClick={handleAddBonusSet}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/20 px-4 py-4 text-zinc-100"
                  >
                    Add Bonus Set
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-4 text-zinc-100"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="fixed inset-0 z-40"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsHistoryOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-white/10 bg-zinc-950/80 p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <p className="text-zinc-100 font-bold">History</p>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-zinc-400"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {(focusedRef?.exercise.sets ?? []).map((set) => (
                  <div key={set.id} className="rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-zinc-100">
                    <p className="text-sm font-bold">{set.previous ?? 'No history'}</p>
                    <p className="text-xs text-zinc-400">Type: {set.type}</p>
                  </div>
                ))}
              </div>
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
            className="fixed inset-0 z-50"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsNotesOpen(false)} />
            <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-zinc-950/90 p-6 backdrop-blur-2xl">
              <h3 className="text-zinc-100 text-lg font-bold">Session Notes</h3>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="mt-4 min-h-[140px] w-full rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-100 focus:outline-none"
                placeholder="Add notes for this exercise..."
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNotesOpen(false)}
                  className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm text-zinc-100"
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
