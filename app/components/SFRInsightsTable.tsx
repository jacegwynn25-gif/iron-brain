'use client';

import { AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

interface SFRInsight {
  exerciseId: string;
  exerciseName: string;
  avgSFR: number;
  timesPerformed: number;
  bestSFR: number;
  worstSFR: number;
  interpretation: 'excellent' | 'good' | 'moderate' | 'poor' | 'excessive';
}

interface SFRInsightsTableProps {
  insights: SFRInsight[];
  loading?: boolean;
  pinnedExerciseIds?: string[];
  onTogglePin?: (exerciseId: string) => void;
}

function getSFRColor(interpretation: string): string {
  switch (interpretation) {
    case 'excellent': return 'text-green-500';
    case 'good': return 'text-green-400';
    case 'moderate': return 'text-yellow-500';
    case 'poor': return 'text-orange-500';
    case 'excessive': return 'text-red-500';
    default: return 'text-gray-400';
  }
}

function getSFRBadge(interpretation: string): string {
  switch (interpretation) {
    case 'excellent': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'good': return 'bg-green-500/10 text-green-400 border-green-400/20';
    case 'moderate': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'poor': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'excessive': return 'bg-red-500/10 text-red-500 border-red-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-400/20';
  }
}

function getInterpretationFromSFR(sfr: number): 'excellent' | 'good' | 'moderate' | 'poor' | 'excessive' {
  if (sfr > 200) return 'excellent';
  if (sfr > 150) return 'good';
  if (sfr > 100) return 'moderate';
  if (sfr > 50) return 'poor';
  return 'excessive';
}

export default function SFRInsightsTable({ insights, loading, pinnedExerciseIds, onTogglePin }: SFRInsightsTableProps) {
  const [sortBy, setSortBy] = useState<'sfr' | 'name' | 'times'>('sfr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const pinnedSet = useMemo(() => new Set(pinnedExerciseIds ?? []), [pinnedExerciseIds]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white mb-4">Training Efficiency</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/10 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-zinc-200 font-semibold mb-2">No efficiency data yet</div>
        <div className="text-sm text-zinc-400">
          Complete workouts to see which exercises are most efficient
        </div>
      </div>
    );
  }

  // Add interpretation to insights if not present
  const enrichedInsights = insights.map(insight => ({
    ...insight,
    interpretation: insight.interpretation || getInterpretationFromSFR(insight.avgSFR)
  }));

  // Sort insights
  const sortedInsights = [...enrichedInsights].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'sfr') {
      comparison = a.avgSFR - b.avgSFR;
    } else if (sortBy === 'name') {
      comparison = a.exerciseName.localeCompare(b.exerciseName);
    } else {
      comparison = a.timesPerformed - b.timesPerformed;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const toggleSort = (column: 'sfr' | 'name' | 'times') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Calculate stats
  const excellentCount = enrichedInsights.filter(i => i.interpretation === 'excellent').length;
  const poorCount = enrichedInsights.filter(i => i.interpretation === 'poor' || i.interpretation === 'excessive').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Training Efficiency</h2>
        <div className="text-sm text-gray-400">
          {insights.length} exercise{insights.length !== 1 ? 's' : ''} analyzed
        </div>
      </div>

      {/* Summary Stats */}
      {(excellentCount > 0 || poorCount > 0) && (
        <div className="flex gap-3 text-sm">
          {excellentCount > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>{excellentCount} excellent</span>
            </div>
          )}
          {poorCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{poorCount} needs improvement</span>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-white/5 border-b border-white/10 text-sm font-medium text-zinc-400">
          <div
            className="col-span-5 cursor-pointer hover:text-white transition-colors"
            onClick={() => toggleSort('name')}
          >
            Exercise {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div
            className="col-span-2 text-center cursor-pointer hover:text-white transition-colors"
            onClick={() => toggleSort('sfr')}
          >
            SFR {sortBy === 'sfr' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div className="col-span-2 text-center">Rating</div>
          <div
            className="col-span-2 text-center cursor-pointer hover:text-white transition-colors"
            onClick={() => toggleSort('times')}
          >
            Sessions {sortBy === 'times' && (sortOrder === 'desc' ? '↓' : '↑')}
          </div>
          <div className="col-span-1 text-center">Range</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/10">
          {sortedInsights.map((insight) => {
            const interpretation = insight.interpretation;
            const colorClass = getSFRColor(interpretation);
            const badgeClass = getSFRBadge(interpretation);
            const isPinned = pinnedSet.has(insight.exerciseId);

            return (
              <div
                key={insight.exerciseId}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  {onTogglePin && (
                    <button
                      type="button"
                      onClick={() => onTogglePin(insight.exerciseId)}
                      className={`rounded-md border p-1 transition-colors ${
                        isPinned
                          ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                          : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
                      }`}
                      title={isPinned ? 'Unpin from overview' : 'Pin to overview'}
                      aria-label={isPinned ? 'Unpin exercise' : 'Pin exercise'}
                    >
                      <Star className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  <span className="text-white font-medium truncate">{insight.exerciseName}</span>
                </div>
                <div className={`col-span-2 text-center font-bold ${colorClass}`}>
                  {Math.round(insight.avgSFR)}
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`text-xs px-2 py-1 rounded border capitalize ${badgeClass}`}>
                    {interpretation}
                  </span>
                </div>
                <div className="col-span-2 text-center text-gray-400">
                  {insight.timesPerformed}x
                </div>
                <div className="col-span-1 text-center text-xs text-gray-500">
                  {Math.round(insight.worstSFR)}-{Math.round(insight.bestSFR)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="text-sm font-medium text-zinc-200 mb-2">SFR Scale (Stimulus-to-Fatigue Ratio)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="text-zinc-400">
            <span className="text-green-500 font-medium">&gt;200:</span> Excellent - optimal efficiency
          </div>
          <div className="text-zinc-400">
            <span className="text-yellow-500 font-medium">100-150:</span> Moderate - monitor trends
          </div>
          <div className="text-zinc-400">
            <span className="text-red-500 font-medium">&lt;50:</span> Excessive - junk volume, cut back
          </div>
        </div>
      </div>
    </div>
  );
}
