'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronUp, Play, RotateCcw } from 'lucide-react';
import { getProgramProgress, resolveProgramDay, type ProgramProgress } from '../lib/programs/progress';
import { useAuth } from '../lib/supabase/auth-context';
import { useProgramContext } from '../providers/ProgramProvider';
import QuickLogConfirm from '../components/workout/QuickLogConfirm';
import { liquidButtonClass } from '../components/ui/liquid';

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
  const [programPickerOpen, setProgramPickerOpen] = useState(false);
  const [overrideProgress, setOverrideProgress] = useState<ProgramProgress | null>(null);
  const [quickLogConfirmOpen, setQuickLogConfirmOpen] = useState(false);

  useEffect(() => {
    setOverrideProgress(null);
    setDayPickerOpen(false);
    setProgramPickerOpen(false);
  }, [selectedProgram?.id]);

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

  const availablePrograms = useMemo<RecentProgram[]>(() => {
    const merged = allPrograms.map((program) => ({ id: program.id, name: program.name }));
    const seen = new Set<string>();

    return merged
      .filter((program) => {
        if (seen.has(program.id)) return false;
        seen.add(program.id);
        return true;
      })
      .slice(0, 8);
  }, [allPrograms]);

  const alternatePrograms = useMemo(
    () => availablePrograms.filter((program) => program.id !== selectedProgram?.id),
    [availablePrograms, selectedProgram?.id]
  );

  const selectedDayStats = useMemo(() => {
    const day = selectedProgramDay?.day;
    if (!day) return { movementCount: 0, setCount: 0 };

    const blockMovementCount = day.blocks?.reduce((total, block) => total + block.exercises.length, 0) ?? 0;
    const blockSetCount =
      day.blocks?.reduce(
        (total, block) => total + block.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
        0
      ) ?? 0;
    const legacySetCount = day.sets?.length ?? 0;

    return {
      movementCount: blockMovementCount || (legacySetCount > 0 ? 1 : 0),
      setCount: blockSetCount || legacySetCount,
    };
  }, [selectedProgramDay]);

  const nextSessionTitle = loading
    ? 'Loading programs...'
    : selectedProgram?.name ?? 'No program selected';
  const nextSessionSubtitle = selectedProgramDay?.day
    ? `${selectedProgramDay.day.dayOfWeek} / ${selectedProgramDay.day.name}`
    : null;
  const primaryActionLabel = selectedProgram ? 'Start program session' : 'Start session';

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
    setQuickLogConfirmOpen(false);
    router.push('/workout/new?type=empty');
  };

  const handleProgramSelect = (programId: string) => {
    const matched = allPrograms.find((program) => program.id === programId) ?? null;
    if (matched) {
      selectProgram(matched);
      setProgramPickerOpen(false);
      setOverrideProgress(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-9 pt-3 sm:space-y-6 sm:pt-8">
      <QuickLogConfirm
        isOpen={quickLogConfirmOpen}
        onClose={() => setQuickLogConfirmOpen(false)}
        onConfirm={handleQuickStart}
      />
      <header className="stagger-item flex items-center justify-between gap-4 px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Start session</h1>
        </div>
        <div className="liquid-icon-button flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10">
          <Play className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
        </div>
      </header>

      <section className="surface-card stagger-item mx-1 overflow-hidden">
        <div className="border-b border-white/8 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="iron-display truncate text-xl leading-tight text-zinc-100 sm:text-2xl">
                {nextSessionTitle}
              </h2>
              {!loading && nextSessionSubtitle && (
                <p className="mt-1 max-w-xl truncate text-xs text-zinc-500 sm:text-sm">
                  {nextSessionSubtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push('/programs')}
              className="liquid-icon-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:text-zinc-100"
              aria-label="Open programs"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </div>

          {selectedProgramDay && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
              <>
                <span>Cycle {selectedProgramDay.cycleNumber}</span>
                <span>Week {selectedProgramDay.weekNumber}</span>
                <span>{selectedDayStats.setCount} sets</span>
              </>
            </div>
          )}
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <button
            type="button"
            onClick={handleStartSession}
            disabled={loading}
            className={liquidButtonClass({
              variant: 'action',
              className: 'min-h-14 w-full justify-between px-5 text-left sm:px-6',
            })}
          >
            <span>
              {loading ? 'Loading programs' : primaryActionLabel}
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className={`grid gap-2.5 ${selectedProgram && selectedProgramDay?.day ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {selectedProgram && selectedProgramDay?.day && (
              <button
                type="button"
                onClick={() => {
                  setDayPickerOpen((prev) => !prev);
                  setProgramPickerOpen(false);
                }}
                aria-expanded={dayPickerOpen}
                className="surface-panel flex min-h-12 items-center justify-between px-2.5 py-2.5 text-left transition-colors hover:border-white/12 hover:bg-white/[0.06] sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-zinc-500">Day</span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-zinc-100">
                    {overrideProgress ? 'Custom' : selectedProgramDay.day.dayOfWeek}
                  </span>
                </span>
                {dayPickerOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setProgramPickerOpen((prev) => !prev);
                setDayPickerOpen(false);
              }}
              aria-expanded={programPickerOpen}
              className="surface-panel flex min-h-12 items-center justify-between px-2.5 py-2.5 text-left transition-colors hover:border-white/12 hover:bg-white/[0.06] sm:px-3"
            >
              <span className="min-w-0">
                <span className="block text-xs text-zinc-500">Program</span>
                <span className="mt-0.5 block truncate text-sm font-medium text-zinc-100">Select</span>
              </span>
              {programPickerOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setQuickLogConfirmOpen(true)}
              className="surface-panel flex min-h-12 items-center justify-between px-2.5 py-2.5 text-left transition-colors hover:border-white/12 hover:bg-white/[0.06] sm:px-3"
            >
              <span className="min-w-0">
                <span className="block text-xs text-zinc-500">Empty</span>
                <span className="mt-0.5 block truncate text-sm font-medium text-zinc-100">Freestyle</span>
              </span>
              <RotateCcw className="hidden h-4 w-4 shrink-0 text-zinc-100/40 sm:block" />
            </button>
          </div>

          {overrideProgress && (
            <button
              type="button"
              onClick={() => {
                setOverrideProgress(null);
                setDayPickerOpen(false);
              }}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Reset to next scheduled day
            </button>
          )}

          {selectedProgram && dayPickerOpen && (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-3">
              {selectedProgram.weeks.map((week, wIdx) => (
                <div key={wIdx} className="mb-3 last:mb-0">
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-zinc-600">
                    Week {week.weekNumber}
                  </p>
                  <div className="grid gap-1">
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
                          className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${isHighlighted
                            ? 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                            : 'border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                            }`}
                        >
                          <span className="w-8 shrink-0 text-[10px] font-black italic text-zinc-500">
                            {day.dayOfWeek}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{day.name}</span>
                          {isAutoDay && (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-500">
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

          {programPickerOpen && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-3">
              {alternatePrograms.length > 0 ? (
                <div className="grid gap-1">
                  {alternatePrograms.map((program) => (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => handleProgramSelect(program.id)}
                      className="group flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-emerald-400/25 hover:bg-emerald-400/10"
                    >
                      <span className="min-w-0 flex-1 break-words text-xs font-bold leading-snug text-zinc-200">
                        {program.name}
                      </span>
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600 group-hover:text-emerald-400">
                        Use
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/programs')}
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-900"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Build or pick a program</span>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
