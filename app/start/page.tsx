'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { getProgramProgress, resolveProgramDay } from '../lib/programs/progress';
import { useAuth } from '../lib/supabase/auth-context';
import { useProgramContext } from '../providers/ProgramProvider';

type RecentProgram = {
  id: string;
  name: string;
};

export default function StartWorkoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { allPrograms, selectedProgram, loading, selectProgram } = useProgramContext();
  const namespaceId = user?.id ?? 'guest';

  const selectedProgramProgress = useMemo(() => {
    if (!selectedProgram) return null;
    return getProgramProgress(selectedProgram, namespaceId);
  }, [namespaceId, selectedProgram]);

  const selectedProgramDay = useMemo(() => {
    if (!selectedProgram || !selectedProgramProgress) return null;
    return resolveProgramDay(selectedProgram, selectedProgramProgress);
  }, [selectedProgram, selectedProgramProgress]);

  const recentPrograms = useMemo<RecentProgram[]>(() => {
    const selected = selectedProgram ? [{ id: selectedProgram.id, name: selectedProgram.name }] : [];
    const fromLibrary = allPrograms.map((program) => ({ id: program.id, name: program.name }));
    const merged = [...selected, ...fromLibrary];
    const seen = new Set<string>();

    return merged
      .filter((program) => {
        if (seen.has(program.id)) return false;
        seen.add(program.id);
        return true;
      })
      .slice(0, 5);
  }, [allPrograms, selectedProgram]);

  const handleStartSession = () => {
    if (selectedProgram?.id) {
      const progress = getProgramProgress(selectedProgram, namespaceId);
      router.push(
        `/workout/new?program_id=${encodeURIComponent(selectedProgram.id)}&week=${progress.weekIndex}&day=${progress.dayIndex}&cycle=${progress.cycleNumber}`
      );
      return;
    }
    router.push('/workout/new');
  };

  const handleQuickStart = () => {
    router.push('/workout/new?type=empty');
  };

  const handleRecentProgramStart = (programId: string) => {
    const matched = allPrograms.find((program) => program.id === programId) ?? null;
    if (matched) {
      selectProgram(matched);
      const progress = getProgramProgress(matched, namespaceId);
      router.push(
        `/workout/new?program_id=${encodeURIComponent(programId)}&week=${progress.weekIndex}&day=${progress.dayIndex}&cycle=${progress.cycleNumber}`
      );
      return;
    }
    router.push(`/workout/new?program_id=${encodeURIComponent(programId)}`);
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-8 pt-6 sm:pt-10">
      <header className="border-b border-zinc-900 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Gym Floor</p>
            <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Start Session</h1>
          </div>
          <Play className="mt-1 h-6 w-6 text-zinc-300" />
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          {loading
            ? 'Loading your program library...'
            : selectedProgram
            ? `Current Program: ${selectedProgram.name}`
            : 'No program selected. Launch now and build in-session.'}
        </p>
      </header>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Current Program</p>
        <button
          type="button"
          onClick={() => router.push('/programs')}
          className="mt-2 flex w-full items-center justify-between border-b border-zinc-900 py-4 text-left transition-colors hover:text-zinc-100"
        >
          <div>
            <p className="text-sm font-semibold text-zinc-100">{selectedProgram?.name ?? 'No Program Selected'}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {selectedProgramDay?.day
                ? `Cycle ${selectedProgramDay.cycleNumber} • Week ${selectedProgramDay.weekNumber} • ${selectedProgramDay.day.dayOfWeek} ${selectedProgramDay.day.name}`
                : 'Manage templates and schedule.'}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
        </button>
      </section>

      <section className="pt-8 space-y-3">
        <button
          type="button"
          onClick={handleStartSession}
          className="flex w-full items-center justify-between rounded-2xl bg-emerald-500 px-6 py-5 text-left text-sm font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
        >
          <span>Start Session</span>
          <ArrowRight className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push('/programs')}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-4 text-xs font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <span>Programs</span>
            <BookOpen className="h-4 w-4 text-zinc-400" />
          </button>
          <button
            type="button"
            onClick={handleQuickStart}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-4 text-xs font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <span>Quick Start</span>
            <RotateCcw className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
      </section>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Recent Programs</p>
        <div
          className="mt-3 flex gap-3 overflow-x-auto pb-2 pr-6"
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
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-zinc-900/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-200 transition-all hover:border-emerald-500/40"
            >
              <span>{program.name}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover:text-emerald-300" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
