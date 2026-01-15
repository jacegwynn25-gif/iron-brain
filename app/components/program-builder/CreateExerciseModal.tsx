'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createCustomExercise } from '../../lib/exercises/custom-exercises';
import type { CustomExercise } from '../../lib/types';

interface CreateExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (exercise: CustomExercise) => void;
  initialName?: string;
  userId: string | null;
}

const MUSCLE_OPTIONS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Abs', 'Obliques', 'Lower Back', 'Traps', 'Lats', 'Rear Delts'
];

export default function CreateExerciseModal({
  isOpen,
  onClose,
  onCreate,
  initialName = '',
  userId,
}: CreateExerciseModalProps) {
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState<CustomExercise['equipment']>('barbell');
  const [exerciseType, setExerciseType] = useState<'compound' | 'isolation'>('isolation');
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [movementPattern, setMovementPattern] = useState<CustomExercise['movementPattern']>('push');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || primaryMuscles.length === 0) return;

    setLoading(true);
    try {
      const exercise = await createCustomExercise(userId, {
        name: name.trim(),
        equipment,
        exerciseType,
        primaryMuscles,
        secondaryMuscles,
        movementPattern,
        trackWeight: true,
        trackReps: true,
        trackTime: false,
        defaultRestSeconds,
      });

      onCreate(exercise);
      onClose();
    } catch (err) {
      console.error('Failed to create exercise:', err);
      alert('Failed to create exercise. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMuscle = (muscle: string, isPrimary: boolean) => {
    if (isPrimary) {
      setPrimaryMuscles(prev =>
        prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
      );
    } else {
      setSecondaryMuscles(prev =>
        prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-white">
            Create Custom Exercise
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Exercise Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cable Fly"
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Equipment *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other'] as const).map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setEquipment(eq)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-all active:scale-[0.98] ${
                    equipment === eq
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Exercise Type *
            </label>
            <div className="flex gap-2">
              {(['compound', 'isolation'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setExerciseType(type)}
                  className={`flex-1 rounded-lg px-4 py-2 font-semibold capitalize transition-all active:scale-[0.98] ${
                    exerciseType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Muscles */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Primary Muscles * (select 1-3)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_OPTIONS.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, true)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    primaryMuscles.includes(muscle)
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Muscles */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Secondary Muscles (optional)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_OPTIONS.filter(m => !primaryMuscles.includes(m)).map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, false)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    secondaryMuscles.includes(muscle)
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Movement Pattern */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Movement Pattern (optional)
            </label>
            <select
              value={movementPattern || ''}
              onChange={(e) => setMovementPattern(e.target.value as CustomExercise['movementPattern'])}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">None</option>
              <option value="push">Push</option>
              <option value="pull">Pull</option>
              <option value="squat">Squat</option>
              <option value="hinge">Hinge</option>
              <option value="carry">Carry</option>
              <option value="rotation">Rotation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Default Rest */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Default Rest Time (seconds)
            </label>
            <input
              type="number"
              value={defaultRestSeconds}
              onChange={(e) => setDefaultRestSeconds(parseInt(e.target.value) || 90)}
              min="0"
              step="15"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/10 px-6 py-3 font-semibold text-white transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || primaryMuscles.length === 0}
              className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
