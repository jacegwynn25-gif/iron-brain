'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, ChevronRight, ChevronUp, Play, RotateCcw } from 'lucide-react';
import { getProgramProgress, resolveProgramDay, type ProgramProgress } from '../lib/programs/progress';
import { buildExerciseCatalog, resolveExerciseDisplayName } from '../lib/exercises/catalog';
import { useAuth } from '../lib/supabase/auth-context';
import { useProgramContext } from '../providers/ProgramProvider';
import QuickLogConfirm from '../components/workout/QuickLogConfirm';
import { liquidButtonClass } from '../components/ui/liquid';
import type { DayTemplate } from '../lib/types';

type RecentProgram = {
  id: string;
  name: string;
};

type MovementPreview = {
  id: string;
  name: string;
  setCount: number;
  slot?: string;
};

const startExerciseCatalog = buildExerciseCatalog();

function resolvePreviewExerciseName(exerciseId: string): string {
  return resolveExerciseDisplayName(exerciseId, { catalog: startExerciseCatalog });
}

function getMovementPreview(day: DayTemplate | null | undefined): MovementPreview[] {
  if (!day) return [];

  if (day.blocks && day.blocks.length > 0) {
    return day.blocks.flatMap((block) =>
      block.exercises.map((exercise) => ({
        id: exercise.id || exercise.exerciseId,
        name: resolvePreviewExerciseName(exercise.exerciseId),
        setCount: exercise.sets.length,
        slot: block.type === 'superset' ? exercise.slot : undefined,
      }))
    );
  }

  const grouped = new Map<string, MovementPreview>();
  day.sets?.forEach((set) => {
    const existing = grouped.get(set.exerciseId);
    if (existing) {
      existing.setCount += 1;
      return;
    }
    grouped.set(set.exerciseId, {
      id: set.exerciseId,
      name: resolvePreviewExerciseName(set.exerciseId),
      setCount: 1,
    });
  });

  return Array.from(grouped.values());
}

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
    const legacyMovementCount = new Set((day.sets ?? []).map((set) => set.exerciseId).filter(Boolean)).size;

    return {
      movementCount: blockMovementCount || legacyMovementCount || (legacySetCount > 0 ? 1 : 0),
      setCount: blockSetCount || legacySetCount,
    };
  }, [selectedProgramDay]);

  const movementPreview = useMemo(
    () => getMovementPreview(selectedProgramDay?.day),
    [selectedProgramDay?.day]
  );
  const visibleMovementPreview = movementPreview.slice(0, 6);
  const hiddenMovementCount = Math.max(0, movementPreview.length - visibleMovementPreview.length);

  const nextSessionTitle = loading
    ? 'Loading programs...'
    : selectedProgram?.name ?? 'No program selected';
  const nextSessionSubtitle = selectedProgramDay?.day
    ? `${selectedProgramDay.day.dayOfWeek} / ${selectedProgramDay.day.name}`
    : null;
  const primaryActionLabel = 'Start training';
  const dayControlText = selectedProgramDay?.day
    ? `Week ${selectedProgramDay.weekNumber} / ${selectedProgramDay.day.dayOfWeek}`
    : 'Choose day';
  const programControlText = selectedProgram?.name ?? (availablePrograms.length > 0 ? 'Choose program' : 'Programs');
  const programControlLabel = selectedProgram ? `Change program, ${selectedProgram.name}` : 'Choose program';

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

          <div
            className={`liquid-control-strip grid gap-1 p-1 ${selectedProgram && selectedProgramDay?.day
              ? 'grid-cols-[1fr_1.12fr_1fr]'
              : 'grid-cols-2'
            }`}
          >
            {selectedProgram && selectedProgramDay?.day && (
              <button
                type="button"
                onClick={() => {
                  setDayPickerOpen((prev) => !prev);
                  setProgramPickerOpen(false);
                }}
                aria-label={overrideProgress ? `Custom day, ${dayControlText}` : `Training day, ${dayControlText}`}
                aria-expanded={dayPickerOpen}
                className="liquid-control-button flex min-h-12 items-center justify-between gap-2 px-2.5 py-2.5 text-left sm:px-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {overrideProgress ? 'Custom day' : dayControlText}
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
              aria-label={programControlLabel}
              aria-expanded={programPickerOpen}
              className="liquid-control-button flex min-h-12 items-center justify-between gap-2 px-2.5 py-2.5 text-left sm:px-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{programControlText}</span>
              {programPickerOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
              )}
            </button>

            <button
              type="button"
              aria-label="Start freestyle session"
              onClick={() => setQuickLogConfirmOpen(true)}
              className="liquid-control-button flex min-h-12 items-center justify-between gap-2 px-2.5 py-2.5 text-left sm:px-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">Freestyle</span>
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
              className="text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Reset to scheduled day
            </button>
          )}

          {selectedProgram && dayPickerOpen && (
            <div className="liquid-menu max-h-72 overflow-y-auto p-3">
              {selectedProgram.weeks.map((week, wIdx) => (
                <div key={wIdx} className="mb-3 last:mb-0">
                  <p className="mb-1.5 px-1 text-[11px] font-semibold text-zinc-500">
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
                            ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                            : 'border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                            }`}
                        >
                          <span className="w-8 shrink-0 text-xs font-black italic text-zinc-500">
                            {day.dayOfWeek}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{day.name}</span>
                          {isAutoDay && (
                            <span className="shrink-0 text-[11px] font-semibold text-emerald-500">
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
            <div className="liquid-menu p-3">
              {availablePrograms.length > 0 ? (
                <div className="grid gap-1">
                  {availablePrograms.map((program) => {
                    const isActive = program.id === selectedProgram?.id;

                    return (
                      <button
                        key={program.id}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setProgramPickerOpen(false);
                            return;
                          }
                          handleProgramSelect(program.id);
                        }}
                        className={`group flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${isActive
                          ? 'border-white/12 bg-white/[0.075] text-zinc-50'
                          : 'border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.055] hover:text-zinc-50'
                        }`}
                      >
                        <span className="min-w-0 flex-1 break-words text-xs font-bold leading-snug">
                          {program.name}
                        </span>
                        {isActive ? (
                          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/programs')}
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-900"
                >
                  <span className="text-xs font-semibold text-zinc-400">Build or pick a program</span>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </button>
              )}
            </div>
          )}

          {visibleMovementPreview.length > 0 && (
            <div className="border-t border-white/8 pt-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-200">On deck</p>
                <span className="shrink-0 text-xs text-zinc-500">
                  {movementPreview.length} {movementPreview.length === 1 ? 'movement' : 'movements'}
                </span>
              </div>
              <div className="mt-2 divide-y divide-white/[0.055]">
                {visibleMovementPreview.map((movement, index) => (
                  <div key={`${movement.id}-${index}`} className="flex min-h-11 items-center gap-3 py-2">
                    <span className="w-5 shrink-0 text-xs font-black italic text-zinc-600">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                      {movement.name}
                    </span>
                    {movement.slot && (
                      <span className="shrink-0 text-xs font-semibold text-zinc-500">{movement.slot}</span>
                    )}
                    <span className="shrink-0 text-xs text-zinc-500">
                      {movement.setCount} {movement.setCount === 1 ? 'set' : 'sets'}
                    </span>
                  </div>
                ))}
              </div>
              {hiddenMovementCount > 0 && (
                <p className="pt-2 text-xs text-zinc-500">+{hiddenMovementCount} more</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
