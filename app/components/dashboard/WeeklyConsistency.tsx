'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface WeeklyConsistencyProps {
    workoutDates: string[]; // Local YYYY-MM-DD date keys
    loading?: boolean;
    compact?: boolean;
}

function formatLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function WeeklyConsistency({ workoutDates, loading, compact = false }: WeeklyConsistencyProps) {
    const days = useMemo(() => {
        const today = new Date();
        const workoutDateSet = new Set(workoutDates);
        const result = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const iso = formatLocalDateKey(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
            const isToday = i === 0;
            const hasWorkout = workoutDateSet.has(iso);

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
            <div className={`${compact ? 'px-1 py-1' : 'border-y border-white/8 py-4'} animate-pulse`}>
                <div className="flex justify-between gap-2">
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className={`flex flex-col items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
                            <div className="h-3 w-3 rounded-full bg-zinc-800"></div>
                            <div className="h-2 w-4 bg-zinc-800 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`overflow-hidden ${compact ? 'px-1 py-1' : 'border-y border-white/8 py-4 sm:py-5'}`}>
            {!compact && (
                <div className="mb-3 flex items-center justify-between sm:mb-5">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:text-[10px]">Activity</span>
                    </div>
                    <span className="text-[9px] font-bold text-zinc-400 sm:text-[10px]">14 days</span>
                </div>
            )}

            <div className={`flex items-end justify-between ${compact ? 'gap-0.5' : 'gap-0.5 sm:gap-2'}`}>
                {days.map((day) => (
                    <div key={day.iso} className={`flex flex-1 flex-col items-center ${compact ? 'gap-1' : 'gap-2 sm:gap-3'}`}>
                        <div
                            className={`relative rounded-full transition-all duration-500 ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2 sm:h-2.5 sm:w-2.5'} ${day.hasWorkout
                                ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                : 'bg-zinc-800'
                                }`}
                        >
                            {day.isToday && (
                                <div className="absolute -inset-0.5 animate-ping rounded-full border border-emerald-500/20 sm:-inset-1.5" />
                            )}
                        </div>
                        <span className={`${compact ? 'text-[7px] leading-none' : 'text-[8px] sm:text-[10px]'} font-bold uppercase ${day.isToday ? 'text-zinc-100' : 'text-zinc-500'}`}>
                            {day.dayName}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
