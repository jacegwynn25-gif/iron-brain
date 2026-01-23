'use client';

import { AlertTriangle } from 'lucide-react';
import { RecoveryProfile } from '../lib/fatigue/cross-session';

interface RecoveryOverviewProps {
  profiles: RecoveryProfile[];
  loading?: boolean;
}

function getRecoveryColor(percentage: number): string {
  if (percentage >= 90) return 'bg-green-500';
  if (percentage >= 75) return 'bg-green-400';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function getReadinessColor(score: number): string {
  if (score >= 8) return 'text-green-500';
  if (score >= 6) return 'text-yellow-500';
  if (score >= 4) return 'text-orange-500';
  return 'text-red-500';
}

function formatTimeAgo(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function RecoveryOverview({ profiles, loading }: RecoveryOverviewProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white mb-4">Muscle Recovery</h2>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
            <div className="h-6 bg-white/10 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-zinc-200 font-semibold mb-2">No recovery data yet</div>
        <div className="text-sm text-zinc-400">
          Complete a workout to start tracking muscle recovery
        </div>
      </div>
    );
  }

  // Sort by readiness (worst first - needs attention)
  const sortedProfiles = [...profiles].sort((a, b) => a.readinessScore - b.readinessScore);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Muscle Recovery</h2>
        <div className="text-sm text-zinc-400">
          {profiles.length} muscle{profiles.length !== 1 ? 's' : ''} tracked
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedProfiles.map((profile) => {
          const recoveryColor = getRecoveryColor(profile.recoveryPercentage);
          const readinessColor = getReadinessColor(profile.readinessScore);
          const isFullyRecovered = profile.recoveryPercentage >= 95;

          return (
            <div
              key={profile.muscleGroup}
              className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium capitalize">
                    {profile.muscleGroup}
                  </span>
                  {isFullyRecovered && (
                    <span className="text-xs text-emerald-200 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Ready
                    </span>
                  )}
                </div>
                <div className={`text-lg font-bold ${readinessColor}`}>
                  {profile.readinessScore.toFixed(1)}/10
                </div>
              </div>

              {/* Recovery Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Recovery</span>
                  <span>{Math.round(profile.recoveryPercentage)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${recoveryColor} transition-all duration-500`}
                    style={{ width: `${profile.recoveryPercentage}%` }}
                  />
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{formatTimeAgo(profile.daysSinceLastTraining)}</span>
                {!isFullyRecovered && (
                  <span>
                    Full: {new Date(profile.estimatedFullRecoveryDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                )}
              </div>

              {/* Warning for low readiness */}
              {profile.readinessScore < 6 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Caution:</span> Consider lighter training or rest
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="text-sm font-medium text-zinc-200 mb-2">Readiness Scale</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-zinc-400">8-10: Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-zinc-400">6-7: Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-zinc-400">4-5: Caution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-zinc-400">&lt;4: Rest needed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
