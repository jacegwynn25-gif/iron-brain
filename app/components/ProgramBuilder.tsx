'use client';

import { useState, useCallback } from 'react';
import { ProgramTemplate, WeekTemplate, SetTemplate, Exercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';

interface ProgramBuilderProps {
  existingProgram?: ProgramTemplate;
  onSave: (program: ProgramTemplate) => void;
  onCancel: () => void;
}

type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProgramBuilder({ existingProgram, onSave, onCancel }: ProgramBuilderProps) {
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
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string | null>(null);
  const [selectedExerciseType, setSelectedExerciseType] = useState<Exercise['type'] | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');

  // Get current week
  const currentWeek = weeks.find(w => w.weekNumber === selectedWeek);
  const selectedDay = selectedDayIndex !== null ? currentWeek?.days[selectedDayIndex] : null;

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
  }, [weeks]);

  // Remove week
  const removeWeek = useCallback((weekNumber: number) => {
    setWeeks(prev => prev.filter(w => w.weekNumber !== weekNumber));
    if (selectedWeek === weekNumber) {
      setSelectedWeek(weeks[0]?.weekNumber || 1);
    }
  }, [selectedWeek, weeks]);

  // Add training day
  const addDay = useCallback((dayOfWeek: DayOfWeek) => {
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
  }, [selectedWeek]);

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
    if (selectedDayIndex === dayIndex) {
      setSelectedDayIndex(null);
    }
  }, [selectedWeek, selectedDayIndex]);

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

  // Add exercise to selected day
  const addExercise = useCallback((exercise: Exercise, numSets: number = 3) => {
    if (selectedDayIndex === null) return;

    const newSets: SetTemplate[] = [];
    for (let i = 1; i <= numSets; i++) {
      newSets.push({
        exerciseId: exercise.id,
        setIndex: i,
        prescribedReps: '8-10',
        targetRPE: 7,
        restSeconds: exercise.defaultRestSeconds || 90,
      });
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
                      sets: [...d.sets, ...newSets],
                    }
                  : d
              ),
            }
          : w
      )
    );

    setShowExerciseLibrary(false);
  }, [selectedWeek, selectedDayIndex]);

  // Quick add exercise handler
  const quickAddExercise = useCallback((exercise: Exercise) => {
    addExercise(exercise);
    setShowQuickAdd(false);
    setQuickAddSearch('');
  }, [addExercise]);

  // Remove exercise (all sets)
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

  // Update set
  const updateSet = useCallback((setIndex: number, updates: Partial<SetTemplate>) => {
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
                      sets: d.sets.map(s => (s.setIndex === setIndex ? { ...s, ...updates } : s)),
                    }
                  : d
              ),
            }
          : w
      )
    );
  }, [selectedWeek, selectedDayIndex]);

  // Save program
  const handleSave = useCallback(() => {
    const program: ProgramTemplate = {
      id: existingProgram?.id || `custom_${Date.now()}`,
      name: programName,
      description,
      goal,
      experienceLevel,
      intensityMethod,
      daysPerWeek: Math.max(...weeks.map(w => w.days.length)),
      weekCount: weeks.length,
      weeks,
    };

    onSave(program);
  }, [programName, description, goal, experienceLevel, intensityMethod, weeks, existingProgram, onSave]);

  // Filter exercises
  const filteredExercises = defaultExercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = !selectedMuscleFilter || ex.muscleGroups.includes(selectedMuscleFilter);
    const matchesType = !selectedExerciseType || ex.type === selectedExerciseType;
    return matchesSearch && matchesMuscle && matchesType;
  });

  // Quick add filtered exercises (top 5 matches)
  const quickAddExercises = defaultExercises
    .filter(ex => ex.name.toLowerCase().includes(quickAddSearch.toLowerCase()))
    .slice(0, 5);

  // Get all unique muscle groups
  const allMuscleGroups = Array.from(
    new Set(defaultExercises.flatMap(ex => ex.muscleGroups))
  ).sort();

  // Group sets by exercise
  const groupedSets = selectedDay?.sets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) {
      acc[set.exerciseId] = [];
    }
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<string, SetTemplate[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-purple-50/30 to-zinc-100 dark:from-zinc-950 dark:via-purple-950/10 dark:to-zinc-900">
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
                  currentWeek.days.map((day, idx) => (
                    <div
                      key={idx}
                      className={`group rounded-lg border-2 p-3 transition-colors ${
                        selectedDayIndex === idx
                          ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-800'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setSelectedDayIndex(idx)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            {day.dayOfWeek}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{day.name}</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                            {day.sets.length} sets
                          </p>
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
                  ))
                )}
              </div>
            </div>

            {/* Day Editor */}
            <div className="rounded-xl bg-white p-6 dark:bg-zinc-900 lg:col-span-2">
              {selectedDay ? (
                <>
                  <div className="mb-6">
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

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        Exercises
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowQuickAdd(!showQuickAdd)}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                            showQuickAdd
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50'
                          }`}
                        >
                          ⚡ Quick Add
                        </button>
                        <button
                          onClick={() => setShowExerciseLibrary(true)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-all"
                        >
                          + Browse All
                        </button>
                      </div>
                    </div>

                    {/* Quick Add Search Interface */}
                    {showQuickAdd && (
                      <div className="mb-4 animate-slideDown">
                        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 border-2 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800">
                          <div className="mb-3">
                            <input
                              type="text"
                              value={quickAddSearch}
                              onChange={e => setQuickAddSearch(e.target.value)}
                              placeholder="🔍 Type exercise name (e.g., 'bench', 'squat')..."
                              autoFocus
                              className="w-full rounded-lg border-2 border-purple-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-purple-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-purple-500"
                            />
                          </div>

                          {quickAddSearch.length > 0 && (
                            <div className="space-y-2">
                              {quickAddExercises.length > 0 ? (
                                <>
                                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">
                                    Top matches - click to add:
                                  </p>
                                  {quickAddExercises.map(exercise => (
                                    <button
                                      key={exercise.id}
                                      onClick={() => quickAddExercise(exercise)}
                                      className="w-full rounded-lg bg-white border border-purple-200 p-3 text-left transition-all hover:bg-purple-50 hover:border-purple-400 hover:scale-[1.02] active:scale-[0.98] dark:bg-zinc-800 dark:border-purple-800 dark:hover:bg-purple-900/30 group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                                            {exercise.name}
                                          </p>
                                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                                            {exercise.muscleGroups.join(', ')} • {exercise.type}
                                          </p>
                                        </div>
                                        <div className="text-purple-600 dark:text-purple-400 text-xl group-hover:scale-110 transition-transform">
                                          +
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </>
                              ) : (
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-3">
                                  No exercises found. Try a different search or browse all exercises.
                                </p>
                              )}
                            </div>
                          )}

                          {quickAddSearch.length === 0 && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 text-center">
                              Start typing to search for exercises...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exercise List */}
                  {Object.keys(groupedSets || {}).length === 0 ? (
                    <div className="rounded-lg bg-zinc-100 p-8 text-center dark:bg-zinc-800">
                      <p className="text-zinc-600 dark:text-zinc-400">
                        No exercises added yet. Click &quot;Add Exercise&quot; to get started!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupedSets!).map(([exerciseId, sets]) => {
                        const exercise = defaultExercises.find(ex => ex.id === exerciseId);
                        if (!exercise) return null;

                        return (
                          <div
                            key={exerciseId}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                {exercise.name}
                              </h4>
                              <button
                                onClick={() => removeExercise(exerciseId)}
                                className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700"
                                title="Remove exercise"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            {/* Set Editor - This is where the magic happens */}
                            <div className="space-y-2">
                              {sets.map(set => (
                                <div
                                  key={set.setIndex}
                                  className="grid grid-cols-5 gap-2 rounded-md bg-white p-2 dark:bg-zinc-900"
                                >
                                  <div className="flex items-center justify-center">
                                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                      Set {set.setIndex}
                                    </span>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                                      Reps
                                    </label>
                                    <input
                                      type="text"
                                      value={set.prescribedReps}
                                      onChange={e =>
                                        updateSet(set.setIndex, { prescribedReps: e.target.value })
                                      }
                                      placeholder="8-10"
                                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                                      RPE
                                    </label>
                                    <input
                                      type="number"
                                      value={set.targetRPE ?? ''}
                                      onChange={e =>
                                        updateSet(set.setIndex, {
                                          targetRPE: e.target.value ? parseFloat(e.target.value) : null,
                                        })
                                      }
                                      placeholder="7"
                                      min="0"
                                      max="10"
                                      step="0.5"
                                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                                      Rest (s)
                                    </label>
                                    <input
                                      type="number"
                                      value={set.restSeconds ?? ''}
                                      onChange={e =>
                                        updateSet(set.setIndex, {
                                          restSeconds: e.target.value ? parseInt(e.target.value) : undefined,
                                        })
                                      }
                                      placeholder="90"
                                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                                      Notes
                                    </label>
                                    <input
                                      type="text"
                                      value={set.notes ?? ''}
                                      onChange={e =>
                                        updateSet(set.setIndex, {
                                          notes: e.target.value || undefined,
                                        })
                                      }
                                      placeholder="paused"
                                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
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

        {/* Exercise Library Modal */}
        {showExerciseLibrary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-700">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Exercise Library
                </h2>
                <button
                  onClick={() => setShowExerciseLibrary(false)}
                  className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Filters */}
                <div className="mb-4 space-y-3">
                  <input
                    type="text"
                    value={exerciseSearch}
                    onChange={e => setExerciseSearch(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />

                  <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setSelectedExerciseType(null)}
                      className={`flex-shrink-0 rounded-lg px-3 py-1 text-xs font-medium ${
                        !selectedExerciseType
                          ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      All Types
                    </button>
                    {(['compound', 'accessory', 'isolation'] as Exercise['type'][]).map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedExerciseType(type)}
                        className={`flex-shrink-0 rounded-lg px-3 py-1 text-xs font-medium capitalize ${
                          selectedExerciseType === type
                            ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedMuscleFilter(null)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium ${
                        !selectedMuscleFilter
                          ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      All Muscles
                    </button>
                    {allMuscleGroups.slice(0, 10).map(muscle => (
                      <button
                        key={muscle}
                        onClick={() => setSelectedMuscleFilter(muscle)}
                        className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${
                          selectedMuscleFilter === muscle
                            ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {muscle}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exercise List */}
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {filteredExercises.map(exercise => (
                    <button
                      key={exercise.id}
                      onClick={() => addExercise(exercise)}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {exercise.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs capitalize dark:bg-zinc-700">
                          {exercise.type}
                        </span>
                        {exercise.muscleGroups.slice(0, 3).map(mg => (
                          <span
                            key={mg}
                            className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs capitalize dark:bg-zinc-700"
                          >
                            {mg}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
