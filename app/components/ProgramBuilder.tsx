'use client';

import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { ProgramTemplate, WeekTemplate, DayTemplate, SetTemplate, Exercise, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
import { getCustomExercises } from '../lib/exercises/custom-exercises';
import { autoSaveProgram } from '../lib/supabase/program-sync';
import { createUuid } from '../lib/uuid';
import ExercisePicker from './program-builder/ExercisePicker';
import ExerciseCard from './program-builder/ExerciseCard';
import MaxesManager from './program-builder/MaxesManager';

interface ProgramBuilderProps {
  existingProgram?: ProgramTemplate;
  onSave: (program: ProgramTemplate) => void;
  onCancel: () => void;
  userId: string | null;
}

type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  const draftProgramIdRef = useRef<string>(
    existingProgram?.id || `custom_${createUuid()}`
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
    if (!existingProgram) return;
    draftProgramIdRef.current = existingProgram.id;
    setProgramName(existingProgram.name || '');
    setDescription(existingProgram.description || '');
    setGoal(existingProgram.goal || 'general');
    setExperienceLevel(existingProgram.experienceLevel || 'intermediate');
    setIntensityMethod(existingProgram.intensityMethod || 'rpe');
    setWeeks(existingProgram.weeks || [{ weekNumber: 1, days: [] }]);
    setSelectedWeek(existingProgram.weeks?.[0]?.weekNumber || 1);
    setSelectedDayIndex(null);
  }, [existingProgram]);

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

  // Get current week
  const currentWeek = weeks.find(w => w.weekNumber === selectedWeek);
  const selectedDay = selectedDayIndex !== null ? currentWeek?.days[selectedDayIndex] : null;

  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise | CustomExercise>();
    defaultExercises.forEach(ex => map.set(ex.id, ex));
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
  // Add new week
  const addWeek = useCallback(() => {
    const newWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0) + 1;
    setWeeks(prev => [
      ...prev,
      {
        weekNumber: newWeekNumber,
        days: [],
      },
    ]);
    setSelectedWeek(newWeekNumber);
    setSelectedDayIndex(null);
  }, [weeks]);

  // Remove week
  const removeWeek = useCallback((weekNumber: number) => {
    setWeeks(prev => {
      const nextWeeks = prev.filter(w => w.weekNumber !== weekNumber);
      if (selectedWeek === weekNumber) {
        setSelectedWeek(nextWeeks[0]?.weekNumber || 1);
        setSelectedDayIndex(null);
      }
      return nextWeeks;
    });
  }, [selectedWeek]);

  const duplicateWeek = useCallback((weekNumber: number) => {
    const sourceWeek = weeks.find(w => w.weekNumber === weekNumber);
    if (!sourceWeek) return;
    const newWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0) + 1;
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
  }, [weeks, cloneDayTemplate]);

  // Add training day
  const addDay = useCallback((dayOfWeek: DayOfWeek) => {
    const newDayIndex = currentWeek?.days.length ?? 0;
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
  }, [selectedWeek, currentWeek]);

  // Remove day
  const removeDay = useCallback((dayIndex: number) => {
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
  }, [selectedWeek]);

  const duplicateDay = useCallback((dayIndex: number) => {
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
  }, [selectedWeek, cloneDayTemplate]);

  // Update day name
  const updateDayName = useCallback((dayIndex: number, name: string) => {
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
  }, [selectedWeek]);

  const updateDayOfWeek = useCallback((dayIndex: number, dayOfWeek: DayOfWeek) => {
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
  }, [selectedWeek]);

  const moveDay = useCallback((dayIndex: number, direction: -1 | 1) => {
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
  }, [selectedWeek]);

  const moveExercise = useCallback((exerciseId: string, direction: -1 | 1) => {
    if (!selectedDay || selectedDay.sets.length === 0) return;
    const order = getExerciseOrder(selectedDay.sets);
    const currentIndex = order.indexOf(exerciseId);
    const targetIndex = currentIndex + direction;
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];

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
  }, [selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder]);

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
  }, [draggingDayIndex, selectedWeek]);

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
  }, [draggingExerciseId, selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder]);

  const handleExerciseDropToEnd = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!selectedDay || !draggingExerciseId) return;
    const order = getExerciseOrder(selectedDay.sets);
    const fromIndex = order.indexOf(draggingExerciseId);
    if (fromIndex === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIndex, 1);
    nextOrder.push(draggingExerciseId);

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
  }, [draggingExerciseId, selectedDay, selectedWeek, selectedDayIndex, getExerciseOrder, rebuildSetsWithOrder]);

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
  }, [selectedWeek, selectedDayIndex, intensityMethod]);

  // Remove exercise (all sets for that exercise)
  const removeExercise = useCallback((exerciseId: string) => {
    if (selectedDayIndex === null) return;

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
  }, [selectedWeek, selectedDayIndex]);

  // Update sets for an exercise
  const updateExerciseSets = useCallback((exerciseId: string, newSets: SetTemplate[]) => {
    if (selectedDayIndex === null) return;

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
  }, [selectedWeek, selectedDayIndex, normalizeSets, replaceExerciseSets]);

  // Save program
  const handleSave = useCallback(() => {
    const program: ProgramTemplate = {
      id: draftProgramIdRef.current,
      name: programName,
      description,
      goal,
      experienceLevel,
      intensityMethod,
      daysPerWeek: Math.max(0, ...weeks.map(w => w.days.length)),
      weekCount: weeks.length,
      weeks,
      isCustom: true,
    };

    onSave(program);
  }, [programName, description, goal, experienceLevel, intensityMethod, weeks, onSave]);

  // Auto-save to cloud every 2 seconds when changes are made
  useEffect(() => {
    // Skip auto-save if no program name or no user
    if (!programName.trim() || !userId) {
      return;
    }

    // Build current program state
    const program: ProgramTemplate = {
      id: draftProgramIdRef.current,
      name: programName,
      description,
      goal,
      experienceLevel,
      intensityMethod,
      daysPerWeek: Math.max(0, ...weeks.map(w => w.days.length)),
      weekCount: weeks.length,
      weeks,
      isCustom: true,
    };

    // Debounced auto-save (2 second delay)
    autoSaveProgram(program, userId, 2000);
  }, [programName, description, goal, experienceLevel, intensityMethod, weeks, userId]);

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

  return (
    <div className="min-h-screen safe-top bg-gradient-to-br from-zinc-50 via-purple-50/30 to-zinc-100 dark:from-zinc-950 dark:via-purple-950/10 dark:to-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-purple-900 to-purple-700 p-6 sm:p-8 shadow-2xl border border-white/10 dark:border-purple-900/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide">
                Builder
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">
                  {existingProgram ? 'Edit Program' : 'Create New Program'}
                </h1>
                <p className="mt-1 text-sm sm:text-base text-purple-100/90">
                  Craft weeks, days, and sets with a clean, mobile-ready workflow.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={onCancel}
                className="w-full sm:w-auto rounded-xl border-2 border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition-all hover:bg-white/20 hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!programName || weeks.length === 0}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
              >
                Save Program
              </button>
            </div>
          </div>
        </div>

        {/* Program Metadata */}
        <div className="mb-8 rounded-3xl bg-white/90 p-6 sm:p-8 shadow-xl ring-1 ring-zinc-100 dark:bg-zinc-900/90 dark:ring-zinc-800 backdrop-blur">
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
                onChange={e => setProgramName(e.target.value)}
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
                onChange={e => setGoal(e.target.value as ProgramTemplate['goal'])}
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
                onChange={e => setExperienceLevel(e.target.value as ProgramTemplate['experienceLevel'])}
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
                onChange={e => setIntensityMethod(e.target.value as ProgramTemplate['intensityMethod'])}
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
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe this program's focus, methodology, and intended results..."
                rows={3}
                className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-inner focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
          </div>
        </div>

        {/* Week Management */}
        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
              Program Structure
            </h2>
            <button
              onClick={addWeek}
              className="rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-800 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900"
            >
              + Add Week
            </button>
          </div>

          {/* Week Tabs */}
          <div className="rounded-2xl bg-white/80 p-3 shadow-inner ring-1 ring-zinc-100 dark:bg-zinc-900/70 dark:ring-zinc-800">
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
              {weeks.map(week => (
                <div key={week.weekNumber} className="flex flex-shrink-0 items-center gap-2 snap-start">
                  <button
                    onClick={() => setSelectedWeek(week.weekNumber)}
                    className={`rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
                      selectedWeek === week.weekNumber
                        ? 'gradient-purple text-white shadow-glow-purple'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col leading-tight text-left">
                      <span className="text-xs uppercase tracking-wide opacity-80">Week</span>
                      <span className="text-base font-black">{week.weekNumber}</span>
                      <span className="text-[11px] font-semibold opacity-80">{week.days.length} day{week.days.length === 1 ? '' : 's'}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => duplicateWeek(week.weekNumber)}
                    className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 shadow-sm"
                    title="Duplicate week"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h9a2 2 0 0 1 2 2v9M8 7H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
                    </svg>
                  </button>
                  {weeks.length > 1 && (
                    <button
                      onClick={() => removeWeek(week.weekNumber)}
                      className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700 shadow-sm"
                      title="Remove week"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Day Management */}
        {currentWeek && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Days List */}
            <div className="rounded-xl bg-white p-6 dark:bg-zinc-900 lg:col-span-1">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Training Days
              </h3>

              {/* Add Day Dropdown */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Add Training Day
                </label>
                <select
                  onChange={e => {
                    if (e.target.value) {
                      addDay(e.target.value as DayOfWeek);
                      e.target.value = '';
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

              {/* Day List */}
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
                        className={`group rounded-lg border-2 p-3 transition-colors ${
                          selectedDayIndex === idx
                            ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800'
                            : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'
                        } ${dragOverDayIndex === idx ? 'ring-2 ring-purple-400 border-purple-400' : ''}`}
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
                              className="rounded-lg bg-indigo-600 p-1 text-white opacity-0 transition-opacity hover:bg-indigo-700 group-hover:opacity-100"
                              title="Duplicate day"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h9a2 2 0 0 1 2 2v9M8 7H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeDay(idx)}
                              className="rounded-lg bg-red-600 p-1 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                              title="Remove day"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Day Editor */}
            <div className="rounded-xl bg-white p-6 dark:bg-zinc-900 lg:col-span-2">
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
                          {customExercisesLoading ? ' • syncing custom exercises' : ''}
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
                          className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg transition-all"
                        >
                          + Add Exercise
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Exercise List with ExerciseCard */}
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
                            className={dragOverExerciseId === exerciseId ? 'rounded-2xl ring-2 ring-purple-400' : ''}
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
            <div className="max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
