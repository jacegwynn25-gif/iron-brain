'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import SessionLogger from '@/app/components/workout/SessionLogger';
import { getProgramProgress, type ProgramProgress } from '@/app/lib/programs/progress';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { useProgramContext } from '@/app/providers/ProgramProvider';

export default function NewWorkoutPage() {
  const searchParams = useSearchParams();
  const requestedProgramId = searchParams.get('program_id');
  const forceQuickStart = searchParams.get('type') === 'empty';
  const queryWeek = searchParams.get('week');
  const queryDay = searchParams.get('day');
  const queryCycle = searchParams.get('cycle');
  const { user } = useAuth();
  const namespaceId = user?.id ?? 'guest';

  const { allPrograms, selectedProgram, loading, selectProgram } = useProgramContext();

  const queryProgress = useMemo<ProgramProgress | null>(() => {
    const weekIndex = Number(queryWeek);
    const dayIndex = Number(queryDay);
    const cycleNumber = Number(queryCycle);
    const hasWeek = Number.isFinite(weekIndex) && weekIndex >= 0;
    const hasDay = Number.isFinite(dayIndex) && dayIndex >= 0;
    const hasCycle = Number.isFinite(cycleNumber) && cycleNumber >= 1;

    if (!hasWeek || !hasDay) return null;

    return {
      weekIndex,
      dayIndex,
      cycleNumber: hasCycle ? cycleNumber : 1,
    };
  }, [queryCycle, queryDay, queryWeek]);

  const resolvedProgram = useMemo(() => {
    if (forceQuickStart) return null;
    if (requestedProgramId) {
      return allPrograms.find((program) => program.id === requestedProgramId) ?? null;
    }
    return selectedProgram ?? null;
  }, [allPrograms, forceQuickStart, requestedProgramId, selectedProgram]);

  const resolvedProgress = useMemo<ProgramProgress | null>(() => {
    if (forceQuickStart || !resolvedProgram) return null;
    if (queryProgress) return queryProgress;
    return getProgramProgress(resolvedProgram, namespaceId);
  }, [forceQuickStart, namespaceId, queryProgress, resolvedProgram]);

  useEffect(() => {
    if (forceQuickStart || !requestedProgramId || !resolvedProgram) return;
    if (selectedProgram?.id === resolvedProgram.id) return;
    selectProgram(resolvedProgram);
  }, [forceQuickStart, requestedProgramId, resolvedProgram, selectProgram, selectedProgram?.id]);

  if (!forceQuickStart && requestedProgramId && loading && !resolvedProgram) {
    return (
      <div className="mx-auto w-full max-w-3xl py-6">
        <div className="px-4 py-12 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
          Loading Program...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <SessionLogger initialData={resolvedProgram ?? undefined} initialProgress={resolvedProgress} />
    </div>
  );
}
