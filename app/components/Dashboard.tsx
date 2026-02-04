'use client';

import { useMemo } from 'react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';

function getTone(score: number) {
  if (score < 50) {
    return {
      card: 'shadow-red-500/20 border-red-500/30 text-red-50',
      gradient: 'radial-gradient(circle at center, rgba(239,68,68,0.50) 0%, rgba(239,68,68,0.14) 42%, transparent 72%)',
      tag: 'Recovery Focused',
    };
  }

  if (score > 80) {
    return {
      card: 'shadow-green-500/20 border-green-500/30 text-green-50',
      gradient: 'radial-gradient(circle at center, rgba(34,197,94,0.50) 0%, rgba(34,197,94,0.14) 42%, transparent 72%)',
      tag: 'High Performance',
    };
  }

  return {
    card: 'shadow-amber-500/20 border-amber-500/30 text-amber-50',
    gradient: 'radial-gradient(circle at center, rgba(245,158,11,0.45) 0%, rgba(245,158,11,0.12) 42%, transparent 72%)',
    tag: 'Balanced',
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-8 animate-pulse">
        <div className="mb-6 h-4 w-32 rounded bg-white/10" />
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="h-12 w-28 rounded bg-white/10" />
            <div className="h-4 w-56 rounded bg-white/10" />
          </div>
          <div className="h-36 w-36 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-6 animate-pulse">
        <div className="mb-4 h-4 w-16 rounded bg-white/10" />
        <div className="h-5 w-full rounded bg-white/10" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { readiness, loading, error } = useRecoveryState();

  const score = readiness?.score ?? 0;
  const tone = useMemo(() => getTone(score), [score]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-6 text-zinc-100">
        <p className="text-zinc-400 text-sm">Readiness</p>
        <p className="mt-2 font-bold">Unable to load Spotter data.</p>
        <p className="mt-1 text-sm text-zinc-400">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className={`relative overflow-hidden rounded-3xl bg-zinc-900/40 backdrop-blur-xl border p-8 shadow-2xl ${tone.card}`}
      >
        <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">Daily Readiness</p>

        <div className="mt-6 flex items-center justify-between gap-8">
          <div className="space-y-3">
            <p className="text-6xl font-bold leading-none">{score}</p>
            <p className="text-zinc-200 text-lg font-bold">{tone.tag}</p>
            <p className="text-zinc-300">{readiness?.recommendation ?? 'No recommendation available.'}</p>
          </div>

          <div className="relative h-40 w-40 shrink-0">
            <div className="absolute -inset-8 rounded-full" style={{ background: tone.gradient }} />
            <div className="relative h-full w-full rounded-full bg-zinc-950/70 backdrop-blur-xl border border-white/20 flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl font-bold">{score}</p>
                <p className="text-zinc-400 text-xs tracking-wide">/ 100</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <p className="text-zinc-400 text-xs uppercase tracking-wide">Modifier</p>
            <p className="font-bold text-lg text-zinc-100">{(readiness?.modifier ?? 1).toFixed(3)}x</p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs uppercase tracking-wide">Recommendation</p>
            <p className="font-bold text-lg text-zinc-100">{readiness?.recommendation ? 'Active' : 'N/A'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-6">
        <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">Why</p>
        <p className="mt-3 text-zinc-100 font-bold text-lg leading-relaxed">
          {readiness?.reason ?? 'No readiness explanation available.'}
        </p>
      </section>
    </div>
  );
}
