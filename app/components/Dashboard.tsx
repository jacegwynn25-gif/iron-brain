'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Activity, ArrowRight, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';

type Tone = {
  color: string;
  glow: string;
  tag: string;
};

function getTone(score: number): Tone {
  if (score < 50) {
    return { color: '#f87171', glow: 'rgba(248,113,113,0.45)', tag: 'Recovery Focused' };
  }

  if (score > 80) {
    return { color: '#34d399', glow: 'rgba(52,211,153,0.45)', tag: 'High Performance' };
  }

  return { color: '#facc15', glow: 'rgba(250,204,21,0.4)', tag: 'Balanced' };
}

function formatModifier(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--';
  return `${Math.round(value * 100)}%`;
}

export default function Dashboard() {
  const { readiness, loading, error, lastUpdated } = useRecoveryState();
  const score = readiness?.score ?? 0;
  const tone = useMemo(() => getTone(score), [score]);
  const message = readiness?.recommendation ?? tone.tag;
  const upperModifier = readiness?.focus_adjustments?.upper_body_modifier;
  const lowerModifier = readiness?.focus_adjustments?.lower_body_modifier;

  const quickActions = [
    {
      label: 'Start Session',
      href: '/start',
      icon: Play,
      description: 'Jump into today’s flow.',
    },
    {
      label: 'Quick Start',
      href: '/workout/new?type=empty',
      icon: RotateCcw,
      description: 'Freeform workout builder.',
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
    <div className="mx-auto w-full max-w-5xl pb-6 pt-6 sm:pt-10">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(40rem 40rem at 12% 18%, rgba(16,185,129,0.12), transparent 60%), radial-gradient(32rem 32rem at 88% 22%, rgba(59,130,246,0.12), transparent 65%)',
            }}
          />
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                  Session Readiness
                </p>
                <p className="text-[clamp(3.5rem,10vw,6.5rem)] font-black italic leading-none text-white">
                  {loading ? '--' : Math.round(score)}
                </p>
                <p
                  className="text-lg font-medium italic"
                  style={{ color: tone.color, textShadow: `0 0 18px ${tone.glow}` }}
                >
                  {message}
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Today’s Focus
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-zinc-400">Upper</span>
                  <span className="font-semibold text-zinc-100">
                    {formatModifier(upperModifier)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-zinc-400">Lower</span>
                  <span className="font-semibold text-zinc-100">
                    {formatModifier(lowerModifier)}
                  </span>
                </div>
                {lastUpdated && (
                  <span className="text-[11px] text-zinc-500">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {error && (
                  <span className="text-xs text-rose-400">Spotter data unavailable.</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/start"
                className="group flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/70 px-5 py-4 text-left transition-all hover:border-emerald-500/60"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Gym Floor</p>
                  <p className="text-xl font-black italic text-white">Start Today’s Session</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
                  <Play className="h-5 w-5" />
                </div>
              </Link>

              <Link
                href="/history"
                className="group flex flex-1 items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 px-5 py-4 text-left transition-all hover:border-white/20"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Library</p>
                  <p className="text-xl font-black italic text-white">Review History</p>
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-zinc-200 transition-colors" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/40 px-6 py-6 backdrop-blur-xl transition-all hover:border-emerald-500/40"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(120deg, rgba(16,185,129,0.18), transparent 55%)',
                  }}
                />
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                      {action.label}
                    </p>
                    <p className="text-lg font-semibold text-zinc-100">{action.description}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-emerald-300">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-zinc-900/30 px-6 py-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
            <Activity className="h-4 w-4 text-emerald-400" />
            Momentum
          </div>
          <div className="flex items-center justify-between gap-3">
            {weeklyActivity.map((day, index) => (
              <div key={`${day.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                <span
                  className={`h-2 w-full rounded-full ${
                    day.active ? 'bg-emerald-500' : 'bg-zinc-800'
                  }`}
                />
                <span className="text-[11px] text-zinc-500">{day.day}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
