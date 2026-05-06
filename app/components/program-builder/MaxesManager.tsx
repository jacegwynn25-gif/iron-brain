'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, AlertCircle, TrendingUp, Calendar, Pencil } from 'lucide-react';
import { getUserMaxes, saveUserMax, deleteUserMax, isMaxStale } from '../../lib/maxes/maxes-service';
import { useDialog } from '@/app/providers/DialogProvider';
import type { UserMax } from '../../lib/types';
import ExercisePicker from './ExercisePicker';
import type { Exercise, CustomExercise } from '../../lib/types';

type ExerciseOption = {
  id: string;
  name: string;
};

interface MaxesManagerProps {
  userId: string | null;
}

export default function MaxesManager({ userId }: MaxesManagerProps) {
  const { alert, confirm } = useDialog();
  const [maxes, setMaxes] = useState<UserMax[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMax, setEditingMax] = useState<UserMax | null>(null);

  // Form state for add/edit
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null);
  const [weight, setWeight] = useState(135);
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedOrTested, setEstimatedOrTested] = useState<'tested' | 'estimated'>('tested');
  const [notes, setNotes] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load maxes
  const loadMaxes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserMaxes(userId);
      setMaxes(data);
    } catch (err) {
      console.error('Failed to load maxes:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMaxes();
  }, [loadMaxes]);

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
    setSelectedExercise({ id: max.exerciseId, name: max.exerciseName });
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
      await alert(
        'Missing Values',
        'Please select an exercise and enter a valid weight before saving.'
      );
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
      await alert(
        'Save Error',
        'Failed to save max. Please check your connection and try again.'
      );
    } finally {

      setSaving(false);
    }
  };

  const handleDeleteMax = async (maxId: string) => {
    const confirmed = await confirm(
      'Delete 1RM Record?',
      'Are you sure you want to delete this 1RM? This will remove it from your history.',
      { variant: 'danger', confirmLabel: 'Delete Record' }
    );
    if (!confirmed) return;


    try {
      await deleteUserMax(userId, maxId);
      await loadMaxes();
    } catch (err) {
      console.error('Failed to delete max:', err);
      await alert(
        'Delete Error',
        'Failed to delete max. Please try again later.'
      );
    }

  };

  const handleExerciseSelect = (exercise: Exercise | CustomExercise) => {
    setSelectedExercise({ id: exercise.id, name: exercise.name });
    setShowExercisePicker(false);
  };

  // Filter maxes
  const filteredMaxes = maxes.filter(max =>
    max.exerciseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 sm:text-[10px]">
            Strength Ceilings
          </p>
          <h2 className="mt-1 text-2xl font-black italic tracking-tight text-zinc-100 sm:text-3xl">
            MAX TABLE
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
            Values here drive percentage prescriptions and strength suggestions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-950 transition-colors hover:bg-emerald-300 active:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Add 1RM
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search exercises..."
          className="w-full rounded-xl border border-zinc-900 bg-zinc-950/70 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
        />
      </div>

      {loading ? (
        <div className="animate-pulse rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 p-5 sm:p-6">
          <div className="h-4 w-40 rounded bg-zinc-800" />
          <div className="mt-4 h-3 w-64 max-w-full rounded bg-zinc-900" />
        </div>
      ) : filteredMaxes.length === 0 ? (
        <div className="rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 px-5 py-10 text-center sm:px-8">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <h3 className="text-lg font-black italic tracking-tight text-zinc-100">
            {searchTerm ? 'NO MATCHES' : 'NO MAXES TRACKED'}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            {searchTerm
              ? 'No maxes found matching your search'
              : 'No 1RMs tracked yet. Add your first max to enable percentage-based training.'}
          </p>
          {!searchTerm && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800 active:bg-zinc-950"
            >
              <Plus className="h-4 w-4" />
              Add First 1RM
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] border border-zinc-900 bg-zinc-950/55">
          {filteredMaxes.map((max) => {
            const stale = isMaxStale(max);
            const testDate = new Date(max.testedAt).toLocaleDateString();

            return (
              <div
                key={max.id}
                className="border-b border-zinc-900 p-4 last:border-b-0 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-black italic tracking-tight text-zinc-100 sm:text-lg">
                      {max.exerciseName}
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-[minmax(7rem,0.8fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)] sm:items-end">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                          Load
                        </p>
                        <p className="mt-0.5 text-2xl font-black tracking-tight text-zinc-100">
                          {max.weight} <span className="text-base font-black uppercase text-zinc-500">{max.unit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                          Tested
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                          {testDate}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                          Source
                        </p>
                        <p className={`mt-1 text-xs font-black uppercase tracking-[0.16em] ${max.estimatedOrTested === 'tested'
                          ? 'text-emerald-300'
                          : 'text-sky-300'
                          }`}
                        >
                          {max.estimatedOrTested}
                        </p>
                      </div>
                    </div>
                    {max.notes && (
                      <p className="mt-3 text-sm leading-6 text-zinc-500">
                        {max.notes}
                      </p>
                    )}
                    {stale && (
                      <div className="mt-3 flex items-start gap-2 border-l border-amber-400/60 pl-3 text-xs leading-5 text-amber-200">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Max is over 3 months old. Consider retesting.</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(max)}
                      aria-label={`Edit ${max.exerciseName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMax(max.id)}
                      aria-label={`Delete ${max.exerciseName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 text-rose-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="border-b border-zinc-900 p-5 sm:p-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-500/80">
                Strength Ceiling
              </p>
              <h3 className="mt-1 text-2xl font-black italic tracking-tight text-zinc-100">
                {editingMax ? 'EDIT 1RM' : 'ADD 1RM'}
              </h3>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              {/* Exercise Selection */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Exercise *
                </label>
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left text-sm text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
                >
                  {selectedExercise ? selectedExercise.name : 'Select exercise...'}
                </button>
              </div>

              {/* Weight */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Weight *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value))}
                    min="0"
                    step="2.5"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm font-bold uppercase text-zinc-100 outline-none transition-colors focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              {/* Date Tested */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Date Tested *
                </label>
                <input
                  type="date"
                  value={testedAt}
                  onChange={(e) => setTestedAt(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
                />
              </div>

              {/* Tested or Estimated */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Type *
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('tested')}
                    className={`rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-colors ${estimatedOrTested === 'tested'
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                  >
                    Tested
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('estimated')}
                    className={`rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-colors ${estimatedOrTested === 'estimated'
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                  >
                    Estimated
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g., Touch & go, paused, competition"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/45 focus:ring-1 focus:ring-emerald-500/25"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-zinc-900 p-5 sm:p-6">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="min-h-12 flex-1 rounded-xl border border-zinc-800 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMax}
                disabled={saving || !selectedExercise || weight <= 0}
                className="min-h-12 flex-1 rounded-xl bg-emerald-400 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-950 transition-colors hover:bg-emerald-300 active:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
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
