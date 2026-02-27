'use client';

import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface WeeklyConsistencyProps {
    workoutDates: string[]; // ISO date strings
    loading?: boolean;
}

export function WeeklyConsistency({ workoutDates, loading }: WeeklyConsistencyProps) {
    const days = useMemo(() => {
        const today = new Date();
        const result = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const iso = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
            const isToday = i === 0;
            const hasWorkout = workoutDates.some(d => d.startsWith(iso));

            result.push({
                iso,
                dayName,
                isToday,
                hasWorkout,
            });
        }
        return result;
    }, [workoutDates]);

    if (loading) {
        return (
            <div className="surface-card p-6 py-8 animate-pulse">
                <div className="flex justify-between gap-2">
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-zinc-800"></div>
                            <div className="h-2 w-4 bg-zinc-800 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="surface-card overflow-hidden p-5 py-6 sm:p-6 sm:py-8">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
                <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px] sm:tracking-[0.35em]">Activity & Consistency</span>
                </div>
                <span className="text-[9px] font-bold text-zinc-400 sm:text-[10px]">Past 14 Days</span>
            </div>

            <div className="flex items-end justify-between gap-0.5 sm:gap-2">
                {days.map((day) => (
                    <div key={day.iso} className="flex flex-1 flex-col items-center gap-2.5 sm:gap-3">
                        <div
                            className={`relative h-2 w-2 rounded-full transition-all duration-500 sm:h-2.5 sm:w-2.5 ${day.hasWorkout
                                ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                : 'bg-zinc-800'
                                }`}
                        >
                            {day.isToday && (
                                <div className="absolute -inset-1 animate-ping rounded-full border border-emerald-500/20 sm:-inset-1.5" />
                            )}
                        </div>
                        <span className={`text-[9px] font-bold uppercase sm:text-[10px] ${day.isToday ? 'text-zinc-100' : 'text-zinc-500'}`}>
                            {day.dayName}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
