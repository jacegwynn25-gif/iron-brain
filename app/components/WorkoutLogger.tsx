'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Exercise, SetTemplate, SetLog, WorkoutSession, ProgramTemplate } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import RestTimer from './RestTimer';
import QuickPicker from './QuickPicker';

interface WorkoutLoggerProps {
  program: ProgramTemplate;
  weekNumber: number;
  dayIndex: number;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
}

let sessionCounter = 0;

export default function WorkoutLogger({
  program,
  weekNumber,
  dayIndex,
  onComplete,
  onCancel,
}: WorkoutLoggerProps) {
  const week = program.weeks.find(w => w.weekNumber === weekNumber);
  const day = week?.days[dayIndex];

  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) {
    sessionCounter += 1;
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `fallback_${sessionCounter}`;
    sessionIdRef.current = `session_${uuid}`;
  }
  const sessionStartRef = useRef(new Date());

  const [session, setSession] = useState<WorkoutSession>({
    id: sessionIdRef.current,
    programId: program.id,
    programName: program.name,
    cycleNumber: 1, // TODO: Track cycle from user data
    weekNumber,
    dayOfWeek: day?.dayOfWeek || 'Mon',
    dayName: day?.name || '',
    date: sessionStartRef.current.toISOString().split('T')[0],
    startTime: sessionStartRef.current.toISOString(),
    sets: [],
    createdAt: sessionStartRef.current.toISOString(),
    updatedAt: sessionStartRef.current.toISOString(),
  });

  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);

  // Get all set templates for this workout
  const setTemplates = day?.sets || [];
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
  // Next set is the one coming up (currentSetIndex already advanced after logging)
  const nextSetTemplate = setTemplates[currentSetIndex];
  const nextExercise = nextSetTemplate ? (defaultExercises.find(ex => ex.id === nextSetTemplate.exerciseId) || null) : null;
  const nextSetInfo = nextSetTemplate && nextExercise ? {
    exerciseName: nextExercise.name,
    setNumber: nextSetTemplate.setIndex,
    totalSets: setTemplates.filter(st => st.exerciseId === nextSetTemplate.exerciseId).length,
    prescribedReps: nextSetTemplate.prescribedReps,
    targetRPE: nextSetTemplate.targetRPE ?? undefined,
    targetRIR: nextSetTemplate.targetRIR ?? undefined,
    lastWeight: session.sets.find(s => s.exerciseId === nextSetTemplate.exerciseId && s.actualWeight)?.actualWeight ?? undefined,
    lastReps: session.sets.find(s => s.exerciseId === nextSetTemplate.exerciseId && s.actualReps)?.actualReps ?? undefined,
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

    // Calculate E1RM if weight and reps are provided
    if (completeSetLog.actualWeight && completeSetLog.actualReps) {
      completeSetLog.e1rm = calculateE1RM(completeSetLog.actualWeight, completeSetLog.actualReps);
      completeSetLog.volumeLoad = completeSetLog.actualWeight * completeSetLog.actualReps;
    }

    setSession(prev => ({
      ...prev,
      sets: [...prev.sets, completeSetLog],
      updatedAt: new Date().toISOString(),
    }));

    // Move to next set first (so we can check if it's part of the same superset)
    const nextIndex = currentSetIndex + 1;
    const willMoveToNext = nextIndex < setTemplates.length;

    if (willMoveToNext) {
      setCurrentSetIndex(nextIndex);
    }

    // Only start rest timer if NOT moving to another exercise in the same superset
    const nextTemplate = willMoveToNext ? setTemplates[nextIndex] : null;
    const isNextInSameSuperset = currentTemplate.setType === 'superset' &&
                                  nextTemplate?.setType === 'superset' &&
                                  currentTemplate.supersetGroup === nextTemplate?.supersetGroup;

    if (!isNextInSameSuperset) {
      // Start rest timer - smart duration based on exercise type
      let restTime = currentTemplate.restSeconds || currentExercise?.defaultRestSeconds;
      if (!restTime && currentExercise) {
        // Auto-determine based on exercise type
        if (currentExercise.type === 'compound') {
          restTime = 180; // 3 minutes for compounds
        } else {
          restTime = 90; // 1.5 minutes for accessories
        }
      }
      setRestTimerSeconds(restTime || 90);
      setIsResting(true);
    }
  }, [currentTemplate, currentExercise, currentSetIndex, setTemplates]);

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
    // Calculate session metrics
    const completedSets = session.sets.filter(s => s.completed);
    const totalVolume = completedSets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);
    const rpeValues = completedSets.map(s => s.actualRPE).filter((rpe): rpe is number => rpe !== null && rpe !== undefined);
    const avgRPE = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : undefined;
    const finishedAt = new Date();

    const finalSession: WorkoutSession = {
      ...session,
      endTime: finishedAt.toISOString(),
      durationMinutes: session.startTime
        ? Math.round((finishedAt.getTime() - new Date(session.startTime).getTime()) / 1000 / 60)
        : undefined,
      totalVolumeLoad: totalVolume,
      averageRPE: avgRPE,
    };
    onComplete(finalSession);
  }, [session, onComplete]);

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
  const progressPercentage = (completedSets / setTemplates.length) * 100;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header with Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {day.name}
            </h1>
            <button
              onClick={onCancel}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Cancel
            </button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {completedSets} / {setTemplates.length} sets completed
          </p>
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
        />

        {/* Upcoming Sets Preview */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Upcoming Sets
          </h3>
          <div className="space-y-2">
            {setTemplates.slice(currentSetIndex + 1, currentSetIndex + 4).map((template, idx) => {
              const ex = defaultExercises.find(e => e.id === template.exerciseId);
              return (
                <div
                  key={idx}
                  className="rounded-lg bg-white p-3 text-sm dark:bg-zinc-900"
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
        </div>
      </div>

      {/* Rest Timer - Fixed overlay */}
      <RestTimer
        isActive={isResting}
        duration={restTimerSeconds || 0}
        onComplete={handleRestComplete}
        onSkip={handleSkipRest}
        nextSetInfo={nextSetInfo}
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
}

function SetLogger({ template, exercise, onLog, onSkip, isLastSet, onFinish, currentSessionSets, nextExerciseInSuperset }: SetLoggerProps) {
  const nowValue = useRef<number>(new Date().getTime()).current;
  const setType = template.setType || 'straight';
  const isDropSet = setType === 'drop';
  const isRestPause = setType === 'rest-pause';
  const isCluster = setType === 'cluster';
  const isWarmup = setType === 'warmup';
  const isAMRAP = setType === 'amrap';
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [rir, setRir] = useState('');
  const [notes, setNotes] = useState('');
  const [showFatigueDetails, setShowFatigueDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  // Calculate Time Under Tension (TUT) from tempo
  const calculateTUT = (tempo: string, reps: number): number | null => {
    if (!tempo || !reps) return null;

    // Tempo format: eccentric-pause-concentric-pause (e.g., "3-1-2-0")
    const parts = tempo.split('-').map(p => parseInt(p));
    if (parts.length !== 4 || parts.some(isNaN)) return null;

    const [eccentric, bottomPause, concentric, topPause] = parts;
    const repDuration = eccentric + bottomPause + concentric + topPause;
    return repDuration * reps;
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

  // Get progression readiness
  const targetReps = parseInt(template.prescribedReps.split('-')[0]) || 5;
  const progressionStatus = storage.analyzeProgressionReadiness(
    template.exerciseId,
    targetReps,
    template.targetRPE
  );

  const handleCopyPreviousSet = useCallback(() => {
    if (!lastWorkout) return;

    const { bestSet } = lastWorkout;
    if (bestSet.actualWeight) setWeight(bestSet.actualWeight.toString());
    if (bestSet.actualReps) setReps(bestSet.actualReps.toString());
    if (bestSet.actualRPE) setRpe(bestSet.actualRPE.toString());
    if (bestSet.actualRIR) setRir(bestSet.actualRIR.toString());
  }, [lastWorkout]);

  const handleSubmit = () => {
    const setType = template.setType || 'straight';

    const setLog: Partial<SetLog> = {
      actualWeight: weight ? parseFloat(weight) : null,
      actualReps: reps ? parseInt(reps) : null,
      actualRPE: rpe ? parseFloat(rpe) : null,
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
    <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900">
      {/* Exercise Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {exercise.name}
          </h2>
          {/* Progression Indicator */}
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
            progressionStatus.status === 'ready'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : progressionStatus.status === 'deload'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
          }`} title={progressionStatus.message}>
            <span className="text-lg">{progressionStatus.indicator}</span>
            <span className="text-xs">{progressionStatus.message}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium dark:bg-zinc-700">
            Set {template.setIndex}
          </span>

          {/* Set Type Indicators */}
          {isWarmup && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
              WARM-UP
            </span>
          )}
          {isAMRAP && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-900 dark:bg-green-900/30 dark:text-green-100">
              💯 AMRAP
            </span>
          )}
          {isDropSet && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900 dark:bg-orange-900/30 dark:text-orange-100">
              📉 DROP SET
            </span>
          )}
          {isRestPause && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-900 dark:bg-red-900/30 dark:text-red-100">
              ⏸️ REST-PAUSE
            </span>
          )}
          {isCluster && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100">
              🔗 CLUSTER
            </span>
          )}

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
            {template.prescribedReps} reps
          </span>
          {template.targetRPE && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-900 dark:bg-orange-900/30 dark:text-orange-100">
              RPE {template.targetRPE}
            </span>
          )}
          {tempo && (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-900 dark:bg-purple-900/30 dark:text-purple-100">
              ⏱️ {tempo}
            </span>
          )}
          {template.notes && (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-900 dark:bg-purple-900/30 dark:text-purple-100">
              {template.notes}
            </span>
          )}
        </div>

        {/* Superset Indicator */}
        {nextExerciseInSuperset && (
          <div className="mt-4 rounded-xl border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 p-4 dark:border-purple-600 dark:from-purple-900/30 dark:to-pink-900/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-lg">
                {template.supersetGroup}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                  SUPERSET
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Next: {nextExerciseInSuperset.name}
                </p>
              </div>
              <div className="text-2xl">🔗</div>
            </div>
          </div>
        )}

        {/* Smart Suggestions */}
        {(suggestion || lastWorkout) && (
          <div className="mt-4 space-y-2">
            {suggestion && (
              <div className={`rounded-xl border-2 shadow-lg ${
                suggestion.basedOn === 'rpe_adjustment'
                  ? suggestion.fatigueAlert?.severity === 'critical'
                    ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/30'
                    : suggestion.fatigueAlert?.severity === 'high'
                      ? 'border-orange-500 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/30'
                      : 'border-yellow-500 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900/30'
                  : 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30'
              }`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {suggestion.basedOn === 'rpe_adjustment' && suggestion.fatigueAlert && (
                        <div className="mb-2 flex items-center gap-2">
                          <p className={`text-xs font-bold uppercase tracking-wide ${
                            suggestion.fatigueAlert.severity === 'critical'
                              ? 'text-red-800 dark:text-red-300'
                              : suggestion.fatigueAlert.severity === 'high'
                                ? 'text-orange-800 dark:text-orange-300'
                                : 'text-yellow-800 dark:text-yellow-300'
                          }`}>
                            {suggestion.fatigueAlert.severity === 'critical' && 'CRITICAL FATIGUE'}
                            {suggestion.fatigueAlert.severity === 'high' && 'HIGH FATIGUE'}
                            {suggestion.fatigueAlert.severity === 'moderate' && 'MODERATE FATIGUE'}
                            {suggestion.fatigueAlert.severity === 'mild' && 'FATIGUE DETECTED'}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {suggestion.fatigueAlert.affectedMuscles.map(muscle => (
                              <span
                                key={muscle}
                                className="rounded-full bg-zinc-900/10 px-2 py-0.5 text-xs font-medium capitalize dark:bg-zinc-50/10"
                              >
                                {muscle}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                        Suggested: {suggestion.suggestedWeight}lbs
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {suggestion.reasoning}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Confidence: {suggestion.confidence} • Based on: {suggestion.basedOn.replace('_', ' ')}
                      </p>

                      {/* Expandable Details */}
                      {suggestion.fatigueAlert && (
                        <div className="mt-3">
                          <button
                            onClick={() => setShowFatigueDetails(!showFatigueDetails)}
                            className="flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                          >
                            {showFatigueDetails ? '▼' : '▶'} Show Detailed Analysis
                          </button>

                          {showFatigueDetails && (
                            <div className="mt-2 rounded-lg bg-white/50 p-3 text-xs dark:bg-zinc-900/50">
                              <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
                                {suggestion.fatigueAlert.detailedExplanation.split('\n').map((line, idx) => {
                                  // Handle bold headers (e.g., **Fatigue Analysis:**)
                                  if (line.startsWith('**') && line.includes(':**')) {
                                    const text = line.replace(/\*\*/g, '').trim();
                                    return (
                                      <p key={idx} className="font-bold text-zinc-900 dark:text-zinc-50">
                                        {text}
                                      </p>
                                    );
                                  }
                                  // Handle bullet points (e.g., • Exercise Name)
                                  if (line.startsWith('•') || line.startsWith('-')) {
                                    const text = line.replace(/^[•\-]\s*/, '').trim();
                                    return (
                                      <p key={idx} className="ml-4 flex gap-2">
                                        <span className="text-zinc-500 dark:text-zinc-400">•</span>
                                        <span>{text}</span>
                                      </p>
                                    );
                                  }
                                  // Handle regular paragraphs
                                  if (line.trim()) {
                                    // Remove any remaining markdown asterisks
                                    const cleanText = line.replace(/\*\*/g, '').trim();
                                    return (
                                      <p key={idx} className="leading-relaxed">
                                        {cleanText}
                                      </p>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                              <div className="mt-3 border-t border-zinc-300 pt-2 text-xs italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                                {suggestion.fatigueAlert.scientificBasis}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setWeight(suggestion.suggestedWeight.toString())}
                      className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg ${
                        suggestion.basedOn === 'rpe_adjustment'
                          ? suggestion.fatigueAlert?.severity === 'critical'
                            ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
                            : suggestion.fatigueAlert?.severity === 'high'
                              ? 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800'
                              : 'bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800'
                          : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'
                      }`}
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            )}
            {lastWorkout && (
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Last time: {lastWorkout.bestSet.actualWeight}lbs × {lastWorkout.bestSet.actualReps}
                  {lastWorkout.bestSet.actualRPE && ` @ RPE ${lastWorkout.bestSet.actualRPE}`}
                  {lastWorkout.bestSet.e1rm && ` (E1RM: ${lastWorkout.bestSet.e1rm}lbs)`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Set History - Last 3 Sessions */}
        {exerciseHistory.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors"
            >
              <span>{showHistory ? '▼' : '▶'}</span>
              <span>Previous Sessions ({exerciseHistory.length})</span>
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 animate-slideDown">
                {exerciseHistory.map((historySession, idx) => {
                  const dateLabel = historySession.daysAgo === 0 ? 'Today' : historySession.daysAgo === 1 ? 'Yesterday' : `${historySession.daysAgo}d ago`;

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          {dateLabel}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          {new Date(historySession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {historySession.sets.map((set, setIdx) => (
                          <div
                            key={setIdx}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                                Set {set.setIndex}
                              </span>
                              <button
                                onClick={() => {
                                  if (set.actualWeight) setWeight(set.actualWeight.toString());
                                  if (set.actualReps) setReps(set.actualReps.toString());
                                  if (set.actualRPE) setRpe(set.actualRPE.toString());
                                  if (set.actualRIR) setRir(set.actualRIR.toString());
                                }}
                                className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                title="Copy this set"
                              >
                                <span className="font-bold text-zinc-900 dark:text-zinc-50">
                                  {set.actualWeight}lbs × {set.actualReps}
                                </span>
                                {set.actualRPE && (
                                  <span className="text-xs text-orange-600 dark:text-orange-400">
                                    @ RPE {set.actualRPE}
                                  </span>
                                )}
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-purple-600 dark:text-purple-400 transition-opacity">
                                  Copy
                                </span>
                              </button>
                            </div>
                            {set.e1rm && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                                E1RM: {set.e1rm}lbs
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Fields */}
      <div className="space-y-5">
        {/* Quick Copy Previous Set Button */}
        {lastWorkout && (
          <button
            onClick={handleCopyPreviousSet}
            className="group w-full rounded-xl border-2 border-dashed border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-4 text-sm font-bold text-purple-700 shadow-sm hover:border-purple-400 hover:shadow-md dark:border-purple-700 dark:from-purple-900/20 dark:to-pink-900/20 dark:text-purple-300 dark:hover:border-purple-600 transition-all transform hover:scale-[1.01]"
          >
            <div className="flex items-center justify-center gap-2">
              <span>Copy Last Set: {lastWorkout.bestSet.actualWeight}lbs × {lastWorkout.bestSet.actualReps}</span>
              {lastWorkout.bestSet.actualRPE && <span className="text-xs opacity-80">@ RPE {lastWorkout.bestSet.actualRPE}</span>}
            </div>
          </button>
        )}

        {isRestPause ? (
          /* Rest-Pause Interface */
          <div className="space-y-4 rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-pink-50 p-5 shadow-md dark:border-red-700 dark:from-red-900/20 dark:to-pink-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-red-900 dark:text-red-100">
                  ⏸️ Rest-Pause Rounds
                </p>
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Mini-sets with 10-15s rest
                </p>
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
        ) : isCluster ? (
          /* Cluster Set Interface */
          <div className="space-y-4 rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 shadow-md dark:border-indigo-700 dark:from-indigo-900/20 dark:to-purple-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-indigo-900 dark:text-indigo-100">
                  🔗 Cluster Rounds
                </p>
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  Small clusters with short rest
                </p>
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
        ) : isDropSet ? (
          /* Drop Set Interface */
          <div className="space-y-4 rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-yellow-50 p-5 shadow-md dark:border-orange-700 dark:from-orange-900/20 dark:to-yellow-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-orange-900 dark:text-orange-100">
                  📉 Drop Set Rounds
                </p>
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  Decreasing weight, push to failure
                </p>
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
        ) : (
          /* Regular Set Interface */
          <>
            {/* Primary Inputs - Weight & Reps (Most Important) */}
            <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 shadow-sm dark:border-purple-800 dark:from-purple-900/20 dark:to-pink-900/20">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Primary Metrics
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <QuickPicker
                  label="Weight (lbs)"
                  value={weight}
                  onChange={setWeight}
                  suggestions={[45, 95, 135, 185, 225, 275, 315, 405]}
                  step={5}
                  placeholder="225"
                  unit="lbs"
                />
                <QuickPicker
                  label="Reps"
                  value={reps}
                  onChange={setReps}
                  suggestions={[1, 3, 5, 8, 10, 12, 15, 20]}
                  step={1}
                  placeholder={template.prescribedReps}
                />
              </div>
            </div>

            {/* Intensity Tracking - RPE & RIR */}
            <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-5 shadow-sm dark:border-orange-800 dark:from-orange-900/20 dark:to-red-900/20">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                Intensity
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <QuickPicker
                  label="RPE (optional)"
                  value={rpe}
                  onChange={setRpe}
                  suggestions={[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]}
                  step={0.5}
                  placeholder="8.5"
                />
                <QuickPicker
                  label="RIR (optional)"
                  value={rir}
                  onChange={setRir}
                  suggestions={[0, 1, 2, 3, 4]}
                  step={1}
                  placeholder="2"
                />
              </div>
            </div>

            {/* Tempo & TUT (only if prescribed in program) */}
            {showTempo && (
              <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-sm dark:border-blue-800 dark:from-blue-900/20 dark:to-cyan-900/20">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  ⏱️ Tempo & Time Under Tension
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Tempo
                    </label>
                    <input
                      type="text"
                      value={tempo}
                      onChange={(e) => setTempo(e.target.value)}
                      placeholder="3-1-2-0"
                      className="w-full rounded-lg border-2 border-blue-300 bg-white px-4 py-3 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-zinc-800 dark:text-zinc-50 transition-all"
                    />
                    <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-400">
                      Format: eccentric-pause-concentric-pause
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Time Under Tension
                    </label>
                    <div className="flex h-[52px] items-center justify-center rounded-lg border-2 border-blue-300 bg-white px-4 shadow-sm dark:border-blue-700 dark:bg-zinc-800">
                      {tempo && reps ? (
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                          {calculateTUT(tempo, parseInt(reps) || 0)}s
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-500">
                          Enter tempo & reps
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                📝 Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Form felt great, paused reps, used wrist wraps..."
                className="w-full rounded-lg border-2 border-zinc-300 bg-white px-4 py-3 text-zinc-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 transition-all"
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={handleSubmit}
          className="group flex-1 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-lg font-bold text-white shadow-lg hover:shadow-xl hover:from-green-700 hover:to-emerald-700 dark:from-green-700 dark:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-2xl group-hover:scale-110 transition-transform">✅</span>
            <span>{isLastSet ? 'Complete & Finish Workout' : 'Log Set'}</span>
          </span>
        </button>
        <button
          onClick={onSkip}
          className="rounded-xl bg-zinc-200 px-6 py-5 text-zinc-700 font-semibold shadow-md hover:bg-zinc-300 hover:shadow-lg dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-all transform hover:scale-105 active:scale-95"
        >
          Skip
        </button>
      </div>

      {isLastSet && (
        <button
          onClick={onFinish}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-4 text-sm font-semibold text-zinc-600 shadow-sm hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-all"
        >
          🏁 Finish workout early (skip remaining sets)
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
