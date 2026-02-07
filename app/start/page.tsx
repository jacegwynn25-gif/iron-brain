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
    <div className="mx-auto w-full max-w-5xl pb-6 pt-6 sm:pt-10">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/40 px-6 py-7 backdrop-blur-2xl sm:px-8 sm:py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(38rem 38rem at 10% 18%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(30rem 30rem at 90% 10%, rgba(56,189,248,0.2), transparent 60%)',
            }}
          />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Gym Floor</p>
                <h1 className="text-3xl font-black italic text-zinc-100 sm:text-4xl">
                  Start Today&apos;s Session
                </h1>
                <p className="text-sm text-zinc-400 sm:text-base">
                  {selectedProgram
                    ? `Current Program: ${selectedProgram.name}`
                    : 'No session scheduled. Start now and choose your flow in the logger.'}
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/60 text-zinc-100">
                <Play className="h-6 w-6" fill="currentColor" />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStartSession}
                className="flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-left text-sm font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Start Session
              </button>
              <button
                type="button"
                onClick={handleQuickStart}
                className="flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-6 py-4 text-left text-sm font-bold uppercase tracking-[0.3em] text-zinc-200 transition-all hover:border-emerald-500/40"
              >
                Quick Start
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleQuickStart}
            className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-zinc-900/30 px-6 py-6 text-left backdrop-blur-xl transition-all hover:border-emerald-500/40"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(120deg, rgba(16,185,129,0.18), transparent 60%)',
              }}
            />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Quick Start</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  Blank session, full control.
                </p>
              </div>
              <Zap className="h-6 w-6 text-zinc-300" />
            </div>
          </button>

          <button
            type="button"
            onClick={handleStartSession}
            className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-zinc-900/30 px-6 py-6 text-left backdrop-blur-xl transition-all hover:border-emerald-500/40"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(120deg, rgba(56,189,248,0.2), transparent 60%)',
              }}
            />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Program Mode</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  Launch your next scheduled session.
                </p>
              </div>
              <Play className="h-6 w-6 text-zinc-300" />
            </div>
          </button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Recent Programs
          </div>

          <div
            className="flex gap-3 overflow-x-auto pb-2 pr-6"
            data-swipe-ignore="true"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
              maskImage:
                'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {recentPrograms.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={() => handleRecentProgramStart(program.id)}
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-zinc-900/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-200 backdrop-blur-xl transition-all hover:border-emerald-500/40"
              >
                <span>{program.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-300 transition-colors" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
