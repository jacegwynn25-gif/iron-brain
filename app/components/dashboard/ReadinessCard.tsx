'use client';

import Link from 'next/link';
import { Activity, ClipboardCheck } from 'lucide-react';
import type { TrainingReadiness } from '@/app/lib/intelligence/recovery-integration-service';

interface ReadinessCardProps {
    readiness: TrainingReadiness | null;
    loading?: boolean;
}

export function ReadinessCard({ readiness, loading }: ReadinessCardProps) {
    const score = readiness?.score ?? 0;
    const headline =
        !readiness
            ? 'CHECK-IN READY'
            : score >= 88
                ? 'GOOD TRAINING WINDOW'
                : score >= 70
                    ? 'NORMAL SESSION'
                    : score >= 50
                        ? 'KEEP LOAD JUMPS SMALL'
                        : 'LIGHTER SESSION';
    const sourceLabel =
        readiness?.source === 'manual'
            ? 'Check-in + training load'
            : readiness?.source === 'training'
                ? 'Recent training load'
                : 'Not enough recent data';
    const nextAction =
        readiness?.score == null
            ? 'Log a check-in or finish a workout'
            : readiness.score >= 70
                ? 'Use planned targets and let RPE guide changes'
                : readiness.score >= 50
                    ? 'Avoid aggressive jumps today'
                    : 'Reduce load or trim volume';
    const upperModifier = Math.round((readiness?.focus_adjustments.upper_body_modifier ?? 1) * 100);
    const lowerModifier = Math.round((readiness?.focus_adjustments.lower_body_modifier ?? 1) * 100);
    const showFocusCaps = Boolean(readiness) && (upperModifier < 100 || lowerModifier < 100);

    // Define color mapping
    const getReadinessColor = (s: number) => {
        if (s >= 80) return { primary: 'text-emerald-400', bg: 'bg-emerald-500', glow: 'rgba(52,211,153,0.2)' };
        if (s >= 50) return { primary: 'text-amber-400', bg: 'bg-amber-500', glow: 'rgba(245,158,11,0.2)' };
        return { primary: 'text-rose-400', bg: 'bg-rose-500', glow: 'rgba(244,63,94,0.2)' };
    };

    const style = getReadinessColor(score);

    if (loading) {
        return (
            <div className="surface-card animate-pulse rounded-[1rem] p-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-zinc-800"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/3 rounded bg-zinc-800"></div>
                        <div className="h-2 rounded bg-zinc-800"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-[1rem] border border-zinc-900 bg-zinc-950/40 p-0.5 sm:rounded-[1.35rem]">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 96% 22%, ${style.glow} 0%, rgba(0,0,0,0) 48%)`,
                }}
            />

            <div className="surface-card relative h-full rounded-[0.9rem] p-3.5 sm:rounded-[1.2rem] sm:p-5">
                <div className="flex items-start justify-between gap-3 sm:gap-5">
                    <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <Activity className={`h-3.5 w-3.5 ${style.primary}`} />
                            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px]">Training Estimate</span>
                        </div>

                        <div>
                            <h2 className="text-lg font-black italic leading-tight tracking-normal text-zinc-100 sm:text-3xl">
                                {headline}
                            </h2>
                            <p className="mt-1 max-w-[15rem] text-[11px] font-semibold leading-snug text-zinc-500 sm:max-w-none sm:text-xs">
                                {sourceLabel}. {readiness?.confidence ?? 'low'} confidence.
                            </p>
                        </div>

                        <div className="min-w-0">
                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                                <div
                                    className={`h-full rounded-full ${style.bg}`}
                                    style={{ width: `${Math.max(6, Math.min(100, score))}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-zinc-400">{nextAction}</p>
                        </div>

                        {showFocusCaps && (
                            <div className="flex flex-wrap gap-1.5">
                                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Upper cap</p>
                                    <p className="text-[10px] font-black text-zinc-100">{upperModifier}%</p>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                                    <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Lower cap</p>
                                    <p className="text-[10px] font-black text-zinc-100">{lowerModifier}%</p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-0.5">
                            <Link
                                href="/checkin"
                                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-300/70 bg-emerald-400 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-950 shadow-[0_16px_34px_-22px_rgba(52,211,153,0.95)] transition-colors hover:bg-emerald-300 active:bg-emerald-500 sm:min-h-10 sm:px-4 sm:text-[11px]"
                            >
                                <ClipboardCheck className="h-4 w-4" strokeWidth={3} />
                                Check-In
                            </Link>
                        </div>
                    </div>

                    <div className="relative flex shrink-0 items-center justify-center">
                        {/* Score Ring */}
                        <div className="relative h-16 w-16 sm:h-24 sm:w-24">
                            <svg className="h-full w-full" viewBox="0 0 100 100">
                                {/* Background Track */}
                                <circle
                                    className="stroke-zinc-800"
                                    strokeWidth="8"
                                    fill="transparent"
                                    r="42"
                                    cx="50"
                                    cy="50"
                                />
                                {/* Progress Circle */}
                                <circle
                                    className={`${style.primary} transition-all duration-1000 ease-out`}
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 42}`}
                                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`}
                                    strokeLinecap="round"
                                    fill="transparent"
                                    r="42"
                                    cx="50"
                                    cy="50"
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                                />
                            </svg>

                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-black italic tracking-tighter text-zinc-100 sm:text-3xl">{score}</span>
                                <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px]">Est.</span>
                            </div>
                        </div>

                        {/* Decorative Glow */}
                        <div className={`absolute inset-0 -z-10 blur-2xl opacity-20 sm:blur-3xl ${style.bg}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
