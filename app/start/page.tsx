'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play, Sparkles, Zap } from 'lucide-react';
import type { ProgramTemplate } from '../lib/types';
import { normalizePrograms } from '../lib/programs/normalize';
import { useAuth } from '../lib/supabase/auth-context';

type RecentProgram = {
  id: string;
  name: string;
};

export default function StartWorkoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);

  const namespaceId = user?.id ?? 'guest';
  const userProgramsKey = useMemo(
    () => `iron_brain_user_programs__${namespaceId}`,
    [namespaceId]
  );
  const selectedProgramKey = useMemo(
    () => `iron_brain_selected_program__${namespaceId}`,
    [namespaceId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedPrograms = localStorage.getItem(userProgramsKey);
    const localPrograms: ProgramTemplate[] = storedPrograms ? JSON.parse(storedPrograms) : [];
    const normalized = normalizePrograms(localPrograms);

    if (normalized.changedPrograms.length > 0) {
      localStorage.setItem(userProgramsKey, JSON.stringify(normalized.programs));
    }

    const storedId = localStorage.getItem(selectedProgramKey);
    const resolvedProgram =
      normalized.programs.find((program) => program.id === storedId) ?? normalized.programs[0] ?? null;
    setSelectedProgram(resolvedProgram);
  }, [selectedProgramKey, userProgramsKey]);

  const recentPrograms = useMemo<RecentProgram[]>(() => {
    const placeholders: RecentProgram[] = [
      { id: 'power-hypertrophy-ul', name: 'Power Hypertrophy UL' },
      { id: 'athletic-full-body', name: 'Athletic Full Body' },
      { id: 'push-pull-legs', name: 'Push Pull Legs' },
    ];

    const selected: RecentProgram[] = selectedProgram
      ? [{ id: selectedProgram.id, name: selectedProgram.name }]
      : [];

    const merged = [...selected, ...placeholders];
    const seen = new Set<string>();

    return merged.filter((program) => {
      if (seen.has(program.id)) return false;
      seen.add(program.id);
      return true;
    }).slice(0, 3);
  }, [selectedProgram]);

  const handleStartSession = () => {
    router.push('/workout/new');
  };

  const handleQuickStart = () => {
    router.push('/workout/new?type=empty');
  };

  const handleRecentProgramStart = (programId: string) => {
    router.push(`/workout/new?program_id=${encodeURIComponent(programId)}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <button
        onClick={handleStartSession}
        className="w-full rounded-3xl border border-white/10 bg-zinc-900/40 p-8 text-left text-zinc-100 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Gym Floor</p>
            <h1 className="text-3xl font-bold text-zinc-100">Start Today&apos;s Session</h1>
            <p className="text-sm text-zinc-400">
              {selectedProgram
                ? `Current Program: ${selectedProgram.name}`
                : 'No session scheduled. Start now and choose your flow in the logger.'}
            </p>
          </div>

          <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/60 text-zinc-100">
            <Play className="h-7 w-7" fill="currentColor" />
          </div>
        </div>
      </button>

      <button
        onClick={handleQuickStart}
        className="w-full rounded-2xl border border-white/10 bg-zinc-900/40 p-5 text-left text-zinc-100 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-zinc-100 font-bold">Quick Start</p>
            <p className="text-zinc-400 text-sm">Start an empty workout session.</p>
          </div>
          <Zap className="h-5 w-5 text-zinc-300" />
        </div>
      </button>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-bold text-zinc-100">Recent Programs</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {recentPrograms.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => handleRecentProgramStart(program.id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 backdrop-blur-xl"
            >
              <span>{program.name}</span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
