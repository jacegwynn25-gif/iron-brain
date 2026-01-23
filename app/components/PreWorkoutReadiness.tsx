'use client';

import { useState, useEffect } from 'react';
import { usePreWorkoutReadiness } from '../lib/hooks/useRecoveryState';
import { useSubscription } from '../lib/auth/subscription';
import { X, Activity, Lock, CheckCircle } from 'lucide-react';
import Paywall from './Paywall';

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
  const {
    readinessMessage,
    overallRecovery,
    muscleStatuses,
    injuryWarning,
    dataQuality,
    confidence,
    loading,
    error
  } = usePreWorkoutReadiness();

  const { subscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Check if user needs to upgrade
  const needsUpgrade = !subscription.isPro;

  // Add timeout for loading state (10 seconds)
  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loading]);

  if (loading || !readinessMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
        <div className="mx-4 max-w-lg rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-2xl backdrop-blur-xl">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Activity className="h-6 w-6 animate-pulse text-purple-300" />
              <p className="text-lg font-semibold text-white">Analyzing your readiness...</p>
            </div>
            {timedOut && (
              <div className="space-y-3 mt-6">
                <p className="text-sm text-amber-400">This is taking longer than expected</p>
                <button
                  onClick={onContinue}
                  className="rounded-xl bg-purple-600 px-6 py-2.5 font-semibold text-white hover:bg-purple-700 transition-colors"
                >
                  Skip and Start Workout
                </button>
                <button
                  onClick={onCancel}
                  className="ml-3 rounded-xl border border-white/20 bg-white/10 px-6 py-2.5 font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
        <div className="mx-4 max-w-lg rounded-2xl border border-white/10 bg-red-600/20 px-6 py-5 shadow-2xl backdrop-blur-xl">
          <div className="text-center">
            <p className="text-lg font-semibold text-red-400 mb-2">Error loading readiness data</p>
            <p className="text-sm text-gray-300">{error.message}</p>
            <button
              onClick={onCancel}
              className="mt-4 rounded-xl bg-white/10 px-6 py-2 font-semibold text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get status from readinessMessage
  const status = readinessMessage.status;

  // Status-specific styling
  const statusStyling = {
    green: {
      bgColor: 'from-emerald-600/30 to-green-600/30',
      borderColor: 'border-emerald-500/50',
      lightColor: 'bg-emerald-400'
    },
    yellow: {
      bgColor: 'from-amber-600/30 to-orange-600/30',
      borderColor: 'border-amber-500/50',
      lightColor: 'bg-amber-400'
    },
    red: {
      bgColor: 'from-red-600/30 to-rose-600/30',
      borderColor: 'border-red-500/50',
      lightColor: 'bg-red-400'
    }
  };

  const styling = statusStyling[status];

  return (
    <>
      {showPaywall && (
        <Paywall
          onClose={() => setShowPaywall(false)}
          feature="Pre-Workout Readiness Assessment"
        />
      )}

      <div className="fixed inset-0 z-50 min-h-screen bg-zinc-950 overflow-y-auto">
        <div className="px-4 py-6 sm:px-6 sm:py-8 safe-top pb-32 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold text-white">Pre-Workout Check</h2>
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main Status Card */}
          <div className={`rounded-3xl border-2 ${styling.borderColor} bg-gradient-to-br ${styling.bgColor} p-8 mb-6 backdrop-blur-xl`}>
            {/* Traffic Light */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                {/* Light housing */}
                <div className="rounded-2xl bg-zinc-900/80 p-4 border border-white/10">
                  <div className="space-y-3">
                    <div className={`h-12 w-12 rounded-full ${status === 'green' ? styling.lightColor : 'bg-gray-700'} ${status === 'green' ? 'shadow-lg shadow-emerald-500/50' : ''}`} />
                    <div className={`h-12 w-12 rounded-full ${status === 'yellow' ? styling.lightColor : 'bg-gray-700'} ${status === 'yellow' ? 'shadow-lg shadow-amber-500/50' : ''}`} />
                    <div className={`h-12 w-12 rounded-full ${status === 'red' ? styling.lightColor : 'bg-gray-700'} ${status === 'red' ? 'shadow-lg shadow-red-500/50' : ''}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Status Text */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{readinessMessage.emoji}</div>
              <h3 className="text-3xl font-bold text-white mb-2">{readinessMessage.title}</h3>
              <p className="text-lg text-gray-200">{readinessMessage.subtitle}</p>
            </div>

            {/* Action Items */}
            <div className="space-y-2">
              {readinessMessage.actionItems.map((item: string, index: number) => (
                <div key={index} className="flex items-start gap-3 bg-black/20 rounded-xl p-3 border border-white/10">
                  <CheckCircle className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <p className="text-white font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Injury Warning - Only for Pro users */}
          {!needsUpgrade && injuryWarning && (
            <div className={`mb-6 rounded-2xl border-2 p-6 backdrop-blur-xl ${
              injuryWarning.severity === 'critical'
                ? 'border-red-500/50 bg-gradient-to-br from-red-600/30 to-rose-600/30'
                : 'border-amber-500/50 bg-gradient-to-br from-amber-600/30 to-orange-600/30'
            }`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <span className="text-4xl">{injuryWarning.emoji}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{injuryWarning.title}</h3>
                  <p className="text-sm text-gray-200 mb-3">{injuryWarning.message}</p>
                  {injuryWarning.actions && injuryWarning.actions.length > 0 && (
                    <div className="space-y-2">
                      {injuryWarning.actions.map((action: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-white">
                          <span>•</span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upgrade Prompt for Free Users */}
          {needsUpgrade && (
            <div className="mb-6 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-6">
              <div className="flex items-start gap-4">
                <Lock className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Want More Detail?</h3>
                  <p className="text-sm text-amber-200 mb-3">
                    Upgrade to Iron Pro to see muscle-by-muscle recovery, injury risk warnings, and personalized recommendations.
                  </p>
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 font-bold text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98]"
                  >
                    View Upgrade Options
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Simple Recovery List - Only for Pro users */}
          {!needsUpgrade && muscleStatuses && muscleStatuses.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Recovery Status
              </h3>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                {muscleStatuses.slice(0, 6).map((muscle, index) => (
                  <div
                    key={muscle.muscle}
                    className={`flex items-center justify-between p-4 ${index !== muscleStatuses.length - 1 ? 'border-b border-white/10' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{muscle.emoji}</span>
                      <span className="font-semibold text-white">{muscle.muscle}</span>
                    </div>
                    <span className="text-sm text-gray-300">{muscle.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blurred Preview for Free Users */}
          {needsUpgrade && (
            <div className="relative mb-6">
              <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 rounded-2xl flex items-center justify-center">
                <div className="text-center p-6">
                  <Lock className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                  <p className="text-white font-semibold mb-2">Recovery Data Locked</p>
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="text-amber-400 hover:text-amber-300 text-sm font-semibold underline"
                  >
                    Upgrade to unlock
                  </button>
                </div>
              </div>
              <div className="opacity-40 pointer-events-none">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Recovery Status
                </h3>
                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  {['Chest', 'Back', 'Legs', 'Shoulders'].map((muscle, index) => (
                    <div
                      key={muscle}
                      className={`flex items-center justify-between p-4 ${index !== 3 ? 'border-b border-white/10' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🟢</span>
                        <span className="font-semibold text-white">{muscle}</span>
                      </div>
                      <span className="text-sm text-gray-300">--</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/95 backdrop-blur px-4 safe-bottom pt-4 pb-4">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 bg-white/10 px-6 py-4 font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              className={`flex-1 rounded-xl px-6 py-4 font-semibold text-white shadow-lg transition-all active:scale-[0.98] ${
                status === 'red'
                  ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                  : 'btn-primary hover:shadow-xl shadow-purple-500/20'
              }`}
              disabled={status === 'red'}
            >
              {status === 'red' ? 'Rest Today' : 'Start Workout'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
