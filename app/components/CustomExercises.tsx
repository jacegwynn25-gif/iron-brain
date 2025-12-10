'use client';

import { useRef, useState } from 'react';
import { Exercise } from '../lib/types';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps', 'lats'];
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band'];

export default function CustomExercises() {
  const [customExercises, setCustomExercises] = useState<Exercise[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('iron_brain_custom_exercises');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'compound' | 'accessory' | 'isolation'>('compound');
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  const customExerciseIdCounter = useRef(customExercises.length + 1);

  const saveCustomExercises = (exercises: Exercise[]) => {
    localStorage.setItem('iron_brain_custom_exercises', JSON.stringify(exercises));
    setCustomExercises(exercises);
  };

  const resetForm = () => {
    setName('');
    setType('compound');
    setMuscleGroups([]);
    setEquipment([]);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!name.trim() || muscleGroups.length === 0) {
      alert('Please provide a name and select at least one muscle group');
      return;
    }

    const id = `custom_${customExerciseIdCounter.current++}`;
    const newExercise: Exercise = {
      id,
      name: name.trim(),
      type,
      muscleGroups,
      equipment,
      defaultRestSeconds: type === 'compound' ? 180 : 90,
    };

    const updated = [...customExercises, newExercise];
    saveCustomExercises(updated);
    resetForm();
    setIsCreating(false);
  };

  const handleUpdate = () => {
    if (!editingId || !name.trim() || muscleGroups.length === 0) {
      alert('Please provide a name and select at least one muscle group');
      return;
    }

    const updated = customExercises.map(ex =>
      ex.id === editingId
        ? { ...ex, name: name.trim(), type, muscleGroups, equipment }
        : ex
    );
    saveCustomExercises(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this custom exercise?')) return;
    const updated = customExercises.filter(ex => ex.id !== id);
    saveCustomExercises(updated);
  };

  const toggleMuscle = (m: string) => {
    setMuscleGroups(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const toggleEquipment = (eq: string) => {
    setEquipment(prev => prev.includes(eq) ? prev.filter(x => x !== eq) : [...prev, eq]);
  };

  const startEdit = (exercise: Exercise) => {
    setName(exercise.name);
    setType(exercise.type);
    setMuscleGroups(exercise.muscleGroups);
    setEquipment(exercise.equipment || []);
    setEditingId(exercise.id);
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Custom Exercises</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Create and manage your own movements</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Exercise
        </button>
      </div>

      {isCreating && (
        <div className="space-y-4 rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="e.g., Landmine Press"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Type *</label>
            <div className="flex gap-3">
              {(['compound', 'accessory'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border-2 px-4 py-2 font-semibold ${
                    type === t
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {t === 'compound' ? 'Compound' : 'Accessory'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Muscle Groups *</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMuscle(m)}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold capitalize ${
                    muscleGroups.includes(m)
                      ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Equipment (optional)</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map(eq => (
                <button
                  key={eq}
                  onClick={() => toggleEquipment(eq)}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold capitalize ${
                    equipment.includes(eq)
                      ? 'bg-purple-600 text-white dark:bg-purple-400 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
            >
              {editingId ? 'Update Exercise' : 'Create Exercise'}
            </button>
            <button
              onClick={() => { resetForm(); setIsCreating(false); }}
              className="rounded-lg bg-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Your Custom Exercises ({customExercises.length})
        </h3>
        {customExercises.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No custom exercises yet.</p>
        ) : (
          <div className="space-y-3">
            {customExercises.map(exercise => (
              <div key={exercise.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{exercise.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">{exercise.type}</span>
                    {exercise.muscleGroups.map(m => (
                      <span key={m} className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 capitalize">{m}</span>
                    ))}
                    {exercise.equipment?.map(eq => (
                      <span key={eq} className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100 capitalize">{eq}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(exercise)}
                    className="rounded-lg bg-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(exercise.id)}
                    className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
