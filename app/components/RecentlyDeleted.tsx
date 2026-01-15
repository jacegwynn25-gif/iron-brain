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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
          <Trash2 className="h-6 w-6 text-gray-300" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-white">
          Trash is empty
        </h3>
        <p className="text-sm text-gray-400">
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
          <h2 className="text-xl font-semibold text-white">
            Recently Deleted
          </h2>
          <p className="text-sm text-gray-400">
            {trash.length} workout{trash.length === 1 ? '' : 's'} • Auto-deleted after 30 days
          </p>
        </div>
        {trash.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <Trash2 className="h-4 w-4" />
            Empty Trash
          </button>
        )}
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-300" />
        <div className="text-sm">
          <p className="font-semibold text-amber-200">
            Workouts are automatically deleted after 30 days
          </p>
          <p className="text-amber-200/80">
            Restore workouts you want to keep before they&apos;re permanently removed
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
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">
                      {workout.programName} - {workout.dayName}
                    </h3>
                    <span className="text-xs font-medium text-gray-500">
                      Week {workout.weekNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
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
                    <Clock className="h-3 w-3 text-red-300" />
                    <span className={`font-medium ${daysLeft <= 7 ? 'text-red-300' : 'text-gray-400'}`}>
                      {daysLeft} day{daysLeft === 1 ? '' : 's'} until permanent deletion
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleRestore(workout.id)}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(workout.id)}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition-all active:scale-[0.98] whitespace-nowrap"
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
