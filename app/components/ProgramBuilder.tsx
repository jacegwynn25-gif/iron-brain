'use client';

import { useState, useCallback } from 'react';
import { ProgramTemplate, WeekTemplate, SetTemplate, Exercise, CustomExercise } from '../lib/types';
import { defaultExercises } from '../lib/programs';
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

  // Add exercise to selected day (starts with 1 set instead of 3!)
  const addExercise = useCallback((exercise: Exercise | CustomExercise) => {
    if (selectedDayIndex === null) return;

    // Create initial set with default prescription method (rpe)
    const newSet: SetTemplate = {
      exerciseId: exercise.id,
      setIndex: 0, // Will be renumbered when grouped
      prescribedReps: '8',
      prescriptionMethod: 'rpe',
      targetRPE: 8,
      restSeconds: ('defaultRestSeconds' in exercise ? exercise.defaultRestSeconds : exercise.defaultRestSeconds) || 90,
      setType: 'straight',
    };

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
  }, [selectedWeek, selectedDayIndex]);

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
                      sets: [
                        ...d.sets.filter(s => s.exerciseId !== exerciseId),
                        ...newSets,
                      ],
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
                          <ExerciseCard
                            key={exerciseId}
                            exercise={exercise}
                            sets={sets}
                            onSetsChange={(newSets) => updateExerciseSets(exerciseId, newSets)}
                            onRemoveExercise={() => removeExercise(exerciseId)}
                            userId={userId}
                          />
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
            <div className="max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-800">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  1RM Management
                </h2>
                <button
                  onClick={() => setShowMaxesManager(false)}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
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
