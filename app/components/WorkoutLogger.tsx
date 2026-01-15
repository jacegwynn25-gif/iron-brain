'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Exercise, SetTemplate, SetLog, WorkoutSession, ProgramTemplate, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { storage } from '../lib/storage';
import { parseLocalDate } from '../lib/dateUtils';
import RestTimer from './RestTimer';
import { useWorkoutIntelligence } from '../lib/useWorkoutIntelligence';
import { useAuth } from '../lib/supabase/auth-context';
import { getWorkoutIntelligence, type SetRecommendation } from '../lib/intelligence/workout-intelligence';
import {
  saveActiveSession,
  clearActiveSession,
  calculateRemainingRest,
  type ActiveSessionState,
} from '../lib/workout/active-session';
import { ChevronRight, ChevronDown, Dumbbell, Pencil, Search, X } from 'lucide-react';
import HardyStepper from './HardyStepper';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { createUuid } from '../lib/uuid';
import WorkoutSelection from './workout/WorkoutSelection';
import RpeRirSlider from './workout/RpeRirSlider';
import CreateExerciseModal from './program-builder/CreateExerciseModal';
import { getWeightForPercentage } from '../lib/maxes/maxes-service';

interface WorkoutLoggerProps {
  program: ProgramTemplate;
  weekNumber: number;
  dayIndex: number;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
  initialSession?: WorkoutSession | null;
  initialActiveState?: ActiveSessionState | null;
}

type WorkoutView = 'selection' | 'logging' | 'rest';

type WorkoutExerciseEntry = {
  id: string;
  exerciseId: string;
  name: string;
  sets: SetTemplate[];
};

type RestContext = {
  exerciseId: string;
  exerciseName: string;
  isLastSet: boolean;
  nextTemplate: SetTemplate | null;
  nextSetNumber: number;
  totalSets: number;
};

