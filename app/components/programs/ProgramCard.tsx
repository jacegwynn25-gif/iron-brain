'use client';

import { useMemo, type KeyboardEvent } from 'react';
import { Calendar, Dumbbell } from 'lucide-react';
import type { ProgramTemplate } from '../../lib/types';
import { getProgramStats, inferSplitTags } from './program-utils';

interface ProgramCardProps {
  program: ProgramTemplate;
  isActive?: boolean;
  variant?: 'library' | 'template';
  onOpen: (program: ProgramTemplate) => void;
  onSetActive?: (program: ProgramTemplate) => void;
  setActiveLabel?: string;
}

export default function ProgramCard({
  program,
  isActive = false,
  variant = 'library',
  onOpen,
  onSetActive,
  setActiveLabel,
}: ProgramCardProps) {
  const stats = useMemo(() => getProgramStats(program), [program]);
  const tags = useMemo(() => inferSplitTags(program), [program]);

  const baseClass = 'group w-full rounded-2xl border p-4 transition-all';
  const variantClass = variant === 'template'
    ? 'min-w-[220px] border-dashed border-zinc-700 bg-zinc-900/40 hover:border-zinc-500/80'
    : 'border-white/10 bg-white/5 hover:border-white/20';
  const activeClass = isActive ? 'border-purple-500/70 ring-1 ring-purple-500/40' : '';
  const quickActionLabel = setActiveLabel ?? (variant === 'template' ? 'Use' : 'Set Active');
  const showQuickAction = Boolean(onSetActive) && !isActive;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(program);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(program)}
      onKeyDown={handleKeyDown}
      className={`${baseClass} ${variantClass} ${activeClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">
            {variant === 'template' ? 'Template' : 'Program'}
          </p>
          <h3 className="mt-2 min-h-[2.5rem] text-sm font-semibold text-white sm:text-base leading-snug line-clamp-2 break-words">
            {program.name}
          </h3>
          {program.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
              {program.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {isActive && (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
              Active
            </span>
          )}
          <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2 py-0.5 text-xs font-semibold text-zinc-200">
            {stats.daysPerWeek || 0}d
          </span>
          {showQuickAction && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSetActive?.(program);
              }}
              className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white transition-all hover:bg-white/20"
            >
              {quickActionLabel}
            </button>
          )}
        </div>
      </div>

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

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
          <span>{stats.weekCount} wk</span>
        </div>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-3.5 w-3.5 text-zinc-500" />
          <span>{stats.totalExercises} ex</span>
        </div>
      </div>
    </div>
  );
}
