'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Timer, ChevronUp } from 'lucide-react';
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
        <button
            type="button"
            onClick={() => router.push('/workout/new')}
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.6rem)] z-[69] mx-auto flex w-full max-w-2xl items-center justify-between gap-3 border-t border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2.5 backdrop-blur-xl transition-colors hover:bg-emerald-500/[0.14] active:bg-emerald-500/20"
        >
            <div className="flex items-center gap-2.5 overflow-hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Timer className="h-3.5 w-3.5 text-emerald-400" />
                </span>
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="truncate text-xs font-bold text-emerald-200">
                        {displayName}
                        {weekLabel && (
                            <span className="ml-1.5 text-[10px] font-semibold text-emerald-400/70">
                                {weekLabel}
                            </span>
                        )}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                        {completed}/{total} sets
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                    {elapsed}
                </span>
                <ChevronUp className="h-4 w-4 text-emerald-400/60" />
            </div>
        </button>
    );
}
