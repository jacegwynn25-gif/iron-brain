'use client';

import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { Copy, Redo2, Trash2, Undo2 } from 'lucide-react';
import { ProgramTemplate, WeekTemplate, DayTemplate, SetTemplate, Exercise, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { EXERCISE_TIER_LIST } from '../lib/intelligence/config';
import { saveProgramToCloud } from '../lib/supabase/program-sync';
import { isOnline } from '../lib/sync/offline-queue';
import { createUuid } from '../lib/uuid';
import ExercisePicker from './program-builder/ExercisePicker';
import ExerciseCard from './program-builder/ExerciseCard';
import MaxesManager from './program-builder/MaxesManager';
import VolumeInsights from './program-builder/VolumeInsights';
import { analyzeProgramVolume } from '../lib/intelligence/builder';
import Card from './ui/Card';

interface ProgramBuilderProps {
  existingProgram?: ProgramTemplate;
  onSave: (program: ProgramTemplate) => void;
  onCancel: () => void;
  userId: string | null;
}

type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HISTORY_LIMIT = 50;
const DRAFT_STORAGE_PREFIX = 'iron_brain_program_builder_draft';
const DRAFT_LAST_PREFIX = 'iron_brain_program_builder_last_draft';

type ProgramDraft = {
  name: string;
  description: string;
  goal: ProgramTemplate['goal'];
  experienceLevel: ProgramTemplate['experienceLevel'];
  intensityMethod: ProgramTemplate['intensityMethod'];
  weeks: WeekTemplate[];
};

type DraftStorageRecord = {
  programId: string;
  updatedAt: string;
  snapshot: ProgramDraft;
};

const buildDraftStorageKey = (namespace: string, programId: string) =>
  `${DRAFT_STORAGE_PREFIX}::${namespace}::${programId}`;

const buildDraftLastKey = (namespace: string) =>
  `${DRAFT_LAST_PREFIX}::${namespace}`;

const parseDraftRecord = (raw: string): DraftStorageRecord | null => {
  try {
    const parsed = JSON.parse(raw) as DraftStorageRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.programId !== 'string') return null;
    if (!parsed.snapshot || typeof parsed.snapshot !== 'object') return null;
    if (!Array.isArray(parsed.snapshot.weeks)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export default function ProgramBuilder({ existingProgram, onSave, onCancel, userId }: ProgramBuilderProps) {
  // Program metadata
  const [programName, setProgramName] = useState(existingProgram?.name || '');
  const [description, setDescription] = useState(existingProgram?.description || '');
  const [goal, setGoal] = useState<ProgramTemplate['goal']>(existingProgram?.goal || 'general');
  const [experienceLevel, setExperienceLevel] = useState<ProgramTemplate['experienceLevel']>(
    existingProgram?.experienceLevel || 'intermediate'
  );
  const [intensityMethod, setIntensityMethod] = useState<ProgramTemplate['intensityMethod']>(
    existingProgram?.intensityMethod || 'rpe'
  );

  const [draftProgramId, setDraftProgramId] = useState(
    () => existingProgram?.id || `custom_${createUuid()}`
  );

  // Program structure
  const [weeks, setWeeks] = useState<WeekTemplate[]>(
    existingProgram?.weeks || [
      {
        weekNumber: 1,
        days: [],
      },
    ]
  );

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const lastSavedHashRef = useRef<string | null>(null);
  const historyRef = useRef<Array<{ hash: string; snapshot: ProgramDraft }>>([]);
  const futureRef = useRef<Array<{ hash: string; snapshot: ProgramDraft }>>([]);
  const isRestoringRef = useRef(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showMaxesManager, setShowMaxesManager] = useState(false);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customExercisesLoading, setCustomExercisesLoading] = useState(false);
  const [draggingDayIndex, setDraggingDayIndex] = useState<number | null>(null);
  const [dragOverDayIndex, setDragOverDayIndex] = useState<number | null>(null);
  const [draggingExerciseId, setDraggingExerciseId] = useState<string | null>(null);
  const [dragOverExerciseId, setDragOverExerciseId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setCustomExercisesLoading(true);
    getCustomExercises(userId)
      .then(exercises => {
        if (!isMounted) return;
        setCustomExercises(exercises);
        setCustomExercisesLoading(false);
      })
      .catch(err => {
        console.error('Failed to load custom exercises:', err);
        if (isMounted) {
          setCustomExercises([]);
          setCustomExercisesLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const week = weeks.find(w => w.weekNumber === selectedWeek);
    if (!week) return;
    setSelectedDayIndex(prev => {
      if (week.days.length === 0) return null;
      if (prev === null) return 0;
      if (prev >= week.days.length) return week.days.length - 1;
      return prev;
    });
  }, [weeks, selectedWeek]);

  useEffect(() => {
    if (weeks.length === 0) return;
    if (!weeks.some(w => w.weekNumber === selectedWeek)) {
      setSelectedWeek(weeks[0]?.weekNumber || 1);
      setSelectedDayIndex(null);
    }
  }, [weeks, selectedWeek]);

  // Get current week
  const currentWeek = weeks.find(w => w.weekNumber === selectedWeek);
  const selectedDay = selectedDayIndex !== null ? currentWeek?.days[selectedDayIndex] : null;

  const buildDraftSnapshot = useCallback((): ProgramDraft => {
    return {
      name: programName,
      description,
      goal,
      experienceLevel,
      intensityMethod,
      weeks: JSON.parse(JSON.stringify(weeks)) as WeekTemplate[],
    };
  }, [programName, description, goal, experienceLevel, intensityMethod, weeks]);

  const draftNamespace = useMemo(() => userId ?? 'guest', [userId]);

  const readDraftFromStorage = useCallback((key: string): DraftStorageRecord | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return parseDraftRecord(raw);
  }, []);

  const writeDraftToStorage = useCallback((key: string, record: DraftStorageRecord) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(record));
  }, []);

  const removeDraftFromStorage = useCallback((key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }, []);

  const updateLastDraft = useCallback((programId: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(buildDraftLastKey(draftNamespace), programId);
  }, [draftNamespace]);

  const clearDraftStorage = useCallback((programId: string) => {
    const key = buildDraftStorageKey(draftNamespace, programId);
    removeDraftFromStorage(key);
    if (typeof window === 'undefined') return;
    const lastKey = buildDraftLastKey(draftNamespace);
    const lastId = localStorage.getItem(lastKey);
    if (lastId === programId) {
      localStorage.removeItem(lastKey);
    }
  }, [draftNamespace, removeDraftFromStorage]);

  const serializeDraft = useCallback((snapshot: ProgramDraft) => JSON.stringify(snapshot), []);

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const applyDraftSnapshot = useCallback((snapshot: ProgramDraft) => {
    setProgramName(snapshot.name);
    setDescription(snapshot.description);
    setGoal(snapshot.goal || 'general');
    setExperienceLevel(snapshot.experienceLevel || 'intermediate');
    setIntensityMethod(snapshot.intensityMethod || 'rpe');
    setWeeks(JSON.parse(JSON.stringify(snapshot.weeks)) as WeekTemplate[]);
  }, []);

  const pushHistorySnapshot = useCallback(() => {
    if (isRestoringRef.current) return;
    const snapshot = buildDraftSnapshot();
    const hash = serializeDraft(snapshot);
    const lastEntry = historyRef.current[historyRef.current.length - 1];
    if (!lastEntry || lastEntry.hash !== hash) {
      historyRef.current.push({ hash, snapshot });
      if (historyRef.current.length > HISTORY_LIMIT) {
        historyRef.current.shift();
      }
    }
    futureRef.current = [];
    updateHistoryFlags();
  }, [buildDraftSnapshot, serializeDraft, updateHistoryFlags]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const currentSnapshot = buildDraftSnapshot();
    const previous = historyRef.current.pop();
    if (!previous) return;
    futureRef.current.push({ hash: serializeDraft(currentSnapshot), snapshot: currentSnapshot });
    isRestoringRef.current = true;
    applyDraftSnapshot(previous.snapshot);
    isRestoringRef.current = false;
    updateHistoryFlags();
  }, [applyDraftSnapshot, buildDraftSnapshot, serializeDraft, updateHistoryFlags]);

  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const currentSnapshot = buildDraftSnapshot();
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({ hash: serializeDraft(currentSnapshot), snapshot: currentSnapshot });
    isRestoringRef.current = true;
    applyDraftSnapshot(next.snapshot);
    isRestoringRef.current = false;
    updateHistoryFlags();
  }, [applyDraftSnapshot, buildDraftSnapshot, serializeDraft, updateHistoryFlags]);

  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise | CustomExercise>();
    defaultExercises.forEach(ex => map.set(ex.id, ex));
    // Include generated builder exercises from config
    EXERCISE_TIER_LIST.forEach(ex => {
      if (!map.has(ex.id)) {
        map.set(ex.id, {
          id: ex.id,
          name: ex.name,
          type: ex.movementType,
          muscleGroups: [ex.primaryMuscle, ...ex.secondaryMuscles],
          equipment: ex.equipment,
        });
      }
    });
    customExercises.forEach(ex => map.set(ex.id, ex));
    return map;
  }, [customExercises]);

  const resolveExercise = useCallback((exerciseId: string): Exercise | CustomExercise => {
    const found = exerciseMap.get(exerciseId);
    if (found) return found;
    const now = new Date().toISOString();
    return {
      id: exerciseId,
      userId: 'unknown',
      name: `Unknown Exercise (${exerciseId})`,
      slug: exerciseId,
      equipment: 'other',
      exerciseType: 'isolation',
      primaryMuscles: [],
      secondaryMuscles: [],
      trackWeight: true,
      trackReps: true,
      trackTime: false,
      defaultRestSeconds: 90,
      createdAt: now,
      updatedAt: now,
    };
  }, [exerciseMap]);

  const getExerciseOrder = useCallback((sets: SetTemplate[]) => {
    const order: string[] = [];
    sets.forEach(set => {
      if (!order.includes(set.exerciseId)) {
        order.push(set.exerciseId);
      }
    });
    return order;
  }, []);

  const normalizeSets = useCallback((sets: SetTemplate[], exerciseId: string) => {
    return sets.map((set, index) => ({
      ...set,
      exerciseId,
      setIndex: index + 1,
    }));
  }, []);

  const cloneSetTemplate = useCallback((set: SetTemplate): SetTemplate => {
    return {
      ...set,
      dropSetWeights: set.dropSetWeights ? [...set.dropSetWeights] : undefined,
      clusterReps: set.clusterReps ? [...set.clusterReps] : undefined,
    };
  }, []);

  const cloneDayTemplate = useCallback((day: DayTemplate): DayTemplate => {
    return {
      ...day,
      sets: day.sets.map(cloneSetTemplate),
    };
  }, [cloneSetTemplate]);

  const replaceExerciseSets = useCallback((
    sets: SetTemplate[],
    exerciseId: string,
    newSets: SetTemplate[]
  ) => {
    const firstIndex = sets.findIndex(set => set.exerciseId === exerciseId);
    if (firstIndex === -1) {
      return [...sets, ...newSets];
    }
    const filtered = sets.filter(set => set.exerciseId !== exerciseId);
    const insertAt = Math.min(firstIndex, filtered.length);
    return [
      ...filtered.slice(0, insertAt),
      ...newSets,
      ...filtered.slice(insertAt),
    ];
  }, []);

  const rebuildSetsWithOrder = useCallback((sets: SetTemplate[], order: string[]) => {
    const byExercise = new Map<string, SetTemplate[]>();
    sets.forEach(set => {
      if (!byExercise.has(set.exerciseId)) {
        byExercise.set(set.exerciseId, []);
      }
      byExercise.get(set.exerciseId)!.push(set);
    });

    return order.flatMap(exerciseId => {
      const exerciseSets = byExercise.get(exerciseId) || [];
      return normalizeSets(exerciseSets, exerciseId);
    });
  }, [normalizeSets]);

  const normalizeDay = useCallback((day: DayTemplate): DayTemplate => {
    const safeDayOfWeek: DayOfWeek = DAYS_OF_WEEK.includes(day.dayOfWeek as DayOfWeek)
      ? (day.dayOfWeek as DayOfWeek)
      : 'Mon';
    const safeName = day.name?.trim() || 'Training Day';
    const order = getExerciseOrder(day.sets);
    const normalizedSets = rebuildSetsWithOrder(day.sets, order);
    return {
      ...day,
      dayOfWeek: safeDayOfWeek,
      name: safeName,
      sets: normalizedSets,
    };
  }, [getExerciseOrder, rebuildSetsWithOrder]);

  const normalizeWeeks = useCallback((inputWeeks: WeekTemplate[]) => {
    return inputWeeks.map(week => ({
      ...week,
      days: week.days.map(normalizeDay),
    }));
  }, [normalizeDay]);

  const buildProgramPayload = useCallback((useFallbackName: boolean): ProgramTemplate => {
    const normalizedWeeks = normalizeWeeks(weeks);
    const trimmedName = programName.trim();
    return {
      id: draftProgramId,
      name: trimmedName || (useFallbackName ? 'Draft Program' : ''),
      description,
      goal,
      experienceLevel,
      intensityMethod,
      daysPerWeek: normalizedWeeks.reduce((max, week) => Math.max(max, week.days.length), 0),
      weekCount: normalizedWeeks.length,
      weeks: normalizedWeeks,
      isCustom: true,
    };
  }, [draftProgramId, programName, description, goal, experienceLevel, intensityMethod, weeks, normalizeWeeks]);

  const draftHash = useMemo(
    () => serializeDraft(buildDraftSnapshot()),
    [buildDraftSnapshot, serializeDraft]
  );

  useEffect(() => {
    setHasUnsavedChanges(draftHash !== lastSavedHashRef.current);
  }, [draftHash]);

  const markSaved = useCallback((hash: string) => {
    lastSavedHashRef.current = hash;
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date());
    setSyncStatus('saved');
  }, []);

  const syncLabel = useMemo(() => {
    if (!userId) {
      return hasUnsavedChanges ? 'Local changes' : 'Local draft';
    }
    if (syncStatus === 'saving') return 'Saving...';
    if (syncStatus === 'offline') return hasUnsavedChanges ? 'Offline - queued' : 'Offline';
    if (syncStatus === 'error') return 'Sync error';
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (syncStatus === 'saved') {
      return lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : 'Saved';
    }
    return 'Up to date';
  }, [userId, syncStatus, lastSavedAt, hasUnsavedChanges]);

  const syncBadgeClass = useMemo(() => {
    if (!userId) return hasUnsavedChanges ? 'bg-amber-500/30 text-white' : 'bg-white/15 text-white/80';
    if (hasUnsavedChanges) return 'bg-amber-500/30 text-white';
    switch (syncStatus) {
      case 'saving':
        return 'bg-blue-500/30 text-white';
      case 'offline':
        return 'bg-amber-500/30 text-white';
      case 'error':
        return 'bg-red-500/30 text-white';
      case 'saved':
        return 'bg-emerald-500/30 text-white';
      default:
        return 'bg-white/15 text-white/80';
    }
  }, [syncStatus, userId, hasUnsavedChanges]);

  useEffect(() => {
    const defaultDraft: ProgramDraft = {
      name: '',
      description: '',
      goal: 'general',
      experienceLevel: 'intermediate',
      intensityMethod: 'rpe',
      weeks: [{ weekNumber: 1, days: [] }],
    };

    if (existingProgram) {
      setDraftProgramId(existingProgram.id);
      setProgramName(existingProgram.name || '');
      setDescription(existingProgram.description || '');
      setGoal(existingProgram.goal || 'general');
      setExperienceLevel(existingProgram.experienceLevel || 'intermediate');
      setIntensityMethod(existingProgram.intensityMethod || 'rpe');
      setWeeks(existingProgram.weeks || defaultDraft.weeks);
      setSelectedWeek(existingProgram.weeks?.[0]?.weekNumber || 1);
      setSelectedDayIndex(null);

      const baseSnapshot: ProgramDraft = {
        name: existingProgram.name || '',
        description: existingProgram.description || '',
        goal: existingProgram.goal || 'general',
        experienceLevel: existingProgram.experienceLevel || 'intermediate',
        intensityMethod: existingProgram.intensityMethod || 'rpe',
        weeks: JSON.parse(JSON.stringify(existingProgram.weeks || defaultDraft.weeks)) as WeekTemplate[],
      };
      lastSavedHashRef.current = serializeDraft(baseSnapshot);

      const draftKey = buildDraftStorageKey(draftNamespace, existingProgram.id);
      const draftRecord = readDraftFromStorage(draftKey);
      if (draftRecord) {
        const draftHash = serializeDraft(draftRecord.snapshot);
        if (draftHash !== lastSavedHashRef.current) {
          const shouldRestore = window.confirm('Restore your last unsaved draft for this program?');
          if (shouldRestore) {
            isRestoringRef.current = true;
            applyDraftSnapshot(draftRecord.snapshot);
            isRestoringRef.current = false;
          } else {
            clearDraftStorage(existingProgram.id);
          }
        }
      }
    } else {
      const lastKey = buildDraftLastKey(draftNamespace);
      const lastDraftId = typeof window !== 'undefined' ? localStorage.getItem(lastKey) : null;
      const draftId = lastDraftId ?? `custom_${createUuid()}`;
      const draftKey = buildDraftStorageKey(draftNamespace, draftId);
      const draftRecord = readDraftFromStorage(draftKey);

      setDraftProgramId(draftId);
      setProgramName(defaultDraft.name);
      setDescription(defaultDraft.description);
      setGoal(defaultDraft.goal);
      setExperienceLevel(defaultDraft.experienceLevel);
      setIntensityMethod(defaultDraft.intensityMethod);
      setWeeks(defaultDraft.weeks);
      setSelectedWeek(defaultDraft.weeks[0]?.weekNumber || 1);
      setSelectedDayIndex(null);
      lastSavedHashRef.current = serializeDraft(defaultDraft);

      if (draftRecord) {
        const shouldRestore = window.confirm('Restore your last unsaved draft?');
        if (shouldRestore) {
          isRestoringRef.current = true;
          applyDraftSnapshot(draftRecord.snapshot);
          isRestoringRef.current = false;
        } else {
          clearDraftStorage(draftId);
        }
      }
    }

    historyRef.current = [];
    futureRef.current = [];
    updateHistoryFlags();
  }, [
    existingProgram,
    draftNamespace,
    serializeDraft,
    applyDraftSnapshot,
    readDraftFromStorage,
    clearDraftStorage,
    updateHistoryFlags,
  ]);
  // Add new week
  const addWeek = useCallback(() => {
    const newWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0) + 1;
    pushHistorySnapshot();
    setWeeks(prev => [
      ...prev,
      {
        weekNumber: newWeekNumber,
        days: [],
      },
    ]);
    setSelectedWeek(newWeekNumber);
    setSelectedDayIndex(null);
  }, [weeks, pushHistorySnapshot]);

  // Remove week
  const removeWeek = useCallback((weekNumber: number) => {
    pushHistorySnapshot();
    setWeeks(prev => {
      const nextWeeks = prev.filter(w => w.weekNumber !== weekNumber);
      if (selectedWeek === weekNumber) {
        setSelectedWeek(nextWeeks[0]?.weekNumber || 1);
        setSelectedDayIndex(null);
      }
      return nextWeeks;
    });
  }, [selectedWeek, pushHistorySnapshot]);

  const duplicateWeek = useCallback((weekNumber: number) => {
    const sourceWeek = weeks.find(w => w.weekNumber === weekNumber);
    if (!sourceWeek) return;
    const newWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0) + 1;
    pushHistorySnapshot();
    const clonedWeek: WeekTemplate = {
      weekNumber: newWeekNumber,
      days: sourceWeek.days.map(day => ({
        ...cloneDayTemplate(day),
        name: day.name ? `${day.name} Copy` : 'Training Day Copy',
      })),
    };
    setWeeks(prev => [...prev, clonedWeek]);
    setSelectedWeek(newWeekNumber);
    setSelectedDayIndex(clonedWeek.days.length > 0 ? 0 : null);
  }, [weeks, cloneDayTemplate, pushHistorySnapshot]);

  // Add training day
  const addDay = useCallback((dayOfWeek: DayOfWeek) => {
    const newDayIndex = currentWeek?.days.length ?? 0;
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: [
                ...w.days,
                {
                  dayOfWeek,
                  name: `Training Day ${w.days.length + 1}`,
                  sets: [],
                },
              ],
            }
          : w
      )
    );
    setSelectedDayIndex(newDayIndex);
  }, [selectedWeek, currentWeek, pushHistorySnapshot]);

  // Remove day
  const removeDay = useCallback((dayIndex: number) => {
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.filter((_, idx) => idx !== dayIndex),
            }
          : w
      )
    );
    setSelectedDayIndex(prev => {
      if (prev === null) return null;
      if (prev === dayIndex) return null;
      if (prev > dayIndex) return prev - 1;
      return prev;
    });
  }, [selectedWeek, pushHistorySnapshot]);

  const duplicateDay = useCallback((dayIndex: number) => {
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w => {
        if (w.weekNumber !== selectedWeek) return w;
        const sourceDay = w.days[dayIndex];
        if (!sourceDay) return w;
        const duplicated: DayTemplate = {
          ...cloneDayTemplate(sourceDay),
          name: sourceDay.name ? `${sourceDay.name} Copy` : 'Training Day Copy',
        };
        const nextDays = [...w.days];
        nextDays.splice(dayIndex + 1, 0, duplicated);
        return { ...w, days: nextDays };
      })
    );
    setSelectedDayIndex(dayIndex + 1);
  }, [selectedWeek, cloneDayTemplate, pushHistorySnapshot]);

  // Update day name
  const updateDayName = useCallback((dayIndex: number, name: string) => {
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) => (idx === dayIndex ? { ...d, name } : d)),
            }
          : w
      )
    );
  }, [selectedWeek, pushHistorySnapshot]);

  const updateDayOfWeek = useCallback((dayIndex: number, dayOfWeek: DayOfWeek) => {
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) => (idx === dayIndex ? { ...d, dayOfWeek } : d)),
            }
          : w
      )
    );
  }, [selectedWeek, pushHistorySnapshot]);

  const moveDay = useCallback((dayIndex: number, direction: -1 | 1) => {
    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w => {
        if (w.weekNumber !== selectedWeek) return w;
        const targetIndex = dayIndex + direction;
        if (targetIndex < 0 || targetIndex >= w.days.length) return w;
        const nextDays = [...w.days];
        [nextDays[dayIndex], nextDays[targetIndex]] = [nextDays[targetIndex], nextDays[dayIndex]];
        return {
          ...w,
          days: nextDays,
        };
      })
    );
    setSelectedDayIndex(prev => {
      if (prev === null) return prev;
      const targetIndex = dayIndex + direction;
      if (prev === dayIndex) return targetIndex;
      if (prev === targetIndex) return dayIndex;
      return prev;
    });
  }, [selectedWeek, pushHistorySnapshot]);

  const moveExercise = useCallback((exerciseId: string, direction: -1 | 1) => {
    if (!selectedDay || selectedDay.sets.length === 0) return;
    const order = getExerciseOrder(selectedDay.sets);
    const currentIndex = order.indexOf(exerciseId);
    const targetIndex = currentIndex + direction;
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? {
                      ...d,
                      sets: rebuildSetsWithOrder(d.sets, nextOrder),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }, [selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder, pushHistorySnapshot]);

  const handleDayDragStart = useCallback((event: DragEvent<HTMLButtonElement>, dayIndex: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `day:${dayIndex}`);
    setDraggingDayIndex(dayIndex);
  }, []);

  const handleDayDragOver = useCallback((event: DragEvent<HTMLDivElement>, dayIndex: number) => {
    if (draggingDayIndex === null || draggingDayIndex === dayIndex) return;
    event.preventDefault();
    setDragOverDayIndex(dayIndex);
  }, [draggingDayIndex]);

  const handleDayDrop = useCallback((event: DragEvent<HTMLDivElement>, dayIndex: number) => {
    event.preventDefault();
    if (draggingDayIndex === null || draggingDayIndex === dayIndex) return;

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w => {
        if (w.weekNumber !== selectedWeek) return w;
        const nextDays = [...w.days];
        const [moved] = nextDays.splice(draggingDayIndex, 1);
        nextDays.splice(dayIndex, 0, moved);
        return { ...w, days: nextDays };
      })
    );

    setSelectedDayIndex(prev => {
      if (prev === null) return prev;
      if (prev === draggingDayIndex) return dayIndex;
      if (draggingDayIndex < dayIndex && prev > draggingDayIndex && prev <= dayIndex) return prev - 1;
      if (draggingDayIndex > dayIndex && prev < draggingDayIndex && prev >= dayIndex) return prev + 1;
      return prev;
    });

    setDraggingDayIndex(null);
    setDragOverDayIndex(null);
  }, [draggingDayIndex, selectedWeek, pushHistorySnapshot]);

  const handleDayDragEnd = useCallback(() => {
    setDraggingDayIndex(null);
    setDragOverDayIndex(null);
  }, []);

  const handleExerciseDragStart = useCallback((event: DragEvent<HTMLButtonElement>, exerciseId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `exercise:${exerciseId}`);
    setDraggingExerciseId(exerciseId);
  }, []);

  const handleExerciseDragOver = useCallback((event: DragEvent<HTMLDivElement>, exerciseId: string) => {
    if (!draggingExerciseId || draggingExerciseId === exerciseId) return;
    event.preventDefault();
    setDragOverExerciseId(exerciseId);
  }, [draggingExerciseId]);

  const handleExerciseDrop = useCallback((event: DragEvent<HTMLDivElement>, exerciseId: string) => {
    event.preventDefault();
    if (!selectedDay || !draggingExerciseId || draggingExerciseId === exerciseId) return;

    const order = getExerciseOrder(selectedDay.sets);
    const fromIndex = order.indexOf(draggingExerciseId);
    const toIndex = order.indexOf(exerciseId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const nextOrder = [...order];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggingExerciseId);

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? { ...d, sets: rebuildSetsWithOrder(d.sets, nextOrder) }
                  : d
              ),
            }
          : w
      )
    );

    setDraggingExerciseId(null);
    setDragOverExerciseId(null);
  }, [draggingExerciseId, selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder, pushHistorySnapshot]);

  const handleExerciseDropToEnd = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!selectedDay || !draggingExerciseId) return;
    const order = getExerciseOrder(selectedDay.sets);
    const fromIndex = order.indexOf(draggingExerciseId);
    if (fromIndex === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIndex, 1);
    nextOrder.push(draggingExerciseId);

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? { ...d, sets: rebuildSetsWithOrder(d.sets, nextOrder) }
                  : d
              ),
            }
          : w
      )
    );

    setDraggingExerciseId(null);
    setDragOverExerciseId(null);
  }, [draggingExerciseId, selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder, pushHistorySnapshot]);

  const handleExerciseDragEnd = useCallback(() => {
    setDraggingExerciseId(null);
    setDragOverExerciseId(null);
  }, []);

  // Add exercise to selected day (starts with 1 set instead of 3!)
  const addExercise = useCallback((exercise: Exercise | CustomExercise) => {
    if (selectedDayIndex === null) return;

    const methodFromProgram = intensityMethod === 'percentage'
      ? 'percentage_1rm'
      : intensityMethod === 'rir'
        ? 'rir'
        : intensityMethod === 'amrap'
          ? 'amrap'
          : 'rpe';

    // Create initial set with default prescription method
    const newSet: SetTemplate = {
      exerciseId: exercise.id,
      setIndex: 1,
      prescribedReps: methodFromProgram === 'amrap' ? 'AMRAP' : '8',
      prescriptionMethod: methodFromProgram,
      targetRPE: methodFromProgram === 'rpe' ? 8 : null,
      targetRIR: methodFromProgram === 'rir' ? 2 : null,
      targetPercentage: methodFromProgram === 'percentage_1rm' ? 80 : null,
      restSeconds: exercise.defaultRestSeconds ?? 90,
      setType: 'straight',
    };

    if ('userId' in exercise) {
      setCustomExercises(prev =>
        prev.some(existing => existing.id === exercise.id) ? prev : [...prev, exercise]
      );
    }

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? {
                      ...d,
                      sets: [...d.sets, newSet],
                    }
                  : d
              ),
            }
          : w
      )
    );

    setShowExercisePicker(false);
  }, [selectedWeek, selectedDayIndex, intensityMethod, pushHistorySnapshot]);

  // Remove exercise (all sets for that exercise)
  const removeExercise = useCallback((exerciseId: string) => {
    if (selectedDayIndex === null) return;

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? {
                      ...d,
                      sets: d.sets.filter(s => s.exerciseId !== exerciseId),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }, [selectedWeek, selectedDayIndex, pushHistorySnapshot]);

  // Update sets for an exercise
  const updateExerciseSets = useCallback((exerciseId: string, newSets: SetTemplate[]) => {
    if (selectedDayIndex === null) return;

    pushHistorySnapshot();
    setWeeks(prev =>
      prev.map(w =>
        w.weekNumber === selectedWeek
          ? {
              ...w,
              days: w.days.map((d, idx) =>
                idx === selectedDayIndex
                  ? {
                      ...d,
                      sets: replaceExerciseSets(
                        d.sets,
                        exerciseId,
                        normalizeSets(newSets, exerciseId)
                      ),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }, [selectedWeek, selectedDayIndex, normalizeSets, replaceExerciseSets, pushHistorySnapshot]);

  const handleProgramNameChange = useCallback((value: string) => {
    if (value === programName) return;
    pushHistorySnapshot();
    setProgramName(value);
  }, [programName, pushHistorySnapshot]);

  const handleGoalChange = useCallback((value: ProgramTemplate['goal']) => {
    if (value === goal) return;
    pushHistorySnapshot();
    setGoal(value);
  }, [goal, pushHistorySnapshot]);

  const handleExperienceLevelChange = useCallback((value: ProgramTemplate['experienceLevel']) => {
    if (value === experienceLevel) return;
    pushHistorySnapshot();
    setExperienceLevel(value);
  }, [experienceLevel, pushHistorySnapshot]);

  const handleIntensityMethodChange = useCallback((value: ProgramTemplate['intensityMethod']) => {
    if (value === intensityMethod) return;
    pushHistorySnapshot();
    setIntensityMethod(value);
  }, [intensityMethod, pushHistorySnapshot]);

  const handleDescriptionChange = useCallback((value: string) => {
    if (value === description) return;
    pushHistorySnapshot();
    setDescription(value);
  }, [description, pushHistorySnapshot]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm('Discard unsaved changes?');
      if (!confirmDiscard) return;
    }
    clearDraftStorage(draftProgramId);
    onCancel();
  }, [hasUnsavedChanges, onCancel, clearDraftStorage, draftProgramId]);

  // Save program
  const handleSave = useCallback(() => {
    const program = buildProgramPayload(false);
    if (!program.name.trim()) {
      return;
    }
    onSave(program);
    markSaved(serializeDraft(buildDraftSnapshot()));
    clearDraftStorage(program.id);
  }, [buildProgramPayload, onSave, markSaved, serializeDraft, buildDraftSnapshot, clearDraftStorage]);

  // Auto-save to cloud with sync status
  useEffect(() => {
    if (!programName.trim() || !userId) {
      setSyncStatus('idle');
      return;
    }
    if (!hasUnsavedChanges) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    const scheduledHash = draftHash;
    setSyncStatus(isOnline() ? 'saving' : 'offline');

    autoSaveTimeoutRef.current = setTimeout(async () => {
      const program = buildProgramPayload(false);
      const online = isOnline();
      const success = await saveProgramToCloud(program, userId);
      if (!success) {
        setSyncStatus('error');
        return;
      }
      if (!online) {
        lastSavedHashRef.current = scheduledHash;
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        setSyncStatus('offline');
        return;
      }
      markSaved(scheduledHash);
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [programName, userId, hasUnsavedChanges, draftHash, buildProgramPayload, markSaved]);

  useEffect(() => {
    if (isRestoringRef.current) return;
    const programId = draftProgramId;
    if (!programId) return;

    if (!hasUnsavedChanges && syncStatus !== 'offline') {
      clearDraftStorage(programId);
      return;
    }

    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }

    const snapshot = buildDraftSnapshot();
    const record: DraftStorageRecord = {
      programId,
      updatedAt: new Date().toISOString(),
      snapshot,
    };

    draftSaveTimeoutRef.current = setTimeout(() => {
      const key = buildDraftStorageKey(draftNamespace, programId);
      writeDraftToStorage(key, record);
      updateLastDraft(programId);
    }, 500);

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [
    draftHash,
    hasUnsavedChanges,
    syncStatus,
    buildDraftSnapshot,
    draftProgramId,
    draftNamespace,
    clearDraftStorage,
    writeDraftToStorage,
    updateLastDraft,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
      const isModifierPressed = isMac ? event.metaKey : event.ctrlKey;
      if (!isModifierPressed) return;

      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const exerciseOrder = useMemo(() => {
    if (!selectedDay) return [];
    return getExerciseOrder(selectedDay.sets);
  }, [selectedDay, getExerciseOrder]);

  const groupedSets = useMemo(() => {
    if (!selectedDay) return {};
    return selectedDay.sets.reduce((acc, set) => {
      if (!acc[set.exerciseId]) {
        acc[set.exerciseId] = [];
      }
      acc[set.exerciseId].push(set);
      return acc;
    }, {} as Record<string, SetTemplate[]>);
  }, [selectedDay]);

  const programPreview = useMemo(() => buildProgramPayload(true), [buildProgramPayload]);

  const volumeAnalysis = useMemo(() => analyzeProgramVolume(programPreview), [programPreview]);

  const uniqueExerciseCount = useMemo(() => {
    const weekOne = programPreview.weeks[0];
    if (!weekOne) return 0;
    const exercises = new Set<string>();
    weekOne.days.forEach(day => {
      day.sets.forEach(set => exercises.add(set.exerciseId));
    });
    return exercises.size;
  }, [programPreview]);

  return (
    <div className="min-h-screen safe-top app-gradient">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl surface-card p-6 sm:p-8">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_12%_15%,rgba(139,92,246,0.25),transparent_45%),radial-gradient(circle_at_82%_0%,rgba(34,211,238,0.18),transparent_40%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide">
                Program Builder
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">
                  {existingProgram ? 'Edit Program' : 'Create New Program'}
                </h1>
                <p className="mt-1 text-sm sm:text-base text-gray-300">
                  Craft weeks, days, and sets with a clean, mobile-ready workflow.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${syncBadgeClass}`}>
                {syncLabel}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl/Cmd+Z)"
                  className="btn-secondary rounded-xl p-2 text-white transition-all disabled:opacity-40"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl/Cmd+Shift+Z)"
                  className="btn-secondary rounded-xl p-2 text-white transition-all disabled:opacity-40"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto btn-secondary rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!programName || weeks.length === 0}
                title={!programName ? 'Enter a program name' : weeks.length === 0 ? 'Add at least one week' : 'Save program'}
                className="w-full sm:w-auto btn-primary rounded-xl px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                Save Program
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Program Metadata */}
          <div className="rounded-3xl bg-white/90 p-6 sm:p-8 shadow-xl ring-1 ring-zinc-100 dark:bg-zinc-900/90 dark:ring-zinc-800 backdrop-blur">
            <h2 className="mb-4 text-xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              Program Details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={e => handleProgramNameChange(e.target.value)}
                  placeholder="e.g., 5-Day Bench Specialization"
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Goal
                </label>
                <select
                  value={goal}
                  onChange={e => handleGoalChange(e.target.value as ProgramTemplate['goal'])}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="strength">Strength</option>
                  <option value="hypertrophy">Hypertrophy</option>
                  <option value="powerlifting">Powerlifting</option>
                  <option value="peaking">Peaking</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={e => handleExperienceLevelChange(e.target.value as ProgramTemplate['experienceLevel'])}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Intensity Method
                </label>
                <select
                  value={intensityMethod}
                  onChange={e => handleIntensityMethodChange(e.target.value as ProgramTemplate['intensityMethod'])}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="rpe">RPE (Rate of Perceived Exertion)</option>
                  <option value="rir">RIR (Reps in Reserve)</option>
                  <option value="percentage">Percentage (% of 1RM)</option>
                  <option value="amrap">AMRAP (As Many Reps As Possible)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => handleDescriptionChange(e.target.value)}
                  placeholder="Describe this program's focus, methodology, and intended results..."
                  rows={3}
                  className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>
          </div>

          {/* Volume Insights */}
          <div className="lg:pt-1">
            <VolumeInsights analysis={volumeAnalysis} uniqueExerciseCount={uniqueExerciseCount} />
          </div>
        </div>

        {currentWeek && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="rounded-2xl bg-white p-5 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Program Structure
                    </p>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Weeks</h3>
                  </div>
                  <button
                    onClick={addWeek}
                    className="rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:scale-105 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900"
                  >
                    + Add Week
                  </button>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {weeks.map((week) => (
                    <div
                      key={week.weekNumber}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all ${
                        selectedWeek === week.weekNumber
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedWeek(week.weekNumber)}
                        className="flex-1 text-left"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Week {week.weekNumber}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {week.days.length} day{week.days.length === 1 ? "" : "s"}
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => duplicateWeek(week.weekNumber)}
                          className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 text-indigo-600 shadow-sm transition-colors hover:bg-indigo-500/20 dark:text-indigo-200"
                          title="Duplicate week"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {weeks.length > 1 && (
                          <button
                            onClick={() => removeWeek(week.weekNumber)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600 shadow-sm transition-colors hover:bg-rose-500/20 dark:text-rose-200"
                            title="Remove week"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Training Days
                  </h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {currentWeek.days.length} days
                  </span>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Add Training Day
                  </label>
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        addDay(e.target.value as DayOfWeek);
                        e.target.value = "";
                      }
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select day...
                    </option>
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {currentWeek.days.length === 0 ? (
                    <div className="rounded-lg bg-zinc-100 p-4 text-center dark:bg-zinc-800">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No training days yet. Add one above!
                      </p>
                    </div>
                  ) : (
                    currentWeek.days.map((day, idx) => {
                      const exerciseCount = new Set(day.sets.map(set => set.exerciseId)).size;
                      return (
                        <div
                          key={idx}
                          onDragOver={(event) => handleDayDragOver(event, idx)}
                          onDrop={(event) => handleDayDrop(event, idx)}
                          className={`group rounded-xl border p-3 transition-colors ${
                            selectedDayIndex === idx
                              ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800"
                              : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                          } ${dragOverDayIndex === idx ? "ring-2 ring-purple-400 border-purple-400" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={() => setSelectedDayIndex(idx)}
                              className="flex-1 text-left"
                            >
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                {day.dayOfWeek}
                              </p>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400">{day.name}</p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                                {exerciseCount} exercises • {day.sets.length} sets
                              </p>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                draggable
                                onDragStart={(event) => handleDayDragStart(event, idx)}
                                onDragEnd={handleDayDragEnd}
                                className="cursor-grab rounded-lg border border-zinc-200 bg-white p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                                title="Drag to reorder day"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h8M8 12h8M8 18h8" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveDay(idx, -1)}
                                disabled={idx === 0}
                                className="rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                title="Move day up"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => moveDay(idx, 1)}
                                disabled={idx === currentWeek.days.length - 1}
                                className="rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                title="Move day down"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => duplicateDay(idx)}
                                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-1 text-indigo-600 opacity-0 transition-opacity hover:bg-indigo-500/20 group-hover:opacity-100 dark:text-indigo-200"
                                title="Duplicate day"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => removeDay(idx)}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1 text-rose-600 opacity-0 transition-opacity hover:bg-rose-500/20 group-hover:opacity-100 dark:text-rose-200"
                                title="Remove day"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 dark:bg-zinc-900">
              {selectedDay ? (
                <>
                  <div className="mb-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Day of Week
                      </label>
                      <select
                        value={selectedDay.dayOfWeek}
                        onChange={e => updateDayOfWeek(selectedDayIndex!, e.target.value as DayOfWeek)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      >
                        {DAYS_OF_WEEK.map(day => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Day Name
                      </label>
                      <input
                        type="text"
                        value={selectedDay.name}
                        onChange={e => updateDayName(selectedDayIndex!, e.target.value)}
                        placeholder="e.g., Upper Body Push"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          Exercises
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {exerciseOrder.length} exercises • {selectedDay.sets.length} sets
                          {customExercisesLoading ? " • syncing custom exercises" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowMaxesManager(true)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all"
                        >
                          Manage 1RMs
                        </button>
                        <button
                          onClick={() => setShowExercisePicker(true)}
                          className="rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white hover:shadow-lg transition-all"
                        >
                          + Add Exercise
                        </button>
                      </div>
                    </div>
                  </div>

                  {exerciseOrder.length === 0 ? (
                    <div className="rounded-lg bg-zinc-100 p-8 text-center dark:bg-zinc-800">
                      <p className="text-zinc-600 dark:text-zinc-400">
                        No exercises added yet. Click &quot;Add Exercise&quot; to get started!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {exerciseOrder.map((exerciseId, index) => {
                        const sets = groupedSets[exerciseId] || [];
                        if (sets.length === 0) return null;

                        const exercise = resolveExercise(exerciseId);
                        return (
                          <div
                            key={exerciseId}
                            onDragOver={(event) => handleExerciseDragOver(event, exerciseId)}
                            onDrop={(event) => handleExerciseDrop(event, exerciseId)}
                            className={dragOverExerciseId === exerciseId ? "rounded-2xl ring-2 ring-purple-400" : ""}
                          >
                            <ExerciseCard
                              exercise={exercise}
                              sets={sets}
                              onSetsChange={(newSets) => updateExerciseSets(exerciseId, newSets)}
                              onRemoveExercise={() => removeExercise(exerciseId)}
                              onMoveUp={() => moveExercise(exerciseId, -1)}
                              onMoveDown={() => moveExercise(exerciseId, 1)}
                              onDragStart={(event) => handleExerciseDragStart(event, exerciseId)}
                              onDragEnd={handleExerciseDragEnd}
                              isFirst={index === 0}
                              isLast={index === exerciseOrder.length - 1}
                              userId={userId}
                            />
                          </div>
                        );
                      })}
                      {draggingExerciseId && (
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleExerciseDropToEnd}
                          className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-center text-sm font-semibold text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                        >
                          Drop here to move to the end
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Select a training day to edit
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exercise Picker Modal */}
        <ExercisePicker
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelect={addExercise}
          userId={userId}
        />

        {/* Maxes Manager Modal */}
        {showMaxesManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 p-6 bg-white/5">
                <h2 className="text-2xl font-semibold text-white">
                  1RM Management
                </h2>
                <button
                  onClick={() => setShowMaxesManager(false)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto p-6">
                <MaxesManager userId={userId} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
