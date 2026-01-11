'use client';

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
          <div key={i} className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">No recovery data yet</div>
        <div className="text-sm text-gray-500">
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
        <div className="text-sm text-gray-400">
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
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium capitalize">
                    {profile.muscleGroup}
                  </span>
                  {isFullyRecovered && (
                    <span className="text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
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
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${recoveryColor} transition-all duration-500`}
                    style={{ width: `${profile.recoveryPercentage}%` }}
                  />
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-400">
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
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <div className="text-xs text-orange-400">
                    <span className="font-medium">⚠️ Caution:</span> Consider lighter training or rest
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30">
        <div className="text-sm font-medium text-gray-300 mb-2">Readiness Scale</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-400">8-10: Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-gray-400">6-7: Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-gray-400">4-5: Caution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-400">&lt;4: Rest needed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
