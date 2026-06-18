'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, AlertCircle, Calendar, Pencil, X, MoreHorizontal } from 'lucide-react';
import { getUserMaxes, saveUserMax, deleteUserMax, isMaxStale } from '../../lib/maxes/maxes-service';
import { useDialog } from '@/app/providers/DialogProvider';
import type { UserMax } from '../../lib/types';
import ExercisePicker from './ExercisePicker';
import type { Exercise, CustomExercise } from '../../lib/types';
import { useBodyScrollLock } from '../../lib/hooks/useBodyScrollLock';
import { LiquidActionMenu, LiquidMenuRow, liquidButtonClass } from '../ui/liquid';

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
  useBodyScrollLock(showAddModal, 'maxes-modal', { hideBottomNav: false });

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
      <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-400">
            {loading ? 'Loading' : `${maxes.length} ${maxes.length === 1 ? 'lift' : 'lifts'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className={liquidButtonClass({
            variant: 'action',
            density: 'compact',
            className: 'min-h-11 px-4 text-[11px]',
          })}
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
          className="liquid-field w-full py-3 pl-11 pr-4 text-sm"
        />
      </div>

      {loading ? (
        <div className="animate-pulse border-y border-white/8 py-5">
          <div className="h-4 w-40 rounded bg-zinc-800" />
          <div className="mt-4 h-3 w-64 max-w-full rounded bg-zinc-900" />
        </div>
      ) : filteredMaxes.length === 0 ? (
        <div className="border-y border-white/8 py-8">
          <h3 className="text-lg font-black italic tracking-tight text-zinc-100">
            {searchTerm ? 'No matches' : 'No maxes tracked'}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            {searchTerm
              ? 'No maxes found matching your search'
              : 'Add your first max to enable percentage-based training.'}
          </p>
          {!searchTerm && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-[11px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] active:bg-white/[0.1]"
            >
              <Plus className="h-4 w-4" />
              Add first 1RM
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-white/8 border-y border-white/8">
          {filteredMaxes.map((max) => {
            const stale = isMaxStale(max);
            const testDate = new Date(max.testedAt).toLocaleDateString();

            return (
              <div
                key={max.id}
                className="py-4 sm:py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-black italic tracking-tight text-zinc-100 sm:text-lg">
                      {max.exerciseName}
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-[minmax(7rem,0.8fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)] sm:items-end">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                          Load
                        </p>
                        <p className="mt-0.5 text-2xl font-black tracking-tight text-zinc-100">
                          {max.weight} <span className="text-base font-black uppercase text-zinc-500">{max.unit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                          Tested
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                          {testDate}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                          Source
                        </p>
                        <p className="mt-1 text-xs font-bold text-zinc-400">
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
                  <LiquidActionMenu
                    label={`Max actions for ${max.exerciseName}`}
                    trigger={
                      <span className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                  >
                    <LiquidMenuRow
                      label="Edit"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => handleOpenEditModal(max)}
                    />
                    <LiquidMenuRow
                      label="Delete"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      danger
                      onClick={() => handleDeleteMax(max.id)}
                    />
                  </LiquidActionMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center bg-transparent px-3 pt-[calc(env(safe-area-inset-top)+7rem)] sm:p-4 sm:pt-[calc(env(safe-area-inset-top)+6rem)]">
          <button
            type="button"
            aria-label="Close max editor"
            className="absolute inset-0 cursor-default"
            onClick={handleCloseModal}
          />
          <div className="liquid-sheet-panel liquid-form-sheet relative w-full max-w-lg overflow-hidden rounded-[1.2rem] p-0">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 p-4 sm:p-5">
              <h3 className="text-xl font-black italic tracking-tight text-zinc-100 sm:text-2xl">
                {editingMax ? 'Edit 1RM' : 'Add 1RM'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="liquid-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-100 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[52dvh] space-y-4 overflow-y-auto p-4 sm:max-h-[58dvh] sm:p-5">
              {/* Exercise Selection */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Exercise
                </label>
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="liquid-field w-full px-4 py-3 text-left text-sm"
                >
                  {selectedExercise ? selectedExercise.name : 'Select exercise...'}
                </button>
              </div>

              {/* Weight */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Weight
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value))}
                    min="0"
                    step="2.5"
                    className="liquid-field min-w-0 flex-1 px-4 py-2.5 text-sm"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
                    className="liquid-field px-4 py-2.5 text-sm font-bold uppercase"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              {/* Date Tested */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Date tested
                </label>
                <input
                  type="date"
                  value={testedAt}
                  onChange={(e) => setTestedAt(e.target.value)}
                  className="liquid-field w-full px-4 py-2.5 text-sm"
                />
              </div>

              {/* Tested or Estimated */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Type
                </label>
                <div className="liquid-segmented grid grid-cols-2 gap-1 p-1">
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('tested')}
                    data-active={estimatedOrTested === 'tested' ? 'true' : 'false'}
                    className="liquid-segmented-item px-4 py-2 text-[11px] font-semibold"
                  >
                    Tested
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstimatedOrTested('estimated')}
                    data-active={estimatedOrTested === 'estimated' ? 'true' : 'false'}
                    className="liquid-segmented-item px-4 py-2 text-[11px] font-semibold"
                  >
                    Estimated
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g., Touch & go, paused, competition"
                  className="liquid-field w-full px-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-white/8 p-3 sm:p-4">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.045] px-5 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMax}
                disabled={saving || !selectedExercise || weight <= 0}
                className={liquidButtonClass({
                  variant: 'action',
                  density: 'compact',
                  className: 'min-h-12 flex-1 rounded-xl px-5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50',
                })}
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
