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
  metadata?: {
    usingHierarchicalModel?: boolean;
    personalizedAssessment?: {
      userFatigueResistance: number;
      exerciseSpecificRate: number;
      nextSetPrediction: {
        expectedFatigue: number;
        lower: number;
        upper: number;
      };
      criticalMoment?: {
        detected: boolean;
        setNumber: number;
        interpretation: string;
      };
      shouldStopNow: boolean;
      reasonsToStop: string[];
    };
    powerAnalysis?: {
      currentPower: number;
      setsNeededForHighPower: number;
      recommendation: string;
    };
    dataQuality?: {
      originalSets: number;
      cleanedSets: number;
      outliersRemoved: number;
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
    [key: string]: any;
  };
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
  metadata,
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

          {/* Personalized Assessment (Hierarchical Model Insights) */}
          {metadata?.usingHierarchicalModel && metadata?.personalizedAssessment && (
            <div className={`mb-3 p-3 rounded-lg bg-white/30 dark:bg-black/10 border ${colors.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  🎓 Personalized Analysis
                </span>
                <span className="text-[10px] text-gray-500">
                  (Hierarchical Bayesian Model)
                </span>
              </div>

              {/* Next Set Prediction */}
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Next Set Fatigue Prediction:
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${colors.text}`}>
                      {metadata.personalizedAssessment.nextSetPrediction.expectedFatigue.toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      95% CI: [{metadata.personalizedAssessment.nextSetPrediction.lower.toFixed(0)}%,
                      {metadata.personalizedAssessment.nextSetPrediction.upper.toFixed(0)}%]
                    </span>
                  </div>
                </div>

                {/* Personal Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Your Fatigue Resistance:</span>
                    <div className={`font-bold ${colors.text}`}>
                      {metadata.personalizedAssessment.userFatigueResistance.toFixed(0)}/100
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Exercise Rate:</span>
                    <div className={`font-bold ${colors.text}`}>
                      {(metadata.personalizedAssessment.exerciseSpecificRate * 100).toFixed(1)}%/set
                    </div>
                  </div>
                </div>

                {/* Critical Moment Warning */}
                {metadata.personalizedAssessment.criticalMoment?.detected && (
                  <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded border border-red-400 dark:border-red-600">
                    <div className="text-xs font-bold text-red-700 dark:text-red-300 mb-1">
                      ⚠️ Critical Moment Detected
                    </div>
                    <div className="text-[11px] text-red-600 dark:text-red-400">
                      {metadata.personalizedAssessment.criticalMoment.interpretation}
                    </div>
                  </div>
                )}

                {/* Stop Recommendations */}
                {metadata.personalizedAssessment.shouldStopNow &&
                 metadata.personalizedAssessment.reasonsToStop.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {metadata.personalizedAssessment.reasonsToStop.map((reason, i) => (
                      <div key={i} className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
                        <span>•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Power Analysis */}
          {metadata?.powerAnalysis && (
            <div className={`mb-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-400/40 dark:border-blue-600/40`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  Statistical Power Analysis
                </span>
              </div>

              <div className="space-y-2">
                {/* Power Level Indicator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 dark:text-gray-300">Current Power:</span>
                    <span className={`text-sm font-bold ${
                      metadata.powerAnalysis.currentPower >= 0.8
                        ? 'text-green-700 dark:text-green-300'
                        : metadata.powerAnalysis.currentPower >= 0.6
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-orange-700 dark:text-orange-300'
                    }`}>
                      {(metadata.powerAnalysis.currentPower * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        metadata.powerAnalysis.currentPower >= 0.8
                          ? 'bg-green-500'
                          : metadata.powerAnalysis.currentPower >= 0.6
                          ? 'bg-yellow-500'
                          : 'bg-orange-500'
                      }`}
                      style={{ width: `${metadata.powerAnalysis.currentPower * 100}%` }}
                    />
                  </div>
                </div>

                {/* Recommendation */}
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {metadata.powerAnalysis.recommendation}
                </div>

                {/* Sets Needed */}
                {metadata.powerAnalysis.setsNeededForHighPower > 0 && (
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                    +{metadata.powerAnalysis.setsNeededForHighPower} sets needed for 80% power
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Quality Indicators */}
          {metadata?.dataQuality && metadata.dataQuality.outliersRemoved > 0 && (
            <div className={`mb-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-400/40 dark:border-amber-600/40`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  Data Quality Check
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  metadata.dataQuality.quality === 'excellent'
                    ? 'bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : metadata.dataQuality.quality === 'good'
                    ? 'bg-blue-200 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    : metadata.dataQuality.quality === 'fair'
                    ? 'bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                    : 'bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}>
                  {metadata.dataQuality.quality.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Original sets:</span>
                  <span className="font-mono">{metadata.dataQuality.originalSets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>After cleaning:</span>
                  <span className="font-mono">{metadata.dataQuality.cleanedSets}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-300">
                  <span>Outliers removed:</span>
                  <span className="font-mono">{metadata.dataQuality.outliersRemoved}</span>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                Outlier detection used Modified Z-Score method (Iglewicz & Hoaglin, 1993).
                Analysis based on cleaned data for reliability.
              </div>
            </div>
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
