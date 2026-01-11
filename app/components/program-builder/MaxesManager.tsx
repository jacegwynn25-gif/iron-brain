'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { getUserMaxes, saveUserMax, deleteUserMax, isMaxStale } from '../../lib/maxes/maxes-service';
import type { UserMax } from '../../lib/types';
import ExercisePicker from './ExercisePicker';
import type { Exercise, CustomExercise } from '../../lib/types';

interface MaxesManagerProps {
  userId: string | null;
}

export default function MaxesManager({ userId }: MaxesManagerProps) {
  const [maxes, setMaxes] = useState<UserMax[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMax, setEditingMax] = useState<UserMax | null>(null);

  // Form state for add/edit
  const [selectedExercise, setSelectedExercise] = useState<(Exercise | CustomExercise) | null>(null);
  const [weight, setWeight] = useState(135);
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedOrTested, setEstimatedOrTested] = useState<'tested' | 'estimated'>('tested');
  const [notes, setNotes] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load maxes
  useEffect(() => {
    loadMaxes();
  }, [userId]);

  const loadMaxes = async () => {
    setLoading(true);
    try {
      const data = await getUserMaxes(userId);
      setMaxes(data);
    } catch (err) {
      console.error('Failed to load maxes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingMax(null);
    setSelectedExercise(null);
    setWeight(135);
    setUnit('lbs');
    setTestedAt(new Date().toISOString().split('T')[0]);
    setEstimatedOrTested('tested');
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (max: UserMax) => {
    setEditingMax(max);
    setSelectedExercise({ id: max.exerciseId, name: max.exerciseName } as any);
    setWeight(max.weight);
    setUnit(max.unit);
    setTestedAt(max.testedAt.split('T')[0]);
    setEstimatedOrTested(max.estimatedOrTested);
    setNotes(max.notes || '');
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingMax(null);
    setSelectedExercise(null);
  };

  const handleSaveMax = async () => {
    if (!selectedExercise || weight <= 0) {
      alert('Please select an exercise and enter a valid weight');
      return;
    }

    setSaving(true);
    try {
      await saveUserMax(userId, {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        weight,
        unit,
        testedAt,
        estimatedOrTested,
        notes,
      });

      await loadMaxes();
      handleCloseModal();
    } catch (err) {
      console.error('Failed to save max:', err);
      alert('Failed to save max. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMax = async (maxId: string) => {
    if (!confirm('Are you sure you want to delete this 1RM?')) return;

    try {
      await deleteUserMax(userId, maxId);
      await loadMaxes();
    } catch (err) {
      console.error('Failed to delete max:', err);
      alert('Failed to delete max. Please try again.');
    }
  };

  const handleExerciseSelect = (exercise: Exercise | CustomExercise) => {
    setSelectedExercise(exercise);
    setShowExercisePicker(false);
  };

  // Filter maxes
  const filteredMaxes = maxes.filter(max =>
    max.exerciseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            1RM Management
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Track your one-rep maxes for percentage-based training
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Add Max
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search exercises..."
          className="w-full rounded-lg border border-zinc-300 bg-white pl-12 pr-4 py-3 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      {/* Maxes List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading...</div>
      ) : filteredMaxes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-zinc-300 rounded-xl dark:border-zinc-700">
          <TrendingUp className="h-12 w-12 mx-auto text-zinc-400 mb-3" />
          <p className="text-zinc-600 dark:text-zinc-400">
            {searchTerm
              ? 'No maxes found matching your search'
              : 'No 1RMs tracked yet. Add your first max to enable percentage-based training.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMaxes.map((max) => {
            const stale = isMaxStale(max);
            const testDate = new Date(max.testedAt).toLocaleDateString();

            return (
              <div
                key={max.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                      {max.exerciseName}
                    </h3>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="font-black text-2xl text-purple-600 dark:text-purple-400">
                        {max.weight} {max.unit}
                      </span>
                      <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                        <Calendar className="h-4 w-4" />
                        {testDate}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          max.estimatedOrTested === 'tested'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}
                      >
                        {max.estimatedOrTested}
                      </span>
                    </div>
                    {max.notes && (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {max.notes}
                      </p>
                    )}
                    {stale && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-500">
                        <AlertCircle className="h-4 w-4" />
                        <span>Max is over 3 months old - consider retesting</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEditModal(max)}
                      className="rounded-lg px-3 py-1.5 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMax(max.id)}
                      className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                {editingMax ? 'Edit 1RM' : 'Add 1RM'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Exercise Selection */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Exercise *
                </label>
                <button
                  onClick={() => setShowExercisePicker(true)}
                  className="w-full text-left rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {selectedExercise ? selectedExercise.name : 'Select exercise...'}
                </button>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Weight *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value))}
                    min="0"
                    step="2.5"
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              {/* Date Tested */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Date Tested *
                </label>
                <input
                  type="date"
                  value={testedAt}
                  onChange={(e) => setTestedAt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              {/* Tested or Estimated */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('tested')}
                    className={`flex-1 rounded-lg px-4 py-2 font-bold transition-all ${
                      estimatedOrTested === 'tested'
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Tested
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('estimated')}
                    className={`flex-1 rounded-lg px-4 py-2 font-bold transition-all ${
                      estimatedOrTested === 'estimated'
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Estimated
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g., Touch & go, paused, competition"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-zinc-200 p-6 dark:border-zinc-800">
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="flex-1 rounded-xl border-2 border-zinc-300 bg-white px-6 py-3 font-bold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMax}
                disabled={saving || !selectedExercise || weight <= 0}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {saving ? 'Saving...' : editingMax ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Picker */}
      <ExercisePicker
        isOpen={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelect={handleExerciseSelect}
        userId={userId}
      />
    </div>
  );
}
