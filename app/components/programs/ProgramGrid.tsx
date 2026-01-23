'use client';

import type { ProgramTemplate } from '../../lib/types';
import ProgramCard from './ProgramCard';

interface ProgramGridProps {
  programs: ProgramTemplate[];
  activeProgramId?: string | null;
  onOpenProgram: (program: ProgramTemplate) => void;
  onSetActive?: (program: ProgramTemplate) => void;
  onCreate: () => void;
}

export default function ProgramGrid({
  programs,
  activeProgramId,
  onOpenProgram,
  onSetActive,
  onCreate,
}: ProgramGridProps) {
  if (programs.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-6 text-left transition-all hover:border-zinc-500 hover:bg-zinc-900/70"
      >
        <p className="text-sm font-semibold text-white">Create your first program</p>
        <p className="mt-1 text-xs text-zinc-400">
          Start from scratch or clone a standard issue template.
        </p>
        <span className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
          New Program
        </span>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {programs.map((program) => (
        <ProgramCard
          key={program.id}
          program={program}
          isActive={activeProgramId === program.id}
          onOpen={onOpenProgram}
          onSetActive={onSetActive}
        />
      ))}
    </div>
  );
}
