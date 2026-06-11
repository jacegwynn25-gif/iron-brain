'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { defaultExercises } from '../../lib/programs';
import { getCustomExercises, getLocalCustomExercises } from '../../lib/exercises/custom-exercises';
import type { Exercise, CustomExercise } from '../../lib/types';
import CreateExerciseModal from './CreateExerciseModal';

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise | CustomExercise) => void;
  userId: string | null;
}

export default function ExercisePicker({
  isOpen,
  onClose,
  onSelect,
  userId,
}: ExercisePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Load custom exercises on mount
  useEffect(() => {
    if (!isOpen) return;

    setCustomExercises(getLocalCustomExercises());
    setLoadingCustom(true);
    getCustomExercises(userId)
      .then(exercises => {
        setCustomExercises(exercises);
        setLoadingCustom(false);
      })
      .catch(err => {
        console.error('Failed to load custom exercises:', err);
        setLoadingCustom(false);
      });
  }, [userId, isOpen]);

  // Filter and group exercises
  const { systemMatches, customMatches, hasExactMatch } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      return {
        systemMatches: defaultExercises,
        customMatches: customExercises,
        hasExactMatch: false,
      };
    }

    const systemFiltered = defaultExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      ex.muscleGroups.some(mg => mg.toLowerCase().includes(term)) ||
      ex.equipment?.some(eq => eq.toLowerCase().includes(term))
    );

    const customFiltered = customExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(term)) ||
      ex.secondaryMuscles.some(m => m.toLowerCase().includes(term)) ||
      ex.equipment.toLowerCase().includes(term)
    );

    // Check if any exercise name is an exact match
    const exactMatch = [...systemFiltered, ...customFiltered].some(
      ex => ex.name.toLowerCase() === term
    );

    return {
      systemMatches: systemFiltered,
      customMatches: customFiltered,
      hasExactMatch: exactMatch,
    };
  }, [searchTerm, customExercises]);

  const handleSelect = (exercise: Exercise | CustomExercise) => {
    onSelect(exercise);
    onClose();
    setSearchTerm('');
  };

  const handleCreateClick = () => {
    setShowCreateModal(true);
  };

  const handleExerciseCreated = (exercise: CustomExercise) => {
    setCustomExercises(prev => [...prev, exercise]);
    setShowCreateModal(false);
    handleSelect(exercise);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  if (!isOpen) return null;

  const showCreateButton = searchTerm.trim() && !hasExactMatch;
  const totalResults = systemMatches.length + customMatches.length;

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
        <div className="liquid-sheet-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 p-5 sm:p-6">
            <h2 className="text-2xl font-black italic tracking-tight text-zinc-100">
              SELECT EXERCISE
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="liquid-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-5 pb-4 sm:p-6 sm:pb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search exercises..."
                autoFocus
                className="liquid-field w-full py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Create Button */}
          {showCreateButton && (
            <div className="px-5 pb-4 sm:px-6">
              <button
                type="button"
                onClick={handleCreateClick}
                className="liquid-action-button flex min-h-11 w-full items-center justify-center gap-2 rounded-[1.05rem] px-4 text-[11px] font-black italic tracking-tight text-zinc-950"
              >
                <Plus className="h-4 w-4" />
                Create &quot;{searchTerm}&quot; as custom exercise
              </button>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
            {totalResults === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {loadingCustom
                  ? 'Loading exercises...'
                  : searchTerm
                    ? 'No exercises found. Try creating a custom exercise!'
                    : 'No exercises available.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Custom Exercises Section */}
                {customMatches.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      Your Exercises ({customMatches.length})
                    </h3>
                    <div className="space-y-2">
                      {customMatches.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleSelect(exercise)}
                          className="w-full border-t border-white/8 py-4 text-left transition-colors hover:text-zinc-100"
                        >
                          <div className="font-semibold text-zinc-100">
                            {exercise.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500">
                            <span className="capitalize">{exercise.equipment}</span>
                            <span>•</span>
                            <span className="capitalize">{exercise.exerciseType}</span>
                            <span>•</span>
                            <span>{exercise.primaryMuscles.join(', ')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {loadingCustom && customMatches.length === 0 && (
                  <div className="border-y border-white/8 py-3 text-xs text-zinc-500">
                    Loading your custom exercises...
                  </div>
                )}

                {/* System Exercises Section */}
                {systemMatches.length > 0 && (
                  <div>
                    {customMatches.length > 0 && (
                      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Built-in Exercises ({systemMatches.length})
                      </h3>
                    )}
                    <div className="space-y-2">
                      {systemMatches.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleSelect(exercise)}
                          className="w-full border-t border-white/8 py-4 text-left transition-colors hover:text-zinc-100"
                        >
                          <div className="font-semibold text-zinc-100">
                            {exercise.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-500">
                            {exercise.equipment && (
                              <>
                                <span className="capitalize">{exercise.equipment.join(', ')}</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="capitalize">{exercise.type}</span>
                            <span>•</span>
                            <span>{exercise.muscleGroups.join(', ')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Exercise Modal */}
      <CreateExerciseModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onCreate={handleExerciseCreated}
        initialName={searchTerm}
        userId={userId}
      />
    </>
  );
}
