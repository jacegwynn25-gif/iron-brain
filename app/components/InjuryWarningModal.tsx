'use client';

import { X, AlertTriangle, TrendingDown } from 'lucide-react';

interface InjuryWarningModalProps {
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  actions: string[];
  onDismiss: () => void;
  onTakeAction?: () => void;
}

export default function InjuryWarningModal({
  severity,
  title,
  message,
  actions,
  onDismiss,
  onTakeAction
}: InjuryWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`max-w-lg w-full rounded-3xl border-2 backdrop-blur-xl shadow-2xl overflow-hidden ${
        severity === 'critical'
          ? 'border-red-500/50 bg-gradient-to-br from-red-600/40 to-rose-600/40'
          : 'border-amber-500/50 bg-gradient-to-br from-amber-600/40 to-orange-600/40'
      }`}>
        {/* Header */}
        <div className="relative p-6 pb-0">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            {severity === 'critical' ? (
              <div className="rounded-full bg-red-500/20 p-6 border-4 border-red-500/50">
                <span className="text-6xl">🚨</span>
              </div>
            ) : (
              <div className="rounded-full bg-amber-500/20 p-6 border-4 border-amber-500/50">
                <AlertTriangle className="h-16 w-16 text-amber-300" />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className={`text-3xl font-bold text-center mb-3 ${
            severity === 'critical' ? 'text-red-100' : 'text-amber-100'
          }`}>
            {title}
          </h2>

          {/* Message */}
          <p className="text-center text-lg text-white/90 mb-6">
            {message}
          </p>
        </div>

        {/* Action Items */}
        <div className="px-6 pb-6 space-y-3">
          {actions.map((action, index) => (
            <div
              key={index}
              className="flex items-start gap-3 bg-black/20 rounded-xl p-4 border border-white/10"
            >
              <div className="flex-shrink-0 mt-0.5">
                {severity === 'critical' ? (
                  <span className="text-xl">🛑</span>
                ) : (
                  <TrendingDown className="h-5 w-5 text-white" />
                )}
              </div>
              <p className="text-white font-medium">{action}</p>
            </div>
          ))}
        </div>

        {/* Explanation Box */}
        <div className="px-6 pb-6">
          <div className="rounded-xl bg-black/30 border border-white/10 p-4">
            <p className="text-sm text-gray-200">
              {severity === 'critical' ? (
                <>
                  <strong className="text-white">Why this matters:</strong> Your body shows multiple signs of
                  overtraining. Continuing to train in this state dramatically increases injury risk and can
                  lead to serious setbacks. Taking rest now means coming back stronger, not weaker.
                </>
              ) : (
                <>
                  <strong className="text-white">Why this matters:</strong> Your training load has spiked beyond
                  safe levels. Research shows injury risk increases 2-3x when you push too hard too fast.
                  Backing off slightly now prevents major problems later.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 space-y-3">
          {onTakeAction && (
            <button
              onClick={onTakeAction}
              className={`w-full rounded-xl px-6 py-4 font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                severity === 'critical'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-xl shadow-red-500/30'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:shadow-xl shadow-amber-500/30'
              }`}
            >
              {severity === 'critical' ? 'Take Rest Days' : 'Reduce Training Load'}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
          >
            I Understand
          </button>
        </div>

        {/* Bottom Warning Bar */}
        {severity === 'critical' && (
          <div className="bg-red-500/20 border-t-2 border-red-500/50 p-4 text-center">
            <p className="text-sm font-semibold text-red-100">
              ⚠️ Training in your current state is not recommended
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
