'use client';

import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useMuscleRecovery, useInjuryRisk } from '../lib/hooks/useRecoveryState';

export default function SimpleRecoveryDashboard() {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const { muscleStatuses, loading: muscleLoading } = useMuscleRecovery();
  const { injuryRisk, loading: riskLoading } = useInjuryRisk();

  const loading = muscleLoading || riskLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-center gap-3">
            <Activity className="h-6 w-6 animate-pulse text-purple-300" />
            <p className="text-lg font-semibold text-white">Loading recovery data...</p>
          </div>
        </div>
      </div>
    );
  }

  const overallRecovery = muscleStatuses.reduce((sum, m) => sum + (m.recoveryPercentage || 0), 0) / (muscleStatuses.length || 1);
  const injuryRiskLevel = injuryRisk?.overallRiskLevel || 'low';
  const warnings = injuryRisk?.warnings || [];

  // Get overall status
  const getOverallStatus = () => {
    if (overallRecovery >= 85) return { emoji: '💪', text: 'Fully Recovered', color: 'text-emerald-400' };
    if (overallRecovery >= 60) return { emoji: '🤔', text: 'Partially Recovered', color: 'text-amber-400' };
    return { emoji: '😴', text: 'Still Fatigued', color: 'text-red-400' };
  };

  const overallStatus = getOverallStatus();

  // Sort muscles: red first, then yellow, then green based on recovery percentage
  const sortedMuscles = [...muscleStatuses].sort((a, b) => {
    // Determine status from recovery percentage
    const getStatus = (pct: number) => pct >= 85 ? 2 : pct >= 60 ? 1 : 0;
    return getStatus(a.recoveryPercentage || 0) - getStatus(b.recoveryPercentage || 0);
  });

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-fuchsia-600/20 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-purple-300" />
            <h2 className="text-xl font-bold text-white">Recovery Status</h2>
          </div>
          <span className="text-4xl">{overallStatus.emoji}</span>
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Overall Recovery</span>
            <span className={`text-lg font-bold ${overallStatus.color}`}>
              {Math.round(overallRecovery)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-black/30 overflow-hidden">
            <div
              className={`h-full transition-all ${
                overallRecovery >= 85 ? 'bg-emerald-400' :
                overallRecovery >= 60 ? 'bg-amber-400' :
                'bg-red-400'
              }`}
              style={{ width: `${overallRecovery}%` }}
            />
          </div>
        </div>
        <p className={`text-sm ${overallStatus.color} font-semibold`}>
          {overallStatus.text}
        </p>
      </div>

      {/* Injury Risk Warning (if needed) */}
      {(injuryRiskLevel === 'high' || injuryRiskLevel === 'very_high' || injuryRiskLevel === 'critical') && (
        <div className={`rounded-2xl border-2 p-6 backdrop-blur-xl ${
          injuryRiskLevel === 'critical'
            ? 'border-red-500/50 bg-gradient-to-br from-red-600/30 to-rose-600/30'
            : injuryRiskLevel === 'very_high'
            ? 'border-orange-500/50 bg-gradient-to-br from-orange-600/30 to-red-600/30'
            : 'border-amber-500/50 bg-gradient-to-br from-amber-600/30 to-orange-600/30'
        }`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {injuryRiskLevel === 'critical' ? (
                <span className="text-4xl">🚨</span>
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-300" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">
                {injuryRiskLevel === 'critical' ? 'STOP - INJURY RISK CRITICAL' :
                 injuryRiskLevel === 'very_high' ? 'SLOW DOWN' :
                 'Watch It'}
              </h3>
              <div className="space-y-1">
                {warnings.map((warning, index) => (
                  <p key={index} className="text-sm text-gray-200">{warning}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Muscle List */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Muscle Groups
        </h3>
        <div className="space-y-2">
          {sortedMuscles.map((muscle) => {
            const recoveryPct = muscle.recoveryPercentage || 0;
            const muscleStatus = recoveryPct >= 85 ? 'green' : recoveryPct >= 60 ? 'yellow' : 'red';

            return (
              <button
                key={muscle.muscle}
                onClick={() => setSelectedMuscle(selectedMuscle === muscle.muscle ? null : muscle.muscle)}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{muscle.emoji}</span>
                    <div className="text-left">
                      <p className="font-semibold text-white">{muscle.muscle}</p>
                      <p className="text-sm text-gray-400">{muscle.status}</p>
                    </div>
                  </div>
                  {muscleStatus !== 'green' && (
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Expanded Detail */}
                {selectedMuscle === muscle.muscle && muscleStatus !== 'green' && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Recovery Progress</span>
                      <span className="text-xs font-semibold text-white">
                        {Math.round(recoveryPct)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all ${
                          muscleStatus === 'yellow' ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${recoveryPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-300">
                      {muscleStatus === 'red' ? (
                        <>Give this muscle more rest. Training now increases injury risk.</>
                      ) : (
                        <>Can train but reduce weight by {Math.round((100 - recoveryPct) / 3)}%.</>
                      )}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tips Section */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Recovery Tips
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">🛏️</span>
            <div>
              <p className="font-semibold text-white text-sm">Get 8+ hours of sleep</p>
              <p className="text-xs text-gray-400">Sleep is when your muscles actually grow</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">🍗</span>
            <div>
              <p className="font-semibold text-white text-sm">Eat enough protein</p>
              <p className="text-xs text-gray-400">1.6-2.2g per kg bodyweight daily</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">💧</span>
            <div>
              <p className="font-semibold text-white text-sm">Stay hydrated</p>
              <p className="text-xs text-gray-400">3-4 liters of water per day</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
