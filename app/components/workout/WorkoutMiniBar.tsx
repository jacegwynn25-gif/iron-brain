'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Timer, ChevronUp, X } from 'lucide-react';
import { useActiveSessionOptional } from '@/app/providers/ActiveSessionProvider';

function formatElapsed(startTimeIso: string): string {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000));
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${minutes}:${pad(seconds)}`;
}

function countCompletedSets(blocks: Array<{ exercises: Array<{ sets: Array<{ completed: boolean }> }> }>): {
    completed: number;
    total: number;
} {
    let completed = 0;
    let total = 0;
    for (const block of blocks) {
        for (const exercise of block.exercises) {
            for (const set of exercise.sets) {
                total += 1;
                if (set.completed) completed += 1;
            }
        }
    }
    return { completed, total };
}

export default function WorkoutMiniBar() {
    const session = useActiveSessionOptional();
    const pathname = usePathname() ?? '/';
    const router = useRouter();
    const [elapsed, setElapsed] = useState('0:00');

    const isOnWorkoutPage =
        pathname.startsWith('/workout/new') ||
        pathname.startsWith('/workout/active') ||
        pathname === '/workout/readiness' ||
        pathname === '/workout/summary';

    const snapshot = session?.snapshot ?? null;
    const isVisible = snapshot !== null && snapshot.status === 'active' && !isOnWorkoutPage;

    // Tick the timer every second
    useEffect(() => {
        if (!isVisible || !snapshot) return;
        setElapsed(formatElapsed(snapshot.startTime));
        const interval = setInterval(() => {
            setElapsed(formatElapsed(snapshot.startTime));
        }, 1000);
        return () => clearInterval(interval);
    }, [isVisible, snapshot]);

    if (!isVisible || !snapshot) return null;

    const { completed, total } = countCompletedSets(snapshot.blocks);
    const displayName = snapshot.meta.dayName
        ? `${snapshot.meta.dayName}`
        : snapshot.meta.programName;
    const weekLabel = snapshot.meta.weekNumber ? `W${snapshot.meta.weekNumber}` : null;

    return (
        <div className="liquid-sheet-panel fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.35rem)] z-[69] mx-auto flex max-w-2xl items-center gap-2 p-1.5">
            <button
                type="button"
                onClick={() => router.push('/workout/new')}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.045] active:bg-white/[0.065]"
            >
                <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                        <Timer className="h-3.5 w-3.5 text-emerald-400" />
                    </span>
                    <div className="flex min-w-0 flex-col items-start overflow-hidden">
                        <span className="truncate text-xs font-bold text-emerald-200">
                            {displayName}
                            {weekLabel && (
                                <span className="ml-1.5 text-[10px] font-semibold text-emerald-400/70">
                                    {weekLabel}
                                </span>
                            )}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400">
                            {completed}/{total} sets
                        </span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black tabular-nums tracking-tight text-emerald-300">
                        {elapsed}
                    </span>
                    <ChevronUp className="h-4 w-4 text-emerald-400/60" />
                </div>
            </button>
            <button
                type="button"
                onClick={() => session?.clearSession()}
                className="liquid-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:text-rose-300 active:bg-rose-500/15"
                aria-label="Clear stuck workout"
                title="Clear stuck workout"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
