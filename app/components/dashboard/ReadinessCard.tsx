'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ClipboardCheck } from 'lucide-react';
import type { TrainingReadiness } from '@/app/lib/intelligence/recovery-integration-service';

interface ReadinessCardProps {
    readiness: TrainingReadiness | null;
    loading?: boolean;
}

export function ReadinessCard({ readiness, loading }: ReadinessCardProps) {
    const score = readiness?.score ?? 0;
    const explanation = readiness?.explanation;

    // Define color mapping
    const getReadinessColor = (s: number) => {
        if (s >= 80) return { primary: 'text-emerald-400', bg: 'bg-emerald-500', glow: 'rgba(52,211,153,0.2)' };
        if (s >= 50) return { primary: 'text-amber-400', bg: 'bg-amber-500', glow: 'rgba(245,158,11,0.2)' };
        return { primary: 'text-rose-400', bg: 'bg-rose-500', glow: 'rgba(244,63,94,0.2)' };
    };

    const style = getReadinessColor(score);

    if (loading) {
        return (
            <div className="surface-card p-6 animate-pulse">
                <div className="h-4 w-24 bg-zinc-800 rounded mb-4"></div>
                <div className="flex items-center gap-6">
                    <div className="h-24 w-24 rounded-full bg-zinc-800"></div>
                    <div className="flex-1 space-y-3">
                        <div className="h-8 bg-zinc-800 rounded w-3/4"></div>
                        <div className="h-4 bg-zinc-800 rounded w-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-900 bg-zinc-950/40 p-0.5 sm:rounded-[2rem] sm:p-1">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: `radial-gradient(circle at 96% 22%, ${style.glow} 0%, rgba(0,0,0,0) 48%)`,
                }}
            />

            <div className="surface-card relative h-full rounded-[1.65rem] p-4 sm:rounded-[1.85rem] sm:p-8">
                <div className="flex items-center justify-between gap-4 sm:gap-6 sm:flex-row">
                    <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className={`h-3 w-3 sm:h-4 sm:w-4 ${style.primary}`} />
                            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px] sm:tracking-[0.3em]">Readiness</span>
                        </div>

                        <div className="space-y-0.5 sm:space-y-1">
                            <h2 className="line-clamp-1 text-lg font-black italic tracking-tight text-zinc-100 sm:line-clamp-none sm:text-4xl">
                                {readiness?.recommendation || 'System Check...'}
                            </h2>
                            <p className="line-clamp-2 max-w-md text-[10px] leading-snug text-zinc-400 sm:line-clamp-none sm:text-sm sm:leading-relaxed">
                                {readiness?.reason || 'Analyzing recovery data.'}
                            </p>
                            {explanation && (
                                <p className="max-w-md text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:text-[10px]">
                                    {readiness.confidence} confidence / {readiness.dataSufficiency} data / {explanation.nextAction}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-0.5 sm:gap-4 sm:pt-2">
                            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
                                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">UP</span>
                                <span className="text-[10px] font-bold text-zinc-100 sm:text-xs">{Math.round((readiness?.focus_adjustments.upper_body_modifier ?? 1) * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
                                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">LO</span>
                                <span className="text-[10px] font-bold text-zinc-100 sm:text-xs">{Math.round((readiness?.focus_adjustments.lower_body_modifier ?? 1) * 100)}%</span>
                            </div>
                            <Link
                                href="/checkin"
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/70 bg-emerald-400 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-950 shadow-[0_16px_34px_-22px_rgba(52,211,153,0.95)] transition-colors hover:bg-emerald-300 active:bg-emerald-500 sm:min-h-11 sm:px-5 sm:text-[11px]"
                            >
                                <ClipboardCheck className="h-4 w-4" strokeWidth={3} />
                                Daily Check-In
                            </Link>
                        </div>
                    </div>

                    <div className="relative flex-shrink-0 flex items-center justify-center">
                        {/* Score Ring */}
                        <div className="relative h-20 w-20 sm:h-40 sm:w-40">
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
                                <span className="text-2xl font-black italic tracking-tighter text-zinc-100 sm:text-4xl">{score}</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">Score</span>
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
