'use client';

import { useMemo } from 'react';
import { Calendar, Clock, Dumbbell, Shield, X } from 'lucide-react';
import type { ProgramTemplate } from '../../lib/types';
import { getProgramStats, inferSplitTags } from './program-utils';

interface ProgramDetailModalProps {
  program: ProgramTemplate;
  activeWeekNumber?: number;
  isActive?: boolean;
  isBuiltIn?: boolean;
  onClose: () => void;
  onSetActive: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export default function ProgramDetailModal({
  program,
  activeWeekNumber,
  isActive = false,
  isBuiltIn = false,
  onClose,
  onSetActive,
  onEdit,
  onDelete,
}: ProgramDetailModalProps) {
  const stats = useMemo(() => getProgramStats(program), [program]);
  const tags = useMemo(() => inferSplitTags(program), [program]);
  const sortedWeeks = useMemo(
    () => [...program.weeks].sort((a, b) => a.weekNumber - b.weekNumber),
    [program.weeks]
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-4xl border-l border-zinc-800 bg-zinc-950/95 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Program details"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-zinc-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">
                  <span>Program Detail</span>
                  {isBuiltIn && (
                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
                      Read-only
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-2xl font-bold text-white">{program.name}</h2>
                {program.description && (
                  <p className="mt-2 text-sm text-zinc-400">{program.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(tags.length > 0 ? tags : ['Balanced']).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition-all hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="h-4 w-4" />
                  Weeks
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{stats.weekCount}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="h-4 w-4" />
                  Days per week
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{stats.daysPerWeek}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Dumbbell className="h-4 w-4" />
                  Total exercises
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{stats.totalExercises}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSetActive}
                disabled={isActive}
                className="rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-white/60"
              >
                {isActive ? 'Active Program' : 'Set as Active'}
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl border border-white/10 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/20"
              >
                {isBuiltIn ? 'Clone and Edit' : 'Edit Program'}
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-xs font-semibold text-rose-200 transition-all hover:bg-rose-500/20"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
              <Shield className="h-4 w-4 text-zinc-500" />
              Full Week Schedule
            </div>
            <div className="mt-4 space-y-4">
              {sortedWeeks.map((week, weekIndex) => {
                const isActiveWeek = activeWeekNumber === week.weekNumber;
                return (
                  <div
                    key={week.weekNumber}
                    className={`rounded-2xl border p-4 ${
                      isActiveWeek
                        ? 'border-purple-500/60 bg-purple-500/10'
                        : 'border-zinc-800 bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
                          Week {weekIndex + 1}
                        </span>
                        {isActiveWeek && (
                          <span className="rounded-full border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">{week.days.length} days</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {week.days.length === 0 && (
                        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-3 text-xs text-zinc-500">
                          No days scheduled for this week.
                        </div>
                      )}
                      {week.days.map((day, dayIndex) => {
                        const exerciseCount = new Set(day.sets.map((set) => set.exerciseId)).size;
                        return (
                          <div
                            key={`${week.weekNumber}-${dayIndex}`}
                            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                          >
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                                {day.dayOfWeek}
                              </p>
                              <p className="text-sm font-semibold text-white">{day.name}</p>
                            </div>
                            <div className="text-xs text-zinc-400">
                              {exerciseCount} ex / {day.sets.length} sets
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
