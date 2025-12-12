'use client';

import { AlertTriangle, TrendingUp, Award, Info, X } from 'lucide-react';

export type AlertType = 'fatigue' | 'progression' | 'pr-opportunity' | 'info';
export type AlertSeverity = 'mild' | 'moderate' | 'high' | 'critical';

interface SmartAlertProps {
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  suggestedWeight?: number;
  currentWeight?: number | null;
  scientificBasis?: string;
  confidence?: number; // 0-1
  onDismiss?: () => void;
  onApply?: () => void;
  compact?: boolean;
}

/**
 * Premium Smart Alert Component
 *
 * Displays science-backed recommendations during workout logging.
 * Clean, professional design with no emojis - just actionable intelligence.
 */
export default function SmartAlert({
  type,
  severity = 'moderate',
  title,
  message,
  suggestedWeight,
  currentWeight,
  scientificBasis,
  confidence,
  onDismiss,
  onApply,
  compact = false,
}: SmartAlertProps) {
  const iconMap = {
    fatigue: AlertTriangle,
    progression: TrendingUp,
    'pr-opportunity': Award,
    info: Info,
  };

  // Color scheme based on type and severity
  const getColors = () => {
    switch (type) {
      case 'fatigue':
        if (severity === 'critical') return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          border: 'border-red-500 dark:border-red-600',
          text: 'text-red-900 dark:text-red-100',
          subtext: 'text-red-700 dark:text-red-300',
          icon: 'text-red-600 dark:text-red-400',
          button: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
        };
        if (severity === 'high') return {
          bg: 'bg-orange-50 dark:bg-orange-950/20',
          border: 'border-orange-500 dark:border-orange-600',
          text: 'text-orange-900 dark:text-orange-100',
          subtext: 'text-orange-700 dark:text-orange-300',
          icon: 'text-orange-600 dark:text-orange-400',
          button: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600',
        };
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          border: 'border-amber-500 dark:border-amber-600',
          text: 'text-amber-900 dark:text-amber-100',
          subtext: 'text-amber-700 dark:text-amber-300',
          icon: 'text-amber-600 dark:text-amber-400',
          button: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600',
        };

      case 'progression':
        return {
          bg: 'bg-green-50 dark:bg-green-950/20',
          border: 'border-green-500 dark:border-green-600',
          text: 'text-green-900 dark:text-green-100',
          subtext: 'text-green-700 dark:text-green-300',
          icon: 'text-green-600 dark:text-green-400',
          button: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
        };

      case 'pr-opportunity':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/20',
          border: 'border-purple-500 dark:border-purple-600',
          text: 'text-purple-900 dark:text-purple-100',
          subtext: 'text-purple-700 dark:text-purple-300',
          icon: 'text-purple-600 dark:text-purple-400',
          button: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600',
        };

      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/20',
          border: 'border-blue-500 dark:border-blue-600',
          text: 'text-blue-900 dark:text-blue-100',
          subtext: 'text-blue-700 dark:text-blue-300',
          icon: 'text-blue-600 dark:text-blue-400',
          button: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
        };
    }
  };

  const colors = getColors();
  const Icon = iconMap[type] ?? Info;

  const weightChange = suggestedWeight && currentWeight
    ? ((suggestedWeight - currentWeight) / currentWeight * 100)
    : null;

  const weightChangeStr = weightChange !== null ? weightChange.toFixed(0) : null;

  if (compact) {
    // Compact mobile-friendly pill
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${colors.bg} ${colors.border}`}>
        <Icon className={`h-4 w-4 ${colors.icon} flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black leading-tight ${colors.text} truncate`}>
            {title}
          </p>
          <p className={`text-[11px] leading-tight ${colors.subtext} truncate`}>
            {message}
          </p>
        </div>
        {suggestedWeight && (
          <span className={`flex-shrink-0 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-black ${colors.text} dark:bg-black/20`}>
            {suggestedWeight} lbs
          </span>
        )}
        {onApply && (
          <button
            onClick={onApply}
            className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white ${colors.button} transition-all active:scale-95`}
          >
            Apply
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 rounded-full p-1 ${colors.subtext} transition-colors`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Full banner alert
  return (
    <div className={`rounded-xl ${colors.bg} ${colors.border} border-2 p-3 shadow-lg mb-3 animate-fadeIn sm:p-4`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 rounded-lg bg-white/50 p-2 dark:bg-black/20`}>
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-black text-sm sm:text-base ${colors.text}`}>
              {title}
            </h3>
            {confidence !== undefined && (
              <span className={`text-xs font-semibold ${colors.subtext} flex-shrink-0`}>
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>

          <p className={`text-xs sm:text-sm font-medium ${colors.subtext} mb-3`}>
            {message}
          </p>

          {/* Weight suggestion display */}
          {suggestedWeight && currentWeight && (
            <div className={`flex items-center gap-3 mb-3 p-2 rounded-lg bg-white/50 dark:bg-black/20`}>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-semibold ${colors.subtext}`}>
                    Current:
                  </span>
                  <span className={`text-lg font-black ${colors.text}`}>
                    {currentWeight} lbs
                  </span>
                </div>
              </div>
              <div className={`text-xl font-black ${colors.icon}`}>→</div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-semibold ${colors.subtext}`}>
                    Suggested:
                  </span>
                  <span className={`text-lg font-black ${colors.text}`}>
                    {suggestedWeight} lbs
                  </span>
                  {weightChangeStr && (
                    <span className={`text-xs font-bold ${colors.subtext}`}>
                      ({Number(weightChangeStr) > 0 ? '+' : ''}{weightChangeStr}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scientific basis (collapsible) */}
          {scientificBasis && (
            <details className="mb-3">
              <summary className={`cursor-pointer text-xs font-semibold ${colors.subtext} hover:${colors.text} transition-colors`}>
                Scientific Basis
              </summary>
              <p className={`mt-2 text-xs ${colors.subtext} italic pl-4 border-l-2 ${colors.border}`}>
                {scientificBasis}
              </p>
            </details>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onApply && suggestedWeight && (
              <button
                onClick={onApply}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-white ${colors.button} transition-all hover:scale-105 active:scale-95 shadow-md`}
              >
                Apply {suggestedWeight} lbs
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold ${colors.text} bg-white/50 hover:bg-white/70 dark:bg-black/20 dark:hover:bg-black/30 transition-all`}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
