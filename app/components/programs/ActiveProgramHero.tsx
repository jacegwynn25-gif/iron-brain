'use client';

import { Calendar, Clock, Dumbbell } from 'lucide-react';
import type { ProgramTemplate } from '../../lib/types';
import { getProgramStats, inferSplitLabel } from './program-utils';

interface ActiveProgramHeroProps {
  program: ProgramTemplate | null;
  weekPosition?: number;
  weekTotal?: number;
  daysCompleted?: number;
  daysTotal?: number;
  progress?: number;
  cadenceLabel?: string | null;
  lastSessionLabel?: string | null;
  nextSession?: {
    dayOfWeek: string;
    name: string;
    exerciseCount: number;
    setCount: number;
  } | null;
  onViewSchedule: () => void;
  onEdit: () => void;
  onCreate: () => void;
  onBrowseLibrary?: () => void;
}

export default function ActiveProgramHero({
  program,
  weekPosition,
  weekTotal,
  daysCompleted,
  daysTotal,
  progress = 0,
  cadenceLabel,
  lastSessionLabel,
  nextSession,
  onViewSchedule,
  onEdit,
  onCreate,
  onBrowseLibrary,
}: ActiveProgramHeroProps) {
  if (!program) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-dashed border-zinc-700 bg-zinc-950/70 p-6 shadow-2xl">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative space-y-4">
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-500">Active Program</p>
          <div>
            <h2 className="text-2xl font-semibold text-white">No active program</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Set an active program to see it here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCreate}
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-zinc-200"
            >
              Create Program
            </button>
            {onBrowseLibrary && (
              <button
                type="button"
                onClick={onBrowseLibrary}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
              >
                Browse Library
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const stats = getProgramStats(program);
  const splitLabel = inferSplitLabel(program);
  const resolvedWeekPosition = weekPosition ?? 1;
  const resolvedWeekTotal = weekTotal ?? stats.weekCount;
  const resolvedDaysCompleted = daysCompleted ?? 0;
  const resolvedDaysTotal = daysTotal ?? stats.daysPerWeek;
  const progressPct = Math.min(Math.max(progress, 0), 1) * 100;
  const resolvedCadence = cadenceLabel ?? `${stats.daysPerWeek} days/week`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/50 bg-zinc-950/80 p-6 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]">
      <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_10%_15%,rgba(168,85,247,0.18),transparent_50%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.12),transparent_45%)]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-[0.35em] text-purple-300">Active Program</p>
            <div>
              <h2 className="text-3xl font-black text-white">{program.name}</h2>
              {program.description && (
                <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                  {program.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onViewSchedule}
              className="rounded-xl bg-white px-5 py-3 text-xs font-semibold text-black transition-all hover:bg-zinc-200"
            >
              View Schedule
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              Edit Program
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Calendar className="h-4 w-4 text-zinc-500" />
              Week
            </div>
            <p className="mt-2 text-lg font-bold text-white">
              {resolvedWeekPosition} of {resolvedWeekTotal}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Clock className="h-4 w-4 text-zinc-500" />
              Split
            </div>
            <p className="mt-2 text-lg font-bold text-white">{splitLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Dumbbell className="h-4 w-4 text-zinc-500" />
              Next Session
            </div>
            <p className="mt-2 text-lg font-bold text-white">
              {nextSession ? nextSession.dayOfWeek : 'Unscheduled'}
            </p>
            <p className="text-xs text-zinc-400">
              {nextSession
                ? `${nextSession.name} • ${nextSession.setCount} sets`
                : 'Add a day in the builder'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Dumbbell className="h-4 w-4 text-zinc-500" />
              Completion
            </div>
            <p className="mt-2 text-lg font-bold text-white">
              {resolvedDaysCompleted}/{resolvedDaysTotal} days
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <span>Week progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span>Cadence: {resolvedCadence}</span>
            {lastSessionLabel && <span>Last trained: {lastSessionLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
