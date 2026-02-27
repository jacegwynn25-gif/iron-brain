'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import type { TrainingReadiness } from '@/app/lib/intelligence/recovery-integration-service';

interface ReadinessCardProps {
    readiness: TrainingReadiness | null;
    loading?: boolean;
}

export function ReadinessCard({ readiness, loading }: ReadinessCardProps) {
    const score = readiness?.score ?? 0;

    // Define color mapping
    const getReadinessColor = (s: number) => {
        if (s >= 80) return { primary: 'text-emerald-400', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30' };
        if (s >= 50) return { primary: 'text-amber-400', bg: 'bg-amber-500', glow: 'shadow-amber-500/20', border: 'border-amber-500/30' };
        return { primary: 'text-rose-400', bg: 'bg-rose-500', glow: 'shadow-rose-500/20', border: 'border-rose-500/30' };
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
            {/* Background Glow */}
            <div
                className={`absolute -right-20 -top-20 h-64 w-64 opacity-10 blur-[80px] rounded-full ${style.bg}`}
            />

            <div className="surface-card relative h-full rounded-[1.65rem] p-5 sm:rounded-[1.85rem] sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${style.primary}`} />
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px] sm:tracking-[0.3em]">Training Readiness</span>
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-2xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">
                                {readiness?.recommendation || 'System Check...'}
                            </h2>
                            <p className="max-w-md text-xs leading-relaxed text-zinc-400 sm:text-sm">
                                {readiness?.reason || 'Wait while we analyze your latest recovery data.'}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-1 sm:gap-4 sm:pt-2">
                            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 sm:px-3 sm:py-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">Upper</span>
                                <span className="text-[11px] font-bold text-zinc-100 sm:text-xs">{Math.round((readiness?.focus_adjustments.upper_body_modifier ?? 1) * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 sm:px-3 sm:py-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">Lower</span>
                                <span className="text-[11px] font-bold text-zinc-100 sm:text-xs">{Math.round((readiness?.focus_adjustments.lower_body_modifier ?? 1) * 100)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex-shrink-0 flex items-center justify-center py-2 sm:py-0">
                        {/* Score Ring */}
                        <div className="relative h-28 w-28 sm:h-40 sm:w-40">
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
                                <span className="text-3xl font-black italic tracking-tighter text-zinc-100 sm:text-4xl">{score}</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 sm:text-[10px]">Score</span>
                            </div>
                        </div>

                        {/* Decorative Glow */}
                        <div className={`absolute inset-0 -z-10 blur-3xl opacity-20 ${style.bg}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
