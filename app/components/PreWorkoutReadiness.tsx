'use client';

import { usePreWorkoutReadiness } from '../lib/useWorkoutIntelligence';
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

interface PreWorkoutReadinessProps {
  userId: string | null;
  plannedExerciseIds?: string[];
  onContinue: () => void;
  onCancel: () => void;
}

export default function PreWorkoutReadiness({
  userId,
  plannedExerciseIds,
  onContinue,
  onCancel,
}: PreWorkoutReadinessProps) {
  const { readiness } = usePreWorkoutReadiness(userId, plannedExerciseIds);

  if (!readiness) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
        <div className="mx-4 max-w-lg rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-center gap-3">
            <Activity className="h-6 w-6 animate-pulse text-purple-300" />
            <p className="text-lg font-semibold text-white">Analyzing your readiness...</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-emerald-200 bg-emerald-500/20 border border-emerald-500/30';
      case 'good':
        return 'text-blue-200 bg-blue-500/20 border border-blue-500/30';
      case 'moderate':
        return 'text-amber-200 bg-amber-500/20 border border-amber-500/30';
      case 'poor':
        return 'text-red-200 bg-red-500/20 border border-red-500/30';
      default:
        return 'text-gray-200 bg-white/5 border border-white/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="h-5 w-5" />;
      case 'good':
        return <TrendingUp className="h-5 w-5" />;
      case 'moderate':
        return <TrendingDown className="h-5 w-5" />;
      case 'poor':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getMuscleStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-emerald-400';
      case 'recovering':
        return 'bg-amber-400';
      case 'fatigued':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-6 sm:px-6 sm:py-8 safe-top pb-32 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-purple-300" />
            <h2 className="text-2xl font-semibold text-white">Pre-Workout Check</h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overall Score */}
        <div className={`rounded-2xl p-6 ${getStatusColor(readiness.overallStatus)} mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(readiness.overallStatus)}
              <div>
                <h3 className="text-lg font-semibold capitalize">{readiness.overallStatus} Readiness</h3>
                <p className="text-sm opacity-80">
                  Overall Score
                </p>
              </div>
            </div>
            <div className="text-4xl font-semibold">
              {readiness.overallScore.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Muscle Readiness */}
        {readiness.muscleReadiness && readiness.muscleReadiness.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Muscle Readiness
            </h3>
            <div className="space-y-2">
              {readiness.muscleReadiness.slice(0, 6).map((muscle) => (
                <div
                  key={muscle.muscle}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`h-3 w-3 rounded-full ${getMuscleStatusColor(muscle.status)}`} />
                      <span className="font-semibold text-white">
                        {muscle.muscle}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {muscle.recoveryPercentage.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/90 backdrop-blur px-4 safe-bottom pt-4">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/10 px-6 py-3 font-semibold text-white transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
}
