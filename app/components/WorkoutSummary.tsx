'use client';

import { useMemo } from 'react';
import { Trophy, Clock, TrendingUp, X } from 'lucide-react';
import type { WorkoutSession } from '../lib/types';
import { storage } from '../lib/storage';

interface WorkoutSummaryProps {
  session: WorkoutSession;
  onClose: () => void;
}

const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const getSessionVolume = (session: WorkoutSession) => {
  if (session.totalVolumeLoad && session.totalVolumeLoad > 0) return session.totalVolumeLoad;
  return session.sets.reduce((sum, set) => {
    if (!set.completed || !set.actualWeight || !set.actualReps) return sum;
    return sum + set.actualWeight * set.actualReps;
  }, 0);
};

const computePRCount = (session: WorkoutSession) => {
  const history = storage.getWorkoutHistory().filter((item) => item.id !== session.id);
  const previousBest = new Map<string, number>();
  const currentBest = new Map<string, number>();

  const extractValue = (weight?: number | null, reps?: number | null, e1rm?: number | null) => {
    if (e1rm) return e1rm;
    if (!weight || !reps) return null;
    return Math.round(weight * (1 + reps / 30));
  };

  for (const past of history) {
    for (const set of past.sets) {
      if (!set.completed) continue;
      const value = extractValue(set.actualWeight, set.actualReps, set.e1rm);
      if (value === null) continue;
      const existing = previousBest.get(set.exerciseId) ?? 0;
      if (value > existing) previousBest.set(set.exerciseId, value);
    }
  }

  for (const set of session.sets) {
    if (!set.completed) continue;
    const value = extractValue(set.actualWeight, set.actualReps, set.e1rm);
    if (value === null) continue;
    const existing = currentBest.get(set.exerciseId) ?? 0;
    if (value > existing) currentBest.set(set.exerciseId, value);
  }

  let prCount = 0;
  for (const [exerciseId, value] of currentBest.entries()) {
    const previous = previousBest.get(exerciseId) ?? 0;
    if (value > previous) prCount += 1;
  }

  return prCount;
};

export default function WorkoutSummary({ session, onClose }: WorkoutSummaryProps) {
  const totalVolume = useMemo(() => getSessionVolume(session), [session]);
  const durationMinutes = useMemo(() => {
    if (session.durationMinutes && session.durationMinutes > 0) return session.durationMinutes;
    if (session.startTime && session.endTime) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      const minutes = Math.round((end - start) / 60000);
      return minutes > 0 ? minutes : undefined;
    }
    return undefined;
  }, [session]);
  const prCount = useMemo(() => computePRCount(session), [session]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-4 pb-24">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Workout Complete</h2>
              <p className="text-sm text-gray-400">Nice work — keep it up.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close summary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Volume</p>
              <p className="text-lg font-semibold text-white">{Math.round(totalVolume).toLocaleString()} lbs</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Duration</p>
              <p className="text-lg font-semibold text-white">{formatDuration(durationMinutes)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">PRs Hit</p>
              <p className="text-lg font-semibold text-white">{prCount}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl btn-primary px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
