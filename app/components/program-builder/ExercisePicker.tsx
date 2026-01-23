'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { defaultExercises } from '../../lib/programs';
import { getCustomExercises } from '../../lib/exercises/custom-exercises';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white">
              Select Exercise
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-6 pb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search exercises..."
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Create Button */}
          {showCreateButton && (
            <div className="px-6 pb-4">
              <button
                onClick={handleCreateClick}
                className="w-full flex items-center justify-center gap-2 rounded-xl btn-primary px-4 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
                Create &quot;{searchTerm}&quot; as custom exercise
              </button>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {totalResults === 0 ? (
              <div className="text-center py-8 text-gray-400">
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
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-300 mb-3">
                      Your Exercises ({customMatches.length})
                    </h3>
                    <div className="space-y-2">
                      {customMatches.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleSelect(exercise)}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                        >
                          <div className="font-semibold text-white">
                            {exercise.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-400">
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
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                    Loading your custom exercises...
                  </div>
                )}

                {/* System Exercises Section */}
                {systemMatches.length > 0 && (
                  <div>
                    {customMatches.length > 0 && (
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                        Built-in Exercises ({systemMatches.length})
                      </h3>
                    )}
                    <div className="space-y-2">
                      {systemMatches.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleSelect(exercise)}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                        >
                          <div className="font-semibold text-white">
                            {exercise.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-400">
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
