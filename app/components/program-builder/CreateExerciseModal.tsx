'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createCustomExercise } from '../../lib/exercises/custom-exercises';
import { inferCustomExerciseDefaults } from '../../lib/exercises/catalog';
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

const EMPTY_MANUAL_FIELDS = {
  equipment: false,
  exerciseType: false,
  primaryMuscles: false,
  secondaryMuscles: false,
  movementPattern: false,
  defaultRestSeconds: false,
};

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
  const [manualFields, setManualFields] = useState(EMPTY_MANUAL_FIELDS);

  useEffect(() => {
    if (!isOpen) return;
    setManualFields(EMPTY_MANUAL_FIELDS);
  }, [isOpen, initialName]);

  // Sync name with initialName when it changes
  useEffect(() => {
    if (initialName) {
      setName(initialName);
    }
  }, [initialName]);

  useEffect(() => {
    if (!isOpen || !name.trim()) return;

    const inferred = inferCustomExerciseDefaults(name);
    if (!manualFields.equipment) setEquipment(inferred.equipment);
    if (!manualFields.exerciseType) setExerciseType(inferred.exerciseType);
    if (!manualFields.primaryMuscles) setPrimaryMuscles(inferred.primaryMuscles);
    if (!manualFields.secondaryMuscles) setSecondaryMuscles(inferred.secondaryMuscles);
    if (!manualFields.movementPattern) setMovementPattern(inferred.movementPattern);
    if (!manualFields.defaultRestSeconds) setDefaultRestSeconds(inferred.defaultRestSeconds);
  }, [isOpen, manualFields, name]);

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
      const now = new Date().toISOString();
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallback: CustomExercise = {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: userId || 'local',
        name: name.trim(),
        slug,
        equipment,
        exerciseType,
        primaryMuscles,
        secondaryMuscles,
        movementPattern,
        trackWeight: true,
        trackReps: true,
        trackTime: false,
        defaultRestSeconds,
        createdAt: now,
        updatedAt: now,
      };
      try {
        const key = `iron_brain_custom_exercises__${userId || 'guest'}`;
        const stored = localStorage.getItem(key);
        const existing = stored ? JSON.parse(stored) : [];
        localStorage.setItem(key, JSON.stringify([fallback, ...existing]));
      } catch (storageError) {
        console.error('Failed to persist fallback exercise:', storageError);
      }
      onCreate(fallback);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const toggleMuscle = (muscle: string, isPrimary: boolean) => {
    if (isPrimary) {
      setManualFields((prev) => ({ ...prev, primaryMuscles: true }));
      setPrimaryMuscles(prev =>
        prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
      );
    } else {
      setManualFields((prev) => ({ ...prev, secondaryMuscles: true }));
      setSecondaryMuscles(prev =>
        prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="liquid-sheet-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#0b0d12]/95 p-5 sm:p-6">
          <h2 className="text-2xl font-black italic tracking-tight text-zinc-100">
            CREATE EXERCISE
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="liquid-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
          {/* Name */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Exercise Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cable Fly"
              required
              className="liquid-field w-full px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Equipment */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Equipment *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other'] as const).map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => {
                    setManualFields((prev) => ({ ...prev, equipment: true }));
                    setEquipment(eq);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                    equipment === eq
                      ? 'border border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border border-white/8 bg-white/[0.035] text-zinc-400 hover:border-white/14 hover:text-zinc-100'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Type */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Exercise Type *
            </label>
            <div className="flex gap-2">
              {(['compound', 'isolation'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setManualFields((prev) => ({ ...prev, exerciseType: true }));
                    setExerciseType(type);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 font-semibold capitalize transition-colors ${
                    exerciseType === type
                      ? 'border border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border border-white/8 bg-white/[0.035] text-zinc-400 hover:border-white/14 hover:text-zinc-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Muscles */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Primary Muscles * (select 1-3)
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MUSCLE_OPTIONS.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, true)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    primaryMuscles.includes(muscle)
                      ? 'border border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border border-white/8 bg-white/[0.035] text-zinc-400 hover:border-white/14 hover:text-zinc-100'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Muscles */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Secondary Muscles (optional)
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MUSCLE_OPTIONS.filter(m => !primaryMuscles.includes(m)).map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle, false)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    secondaryMuscles.includes(muscle)
                      ? 'border border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border border-white/8 bg-white/[0.035] text-zinc-400 hover:border-white/14 hover:text-zinc-100'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Movement Pattern */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Movement Pattern (optional)
            </label>
            <select
              value={movementPattern || ''}
              onChange={(e) => {
                setManualFields((prev) => ({ ...prev, movementPattern: true }));
                setMovementPattern(e.target.value as CustomExercise['movementPattern']);
              }}
              className="liquid-field w-full px-4 py-2.5 text-sm text-zinc-100"
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
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Default Rest Time (seconds)
            </label>
            <input
              type="number"
              value={defaultRestSeconds}
              onChange={(e) => {
                setManualFields((prev) => ({ ...prev, defaultRestSeconds: true }));
                setDefaultRestSeconds(parseInt(e.target.value) || 90);
              }}
              min="0"
              step="15"
              className="liquid-field w-full px-4 py-2.5 text-sm text-zinc-100"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="liquid-icon-button min-h-12 flex-1 rounded-[1.05rem] px-5 text-[11px] font-black italic tracking-tight text-zinc-300 transition-colors hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || primaryMuscles.length === 0}
              className="liquid-action-button min-h-12 flex-1 rounded-[1.05rem] px-5 text-[11px] font-black italic tracking-tight text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
