'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { Exercise, CustomExercise, SetTemplate } from '../../lib/types';
import SetEditor from './SetEditor';

interface ExerciseCardProps {
  exercise: Exercise | CustomExercise;
  sets: SetTemplate[];
  onSetsChange: (sets: SetTemplate[]) => void;
  onRemoveExercise: () => void;
  userId: string | null;
}

export default function ExerciseCard({
  exercise,
  sets,
  onSetsChange,
  onRemoveExercise,
  userId,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(true);

  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet: SetTemplate = {
      exerciseId: exercise.id,
      setIndex: sets.length,
      prescribedReps: lastSet?.prescribedReps || '5',
      minReps: lastSet?.minReps,
      maxReps: lastSet?.maxReps,
      prescriptionMethod: lastSet?.prescriptionMethod || 'rpe',
      targetRPE: lastSet?.targetRPE || 8,
      targetRIR: lastSet?.targetRIR,
      targetPercentage: lastSet?.targetPercentage,
      fixedWeight: lastSet?.fixedWeight,
      targetSeconds: lastSet?.targetSeconds,
      tempo: lastSet?.tempo,
      restSeconds: lastSet?.restSeconds || 90,
      setType: lastSet?.setType || 'straight',
      notes: lastSet?.notes,
    };

    onSetsChange([...sets, newSet]);
  };

  const handleRemoveSet = (index: number) => {
    if (sets.length <= 1) {
      alert('Exercise must have at least one set');
      return;
    }

    const updatedSets = sets
      .filter((_, i) => i !== index)
      .map((set, i) => ({ ...set, setIndex: i }));

    onSetsChange(updatedSets);
  };

  const handleSetChange = (index: number, updatedSet: SetTemplate) => {
    const updatedSets = sets.map((set, i) => (i === index ? updatedSet : set));
    onSetsChange(updatedSets);
  };

  // Get exercise type label (handle both Exercise and CustomExercise)
  const exerciseType = 'exerciseType' in exercise ? exercise.exerciseType : exercise.type;

  // Get muscle groups (handle both Exercise and CustomExercise)
  const muscles = 'primaryMuscles' in exercise
    ? exercise.primaryMuscles.join(', ')
    : exercise.muscleGroups.join(', ');

  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start gap-3 flex-1">
          <button className="mt-1 cursor-grab text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
              {exercise.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="capitalize">{exerciseType}</span>
              {' • '}
              {muscles}
            </p>
            <p className="mt-1 text-xs font-bold text-purple-600 dark:text-purple-400">
              {sets.length} {sets.length === 1 ? 'set' : 'sets'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {expanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={onRemoveExercise}
            className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Sets */}
      {expanded && (
        <div className="p-4 space-y-4">
          {sets.map((set, index) => (
            <div key={index} className="relative">
              {/* Set Number & Delete */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  Set {index + 1}
                </h4>
                <button
                  onClick={() => handleRemoveSet(index)}
                  disabled={sets.length === 1}
                  className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title={sets.length === 1 ? 'Exercise must have at least one set' : 'Remove set'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Set Editor */}
              <SetEditor
                setData={set}
                onChange={(updated) => handleSetChange(index, updated)}
                exerciseId={exercise.id}
                userId={userId}
              />
            </div>
          ))}

          {/* Add Set Button */}
          <button
            onClick={handleAddSet}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 font-bold text-zinc-600 transition-all hover:border-purple-500 hover:bg-purple-50 hover:text-purple-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-purple-500 dark:hover:bg-purple-900/20 dark:hover:text-purple-400"
          >
            <Plus className="h-5 w-5" />
            Add Set
          </button>
        </div>
      )}
    </div>
  );
}
