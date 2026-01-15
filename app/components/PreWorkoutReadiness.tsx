'use client';

import { usePreWorkoutReadiness } from '../lib/useWorkoutIntelligence';
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, Clock } from 'lucide-react';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="mx-4 max-w-2xl rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-center gap-3">
            <Activity className="h-6 w-6 animate-pulse text-purple-300" />
            <p className="text-lg font-semibold text-white">
              Analyzing your readiness...
            </p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-purple-300" />
            <h2 className="text-2xl font-semibold text-white">
              Pre-Workout Readiness
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Score */}
          <div className={`rounded-2xl p-6 ${getStatusColor(readiness.overallStatus)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(readiness.overallStatus)}
                <div>
                  <h3 className="text-lg font-semibold capitalize">{readiness.overallStatus} Readiness</h3>
                  <p className="text-sm opacity-80">
                    Overall Score: {readiness.overallScore.toFixed(1)}/10
                  </p>
                </div>
              </div>
              <div className="text-4xl font-semibold">
                {readiness.overallScore.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                ACWR
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {readiness.acwr.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {readiness.acwrStatus}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Fitness
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                {readiness.fitnessScore.toFixed(0)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Adaptation Level
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Fatigue
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-300">
                {readiness.fatigueScore.toFixed(0)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Cumulative Load
              </p>
            </div>
          </div>

          {/* Muscle Readiness */}
          {readiness.muscleReadiness && readiness.muscleReadiness.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Muscle Group Readiness
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
                        {muscle.hoursUntilReady && muscle.hoursUntilReady > 0 && (
                          <p className="text-xs text-gray-400">
                            <Clock className="inline h-3 w-3" /> {muscle.hoursUntilReady.toFixed(0)}h
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {readiness.warnings && readiness.warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
                    Warnings
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {readiness.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-amber-200">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {readiness.recommendations && readiness.recommendations.length > 0 && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-200">
                    Recommendations
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {readiness.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-blue-200">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Score */}
          <div className="text-center text-xs text-gray-500">
            Confidence: {(readiness.confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 border-t border-white/10 bg-white/5 p-6">
          <div className="flex gap-3">
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
    </div>
  );
}
