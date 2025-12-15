'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Exercise, SetTemplate, SetLog, WorkoutSession, ProgramTemplate } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import RestTimer from './RestTimer';
import { useWorkoutIntelligence } from '../lib/useWorkoutIntelligence';
import { Dumbbell } from 'lucide-react';
import HardyStepper from './HardyStepper';

interface WorkoutLoggerProps {
  program: ProgramTemplate;
  weekNumber: number;
  dayIndex: number;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
  initialSession?: WorkoutSession | null;
  onSessionUpdate?: (session: WorkoutSession) => void;
}

export default function WorkoutLogger({
  program,
  weekNumber,
  dayIndex,
  onComplete,
  onCancel,
  initialSession,
  onSessionUpdate,
}: WorkoutLoggerProps) {
  const week = program.weeks.find(w => w.weekNumber === weekNumber);
  const day = week?.days[dayIndex];

  const sessionId = useMemo(() => {
    if (initialSession?.id) return initialSession.id;
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'fallback';
    return `session_${uuid}`;
  }, [initialSession?.id]);
  const sessionStart = useMemo(
    () => new Date(initialSession?.startTime ?? new Date()),
    [initialSession?.startTime]
  );

  // Get all set templates for this workout
  const setTemplates = useMemo(() => day?.sets || [], [day]);
  const initialCompletedSets = initialSession ? initialSession.sets.filter(s => s.completed).length : 0;
  const initialSetIndex = Math.min(
    Math.max(initialCompletedSets, 0),
    Math.max(setTemplates.length - 1, 0)
  );

  const [session, setSession] = useState<WorkoutSession>(() =>
    initialSession ?? {
      id: sessionId,
      programId: program.id,
      programName: program.name,
      cycleNumber: 1, // TODO: Track cycle from user data
      weekNumber,
      dayOfWeek: day?.dayOfWeek || 'Mon',
      dayName: day?.name || '',
      date: sessionStart.toISOString().split('T')[0],
      startTime: sessionStart.toISOString(),
      sets: [],
      createdAt: sessionStart.toISOString(),
      updatedAt: sessionStart.toISOString(),
    }
  );

  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showUpcomingSets, setShowUpcomingSets] = useState(false);
  const [appliedRestTimerWeight, setAppliedRestTimerWeight] = useState<number | null>(null);
  const [ignoredSuggestion, setIgnoredSuggestion] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (onSessionUpdate) {
      onSessionUpdate(session);
    }
  }, [session, onSessionUpdate]);

  const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - sessionStartMs) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedDisplay = `${elapsedMinutes}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  const currentTemplate = setTemplates[currentSetIndex];
  const currentExercise = currentTemplate ? (defaultExercises.find(ex => ex.id === currentTemplate.exerciseId) || null) : null;

  // Check if current set is part of a superset
  const isSuperset = currentTemplate?.setType === 'superset' && currentTemplate?.supersetGroup;
  const nextSetInSuperset = isSuperset
    ? setTemplates[currentSetIndex + 1]
    : null;
  const isNextSetSameGroup = nextSetInSuperset?.supersetGroup === currentTemplate?.supersetGroup;
  const nextExerciseInSuperset = isNextSetSameGroup && nextSetInSuperset
    ? (defaultExercises.find(ex => ex.id === nextSetInSuperset.exerciseId) || null)
    : null;

  // Calculate next set info for rest timer
  const nextSetTemplate = setTemplates[currentSetIndex];
  const nextExercise = nextSetTemplate ? (defaultExercises.find(ex => ex.id === nextSetTemplate.exerciseId) || null) : null;

  // Get weight suggestion for the next set
  const nextSetSuggestion = nextSetTemplate
    ? storage.suggestWeight(
        nextSetTemplate.exerciseId,
        parseInt(String(nextSetTemplate.prescribedReps)) || 5,
        nextSetTemplate.targetRPE,
        session.sets
      )
    : null;

  const nextSetInfo = nextSetTemplate && nextExercise ? {
    exerciseName: nextExercise.name,
    setNumber: nextSetTemplate.setIndex,
    totalSets: setTemplates.filter(st => st.exerciseId === nextSetTemplate.exerciseId).length,
    prescribedReps: nextSetTemplate.prescribedReps,
    targetRPE: nextSetTemplate.targetRPE ?? undefined,
    targetRIR: nextSetTemplate.targetRIR ?? undefined,
    suggestedWeight: nextSetSuggestion?.suggestedWeight ?? undefined,
    weightReasoning: nextSetSuggestion?.reasoning ?? undefined,
    lastWeight: session.sets.filter(s => s.exerciseId === nextSetTemplate.exerciseId && s.actualWeight).slice(-1)[0]?.actualWeight ?? undefined,
    lastReps: session.sets.filter(s => s.exerciseId === nextSetTemplate.exerciseId && s.actualReps).slice(-1)[0]?.actualReps ?? undefined,
  } : undefined;

  // Rest timer handlers
  const handleRestComplete = () => {
    setIsResting(false);
    setRestTimerSeconds(null);
  };

  const handleSkipRest = () => {
    setIsResting(false);
    setRestTimerSeconds(null);
  };

  const buildFinalSession = useCallback((setsOverride?: SetLog[]) => {
    const finalSets = setsOverride ?? session.sets;
    const finishedAt = new Date();
    const completedSets = finalSets.filter(s => s.completed);
    const totalVolume = completedSets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);
    const rpeValues = completedSets
      .map(s => s.actualRPE)
      .filter((rpe): rpe is number => rpe !== null && rpe !== undefined);
    const avgRPE = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : undefined;

    return {
      ...session,
      sets: finalSets,
      endTime: finishedAt.toISOString(),
      durationMinutes: session.startTime
        ? Math.round((finishedAt.getTime() - new Date(session.startTime).getTime()) / 1000 / 60)
        : undefined,
      totalVolumeLoad: totalVolume,
      averageRPE: avgRPE,
    };
  }, [session]);

  const logSet = useCallback((setLog: Partial<SetLog>) => {
    const completeSetLog: SetLog = {
      exerciseId: currentTemplate.exerciseId,
      setIndex: currentTemplate.setIndex,
      prescribedReps: currentTemplate.prescribedReps,
      prescribedRPE: currentTemplate.targetRPE,
      prescribedRIR: currentTemplate.targetRIR,
      completed: true,
      ...setLog,
      timestamp: new Date().toISOString(),
    };

    if (completeSetLog.actualWeight && completeSetLog.actualReps) {
      completeSetLog.e1rm = calculateE1RM(completeSetLog.actualWeight, completeSetLog.actualReps);
      completeSetLog.volumeLoad = completeSetLog.actualWeight * completeSetLog.actualReps;
    }

    const updatedSets = [...session.sets, completeSetLog];
    const updatedSession: WorkoutSession = {
      ...session,
      sets: updatedSets,
      updatedAt: new Date().toISOString(),
    };
    setSession(updatedSession);

    const nextIndex = currentSetIndex + 1;
    const willMoveToNext = nextIndex < setTemplates.length;

    if (willMoveToNext) {
      setCurrentSetIndex(nextIndex);
      setIgnoredSuggestion(false); // Reset for next set
      setAppliedRestTimerWeight(null); // Clear applied weight for next set
    }

    const nextTemplate = willMoveToNext ? setTemplates[nextIndex] : null;
    const isNextInSameSuperset = currentTemplate.setType === 'superset' &&
                                  nextTemplate?.setType === 'superset' &&
                                  currentTemplate.supersetGroup === nextTemplate?.supersetGroup;

    if (!willMoveToNext) {
      const finalSession = buildFinalSession(updatedSets);
      setIsResting(false);
      setRestTimerSeconds(null);
      onComplete(finalSession);
      return;
    }

    if (!isNextInSameSuperset) {
      let restTime = currentTemplate.restSeconds || currentExercise?.defaultRestSeconds;
      if (!restTime && currentExercise) {
        if (currentExercise.type === 'compound') {
          restTime = 180;
        } else {
          restTime = 90;
        }
      }
      setRestTimerSeconds(restTime || 90);
      setIsResting(true);
    }
  }, [currentTemplate, currentExercise, currentSetIndex, setTemplates, session, buildFinalSession, onComplete]);

  const skipSet = useCallback(() => {
    const skippedSetLog: SetLog = {
      exerciseId: currentTemplate.exerciseId,
      setIndex: currentTemplate.setIndex,
      prescribedReps: currentTemplate.prescribedReps,
      prescribedRPE: currentTemplate.targetRPE,
      completed: false,
      timestamp: new Date().toISOString(),
    };

    setSession(prev => ({
      ...prev,
      sets: [...prev.sets, skippedSetLog],
      updatedAt: new Date().toISOString(),
    }));

    if (currentSetIndex < setTemplates.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
    }
  }, [currentTemplate, currentSetIndex, setTemplates.length]);

  const finishWorkout = useCallback(() => {
    const finalSession = buildFinalSession();
    onComplete(finalSession);
  }, [buildFinalSession, onComplete]);

  if (!day || !currentTemplate) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">No workout data available</p>
        <button
          onClick={onCancel}
          className="mt-4 rounded-lg bg-zinc-900 px-6 py-2 text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isLastSet = currentSetIndex >= setTemplates.length - 1;
  const completedSets = session.sets.filter(s => s.completed).length;
  const progressPercentage = setTemplates.length ? (completedSets / setTemplates.length) * 100 : 0;
  const totalSetsForExercise = currentTemplate
    ? setTemplates.filter(st => st.exerciseId === currentTemplate.exerciseId).length
    : 0;
  const positionForExercise = currentTemplate
    ? setTemplates.slice(0, currentSetIndex + 1).filter(st => st.exerciseId === currentTemplate.exerciseId).length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-purple-50/40 to-zinc-100 dark:from-zinc-950 dark:via-purple-950/25 dark:to-zinc-900">
      <div className="w-full max-w-none px-2 py-4 sm:mx-auto sm:max-w-4xl sm:px-4 sm:py-8">
        {/* Compact Header */}
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-amber-500 p-1 shadow-xl">
          <div className="rounded-2xl bg-white/95 p-4 dark:bg-zinc-950/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 truncate">
                  {day.name}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  Week {weekNumber} • {completedSets}/{setTemplates.length} sets • {elapsedDisplay}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="rounded-xl border-2 border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-700 dark:hover:text-red-300 flex-shrink-0"
              >
                Exit
              </button>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
              </div>
              <span className="tabular-nums text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* Current Set Card */}
        <SetLogger
          template={currentTemplate}
          exercise={currentExercise}
          onLog={logSet}
          onSkip={skipSet}
          isLastSet={isLastSet}
          onFinish={finishWorkout}
          currentSessionSets={session.sets}
          nextExerciseInSuperset={nextExerciseInSuperset}
          setPositionForExercise={positionForExercise}
          totalSetsForExercise={totalSetsForExercise}
          initialWeight={appliedRestTimerWeight}
          ignoredSuggestion={ignoredSuggestion}
        />

        {/* Upcoming Sets Preview - Collapsible */}
        {setTemplates.slice(currentSetIndex + 1).length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowUpcomingSets(!showUpcomingSets)}
              className="w-full flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 hover:ring-purple-300 transition-all dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-purple-700"
            >
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                Upcoming Sets ({setTemplates.slice(currentSetIndex + 1).length})
              </span>
              <svg
                className={`h-5 w-5 text-zinc-500 dark:text-zinc-400 transition-transform ${showUpcomingSets ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUpcomingSets && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 animate-fadeIn">
                {setTemplates.slice(currentSetIndex + 1, currentSetIndex + 7).map((template, idx) => {
                  const ex = defaultExercises.find(e => e.id === template.exerciseId);
                  return (
                    <div
                      key={idx}
                      className="rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {ex?.name}
                      </span>
                      <span className="ml-2 text-zinc-600 dark:text-zinc-400">
                        {template.prescribedReps} reps
                        {template.targetRPE && ` @ RPE ${template.targetRPE}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rest Timer - Full Screen Overlay */}
      <RestTimer
        isActive={isResting}
        duration={restTimerSeconds || 0}
        onComplete={handleRestComplete}
        onSkip={handleSkipRest}
        nextSetInfo={nextSetInfo}
        fatigueAlert={nextSetSuggestion?.fatigueAlert ? {
          severity: nextSetSuggestion.fatigueAlert.severity,
          affectedMuscles: nextSetSuggestion.fatigueAlert.affectedMuscles,
          reasoning: nextSetSuggestion.fatigueAlert.detailedExplanation || nextSetSuggestion.reasoning,
          scientificBasis: nextSetSuggestion.fatigueAlert.scientificBasis,
        } : null}
        weightRecommendation={(() => {
          if (!nextSetSuggestion) return null;
          
          // Get the last weight used for this exercise in the CURRENT session
          const lastSessionWeight = session.sets
            .filter(s => s.exerciseId === nextSetTemplate?.exerciseId && s.actualWeight)
            .slice(-1)[0]?.actualWeight;
          
          // Get historical weight from previous workouts
          const historicalData = storage.getLastWorkoutForExercise(nextSetTemplate?.exerciseId || '');
          const lastHistoricalWeight = historicalData?.bestSet?.actualWeight;
          
          // Determine the reference weight (prefer current session, fall back to history)
          const referenceWeight = lastSessionWeight ?? lastHistoricalWeight;
          
          // Determine recommendation type
          let recType: 'increase' | 'decrease' | 'maintain' = 'maintain';
          
          if (nextSetSuggestion.basedOn === 'rpe_adjustment' && nextSetSuggestion.fatigueAlert) {
            // Fatigue-based decrease
            recType = 'decrease';
          } else if (referenceWeight && nextSetSuggestion.suggestedWeight > referenceWeight) {
            // Only show "increase" if we have a valid reference AND suggestion is higher
            recType = 'increase';
          } else if (referenceWeight && nextSetSuggestion.suggestedWeight < referenceWeight * 0.95) {
            // Show "decrease" if suggestion is more than 5% lower than reference
            recType = 'decrease';
          }
          // Otherwise stays 'maintain' - no alert shown
          
          return {
            type: recType,
            suggestedWeight: nextSetSuggestion.suggestedWeight,
            currentWeight: referenceWeight ?? undefined,
            reasoning: nextSetSuggestion.reasoning,
            confidence: nextSetSuggestion.confidence === 'high' ? 0.9 : nextSetSuggestion.confidence === 'medium' ? 0.7 : 0.5,
            scientificBasis: nextSetSuggestion.fatigueAlert?.scientificBasis || 'Based on your recent performance data',
          };
        })()}
        onApplyWeightSuggestion={(weight) => {
          setAppliedRestTimerWeight(weight);
          setIgnoredSuggestion(false);
        }}
        onIgnoreSuggestion={() => {
          setIgnoredSuggestion(true);
          setAppliedRestTimerWeight(null);
        }}
      />
    </div>
  );
}

// ============================================================
// SET LOGGER COMPONENT
// ============================================================

interface SetLoggerProps {
  template: SetTemplate;
  exercise: Exercise | null;
  onLog: (setLog: Partial<SetLog>) => void;
  onSkip: () => void;
  isLastSet: boolean;
  onFinish: () => void;
  currentSessionSets: SetLog[];
  nextExerciseInSuperset: Exercise | null;
  setPositionForExercise: number;
  totalSetsForExercise: number;
  initialWeight?: number | null;
  ignoredSuggestion?: boolean;
}

const getPrecision = (step: number) => {
  const parts = step.toString().split('.');
  return parts[1]?.length || 0;
};

const formatToStep = (val: number, step: number, min: number) => {
  const precision = getPrecision(step);
  const rounded = Math.round(val / step) * step;
  const clamped = Math.max(min, rounded);
  return clamped.toFixed(precision);
};

function SetLogger({
  template,
  exercise,
  onLog,
  onSkip,
  isLastSet,
  onFinish,
  currentSessionSets,
  nextExerciseInSuperset,
  setPositionForExercise,
  totalSetsForExercise,
  initialWeight,
  ignoredSuggestion,
}: SetLoggerProps) {
  const nowValue = useMemo(() => new Date().getTime(), []);
  const setType = template.setType || 'straight';
  const isDropSet = setType === 'drop';
  const isRestPause = setType === 'rest-pause';
  const isCluster = setType === 'cluster';
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [rir, setRir] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const weightRef = useRef<string>('');
  const repsRef = useRef<string>('');
  // Drop set state
  const [dropSetRounds, setDropSetRounds] = useState<Array<{ weight: string; reps: string; rpe: string }>>([
    { weight: '', reps: '', rpe: '' },
  ]);

  // Rest-pause set state
  const [restPauseRounds, setRestPauseRounds] = useState<Array<{ reps: string; restSeconds: string }>>([
    { reps: '', restSeconds: '15' },
  ]);

  // Cluster set state
  const [clusterRounds, setClusterRounds] = useState<Array<{ reps: string; restSeconds: string }>>([
    { reps: '2', restSeconds: '20' },
  ]);

  // Tempo tracking (only when prescribed in template)
  const [tempo, setTempo] = useState(template.tempo || '');
  const showTempo = Boolean(template.tempo);

  useEffect(() => {
    if (initialWeight != null && initialWeight > 0) {
      const formatted = formatToStep(initialWeight, 0.5, 0);
      weightRef.current = formatted;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeight(formatted);
    }
  }, [initialWeight]);

  const applyWeight = useCallback((next: number) => {
    const formatted = formatToStep(next, 0.5, 0);
    weightRef.current = formatted;
    setWeight(formatted);
  }, []);

  const applyReps = useCallback((next: number) => {
    const formatted = formatToStep(next, 1, 0);
    repsRef.current = formatted;
    setReps(formatted);
  }, []);

  const sanitizeWeight = useCallback(() => {
    const num = parseFloat(weightRef.current);
    if (isNaN(num)) {
      weightRef.current = '';
      setWeight('');
      return;
    }
    applyWeight(num);
  }, [applyWeight]);

  const sanitizeReps = useCallback(() => {
    const num = parseFloat(repsRef.current);
    if (isNaN(num)) {
      repsRef.current = '';
      setReps('');
      return;
    }
    applyReps(num);
  }, [applyReps]);

  const incrementWeight = useCallback((delta: number) => {
    const current = parseFloat(weightRef.current);
    const base = isNaN(current) ? 0 : current;
    applyWeight(base + delta);
  }, [applyWeight]);

  const incrementReps = useCallback((delta: number) => {
    const current = parseFloat(repsRef.current);
    const base = isNaN(current) ? 0 : current;
    applyReps(base + delta);
  }, [applyReps]);

  const basePrescribedReps = useMemo(() => {
    if (!template.prescribedReps) return null;
    const first = parseInt(template.prescribedReps.split('-')[0]);
    return isNaN(first) ? null : first;
  }, [template.prescribedReps]);

  const renderSetBody = () => {
    if (isRestPause) {
      return (
        <div className="space-y-4 rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-pink-50 p-5 shadow-md dark:border-red-700 dark:from-red-900/20 dark:to-pink-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-red-900 dark:text-red-100">⏸️ Rest-Pause Rounds</p>
              <p className="text-xs font-medium text-red-700 dark:text-red-300">Mini-sets with 10-15s rest</p>
            </div>
            <button
              onClick={() => setRestPauseRounds([...restPauseRounds, { reps: '', restSeconds: '15' }])}
              className="rounded-lg bg-gradient-to-r from-red-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg hover:from-red-700 hover:to-pink-700 transition-all transform hover:scale-105"
            >
              + Add Round
            </button>
          </div>

          {restPauseRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-pink-600 text-sm font-bold text-white shadow">
                {idx + 1}
              </span>
              <input
                type="number"
                placeholder="Reps"
                value={round.reps}
                onChange={(e) => {
                  const updated = [...restPauseRounds];
                  updated[idx].reps = e.target.value;
                  setRestPauseRounds(updated);
                }}
                className="w-24 rounded-lg border-2 border-red-300 bg-white px-3 py-2 text-sm font-semibold dark:border-red-700 dark:bg-zinc-800 focus:border-red-500 focus:ring-2 focus:ring-red-500 transition-all"
              />
              <input
                type="number"
                placeholder="Rest (s)"
                value={round.restSeconds}
                onChange={(e) => {
                  const updated = [...restPauseRounds];
                  updated[idx].restSeconds = e.target.value;
                  setRestPauseRounds(updated);
                }}
                className="flex-1 rounded-lg border-2 border-red-300 bg-white px-3 py-2 text-sm font-semibold dark:border-red-700 dark:bg-zinc-800 focus:border-red-500 focus:ring-2 focus:ring-red-500 transition-all"
              />
              {restPauseRounds.length > 1 && (
                <button
                  onClick={() => setRestPauseRounds(restPauseRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="rounded-lg bg-red-100 px-4 py-2 dark:bg-red-900/30">
            <p className="text-sm font-bold text-red-900 dark:text-red-100">
              Total reps: {restPauseRounds.reduce((sum, r) => sum + (parseInt(r.reps) || 0), 0)}
            </p>
          </div>
        </div>
      );
    }

    if (isCluster) {
      return (
        <div className="space-y-4 rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 shadow-md dark:border-indigo-700 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-indigo-900 dark:text-indigo-100">🔗 Cluster Rounds</p>
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Small clusters with short rest</p>
            </div>
            <button
              onClick={() => setClusterRounds([...clusterRounds, { reps: '2', restSeconds: '20' }])}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
            >
              + Add Cluster
            </button>
          </div>

          {clusterRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-bold text-white shadow">
                {idx + 1}
              </span>
              <input
                type="number"
                placeholder="Reps"
                value={round.reps}
                onChange={(e) => {
                  const updated = [...clusterRounds];
                  updated[idx].reps = e.target.value;
                  setClusterRounds(updated);
                }}
                className="w-24 rounded-lg border-2 border-indigo-300 bg-white px-3 py-2 text-sm font-semibold dark:border-indigo-700 dark:bg-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <input
                type="number"
                placeholder="Rest (s)"
                value={round.restSeconds}
                onChange={(e) => {
                  const updated = [...clusterRounds];
                  updated[idx].restSeconds = e.target.value;
                  setClusterRounds(updated);
                }}
                className="flex-1 rounded-lg border-2 border-indigo-300 bg-white px-3 py-2 text-sm font-semibold dark:border-indigo-700 dark:bg-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {clusterRounds.length > 1 && (
                <button
                  onClick={() => setClusterRounds(clusterRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="rounded-lg bg-indigo-100 px-4 py-2 dark:bg-indigo-900/30">
            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
              Total reps: {clusterRounds.reduce((sum, r) => sum + (parseInt(r.reps) || 0), 0)}
            </p>
          </div>
        </div>
      );
    }

    if (isDropSet) {
      return (
        <div className="space-y-4 rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-yellow-50 p-5 shadow-md dark:border-orange-700 dark:from-orange-900/20 dark:to-yellow-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-orange-900 dark:text-orange-100">📉 Drop Set Rounds</p>
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Decreasing weight, push to failure</p>
            </div>
            <button
              onClick={() => setDropSetRounds([...dropSetRounds, { weight: '', reps: '', rpe: '' }])}
              className="rounded-lg bg-gradient-to-r from-orange-600 to-yellow-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg hover:from-orange-700 hover:to-yellow-700 transition-all transform hover:scale-105"
            >
              + Add Round
            </button>
          </div>

          {dropSetRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-600 to-yellow-600 text-sm font-bold text-white shadow">
                {idx + 1}
              </span>
              <input
                type="number"
                placeholder="Weight"
                value={round.weight}
                onChange={(e) => {
                  const updated = [...dropSetRounds];
                  updated[idx].weight = e.target.value;
                  setDropSetRounds(updated);
                }}
                className="flex-1 rounded-lg border-2 border-orange-300 bg-white px-3 py-2 text-sm font-semibold dark:border-orange-700 dark:bg-zinc-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 transition-all"
              />
              <input
                type="number"
                placeholder="Reps"
                value={round.reps}
                onChange={(e) => {
                  const updated = [...dropSetRounds];
                  updated[idx].reps = e.target.value;
                  setDropSetRounds(updated);
                }}
                className="w-24 rounded-lg border-2 border-orange-300 bg-white px-3 py-2 text-sm font-semibold dark:border-orange-700 dark:bg-zinc-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 transition-all"
              />
              <input
                type="number"
                placeholder="RPE"
                value={round.rpe}
                onChange={(e) => {
                  const updated = [...dropSetRounds];
                  updated[idx].rpe = e.target.value;
                  setDropSetRounds(updated);
                }}
                step="0.5"
                className="w-24 rounded-lg border-2 border-orange-300 bg-white px-3 py-2 text-sm font-semibold dark:border-orange-700 dark:bg-zinc-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 transition-all"
              />
              {dropSetRounds.length > 1 && (
                <button
                  onClick={() => setDropSetRounds(dropSetRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Weight & Reps - Hardy Style Side by Side */}
        <div className="grid w-full grid-cols-2 gap-3">
          <HardyStepper
            label="Weight"
            value={weightDisplay}
            onChange={(val) => {
              weightRef.current = val;
              setWeight(val);
            }}
            onIncrement={() => incrementWeight(0.5)}
            onDecrement={() => incrementWeight(-0.5)}
            onSanitize={sanitizeWeight}
            inputMode="decimal"
            displayUnit="lbs"
            accelerate
          />
          <HardyStepper
            label="Reps"
            value={repsDisplay}
            onChange={(val) => {
              repsRef.current = val;
              setReps(val);
            }}
            onIncrement={() => incrementReps(1)}
            onDecrement={() => incrementReps(-1)}
            onSanitize={sanitizeReps}
            inputMode="numeric"
            accelerate={false}
          />
        </div>

        {/* RPE Slider - Full Width Row */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              RPE {rpe || '8'}
            </span>
            {template.targetRIR != null && (
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {template.targetRIR} RIR
              </span>
            )}
          </div>
          <input
            type="range"
            min="6"
            max="10"
            step="0.5"
            value={rpe || '8'}
            onChange={(e) => setRpe(e.target.value)}
            className="w-full h-2 appearance-none rounded-full bg-zinc-200 accent-purple-500 dark:bg-zinc-700"
          />
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/20 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-purple-600">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full border-none bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Advanced Options - Collapsible */}
        {(showTempo || template.targetRIR != null) && (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
              Advanced Options
            </summary>
            <div className="mt-2 space-y-2">
              {template.targetRIR != null && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-16 flex-shrink-0">
                    RIR
                  </label>
                  <input
                    type="number"
                    value={rir}
                    onChange={(e) => setRir(e.target.value)}
                    placeholder="2"
                    step={1}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-lg font-bold text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              )}
              {showTempo && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-16 flex-shrink-0">
                    Tempo
                  </label>
                  <input
                    type="text"
                    value={tempo}
                    onChange={(e) => setTempo(e.target.value)}
                    placeholder="3-1-2-0"
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    );
  };

  // Get weight suggestion - memoize to recalculate when currentSessionSets changes
  const suggestion = useMemo(() => {
    // Enhanced debug logging
    console.log('\n=== FATIGUE CHECK START ===');
    console.log('🎯 Target Exercise:', exercise?.name, `(ID: ${template.exerciseId})`);
    console.log('📊 Total session sets:', currentSessionSets.length);

    const completedWithRPE = currentSessionSets.filter(
      s => s.completed &&
           s.prescribedRPE !== null && s.prescribedRPE !== undefined &&
           s.actualRPE !== null && s.actualRPE !== undefined
    );

    console.log('✅ Completed sets with RPE:', completedWithRPE.length);

    if (completedWithRPE.length > 0) {
      console.log('📋 Detailed RPE breakdown:');
      completedWithRPE.forEach((s, idx) => {
        const overshoot = (s.actualRPE || 0) - (s.prescribedRPE || 0);
        const exerciseName = defaultExercises.find(ex => ex.id === s.exerciseId)?.name || s.exerciseId;
        console.log(`  ${idx + 1}. ${exerciseName} Set ${s.setIndex}:`);
        console.log(`     Prescribed RPE: ${s.prescribedRPE}`);
        console.log(`     Actual RPE: ${s.actualRPE}`);
        console.log(`     Overshoot: ${overshoot > 0 ? '+' : ''}${overshoot.toFixed(1)}`);
        console.log(`     Reps: ${s.actualReps || 'N/A'}, Weight: ${s.actualWeight || 'N/A'}lbs`);
      });
    } else {
      console.log('⚠️ No completed sets with RPE data yet - fatigue system inactive');
    }

    const sug = storage.suggestWeight(
      template.exerciseId,
      parseInt(template.prescribedReps) || 5,
      template.targetRPE,
      currentSessionSets
    );

    if (sug) {
      console.log('💡 SUGGESTION GENERATED:');
      console.log('   Weight:', sug.suggestedWeight, 'lbs');
      console.log('   Reasoning:', sug.reasoning);
      console.log('   Based on:', sug.basedOn);
      console.log('   Confidence:', sug.confidence);
      if (sug.fatigueAlert) {
        console.log('🚨 FATIGUE ALERT TRIGGERED:');
        console.log('   Severity:', sug.fatigueAlert.severity);
        console.log('   Affected muscles:', sug.fatigueAlert.affectedMuscles.join(', '));
        console.log('   Scientific basis:', sug.fatigueAlert.scientificBasis);
      } else {
        console.log('ℹ️ Suggestion without fatigue alert (normal progression)');
      }
    } else {
      console.log('❌ NO SUGGESTION - Likely no previous workout history for this exercise');
    }

    console.log('=== FATIGUE CHECK END ===\n');

    return sug;
  }, [template.exerciseId, template.prescribedReps, template.targetRPE, currentSessionSets, exercise?.name]);

  // Get last performance
  const lastWorkout = storage.getLastWorkoutForExercise(template.exerciseId);

  // Workout Intelligence - Smart recommendations
  const intelligence = useWorkoutIntelligence(
    currentSessionSets,
    exercise,
    lastWorkout?.bestSet,
    template.targetRPE ?? null
  );

  const weightSeed = useMemo(() => {
    // If user applied a specific weight from rest timer, use that
    if (initialWeight != null && initialWeight > 0) {
      return initialWeight;
    }
    
    // If user ignored the suggestion, skip fatigue-adjusted weights and use historical data
    if (ignoredSuggestion) {
      if (lastWorkout?.bestSet.actualWeight) return lastWorkout.bestSet.actualWeight;
      return null;
    }
    
    // Normal flow: use intelligent suggestions
    if (intelligence.weightRecommendation?.suggestedWeight) return intelligence.weightRecommendation.suggestedWeight;
    if (suggestion?.suggestedWeight) return suggestion.suggestedWeight;
    if (lastWorkout?.bestSet.actualWeight) return lastWorkout.bestSet.actualWeight;
    return null;
  }, [intelligence.weightRecommendation, suggestion?.suggestedWeight, lastWorkout?.bestSet.actualWeight, initialWeight, ignoredSuggestion]);

  const repSeed = useMemo(() => {
    // If user ignored suggestion, don't reduce reps
    if (ignoredSuggestion) {
      return basePrescribedReps;
    }
    
    let base = basePrescribedReps;
    if (intelligence.fatigueAlert || intelligence.weightRecommendation?.type === 'decrease') {
      base = base !== null ? Math.max(1, base - 1) : base;
    }
    return base;
  }, [basePrescribedReps, intelligence.fatigueAlert, intelligence.weightRecommendation, ignoredSuggestion]);

  const weightDisplay = weight || (weightSeed !== null ? weightSeed.toString() : '');
  const repsDisplay = reps || (repSeed !== null ? repSeed.toString() : '');

  useEffect(() => {
    weightRef.current = weightDisplay;
  }, [weightDisplay]);

  useEffect(() => {
    repsRef.current = repsDisplay;
  }, [repsDisplay]);

  // Get last 3 sessions for this exercise
  const exerciseHistory = useMemo(() => {
    const history = storage.getExerciseHistory(template.exerciseId);
    return history
      .slice(0, 3)
      .map(session => {
        const exerciseSets = session.sets.filter(s => s.exerciseId === template.exerciseId && s.completed);
        const sessionDate = parseLocalDate(session.date);
        const daysAgo = Math.floor((nowValue - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          date: session.date,
          daysAgo,
          sets: exerciseSets,
        };
      })
      .filter(h => h.sets.length > 0);
  }, [template.exerciseId, nowValue]);

  const handleSubmit = () => {
    const setType = template.setType || 'straight';

    const actualWeight = weightDisplay ? parseFloat(weightDisplay) : null;
    const actualReps = repsDisplay ? parseInt(repsDisplay, 10) : null;
    const rpeDisplay = rpe || '8';
    const actualRPE = rpeDisplay ? parseFloat(rpeDisplay) : null;

    const setLog: Partial<SetLog> = {
      actualWeight,
      actualReps,
      actualRPE,
      actualRIR: rir ? parseInt(rir) : null,
      notes: notes || undefined,
      weightUnit: 'lbs', // TODO: Get from user settings
      setType,
      tempo: showTempo && tempo ? tempo : undefined,
    };

    // Add drop set data if applicable
    if (isDropSet && dropSetRounds.length > 0) {
      const validRounds = dropSetRounds
        .filter(round => round.weight && round.reps)
        .map(round => ({
          weight: parseFloat(round.weight),
          reps: parseInt(round.reps),
          rpe: round.rpe ? parseFloat(round.rpe) : undefined,
        }));

      if (validRounds.length > 0) {
        setLog.dropSetRounds = validRounds;
        // Set main weight/reps to first round
        setLog.actualWeight = validRounds[0].weight;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0); // Total reps
      }
    }

    // Add rest-pause data if applicable
    if (isRestPause && restPauseRounds.length > 0) {
      const validRounds = restPauseRounds
        .filter(round => round.reps)
        .map(round => ({
          reps: parseInt(round.reps),
          restSeconds: parseInt(round.restSeconds) || 15,
        }));

      if (validRounds.length > 0) {
        setLog.restPauseRounds = validRounds;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0); // Total reps
      }
    }

    // Add cluster set data if applicable
    if (isCluster && clusterRounds.length > 0) {
      const validRounds = clusterRounds
        .filter(round => round.reps)
        .map(round => ({
          reps: parseInt(round.reps),
          restSeconds: parseInt(round.restSeconds) || 20,
        }));

      if (validRounds.length > 0) {
        setLog.clusterRounds = validRounds;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0); // Total reps
      }
    }

    onLog(setLog);

    // Reset form
    setWeight('');
    setReps('');
    setRpe('');
    setRir('');
    setNotes('');
    setTempo('');
    setDropSetRounds([{ weight: '', reps: '', rpe: '' }]);
    setRestPauseRounds([{ reps: '', restSeconds: '15' }]);
    setClusterRounds([{ reps: '2', restSeconds: '20' }]);
  };

  if (!exercise) return null;

  return (
    <div className="rounded-xl bg-white/95 p-3 shadow-xl ring-1 ring-zinc-100 dark:bg-zinc-950/95 dark:ring-zinc-800">
      {/* Exercise Header - Ultra Compact Single Line */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
            exercise?.type === 'compound'
              ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
          }`}>
            <Dumbbell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 truncate">{exercise.name}</h2>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end sm:flex-none">
          <p className="text-[11px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 sm:text-right">
            Set {setPositionForExercise} of {totalSetsForExercise}
            {template.prescribedReps && ` • ${template.prescribedReps} reps`}
            {template.targetRPE && ` @ RPE ${template.targetRPE}`}
          </p>
          {exerciseHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex-shrink-0 rounded-lg bg-zinc-100 p-2 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
              title="View history"
            >
              <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Superset Indicator - Inline */}
      {nextExerciseInSuperset && (
        <div className="mb-3 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs dark:border-purple-800 dark:bg-purple-900/20">
          <span className="font-bold text-purple-900 dark:text-purple-200">SUPERSET</span>
          <span className="mx-1.5 text-purple-700 dark:text-purple-400">→</span>
          <span className="text-purple-800 dark:text-purple-300">{nextExerciseInSuperset.name}</span>
        </div>
      )}

      {/* Set History - Overlay when open */}
      {showHistory && exerciseHistory.length > 0 && (
        <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Recent Sets</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5">
            {exerciseHistory.slice(0, 3).map((historySession, idx) => {
              const dateLabel = historySession.daysAgo === 0 ? 'Today' : historySession.daysAgo === 1 ? 'Yesterday' : `${historySession.daysAgo}d ago`;
              const bestSet = historySession.sets.reduce((best, set) =>
                (set.e1rm || 0) > (best.e1rm || 0) ? set : best
              );

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (bestSet.actualWeight) setWeight(bestSet.actualWeight.toString());
                    if (bestSet.actualReps) setReps(bestSet.actualReps.toString());
                    if (bestSet.actualRPE) setRpe(bestSet.actualRPE.toString());
                    setShowHistory(false);
                  }}
                  className="w-full flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-purple-50 active:bg-purple-100 dark:bg-zinc-900 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{dateLabel}</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    {bestSet.actualWeight || 0}lbs × {bestSet.actualReps || 0}
                    {bestSet.actualRPE && <span className="ml-1 text-xs text-orange-600 dark:text-orange-400">@{bestSet.actualRPE}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Input Fields - Ultra Clean */}
      <div>
        {renderSetBody()}
      </div>

      {/* Actions - More Compact */}
      <div className="sticky bottom-4 z-20 mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-2xl bg-white/95 p-2.5 shadow-2xl ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/95 dark:ring-zinc-800">
          <button
            onClick={handleSubmit}
            className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-5 py-3.5 text-base font-black text-white shadow-lg transition transform hover:shadow-xl active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
            <span className="relative flex items-center justify-center">
              {isLastSet ? 'Complete & Finish' : 'Log Set'}
            </span>
          </button>
          <button
            onClick={onSkip}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs sm:text-sm font-bold text-zinc-700 shadow-sm transition hover:border-zinc-300 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
          >
            Skip Set
          </button>
        </div>
      </div>

      {isLastSet && (
        <button
          onClick={onFinish}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-zinc-300 bg-white/80 px-4 py-3 text-xs sm:text-sm font-bold text-zinc-600 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Finish workout early
        </button>
      )}
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateE1RM(weight: number, reps: number): number {
  // Epley formula: 1RM = weight × (1 + reps/30)
  return Math.round(weight * (1 + reps / 30));
}
