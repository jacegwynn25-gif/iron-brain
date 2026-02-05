'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';

type Tone = {
  color: string;
  tag: string;
};

function getTone(score: number): Tone {
  if (score < 50) {
    return { color: 'text-red-400', tag: 'Recovery Focused' };
  }

  if (score > 80) {
    return { color: 'text-emerald-400', tag: 'High Performance' };
  }

  return { color: 'text-amber-400', tag: 'Balanced' };
}

export default function Dashboard() {
  const { readiness, loading, error } = useRecoveryState();
  const score = readiness?.score ?? 0;
  const tone = useMemo(() => getTone(score), [score]);
  const message = readiness?.recommendation ?? tone.tag;

  const quickActions = [
    {
      label: 'Empty Session',
      href: '/workout/new?type=empty',
      icon: Play,
    },
    {
      label: 'Resume Program',
      href: '/start',
      icon: RotateCcw,
    },
  ];

  const weeklyActivity = [
    { day: 'M', active: true },
    { day: 'T', active: false },
    { day: 'W', active: true },
    { day: 'T', active: false },
    { day: 'F', active: true },
    { day: 'S', active: false },
    { day: 'S', active: true },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col pt-[max(env(safe-area-inset-top),2rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] px-6">
      <div className="flex flex-col gap-12">
        <header className="space-y-2">
          <p className="text-xs font-bold text-zinc-500 tracking-[0.2em]">SESSION READINESS</p>
          <p className="text-8xl font-black text-white leading-none tracking-tighter">{Math.round(score)}</p>
          <p className={`text-xl font-medium italic ${tone.color}`}>{message}</p>
          {error && (
            <p className="text-sm text-red-400">Unable to load Spotter data.</p>
          )}
          {loading && !error && (
            <p className="text-sm text-zinc-600">Loading Spotter...</p>
          )}
        </header>

        <section>
          <p className="text-xs font-bold text-zinc-600 mb-6 tracking-widest">QUICK ACTIONS</p>
          <div className="flex flex-col">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex items-center gap-5 py-5 border-b border-zinc-900 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-black italic text-white group-hover:text-emerald-400 transition-colors">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-xs font-bold text-zinc-600 mb-6 tracking-widest">RECENT ACTIVITY</p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center py-4">
              {weeklyActivity.map((day, index) => (
                <div key={`${day.day}-${index}`} className="flex flex-col items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${day.active ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                  />
                  <span className="text-[10px] text-zinc-600">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
