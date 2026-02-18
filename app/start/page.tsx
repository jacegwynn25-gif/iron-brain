'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronUp, Play, RotateCcw } from 'lucide-react';
import { getProgramProgress, resolveProgramDay, type ProgramProgress } from '../lib/programs/progress';
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
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [overrideProgress, setOverrideProgress] = useState<ProgramProgress | null>(null);

  const selectedProgramProgress = useMemo(() => {
    if (!selectedProgram) return null;
    return getProgramProgress(selectedProgram, namespaceId);
  }, [namespaceId, selectedProgram]);

  const selectedProgramDay = useMemo(() => {
    if (!selectedProgram || !selectedProgramProgress) return null;
    return resolveProgramDay(selectedProgram, overrideProgress ?? selectedProgramProgress);
  }, [selectedProgram, selectedProgramProgress, overrideProgress]);

  const effectiveProgress = useMemo(() => {
    if (!selectedProgram) return null;
    return overrideProgress ?? selectedProgramProgress;
  }, [overrideProgress, selectedProgramProgress, selectedProgram]);

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
    if (selectedProgram?.id && effectiveProgress) {
      router.push(
        `/workout/new?program_id=${encodeURIComponent(selectedProgram.id)}&week=${effectiveProgress.weekIndex}&day=${effectiveProgress.dayIndex}&cycle=${effectiveProgress.cycleNumber}`
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

        {selectedProgram && selectedProgramDay?.day && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setDayPickerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              <span>{overrideProgress ? 'Undo Day Change' : 'Change Day'}</span>
              {dayPickerOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {overrideProgress && (
              <button
                type="button"
                onClick={() => {
                  setOverrideProgress(null);
                  setDayPickerOpen(false);
                }}
                className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:text-zinc-400"
              >
                Reset
              </button>
            )}

            {dayPickerOpen && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                {selectedProgram.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="mb-3 last:mb-0">
                    <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.35em] text-zinc-600">
                      Week {week.weekNumber}
                    </p>
                    <div className="space-y-1">
                      {week.days.map((day, dIdx) => {
                        const isAutoDay =
                          !overrideProgress &&
                          selectedProgramProgress &&
                          wIdx === selectedProgramProgress.weekIndex &&
                          dIdx === selectedProgramProgress.dayIndex;
                        const isSelected =
                          overrideProgress &&
                          wIdx === overrideProgress.weekIndex &&
                          dIdx === overrideProgress.dayIndex;
                        const isHighlighted = isAutoDay || isSelected;

                        return (
                          <button
                            key={`${wIdx}-${dIdx}`}
                            type="button"
                            onClick={() => {
                              setOverrideProgress({
                                weekIndex: wIdx,
                                dayIndex: dIdx,
                                cycleNumber: selectedProgramProgress?.cycleNumber ?? 1,
                              });
                              setDayPickerOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${isHighlighted
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                              }`}
                          >
                            <span className="w-8 shrink-0 font-bold text-zinc-600">
                              {day.dayOfWeek}
                            </span>
                            <span className="font-medium">{day.name}</span>
                            {isAutoDay && (
                              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                                Next
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