export default function WorkoutLogger({
  program,
  weekNumber,
  dayIndex,
  onComplete,
  onCancel,
  initialSession,
  initialActiveState,
}: WorkoutLoggerProps) {
  const { user } = useAuth();
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  useEffect(() => {
    let isMounted = true;
    getCustomExercises(user?.id || null)
      .then((exercises) => {
        if (!isMounted) return;
        setCustomExercises(exercises);
      })
      .catch((err) => {
        console.error('Failed to load custom exercises:', err);
        if (isMounted) {
          setCustomExercises([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const normalizeCustomExercise = useCallback((exercise: CustomExercise): Exercise => {
    const muscleGroups = Array.from(new Set([
      ...(exercise.primaryMuscles || []),
      ...(exercise.secondaryMuscles || []),
    ]));

    return {
      id: exercise.id,
      name: exercise.name,
      type: exercise.exerciseType === 'compound' ? 'compound' : 'isolation',
      muscleGroups,
      equipment: exercise.equipment ? [exercise.equipment] : undefined,
      defaultRestSeconds: exercise.defaultRestSeconds ?? 90,
    };
  }, []);

  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    defaultExercises.forEach((ex) => map.set(ex.id, ex));
    customExercises.forEach((ex) => map.set(ex.id, normalizeCustomExercise(ex)));
    return map;
  }, [customExercises, normalizeCustomExercise]);

  const resolveExercise = useCallback((exerciseId: string): Exercise => {
    const found = exerciseMap.get(exerciseId);
    if (found) return found;
    return {
      id: exerciseId,
      name: `Unknown Exercise (${exerciseId})`,
      type: 'isolation',
      muscleGroups: [],
      equipment: [],
      defaultRestSeconds: 90,
    };
  }, [exerciseMap]);

  const week = program.weeks.find((w) => w.weekNumber === weekNumber);
  const day = week?.days[dayIndex];
  const isQuickStart = program.id === 'quick_start';

  const sessionId = useMemo(() => {
    if (initialSession?.id) return initialSession.id;
    return `session_${createUuid()}`;
  }, [initialSession?.id]);
  const sessionStart = useMemo(
    () => new Date(initialSession?.startTime ?? new Date()),
    [initialSession?.startTime]
  );

  const [session, setSession] = useState<WorkoutSession>(() =>
    initialSession ?? {
      id: sessionId,
      programId: program.id,
      programName: program.name,
      cycleNumber: 1,
      weekNumber,
      dayOfWeek: day?.dayOfWeek || 'Mon',
      dayName: day?.name || '',
      date: sessionStart.toISOString().split('T')[0],
      startTime: sessionStart.toISOString(),
      sets: [],
      metadata: {
        dayIndex,
      },
      createdAt: sessionStart.toISOString(),
      updatedAt: sessionStart.toISOString(),
    }
  );
  const [workoutName, setWorkoutName] = useState(() =>
    session.dayName || day?.name || program.name
  );

  useEffect(() => {
    if (!isQuickStart) return;
    const resolvedName = workoutName.trim() || 'Quick Workout';
    setSession((prev) => {
      if (prev.dayName === resolvedName) return prev;
      return {
        ...prev,
        dayName: resolvedName,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [isQuickStart, workoutName]);

  const buildExerciseEntries = useCallback((): WorkoutExerciseEntry[] => {
    if (!day) return [];
    const entries: WorkoutExerciseEntry[] = [];
    const map = new Map<string, WorkoutExerciseEntry>();

    day.sets.forEach((set) => {
      const existing = map.get(set.exerciseId);
      if (existing) {
        existing.sets.push(set);
      } else {
        const exercise = resolveExercise(set.exerciseId);
        const entry: WorkoutExerciseEntry = {
          id: `entry_${exercise.id}`,
          exerciseId: exercise.id,
          name: exercise.name,
          sets: [set],
        };
        map.set(set.exerciseId, entry);
        entries.push(entry);
      }
    });

    return entries;
  }, [day, resolveExercise]);

  const [exerciseEntries, setExerciseEntries] = useState<WorkoutExerciseEntry[]>(() => buildExerciseEntries());

  useEffect(() => {
    setExerciseEntries(buildExerciseEntries());
  }, [buildExerciseEntries]);

  const initialView: WorkoutView = useMemo(() => {
    if (initialActiveState?.isResting) return 'rest';
    if (initialActiveState?.currentExerciseId) return 'logging';
    return 'selection';
  }, [initialActiveState?.isResting, initialActiveState?.currentExerciseId]);

  const [view, setView] = useState<WorkoutView>(initialView);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(
    initialActiveState?.currentExerciseId ?? null
  );
  const [activeSetIndex, setActiveSetIndex] = useState(
    initialActiveState?.currentSetIndex ?? 0
  );

  const initialRestSeconds = useMemo(
    () => (initialActiveState ? calculateRemainingRest(initialActiveState) : null),
    [initialActiveState]
  );
  const initialIsResting = Boolean(
    initialActiveState?.isResting && initialRestSeconds !== null && initialRestSeconds > 0
  );

  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(initialRestSeconds);
  const [isResting, setIsResting] = useState(initialIsResting);
  const [restTimerStartedAt, setRestTimerStartedAt] = useState<string | null>(
    initialActiveState?.restTimerStartedAt ?? null
  );
  const [restContext, setRestContext] = useState<RestContext | null>(null);

  const [appliedRestTimerWeight, setAppliedRestTimerWeight] = useState<number | null>(null);
  const [ignoredSuggestion, setIgnoredSuggestion] = useState(false);
  const [repReduction, setRepReduction] = useState(0);
  const [extraRestTime, setExtraRestTime] = useState(0);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInitialName, setCustomInitialName] = useState('');
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const sessionSets = session.sets;

  const getLoggedSetsForExercise = useCallback(
    (exerciseId: string) => sessionSets.filter((set) => set.exerciseId === exerciseId).length,
    [sessionSets]
  );

  const currentExerciseEntry = useMemo(() => {
    if (!currentExerciseId) return null;
    return exerciseEntries.find((entry) => entry.id === currentExerciseId) || null;
  }, [exerciseEntries, currentExerciseId]);

  const currentTemplate = currentExerciseEntry?.sets[activeSetIndex] ?? null;
  const currentExercise = currentExerciseEntry ? resolveExercise(currentExerciseEntry.exerciseId) : null;

  useEffect(() => {
    if (!isResting || restContext || !currentExerciseEntry || !currentTemplate) return;
    const isLastSet = activeSetIndex >= currentExerciseEntry.sets.length - 1;
    setRestContext({
      exerciseId: currentExerciseEntry.exerciseId,
      exerciseName: currentExerciseEntry.name,
      isLastSet,
      nextTemplate: isLastSet
        ? currentTemplate
        : currentExerciseEntry.sets[activeSetIndex + 1] ?? null,
      nextSetNumber: isLastSet
        ? currentExerciseEntry.sets.length + 1
        : activeSetIndex + 2,
      totalSets: isLastSet
        ? currentExerciseEntry.sets.length + 1
        : currentExerciseEntry.sets.length,
    });
  }, [isResting, restContext, currentExerciseEntry, currentTemplate, activeSetIndex]);

  useEffect(() => {
    if (!currentExerciseId) return;
    const entry = exerciseEntries.find((item) => item.id === currentExerciseId);
    if (!entry) return;

    const loggedCount = getLoggedSetsForExercise(entry.exerciseId);
    if (loggedCount >= entry.sets.length) {
      setExerciseEntries((prev) =>
        prev.map((item) => {
          if (item.exerciseId !== entry.exerciseId) return item;
          const last = item.sets[item.sets.length - 1];
          const baseTemplate: SetTemplate = last ?? {
            exerciseId: item.exerciseId,
            setIndex: 1,
            prescribedReps: '8',
            targetRPE: 8,
            restSeconds: 90,
          };
          const nextIndex = (last?.setIndex ?? item.sets.length) + 1;
          const extraTemplate: SetTemplate = {
            ...baseTemplate,
            setIndex: nextIndex,
          };
          return { ...item, sets: [...item.sets, extraTemplate] };
        })
      );
      setActiveSetIndex(entry.sets.length);
    } else {
      setActiveSetIndex(loggedCount);
    }
  }, [currentExerciseId, exerciseEntries, getLoggedSetsForExercise]);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - sessionStartMs) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedDisplay = `${elapsedMinutes}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  const buildActiveState = useCallback((): ActiveSessionState => ({
    session,
    currentSetIndex: activeSetIndex,
    currentExerciseId: currentExerciseEntry?.id ?? currentExerciseId ?? undefined,
    view,
    isResting,
    restTimerSeconds,
    restTimerStartedAt: isResting ? restTimerStartedAt : null,
    lastUpdated: new Date().toISOString(),
    programId: program.id,
    weekNumber,
    dayIndex,
  }), [session, activeSetIndex, currentExerciseEntry?.id, currentExerciseId, view, isResting, restTimerSeconds, restTimerStartedAt, program.id, weekNumber, dayIndex]);

  useEffect(() => {
    if (!session) return;
    saveActiveSession(buildActiveState());
  }, [session, activeSetIndex, currentExerciseId, view, isResting, restTimerSeconds, restTimerStartedAt, buildActiveState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveActiveSession(buildActiveState());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [buildActiveState]);

  useEffect(() => {
    const handlePageHide = () => {
      saveActiveSession(buildActiveState());
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [buildActiveState]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      saveActiveSession(buildActiveState());
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [buildActiveState]);

  const buildFinalSession = useCallback((setsOverride?: SetLog[]) => {
    const finalSets = setsOverride ?? session.sets;
    const finishedAt = new Date();
    const completedSets = finalSets.filter((s) => s.completed);
    const totalVolume = completedSets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);
    const rpeValues = completedSets
      .map((s) => s.actualRPE)
      .filter((rpe): rpe is number => rpe !== null && rpe !== undefined);
    const avgRPE = rpeValues.length > 0
      ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length
      : undefined;

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

  const finishWorkout = useCallback(() => {
    const finalSession = buildFinalSession();
    const completedSets = finalSession.sets.filter((set) => set.completed);

    if (completedSets.length === 0) {
      clearActiveSession();
      onCancel();
      return;
    }

    if (user?.id) {
      const intelligence = getWorkoutIntelligence(user.id);
      void intelligence.recordWorkoutCompletion(finalSession).catch((error) => {
        console.error('Failed to update intelligence models:', error);
      });
    }

    clearActiveSession();
    onComplete(finalSession);
  }, [buildFinalSession, onCancel, onComplete, user]);

  const handleCancelWorkout = useCallback(() => {
    clearActiveSession();
    onCancel();
  }, [onCancel]);

  const addExtraSetToExercise = useCallback((exerciseId: string) => {
    setExerciseEntries((prev) =>
      prev.map((entry) => {
        if (entry.exerciseId !== exerciseId) return entry;
        const last = entry.sets[entry.sets.length - 1];
        const baseTemplate: SetTemplate = last ?? {
          exerciseId: entry.exerciseId,
          setIndex: 1,
          prescribedReps: '8',
          targetRPE: 8,
          restSeconds: 90,
        };
        const nextIndex = (last?.setIndex ?? entry.sets.length) + 1;
        const extraTemplate: SetTemplate = {
          ...baseTemplate,
          setIndex: nextIndex,
        };
        return { ...entry, sets: [...entry.sets, extraTemplate] };
      })
    );
  }, []);

  const handleSelectExercise = useCallback((entryId: string) => {
    setCurrentExerciseId(entryId);
    setView('logging');
    setAppliedRestTimerWeight(null);
    setIgnoredSuggestion(false);
    setRepReduction(0);
    setExtraRestTime(0);
  }, []);

  const updateLoggedSet = useCallback((target: SetLog, updates: Partial<SetLog>) => {
    setSession((prev) => {
      const nextSets = prev.sets.map((set) => {
        const matchesId = target.id && set.id === target.id;
        const matchesTimestamp = !target.id && target.timestamp && set.timestamp === target.timestamp;
        const matchesFallback = !target.id && !target.timestamp
          && set.exerciseId === target.exerciseId
          && set.setIndex === target.setIndex;

        if (!matchesId && !matchesTimestamp && !matchesFallback) return set;

        const merged: SetLog = {
          ...set,
          ...updates,
          completed: true,
        };

        if (merged.actualWeight && merged.actualReps) {
          merged.e1rm = calculateE1RM(merged.actualWeight, merged.actualReps);
          merged.volumeLoad = merged.actualWeight * merged.actualReps;
        } else {
          merged.e1rm = null;
          merged.volumeLoad = null;
        }

        return merged;
      });

      return {
        ...prev,
        sets: nextSets,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const logSet = useCallback(async (setLog: Partial<SetLog>) => {
    if (!currentTemplate || !currentExerciseEntry) return;

    const completeSetLog: SetLog = {
      id: setLog.id ?? createUuid(),
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

    const wasLastSet = activeSetIndex >= currentExerciseEntry.sets.length - 1;
    const nextIndex = Math.min(activeSetIndex + 1, currentExerciseEntry.sets.length - 1);

    if (!wasLastSet) {
      setActiveSetIndex(nextIndex);
    }

    const restSeconds =
      currentTemplate.restSeconds ||
      currentExercise?.defaultRestSeconds ||
      (currentExercise?.type === 'compound' ? 180 : 90);

    setRestTimerSeconds(restSeconds || 90);
    setRestTimerStartedAt(new Date().toISOString());
    setIsResting(true);
    setView('rest');
    setAppliedRestTimerWeight(null);
    setIgnoredSuggestion(false);
    setRepReduction(0);
    setExtraRestTime(0);

    setRestContext({
      exerciseId: currentExerciseEntry.exerciseId,
      exerciseName: currentExerciseEntry.name,
      isLastSet: wasLastSet,
      nextTemplate: wasLastSet ? currentTemplate : currentExerciseEntry.sets[activeSetIndex + 1] ?? null,
      nextSetNumber: wasLastSet ? currentExerciseEntry.sets.length + 1 : activeSetIndex + 2,
      totalSets: wasLastSet ? currentExerciseEntry.sets.length + 1 : currentExerciseEntry.sets.length,
    });

    if (wasLastSet && user?.id) {
      try {
        const intelligence = getWorkoutIntelligence(user.id);
        await intelligence.recordWorkoutCompletion(buildFinalSession(updatedSets));
      } catch (error) {
        console.error('Failed to update intelligence models:', error);
      }
    }
  }, [currentTemplate, currentExerciseEntry, activeSetIndex, session, currentExercise, buildFinalSession, user]);

  const skipSet = useCallback(() => {
    if (!currentTemplate || !currentExerciseEntry) return;

    const skippedSetLog: SetLog = {
      id: createUuid(),
      exerciseId: currentTemplate.exerciseId,
      setIndex: currentTemplate.setIndex,
      prescribedReps: currentTemplate.prescribedReps,
      prescribedRPE: currentTemplate.targetRPE,
      completed: false,
      timestamp: new Date().toISOString(),
    };

    setSession((prev) => ({
      ...prev,
      sets: [...prev.sets, skippedSetLog],
      updatedAt: new Date().toISOString(),
    }));

    const wasLastSet = activeSetIndex >= currentExerciseEntry.sets.length - 1;
    if (wasLastSet) {
      setView('selection');
      setCurrentExerciseId(null);
      return;
    }

    setActiveSetIndex((prev) => prev + 1);
  }, [currentTemplate, currentExerciseEntry, activeSetIndex]);

  const handleRestAdvance = useCallback((addExtraSet: boolean) => {
    setIsResting(false);
    setRestTimerSeconds(null);
    setRestTimerStartedAt(null);
    setExtraRestTime(0);

    if (!restContext) {
      setView('selection');
      return;
    }

    if (addExtraSet && currentExerciseEntry) {
      const nextIndex = currentExerciseEntry.sets.length;
      addExtraSetToExercise(restContext.exerciseId);
      setActiveSetIndex(nextIndex);
      setView('logging');
      return;
    }

    if (restContext.isLastSet) {
      setView('selection');
      setCurrentExerciseId(null);
      return;
    }

    setView('logging');
  }, [restContext, currentExerciseEntry, addExtraSetToExercise]);

  const handleCreateCustom = useCallback(() => {
    setCustomInitialName(searchQuery.trim());
    setShowCustomModal(true);
    setShowExercisePicker(false);
  }, [searchQuery]);

  const handleCustomCreated = useCallback((exercise: CustomExercise) => {
    setCustomExercises((prev) => [exercise, ...prev]);
    const normalized = normalizeCustomExercise(exercise);
    const entryId = `entry_${normalized.id}`;

    setExerciseEntries((prev) => {
      const existing = prev.find((item) => item.exerciseId === normalized.id);
      if (existing) {
        const last = existing.sets[existing.sets.length - 1];
        const baseTemplate: SetTemplate = last ?? {
          exerciseId: normalized.id,
          setIndex: 1,
          prescribedReps: '8',
          targetRPE: 8,
          restSeconds: normalized.defaultRestSeconds ?? 90,
        };
        const nextIndex = (last?.setIndex ?? existing.sets.length) + 1;
        const newTemplate: SetTemplate = {
          ...baseTemplate,
          setIndex: nextIndex,
        };
        return prev.map((item) =>
          item.exerciseId === normalized.id
            ? { ...item, sets: [...item.sets, newTemplate] }
            : item
        );
      }

      const newTemplate: SetTemplate = {
        exerciseId: normalized.id,
        setIndex: 1,
        prescribedReps: '8',
        targetRPE: 8,
        restSeconds: normalized.defaultRestSeconds ?? 90,
      };
      return [...prev, { id: entryId, exerciseId: normalized.id, name: normalized.name, sets: [newTemplate] }];
    });

    setCurrentExerciseId(entryId);
    setView('logging');
    setShowCustomModal(false);
    setShowExercisePicker(false);
    setSearchQuery('');
  }, [normalizeCustomExercise]);

  const allExercises = useMemo(() => {
    const custom = customExercises.map(normalizeCustomExercise);
    return [...custom, ...defaultExercises];
  }, [customExercises, normalizeCustomExercise]);

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

  const handleAddExercise = useCallback((exercise: Exercise) => {
    const entryId = `entry_${exercise.id}`;

    setExerciseEntries((prev) => {
      const existing = prev.find((item) => item.exerciseId === exercise.id);
      if (existing) {
        const last = existing.sets[existing.sets.length - 1];
        const baseTemplate: SetTemplate = last ?? {
          exerciseId: exercise.id,
          setIndex: 1,
          prescribedReps: '8',
          targetRPE: 8,
          restSeconds: exercise.defaultRestSeconds ?? 90,
        };
        const nextIndex = (last?.setIndex ?? existing.sets.length) + 1;
        const newTemplate: SetTemplate = {
          ...baseTemplate,
          setIndex: nextIndex,
        };
        return prev.map((item) =>
          item.exerciseId === exercise.id
            ? { ...item, sets: [...item.sets, newTemplate] }
            : item
        );
      }

      const newTemplate: SetTemplate = {
        exerciseId: exercise.id,
        setIndex: 1,
        prescribedReps: '8',
        targetRPE: 8,
        restSeconds: exercise.defaultRestSeconds ?? 90,
      };
      return [...prev, { id: entryId, exerciseId: exercise.id, name: exercise.name, sets: [newTemplate] }];
    });

    setShowExercisePicker(false);
    setSearchQuery('');
    setCurrentExerciseId(entryId);
    setView('logging');
  }, []);

  const selectionExercises = useMemo(() => (
    exerciseEntries.map((entry) => {
      const loggedSets = getLoggedSetsForExercise(entry.exerciseId);
      return {
        id: entry.id,
        exerciseId: entry.exerciseId,
        name: entry.name,
        sets: entry.sets,
        completedSets: loggedSets,
        isCompleted: loggedSets >= entry.sets.length,
      };
    })
  ), [exerciseEntries, getLoggedSetsForExercise]);

  const hasIncompleteExercises = useMemo(
    () => selectionExercises.some((exercise) => !exercise.isCompleted),
    [selectionExercises]
  );

  const requestFinishWorkout = useCallback(() => {
    if (hasIncompleteExercises) {
      setShowFinishConfirm(true);
      return;
    }
    void finishWorkout();
  }, [finishWorkout, hasIncompleteExercises]);

  const handleReorder = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    const orderSet = new Set(orderedIds);
    setExerciseEntries((prev) => {
      const map = new Map(prev.map((entry) => [entry.id, entry]));
      const ordered = orderedIds
        .map((id) => map.get(id))
        .filter((entry): entry is WorkoutExerciseEntry => Boolean(entry));
      const remaining = prev.filter((entry) => !orderSet.has(entry.id));
      return [...ordered, ...remaining];
    });
  }, []);

  const [nextSetRecommendation, setNextSetRecommendation] = useState<SetRecommendation | null>(null);

  useEffect(() => {
    if (!restContext?.nextTemplate) {
      setNextSetRecommendation(null);
      return;
    }

    let cancelled = false;
    const intelligence = getWorkoutIntelligence(user?.id || null);

    intelligence.getSetRecommendation(
      restContext.nextTemplate.exerciseId,
      restContext.nextSetNumber,
      parseInt(String(restContext.nextTemplate.prescribedReps)) || 5,
      restContext.nextTemplate.targetRPE ?? null,
      sessionSets
    ).then((rec) => {
      if (!cancelled) {
        setNextSetRecommendation(rec);
      }
    }).catch((err) => {
      console.error('Failed to get set recommendation:', err);
      if (!cancelled) {
        setNextSetRecommendation(null);
      }
    });

    return () => { cancelled = true; };
  }, [user?.id, restContext, sessionSets]);

  const nextSetInfo = useMemo(() => {
    const nextTemplate = restContext?.nextTemplate;
    if (!nextTemplate) return undefined;
    const exercise = resolveExercise(nextTemplate.exerciseId);
    const lastSet = sessionSets.filter((set) => set.exerciseId === nextTemplate.exerciseId && set.actualWeight).slice(-1)[0];

    return {
      exerciseName: exercise.name,
      exerciseId: exercise.id,
      muscleGroups: exercise.muscleGroups || [],
      setNumber: restContext.nextSetNumber,
      totalSets: restContext.totalSets,
      prescribedReps: nextTemplate.prescribedReps,
      targetRPE: nextTemplate.targetRPE ?? undefined,
      targetRIR: nextTemplate.targetRIR ?? undefined,
      suggestedWeight: nextSetRecommendation?.suggestedWeight ?? undefined,
      weightReasoning: nextSetRecommendation?.reasoning ?? undefined,
      lastWeight: lastSet?.actualWeight ?? undefined,
      lastReps: lastSet?.actualReps ?? undefined,
    };
  }, [restContext, resolveExercise, nextSetRecommendation, sessionSets]);

  if (!day) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-300">No workout data available</p>
        <button
          onClick={handleCancelWorkout}
          className="mt-4 rounded-xl bg-white/10 border border-white/10 px-6 py-3 text-white font-medium transition-all active:scale-[0.98]"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (view === 'rest' && restTimerSeconds !== null) {
    return (
      <RestTimer
        isActive={isResting}
        duration={(restTimerSeconds || 0) + extraRestTime}
        onComplete={handleRestAdvance}
        onSkip={handleRestAdvance}
        nextSetInfo={nextSetInfo}
        currentSessionSets={sessionSets}
        onApplyWeightSuggestion={(weight) => {
          setAppliedRestTimerWeight(weight);
          setIgnoredSuggestion(false);
        }}
        onReduceReps={(amount) => {
          setRepReduction(amount);
          setIgnoredSuggestion(false);
        }}
        onIncreaseRest={(seconds) => {
          setExtraRestTime(seconds);
        }}
        onSkipExercise={() => {
          handleRestAdvance(false);
        }}
        isLastSetOfExercise={restContext?.isLastSet ?? false}
        exerciseName={restContext?.exerciseName ?? 'Exercise'}
      />
    );
  }

  if (view === 'logging' && currentTemplate && currentExerciseEntry) {
    const totalSetsForExercise = currentExerciseEntry.sets.length;
    const setPositionForExercise = Math.min(activeSetIndex + 1, totalSetsForExercise);

    return (
      <div className="min-h-screen safe-top bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950">
        <div className="w-full max-w-none px-4 py-6 sm:mx-auto sm:max-w-4xl sm:px-6 sm:py-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Session Time</p>
              <p className="text-sm text-gray-300">{elapsedDisplay}</p>
            </div>
            <button
              onClick={() => setView('selection')}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              Back to Menu
            </button>
          </div>

          <SetLogger
            template={currentTemplate}
            exercise={currentExercise}
            onLog={logSet}
            onUpdateSet={updateLoggedSet}
            onSkip={skipSet}
            currentSessionSets={sessionSets}
            nextExerciseInSuperset={null}
            setPositionForExercise={setPositionForExercise}
            totalSetsForExercise={totalSetsForExercise}
            initialWeight={appliedRestTimerWeight}
            ignoredSuggestion={ignoredSuggestion}
            repReduction={repReduction}
            onFinishWorkout={requestFinishWorkout}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkoutSelection
        programName={workoutName || day.name || program.name}
        exercises={selectionExercises}
        onSelectExercise={handleSelectExercise}
        onAddExercise={() => setShowExercisePicker(true)}
        onFinishWorkout={requestFinishWorkout}
        onReorder={handleReorder}
        isNameEditable={isQuickStart}
        workoutName={workoutName}
        onRenameWorkout={setWorkoutName}
      />

      {showExercisePicker && (
        <ExercisePicker
          exercises={filteredExercises}
          recentExercises={recentExercises}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleAddExercise}
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

      {showFinishConfirm && (
        <ConfirmFinishModal
          onCancel={() => setShowFinishConfirm(false)}
          onConfirm={() => {
            setShowFinishConfirm(false);
            void finishWorkout();
          }}
        />
      )}
    </>
  );
}

// ============================================================
// SET LOGGER COMPONENT
// ============================================================

interface SetLoggerProps {
  template: SetTemplate;
  exercise: Exercise | null;
  onLog: (setLog: Partial<SetLog>) => void;
  onUpdateSet: (target: SetLog, updates: Partial<SetLog>) => void;
  onSkip: () => void;
  currentSessionSets: SetLog[];
  nextExerciseInSuperset: Exercise | null;
  setPositionForExercise: number;
  totalSetsForExercise: number;
  initialWeight?: number | null;
  ignoredSuggestion?: boolean;
  repReduction?: number;
  onFinishWorkout: () => void;
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
  onUpdateSet,
  onSkip,
  currentSessionSets,
  nextExerciseInSuperset,
  setPositionForExercise,
  totalSetsForExercise,
  initialWeight,
  ignoredSuggestion,
  repReduction = 0,
  onFinishWorkout,
}: SetLoggerProps) {
  const { user } = useAuth();
  const nowValue = useMemo(() => new Date().getTime(), []);
  const setType = template.setType || 'straight';
  const isDropSet = setType === 'drop';
  const isRestPause = setType === 'rest-pause';
  const isCluster = setType === 'cluster';
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const defaultRpeValue = useMemo(() => {
    if (template.targetRPE != null) return template.targetRPE;
    if (template.targetRIR != null) return Math.min(10, Math.max(5, 10 - template.targetRIR));
    return 8;
  }, [template.targetRPE, template.targetRIR]);
  const [rpeValue, setRpeValue] = useState<number>(defaultRpeValue);
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showCompletedSets, setShowCompletedSets] = useState(false);
  const [editingSet, setEditingSet] = useState<SetLog | null>(null);
  const [percentageWeight, setPercentageWeight] = useState<number | null>(null);
  const weightRef = useRef<string>('');
  const repsRef = useRef<string>('');

  const [dropSetRounds, setDropSetRounds] = useState<Array<{ weight: string; reps: string; rpe: string }>>([
    { weight: '', reps: '', rpe: '' },
  ]);

  const [restPauseRounds, setRestPauseRounds] = useState<Array<{ reps: string; restSeconds: string }>>([
    { reps: '', restSeconds: '15' },
  ]);

  const [clusterRounds, setClusterRounds] = useState<Array<{ reps: string; restSeconds: string }>>([
    { reps: '2', restSeconds: '20' },
  ]);

  const [tempo, setTempo] = useState(template.tempo || '');
  const showTempo = Boolean(template.tempo);
  const lastExerciseIdRef = useRef(template.exerciseId);

  const completedSetsForExercise = useMemo(() => (
    currentSessionSets
      .filter((set) => set.exerciseId === template.exerciseId && set.completed)
      .sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0))
  ), [currentSessionSets, template.exerciseId]);

  useEffect(() => {
    if (editingSet) return;
    setRpeValue(defaultRpeValue);
  }, [defaultRpeValue, template.exerciseId, template.setIndex, editingSet]);

  useEffect(() => {
    if (!template.targetPercentage) {
      setPercentageWeight(null);
      return;
    }

    let cancelled = false;
    getWeightForPercentage(template.exerciseId, template.targetPercentage, user?.id || null)
      .then((weightValue) => {
        if (!cancelled) setPercentageWeight(weightValue);
      })
      .catch(() => {
        if (!cancelled) setPercentageWeight(null);
      });

    return () => {
      cancelled = true;
    };
  }, [template.exerciseId, template.targetPercentage, user?.id]);

  useEffect(() => {
    if (initialWeight != null && initialWeight > 0) {
      const formatted = formatToStep(initialWeight, 0.5, 0);
      weightRef.current = formatted;
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

  const resetForm = useCallback(() => {
    weightRef.current = '';
    repsRef.current = '';
    setWeight('');
    setReps('');
    setRpeValue(defaultRpeValue);
    setNotes('');
    setTempo('');
    setDropSetRounds([{ weight: '', reps: '', rpe: '' }]);
    setRestPauseRounds([{ reps: '', restSeconds: '15' }]);
    setClusterRounds([{ reps: '2', restSeconds: '20' }]);
    setEditingSet(null);
  }, [defaultRpeValue]);

  useEffect(() => {
    if (!editingSet) {
      lastExerciseIdRef.current = template.exerciseId;
      return;
    }

    if (lastExerciseIdRef.current !== template.exerciseId) {
      resetForm();
    }

    lastExerciseIdRef.current = template.exerciseId;
  }, [template.exerciseId, resetForm, editingSet]);

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

  const startEditSet = useCallback((set: SetLog) => {
    setEditingSet(set);
    setShowCompletedSets(true);

    if (set.actualWeight != null) {
      const formatted = formatToStep(set.actualWeight, 0.5, 0);
      weightRef.current = formatted;
      setWeight(formatted);
    } else {
      weightRef.current = '';
      setWeight('');
    }

    if (set.actualReps != null) {
      const formatted = formatToStep(set.actualReps, 1, 0);
      repsRef.current = formatted;
      setReps(formatted);
    } else {
      repsRef.current = '';
      setReps('');
    }

    const derivedRpe = set.actualRPE != null
      ? set.actualRPE
      : set.actualRIR != null
        ? Math.min(10, Math.max(5, 10 - set.actualRIR))
        : defaultRpeValue;
    setRpeValue(derivedRpe);

    setNotes(set.notes ?? '');
    setTempo(set.tempo ?? '');

    if (set.dropSetRounds?.length) {
      setDropSetRounds(set.dropSetRounds.map((round) => ({
        weight: round.weight.toString(),
        reps: round.reps.toString(),
        rpe: round.rpe != null ? round.rpe.toString() : '',
      })));
    } else {
      setDropSetRounds([{ weight: '', reps: '', rpe: '' }]);
    }

    if (set.restPauseRounds?.length) {
      setRestPauseRounds(set.restPauseRounds.map((round) => ({
        reps: round.reps.toString(),
        restSeconds: round.restSeconds.toString(),
      })));
    } else {
      setRestPauseRounds([{ reps: '', restSeconds: '15' }]);
    }

    if (set.clusterRounds?.length) {
      setClusterRounds(set.clusterRounds.map((round) => ({
        reps: round.reps.toString(),
        restSeconds: round.restSeconds.toString(),
      })));
    } else {
      setClusterRounds([{ reps: '2', restSeconds: '20' }]);
    }
  }, [defaultRpeValue]);

  const basePrescribedReps = useMemo(() => {
    if (!template.prescribedReps) return null;
    const first = parseInt(template.prescribedReps.split('-')[0]);
    return isNaN(first) ? null : first;
  }, [template.prescribedReps]);

  const renderSetBody = () => {
    if (isRestPause) {
      return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-white">Rest-Pause Rounds</p>
              <p className="text-xs font-medium text-gray-400">Mini-sets with 10-15s rest</p>
            </div>
            <button
              onClick={() => setRestPauseRounds([...restPauseRounds, { reps: '', restSeconds: '15' }])}
              className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              Add Round
            </button>
          </div>

          {restPauseRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
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
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              {restPauseRounds.length > 1 && (
                <button
                  onClick={() => setRestPauseRounds(restPauseRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <p className="text-sm font-semibold text-red-300">
              Total reps: {restPauseRounds.reduce((sum, r) => sum + (parseInt(r.reps) || 0), 0)}
            </p>
          </div>
        </div>
      );
    }

    if (isCluster) {
      return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-white">Cluster Rounds</p>
              <p className="text-xs font-medium text-gray-400">Small clusters with short rest</p>
            </div>
            <button
              onClick={() => setClusterRounds([...clusterRounds, { reps: '2', restSeconds: '20' }])}
              className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              Add Cluster
            </button>
          </div>

          {clusterRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
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
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              {clusterRounds.length > 1 && (
                <button
                  onClick={() => setClusterRounds(clusterRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-300 hover:bg-indigo-500/10 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <p className="text-sm font-semibold text-indigo-300">
              Total reps: {clusterRounds.reduce((sum, r) => sum + (parseInt(r.reps) || 0), 0)}
            </p>
          </div>
        </div>
      );
    }

    if (isDropSet) {
      return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-white">Drop Set Rounds</p>
              <p className="text-xs font-medium text-gray-400">Decreasing weight, push to failure</p>
            </div>
            <button
              onClick={() => setDropSetRounds([...dropSetRounds, { weight: '', reps: '', rpe: '' }])}
              className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              Add Round
            </button>
          </div>

          {dropSetRounds.map((round, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
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
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              {dropSetRounds.length > 1 && (
                <button
                  onClick={() => setDropSetRounds(dropSetRounds.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-300 hover:bg-orange-500/10 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
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

        <div className="mx-auto max-w-lg">
          <RpeRirSlider value={rpeValue} onChange={setRpeValue} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-colors">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full border-none bg-transparent text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none"
          />
        </div>

        {showTempo && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tempo
            </label>
            <input
              type="text"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              placeholder="3-1-2-0"
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}
      </div>
    );
  };

  const lastWorkout = storage.getLastWorkoutForExercise(template.exerciseId);
  const headerSetIndex = editingSet?.setIndex ?? setPositionForExercise;
  const headerLabel = editingSet
    ? `Editing Set ${headerSetIndex}`
    : `Set ${headerSetIndex} of ${totalSetsForExercise}`;

  const intelligence = useWorkoutIntelligence(
    user?.id || null,
    currentSessionSets,
    template.exerciseId,
    parseInt(template.prescribedReps) || 5,
    template.targetRPE ?? null,
    lastWorkout?.bestSet.actualWeight || null
  );

  const weightSeed = useMemo(() => {
    if (initialWeight != null && initialWeight > 0) {
      return initialWeight;
    }

    if (ignoredSuggestion) {
      if (lastWorkout?.bestSet.actualWeight) return lastWorkout.bestSet.actualWeight;
      if (percentageWeight != null) return percentageWeight;
      return null;
    }

    if (intelligence.setRecommendation?.suggestedWeight) return intelligence.setRecommendation.suggestedWeight;
    if (percentageWeight != null) return percentageWeight;
    if (lastWorkout?.bestSet.actualWeight) return lastWorkout.bestSet.actualWeight;
    return null;
  }, [intelligence.setRecommendation?.suggestedWeight, lastWorkout?.bestSet.actualWeight, initialWeight, ignoredSuggestion, percentageWeight]);

  const repSeed = useMemo(() => {
    if (ignoredSuggestion) {
      return basePrescribedReps;
    }

    let base = basePrescribedReps;

    if (repReduction > 0 && base !== null) {
      base = Math.max(1, base - repReduction);
    }

    return base;
  }, [basePrescribedReps, ignoredSuggestion, repReduction]);

  const weightDisplay = editingSet
    ? weight
    : weight || (weightSeed !== null ? weightSeed.toString() : '');
  const repsDisplay = editingSet
    ? reps
    : reps || (repSeed !== null ? repSeed.toString() : '');

  useEffect(() => {
    weightRef.current = weightDisplay;
  }, [weightDisplay]);

  useEffect(() => {
    repsRef.current = repsDisplay;
  }, [repsDisplay]);

  const exerciseHistory = useMemo(() => {
    const history = storage.getExerciseHistory(template.exerciseId);
    return history
      .slice(0, 3)
      .map((sessionItem) => {
        const exerciseSets = sessionItem.sets.filter((s) => s.exerciseId === template.exerciseId && s.completed);
        const sessionDate = parseLocalDate(sessionItem.date);
        const daysAgo = Math.floor((nowValue - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          date: sessionItem.date,
          daysAgo,
          sets: exerciseSets,
        };
      })
      .filter((h) => h.sets.length > 0);
  }, [template.exerciseId, nowValue]);

  const handleSubmit = () => {
    const actualWeight = weightDisplay ? parseFloat(weightDisplay) : null;
    const actualReps = repsDisplay ? parseInt(repsDisplay, 10) : null;
    const actualRPE = rpeValue ? Number(rpeValue) : null;
    const actualRIR = rpeValue ? Math.max(0, 10 - rpeValue) : null;

    const setLog: Partial<SetLog> = {
      actualWeight,
      actualReps,
      actualRPE,
      actualRIR,
      notes: notes || undefined,
      weightUnit: 'lbs',
      setType,
      tempo: showTempo && tempo ? tempo : undefined,
    };

    if (isDropSet && dropSetRounds.length > 0) {
      const validRounds = dropSetRounds
        .filter((round) => round.weight && round.reps)
        .map((round) => ({
          weight: parseFloat(round.weight),
          reps: parseInt(round.reps),
          rpe: round.rpe ? parseFloat(round.rpe) : undefined,
        }));

      if (validRounds.length > 0) {
        setLog.dropSetRounds = validRounds;
        setLog.actualWeight = validRounds[0].weight;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0);
      }
    }

    if (isRestPause && restPauseRounds.length > 0) {
      const validRounds = restPauseRounds
        .filter((round) => round.reps)
        .map((round) => ({
          reps: parseInt(round.reps),
          restSeconds: parseInt(round.restSeconds) || 15,
        }));

      if (validRounds.length > 0) {
        setLog.restPauseRounds = validRounds;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0);
      }
    }

    if (isCluster && clusterRounds.length > 0) {
      const validRounds = clusterRounds
        .filter((round) => round.reps)
        .map((round) => ({
          reps: parseInt(round.reps),
          restSeconds: parseInt(round.restSeconds) || 20,
        }));

      if (validRounds.length > 0) {
        setLog.clusterRounds = validRounds;
        setLog.actualReps = validRounds.reduce((sum, r) => sum + r.reps, 0);
      }
    }

    if (editingSet) {
      onUpdateSet(editingSet, setLog);
      resetForm();
      return;
    }

    onLog(setLog);
    resetForm();
  };

  if (!exercise) return null;

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-xl p-4 sm:p-5 border border-white/10">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
            exercise?.type === 'compound'
              ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white'
              : 'bg-blue-500/20 text-blue-300'
          }`}>
            <Dumbbell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{exercise.name}</h2>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end sm:flex-none">
          <p className="text-[11px] sm:text-xs font-semibold text-gray-400 sm:text-right">
            {headerLabel}
            {!editingSet && template.prescribedReps && ` • ${template.prescribedReps} reps`}
            {!editingSet && template.targetRPE && ` @ RPE ${template.targetRPE}`}
          </p>
          {exerciseHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex-shrink-0 rounded-lg bg-white/10 border border-white/10 p-2 hover:bg-white/15 transition-all"
              title="View history"
            >
              <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {editingSet && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Pencil className="h-4 w-4" />
            Editing set {editingSet.setIndex}. Update values below.
          </div>
          <button
            onClick={resetForm}
            className="text-xs font-semibold text-amber-200 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {nextExerciseInSuperset && (
        <div className="mb-3 rounded-xl border border-purple-500/30 bg-white/5 px-3 py-2 text-xs">
          <span className="font-semibold text-purple-200">SUPERSET</span>
          <ChevronRight className="mx-1 inline-block h-3.5 w-3.5 text-purple-300" />
          <span className="text-purple-300">{nextExerciseInSuperset.name}</span>
        </div>
      )}

      {showHistory && exerciseHistory.length > 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Recent Sets</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs font-semibold text-gray-400 hover:text-white transition-colors"
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
                    if (bestSet.actualRPE) setRpeValue(bestSet.actualRPE);
                    setShowHistory(false);
                  }}
                  className="w-full flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-400">{dateLabel}</span>
                  <span className="font-semibold text-white">
                    {bestSet.actualWeight || 0}lbs × {bestSet.actualReps || 0}
                    {bestSet.actualRPE && <span className="ml-1 text-xs text-amber-400">@{bestSet.actualRPE}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {renderSetBody()}
      </div>

      {completedSetsForExercise.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <button
            onClick={() => setShowCompletedSets(!showCompletedSets)}
            className="flex w-full items-center justify-between text-sm font-semibold text-gray-300"
          >
            <span>Completed Sets ({completedSetsForExercise.length})</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showCompletedSets ? 'rotate-180' : ''}`} />
          </button>
          {showCompletedSets && (
            <div className="mt-3 space-y-2">
              {completedSetsForExercise.map((set) => (
                <div
                  key={set.id ?? set.timestamp ?? `${set.exerciseId}-${set.setIndex}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                      {set.setIndex}
                    </div>
                    <div className="text-sm text-white">
                      {set.actualWeight ?? 0}lbs × {set.actualReps ?? 0}
                      {set.actualRPE != null ? (
                        <span className="ml-2 text-xs text-purple-300">@{set.actualRPE}</span>
                      ) : set.actualRIR != null ? (
                        <span className="ml-2 text-xs text-purple-300">RIR {set.actualRIR}</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => startEditSet(set)}
                    className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs font-semibold text-gray-200 transition-all hover:bg-white/15"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-4 z-20 mt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-2xl bg-white/5 backdrop-blur-xl p-3 border border-white/10 shadow-2xl">
          <button
            onClick={handleSubmit}
            className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-5 py-3.5 text-base font-black text-white shadow-lg transition transform hover:shadow-xl active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
            <span className="relative flex items-center justify-center">
              {editingSet ? 'Update Set' : 'Log Set'}
            </span>
          </button>
          {!editingSet && (
            <button
              onClick={onSkip}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-xs sm:text-sm font-semibold text-white transition-all active:scale-[0.98]"
            >
              Skip Set
            </button>
          )}
        </div>
      </div>

      <button
        onClick={onFinishWorkout}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs sm:text-sm font-semibold text-gray-300 transition-all active:scale-[0.98]"
      >
        Finish workout early
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

interface ConfirmFinishModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmFinishModal({ onCancel, onConfirm }: ConfirmFinishModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-2">Finish workout early?</h2>
        <p className="text-sm text-gray-400 mb-6">
          You still have unfinished sets. Are you sure you want to end this workout now?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            Finish Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateE1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}
