'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Activity, BookOpen, History as HistoryIcon, RotateCcw, Sparkles } from 'lucide-react';
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
      label: 'Programs',
      href: '/programs',
      icon: BookOpen,
      description: 'Build, edit, and select plans.',
    },
    {
      label: 'Quick Start',
      href: '/workout/new?type=empty',
      icon: RotateCcw,
      description: 'Freeform workout builder.',
    },
    {
      label: 'History',
      href: '/history',
      icon: HistoryIcon,
      description: 'Review completed sessions.',
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
        <section className="border-b border-zinc-900 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-8">
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

            <div className="flex flex-col gap-3 text-sm text-zinc-300">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                <Sparkles className="h-3.5 w-3.5" />
                Today’s Focus
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-500">Upper</span>
                <span className="font-semibold text-zinc-100">
                  {formatModifier(upperModifier)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-500">Lower</span>
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/start"
              className="flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
            >
              Start Session
            </Link>

            <Link
              href="/programs"
              className="flex-1 rounded-2xl border border-zinc-800 px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 transition-colors hover:border-zinc-600"
            >
              Programs
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
            Quick Actions
          </p>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center justify-between border-b border-zinc-900 py-4 text-left transition-colors hover:text-white"
                >
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                      {action.label}
                    </p>
                    <p className="text-lg font-semibold text-zinc-100">{action.description}</p>
                  </div>
                  <Icon className="h-5 w-5 text-zinc-500" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
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
