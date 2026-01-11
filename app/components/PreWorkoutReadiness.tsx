'use client';

import { useEffect, useState } from 'react';
import { usePreWorkoutReadiness } from '../lib/useWorkoutIntelligence';
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Activity, Clock } from 'lucide-react';
import type { SetTemplate } from '../lib/types';

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
  const { readiness, loading } = usePreWorkoutReadiness(userId, plannedExerciseIds);

  if (loading || !readiness) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="mx-4 max-w-2xl rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900">
          <div className="flex items-center justify-center gap-3">
            <Activity className="h-6 w-6 animate-pulse text-purple-600" />
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
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
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'good':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'moderate':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'poor':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900/30';
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
        return 'bg-green-500';
      case 'recovering':
        return 'bg-yellow-500';
      case 'fatigued':
        return 'bg-red-500';
      default:
        return 'bg-zinc-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              Pre-Workout Readiness
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Score */}
          <div className={`rounded-xl p-6 ${getStatusColor(readiness.overallStatus)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(readiness.overallStatus)}
                <div>
                  <h3 className="text-lg font-black capitalize">{readiness.overallStatus} Readiness</h3>
                  <p className="text-sm font-medium opacity-80">
                    Overall Score: {readiness.overallScore.toFixed(1)}/10
                  </p>
                </div>
              </div>
              <div className="text-4xl font-black">
                {readiness.overallScore.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                ACWR
              </p>
              <p className="mt-1 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                {readiness.acwr.toFixed(2)}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {readiness.acwrStatus}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Fitness
              </p>
              <p className="mt-1 text-2xl font-black text-green-600 dark:text-green-400">
                {readiness.fitnessScore.toFixed(0)}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Adaptation Level
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Fatigue
              </p>
              <p className="mt-1 text-2xl font-black text-orange-600 dark:text-orange-400">
                {readiness.fatigueScore.toFixed(0)}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Cumulative Load
              </p>
            </div>
          </div>

          {/* Muscle Readiness */}
          {readiness.muscleReadiness && readiness.muscleReadiness.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Muscle Group Readiness
              </h3>
              <div className="space-y-2">
                {readiness.muscleReadiness.slice(0, 6).map((muscle) => (
                  <div
                    key={muscle.muscle}
                    className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-3 w-3 rounded-full ${getMuscleStatusColor(muscle.status)}`} />
                        <span className="font-bold text-zinc-900 dark:text-zinc-50">
                          {muscle.muscle}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                          {muscle.recoveryPercentage.toFixed(0)}%
                        </p>
                        {muscle.hoursUntilReady && muscle.hoursUntilReady > 0 && (
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
            <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-orange-900 dark:text-orange-100">
                    Warnings
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {readiness.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm font-medium text-orange-800 dark:text-orange-200">
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
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-blue-900 dark:text-blue-100">
                    Recommendations
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {readiness.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Score */}
          <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Confidence: {(readiness.confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 border-t border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border-2 border-zinc-300 bg-white px-6 py-3 font-bold text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Start Workout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
