'use client';

import { AlertTriangle, TrendingDown, X } from 'lucide-react';

interface InWorkoutFatigueAlertProps {
  fatigueLevel: number; // 0-100
  message: string;
  recommendation: string;
  onAcknowledge: () => void;
  onStopWorkout?: () => void;
}

export default function InWorkoutFatigueAlert({
  fatigueLevel,
  message,
  recommendation,
  onAcknowledge,
  onStopWorkout
}: InWorkoutFatigueAlertProps) {
  const getSeverity = () => {
    if (fatigueLevel >= 80) return 'critical';
    if (fatigueLevel >= 60) return 'high';
    return 'moderate';
  };

  const severity = getSeverity();

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-2xl mx-auto">
      <div className={`rounded-2xl border-2 backdrop-blur-xl shadow-2xl overflow-hidden ${
        severity === 'critical'
          ? 'border-red-500/50 bg-gradient-to-br from-red-600/90 to-rose-600/90'
          : severity === 'high'
          ? 'border-amber-500/50 bg-gradient-to-br from-amber-600/90 to-orange-600/90'
          : 'border-yellow-500/50 bg-gradient-to-br from-yellow-600/90 to-amber-600/90'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-0">
          <div className="flex items-start gap-3 flex-1">
            {severity === 'critical' ? (
              <span className="text-3xl flex-shrink-0">🚨</span>
            ) : (
              <AlertTriangle className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">
                {severity === 'critical' ? 'Stop Now' :
                 severity === 'high' ? 'High Fatigue' :
                 'Getting Fatigued'}
              </h3>
              <p className="text-sm text-white/90">
                {message}
              </p>
            </div>
          </div>
          <button
            onClick={onAcknowledge}
            className="flex-shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Recommendation */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-start gap-3 bg-black/20 rounded-xl p-3 border border-white/10">
            <TrendingDown className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
            <p className="text-sm text-white font-medium">{recommendation}</p>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex gap-2">
            {onStopWorkout && severity === 'critical' && (
              <button
                onClick={onStopWorkout}
                className="flex-1 rounded-xl bg-white/20 border border-white/30 px-4 py-2.5 font-semibold text-white transition-all hover:bg-white/30 active:scale-[0.98]"
              >
                End Workout
              </button>
            )}
            <button
              onClick={onAcknowledge}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
            >
              {severity === 'critical' ? 'Ignore (Not Recommended)' : 'Got It'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/80">Session Fatigue</span>
            <span className="text-xs font-bold text-white">{Math.round(fatigueLevel)}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/30 overflow-hidden">
            <div
              className={`h-full transition-all ${
                fatigueLevel >= 80 ? 'bg-red-300' :
                fatigueLevel >= 60 ? 'bg-amber-300' :
                'bg-yellow-300'
              }`}
              style={{ width: `${fatigueLevel}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
