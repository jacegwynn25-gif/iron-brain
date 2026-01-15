'use client';

import { useEffect, useState, type DragEvent } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import type { Exercise, CustomExercise, SetTemplate, SetType } from '../../lib/types';
import SetEditor from './SetEditor';

interface ExerciseCardProps {
  exercise: Exercise | CustomExercise;
  sets: SetTemplate[];
  onSetsChange: (sets: SetTemplate[]) => void;
  onRemoveExercise: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  userId: string | null;
}

export default function ExerciseCard({
  exercise,
  sets,
  onSetsChange,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  isFirst,
  isLast,
  userId,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkReps, setBulkReps] = useState('');
  const [bulkRestSeconds, setBulkRestSeconds] = useState('');
  const [bulkTempo, setBulkTempo] = useState('');
  const [bulkSetType, setBulkSetType] = useState<SetType>('straight');
  const [bulkSupersetGroup, setBulkSupersetGroup] = useState('A');

  useEffect(() => {
    if (!showBulkEdit) return;
    const lastSet = sets[sets.length - 1];
    setBulkReps(lastSet?.prescribedReps ?? '');
    setBulkRestSeconds(String(lastSet?.restSeconds ?? 90));
    setBulkTempo(lastSet?.tempo ?? '');
    setBulkSetType(lastSet?.setType || 'straight');
    setBulkSupersetGroup(lastSet?.supersetGroup || 'A');
  }, [showBulkEdit, sets]);

  const parseRepsInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return { prescribedReps: null as string | null, minReps: undefined, maxReps: undefined };
    }

    if (trimmed.toLowerCase() === 'amrap') {
      return { prescribedReps: 'AMRAP', minReps: undefined, maxReps: undefined };
    }

    if (trimmed.includes('-')) {
      const [minRaw, maxRaw] = trimmed.split('-');
      const min = parseInt(minRaw.trim(), 10);
      const max = parseInt(maxRaw.trim(), 10);
      if (!isNaN(min) && !isNaN(max)) {
        return { prescribedReps: trimmed, minReps: min, maxReps: max };
      }
    }

    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      return { prescribedReps: trimmed, minReps: undefined, maxReps: undefined };
    }

    return { prescribedReps: trimmed, minReps: undefined, maxReps: undefined };
  };

  const applyBulkEdits = () => {
    const repsValue = bulkReps.trim();
    const restValue = bulkRestSeconds.trim();
    const tempoValue = bulkTempo.trim();
    const restParsed = restValue === '' ? null : parseInt(restValue, 10);
    const parsedReps = parseRepsInput(repsValue);
    const supersetGroup = bulkSupersetGroup.trim().toUpperCase() || 'A';

    const nextSets = sets.map(set => ({
      ...set,
      prescribedReps: repsValue ? parsedReps.prescribedReps || set.prescribedReps : set.prescribedReps,
      minReps: repsValue ? parsedReps.minReps : set.minReps,
      maxReps: repsValue ? parsedReps.maxReps : set.maxReps,
      restSeconds: restParsed === null || Number.isNaN(restParsed) ? set.restSeconds : restParsed,
      tempo: tempoValue ? tempoValue : undefined,
      setType: bulkSetType,
      supersetGroup: bulkSetType === 'superset' ? supersetGroup : undefined,
    }));

    onSetsChange(nextSets);
  };

  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    const newSet: SetTemplate = {
      exerciseId: exercise.id,
      setIndex: sets.length + 1,
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
      supersetGroup: lastSet?.supersetGroup,
      dropSetWeights: lastSet?.dropSetWeights,
      restPauseRounds: lastSet?.restPauseRounds,
      clusterReps: lastSet?.clusterReps,
      clusterRestSeconds: lastSet?.clusterRestSeconds,
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
      .map((set, i) => ({ ...set, setIndex: i + 1 }));

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
          {onDragStart && (
            <button
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className="cursor-grab rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Drag to reorder exercise"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              title="Move exercise up"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              title="Move exercise down"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
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
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  Apply to all sets
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  Update reps, rest, tempo, and set type in one action.
                </p>
              </div>
              <button
                onClick={() => setShowBulkEdit(prev => !prev)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/30"
              >
                {showBulkEdit ? 'Hide' : 'Show'}
              </button>
            </div>

            {showBulkEdit && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Reps
                  </label>
                  <input
                    type="text"
                    value={bulkReps}
                    onChange={(e) => setBulkReps(e.target.value)}
                    placeholder="e.g., 5 or 8-10"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Rest (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={bulkRestSeconds}
                    onChange={(e) => setBulkRestSeconds(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Tempo
                  </label>
                  <input
                    type="text"
                    value={bulkTempo}
                    onChange={(e) => setBulkTempo(e.target.value)}
                    placeholder="e.g., 3-0-1-0"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Set Type
                  </label>
                  <select
                    value={bulkSetType}
                    onChange={(e) => setBulkSetType(e.target.value as SetType)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    {[
                      'straight',
                      'warmup',
                      'superset',
                      'giant',
                      'drop',
                      'rest-pause',
                      'cluster',
                      'amrap',
                      'backoff',
                    ].map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                {bulkSetType === 'superset' && (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      Superset Group
                    </label>
                    <input
                      type="text"
                      value={bulkSupersetGroup}
                      onChange={(e) => setBulkSupersetGroup(e.target.value)}
                      maxLength={3}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={applyBulkEdits}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-purple-700"
                  >
                    Apply to All Sets
                  </button>
                </div>
              </div>
            )}
          </div>

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
