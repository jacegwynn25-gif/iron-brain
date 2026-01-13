'use client';

import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import { getTrash, restoreFromTrash, permanentlyDelete, emptyTrash, type DeletedWorkout } from '../lib/trash';

export default function RecentlyDeleted({ onRestore }: { onRestore?: () => void }) {
  const [trash, setTrash] = useState<DeletedWorkout[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTrash = () => {
    setTrash(getTrash());
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (workoutId: string) => {
    if (!confirm('Restore this workout?')) return;

    setLoading(true);
    const success = await restoreFromTrash(workoutId);
    setLoading(false);

    if (success) {
      loadTrash();
      onRestore?.();
    } else {
      alert('Failed to restore workout');
    }
  };

  const handlePermanentDelete = async (workoutId: string) => {
    if (!confirm('Permanently delete this workout? This cannot be undone.')) return;

    setLoading(true);
    const success = await permanentlyDelete(workoutId);
    setLoading(false);

    if (success) {
      loadTrash();
    } else {
      alert('Failed to delete workout');
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm(`Permanently delete all ${trash.length} workouts in trash? This cannot be undone.`)) return;

    setLoading(true);
    const count = await emptyTrash();
    setLoading(false);

    if (count > 0) {
      loadTrash();
      alert(`${count} workouts permanently deleted`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilPurge = (deletedAt: string) => {
    const deletedTime = new Date(deletedAt).getTime();
    const now = new Date().getTime();
    const ageMs = now - deletedTime;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const daysRemaining = 30 - ageDays;
    return Math.max(0, daysRemaining);
  };

  if (trash.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <Trash2 className="mx-auto mb-4 h-16 w-16 text-zinc-400 dark:text-zinc-600" />
        <h3 className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Trash is empty
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Deleted workouts will appear here for 30 days before being permanently removed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Recently Deleted
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {trash.length} workout{trash.length === 1 ? '' : 's'} • Auto-deleted after 30 days
          </p>
        </div>
        {trash.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Empty Trash
          </button>
        )}
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-900/20">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Workouts are automatically deleted after 30 days
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            Restore workouts you want to keep before they're permanently removed
          </p>
        </div>
      </div>

      {/* Trash Items */}
      <div className="space-y-3">
        {trash.map((item) => {
          const daysLeft = getDaysUntilPurge(item.deletedAt);
          const workout = item.workout;

          return (
            <div
              key={workout.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                      {workout.programName} - {workout.dayName}
                    </h3>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Week {workout.weekNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>{formatDate(workout.date)}</span>
                    <span>•</span>
                    <span>{workout.sets.length} sets</span>
                    {workout.durationMinutes && (
                      <>
                        <span>•</span>
                        <span>{workout.durationMinutes} min</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-red-500" />
                    <span className={`font-medium ${daysLeft <= 7 ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {daysLeft} day{daysLeft === 1 ? '' : 's'} until permanent deletion
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleRestore(workout.id)}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50 transition-all whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(workout.id)}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all dark:border-red-700 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20 whitespace-nowrap"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
