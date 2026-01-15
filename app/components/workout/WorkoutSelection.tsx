'use client';

import { useState } from 'react';
import { ChevronRight, Check, Plus } from 'lucide-react';
import type { SetTemplate } from '../../lib/types';

interface WorkoutSelectionProps {
  programName: string;
  workoutName?: string;
  isNameEditable?: boolean;
  onRenameWorkout?: (name: string) => void;
  exercises: Array<{
    id: string;
    exerciseId: string;
    name: string;
    sets: SetTemplate[];
    completedSets: number;
    isCompleted: boolean;
  }>;
  onSelectExercise: (instanceId: string) => void;
  onAddExercise: () => void;
  onFinishWorkout: () => void;
  onReorder: (newOrder: string[]) => void;
}

export default function WorkoutSelection({
  programName,
  workoutName,
  isNameEditable = false,
  onRenameWorkout,
  exercises,
  onSelectExercise,
  onAddExercise,
  onFinishWorkout,
  onReorder,
}: WorkoutSelectionProps) {
  const activeExercises = exercises.filter((ex) => !ex.isCompleted);
  const completedExercises = exercises.filter((ex) => ex.isCompleted);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const reordered = Array.from(activeExercises);
    const fromIndex = reordered.findIndex((entry) => entry.id === draggedId);
    const toIndex = reordered.findIndex((entry) => entry.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onReorder(reordered.map((entry) => entry.id));
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top pb-32">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8">
          {isNameEditable ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Workout Name
              </label>
              <input
                value={workoutName ?? ''}
                onChange={(event) => onRenameWorkout?.(event.target.value)}
                placeholder="Quick Workout"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-white mb-1">{programName}</h1>
          )}
          <p className="text-gray-400 text-sm">
            {completedExercises.length}/{exercises.length} exercises complete
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Up Next
          </h2>
          <div className="space-y-3">
            {activeExercises.map((ex, index) => (
              <div
                key={ex.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(ex.id)}
                onDragEnter={() => setDragOverId(ex.id)}
                onDragLeave={() => setDragOverId((prev) => (prev === ex.id ? null : prev))}
                className={`flex items-center gap-2 rounded-2xl border p-2 pr-3 transition-all ${
                  dragOverId === ex.id
                    ? 'border-purple-500/60 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <button
                  draggable
                  onClick={() => onSelectExercise(ex.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggedId(ex.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className="flex-1 rounded-xl px-2 py-2 text-left transition-all active:scale-[0.98] cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-400 border border-white/10">
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white">{ex.name}</h3>
                      <p className="text-xs text-gray-400">
                        {ex.completedSets}/{ex.sets.length} sets done
                      </p>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {ex.completedSets > 0 && (
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
              </div>
            ))}
          </div>

          {activeExercises.length === 0 && completedExercises.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No exercises added yet.
            </div>
          )}
        </div>

        {completedExercises.length > 0 && (
          <div className="space-y-3 mb-8 opacity-60">
            <h2 className="text-sm font-semibold text-emerald-500/80 uppercase tracking-wider mb-2">
              Completed
            </h2>
            {completedExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelectExercise(ex.id)}
                className="w-full bg-zinc-900 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-300 line-through">{ex.name}</h3>
                    <p className="text-xs text-emerald-500/80">
                      All {ex.sets.length} sets done
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onAddExercise}
          className="w-full py-3 rounded-xl border border-dashed border-white/20 text-gray-400 font-medium hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent safe-bottom">
        <button
          onClick={onFinishWorkout}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-500 rounded-2xl text-white font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
        >
          Finish Workout
        </button>
      </div>
    </div>
  );
}
