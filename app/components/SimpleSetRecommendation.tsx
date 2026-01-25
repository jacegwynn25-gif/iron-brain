'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SimpleSetRecommendationProps {
  exerciseName: string;
  recommendedWeight: number;
  lastWeight: number | null;
  reps: number;
  confidence: number; // 0-1
  onAdjust: (amount: number) => void;
  onAccept: () => void;
}

export default function SimpleSetRecommendation({
  exerciseName,
  recommendedWeight,
  lastWeight,
  reps,
  confidence,
  onAdjust,
  onAccept
}: SimpleSetRecommendationProps) {
  // Round to nearest 5 lbs
  const roundedWeight = Math.round(recommendedWeight / 5) * 5;

  // Calculate difference from last time
  const diff = lastWeight !== null ? roundedWeight - lastWeight : 0;

  // Get status icon and color
  const getStatusDisplay = () => {
    if (lastWeight === null) {
      return {
        icon: null,
        color: 'text-gray-300',
        message: 'Estimate (no history)',
        showMessage: confidence < 0.5
      };
    }

    if (diff > 0) {
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-emerald-400',
        message: `+${diff} lbs from last time 💪`,
        showMessage: true
      };
    } else if (diff < 0) {
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        color: 'text-amber-400',
        message: `${diff} lbs (you're fatigued, scale back)`,
        showMessage: true
      };
    } else {
      return {
        icon: <Minus className="h-4 w-4" />,
        color: 'text-blue-400',
        message: 'Same as last time',
        showMessage: true
      };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      {/* Exercise Name */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-1">
          Next Set
        </h3>
        <p className="text-lg font-bold text-white">{exerciseName}</p>
      </div>

      {/* Recommended Weight - Big and Clear */}
      <div className="mb-4">
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-4xl sm:text-6xl font-bold text-white">{roundedWeight}</span>
          <span className="text-lg sm:text-2xl text-gray-400">lbs</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg sm:text-xl text-gray-300">×</span>
          <span className="text-2xl sm:text-3xl font-semibold text-white">{reps}</span>
          <span className="text-base sm:text-lg text-gray-400">reps</span>
        </div>
      </div>

      {/* Status Message */}
      {status.showMessage && (
        <div className={`flex items-center justify-center gap-2 mb-6 ${status.color}`}>
          {status.icon}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {/* Quick Adjustments */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 text-center mb-3">Quick Adjust</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onAdjust(-10)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
          >
            -10 lbs
          </button>
          <button
            onClick={() => onAdjust(-5)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
          >
            -5 lbs
          </button>
          <button
            onClick={() => onAdjust(5)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
          >
            +5 lbs
          </button>
        </div>
      </div>

      {/* Accept Button */}
      <button
        onClick={onAccept}
        className="w-full rounded-xl btn-primary px-6 py-4 font-bold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl active:scale-[0.98]"
      >
        Use This Weight
      </button>
    </div>
  );
}
