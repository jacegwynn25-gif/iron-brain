'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  History as HistoryIcon,
  RotateCcw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';

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
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const upperModifier = readiness?.focus_adjustments?.upper_body_modifier;
  const lowerModifier = readiness?.focus_adjustments?.lower_body_modifier;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('iron_brain_last_pr_hits');
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | PersonalRecordHit[]
        | { hits?: PersonalRecordHit[]; createdAt?: string };
      const hits = Array.isArray(parsed) ? parsed : parsed.hits ?? [];
      if (hits.length === 0) return;
      setRecentPrHits(hits);
    } catch (error) {
      console.error('Failed to read recent PR hits:', error);
    }
  }, []);

  const prSummary = useMemo(() => {
    if (recentPrHits.length === 0) return [];
    const labels: Record<PersonalRecordHit['recordType'], string> = {
      max_weight: 'Max Weight',
      max_reps: 'Max Reps',
      max_e1rm: 'Max e1RM',
      max_volume: 'Max Volume',
    };
    const grouped = new Map<string, number>();
    recentPrHits.forEach((hit) => {
      const label = labels[hit.recordType];
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    });
    return Array.from(grouped.entries()).map(([label, count]) => ({ label, count }));
  }, [recentPrHits]);

  const dismissPrSummary = () => {
    setRecentPrHits([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('iron_brain_last_pr_hits');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-8 pt-6 sm:pt-10">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Iron Brain</p>
          <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Dashboard</h1>
        </div>
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </header>

      {prSummary.length > 0 && (
        <section className="border-b border-zinc-900 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                New Personal Records
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prSummary.map((entry) => (
                  <span
                    key={entry.label}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300"
                  >
                    {entry.label} {entry.count > 1 ? `x${entry.count}` : ''}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrSummary}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-500 transition-colors hover:text-zinc-200"
              aria-label="Dismiss PR summary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      <section className="pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">Session Readiness</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className="text-[clamp(4.5rem,18vw,8rem)] font-black italic leading-[0.9] text-zinc-100">
            {loading ? '--' : Math.round(score)}
          </p>
          <div className="pb-2 text-right">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">Status</p>
            <p
              className="mt-2 text-base font-medium italic"
              style={{ color: tone.color, textShadow: `0 0 18px ${tone.glow}` }}
            >
              {message}
            </p>
            {lastUpdated && (
              <p className="mt-2 text-[11px] text-zinc-500">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-8 border-t border-zinc-900 pt-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">Upper</span>
            <span className="font-semibold text-zinc-100">{formatModifier(upperModifier)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">Lower</span>
            <span className="font-semibold text-zinc-100">{formatModifier(lowerModifier)}</span>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-rose-400">Spotter data unavailable.</p>}
      </section>

      <section className="mt-10 space-y-3">
        <Link
          href="/start"
          className="flex w-full items-center justify-between rounded-2xl bg-emerald-500 px-6 py-5 text-left text-sm font-black uppercase tracking-[0.3em] text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
        >
          <span>Start Session</span>
          <ArrowRight className="h-5 w-5" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/programs"
            className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-4 text-xs font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <span>Programs</span>
            <BookOpen className="h-4 w-4 text-zinc-400" />
          </Link>

          <Link
            href="/history"
            className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-4 text-xs font-bold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <span>History</span>
            <HistoryIcon className="h-4 w-4 text-zinc-400" />
          </Link>
        </div>

        <Link
          href="/workout/new?type=empty"
          className="inline-flex items-center gap-2 border-b border-zinc-900 py-3 text-xs font-bold uppercase tracking-[0.24em] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <RotateCcw className="h-4 w-4" />
          Quick Start
        </Link>
      </section>
    </div>
  );
}
