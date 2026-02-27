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
  Plus,
  BarChart3,
  User,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';
import { ReadinessCard } from './dashboard/ReadinessCard';
import { WeeklyConsistency } from './dashboard/WeeklyConsistency';
import { getWorkoutHistory } from '@/app/lib/storage';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';

export default function Dashboard() {
  const { readiness, loading, error, lastUpdated } = useRecoveryState();
  const { isSessionActive } = useActiveSession();
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Load recent PR hits
      const raw = localStorage.getItem('iron_brain_last_pr_hits');
      if (raw) {
        const parsed = JSON.parse(raw) as
          | PersonalRecordHit[]
          | { hits?: PersonalRecordHit[]; createdAt?: string };
        const hits = Array.isArray(parsed) ? parsed : parsed.hits ?? [];
        if (hits.length > 0) setRecentPrHits(hits);
      }

      // Load workout history for consistency chart
      const history = getWorkoutHistory();
      const dates = history.map(w => w.date).filter(Boolean);
      setWorkoutDates(dates);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-12 pt-6 sm:pt-10">
      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-500/80">Command Center</p>
          <h1 className="text-4xl font-black italic tracking-tighter text-zinc-100">
            IRON BRAIN
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            <User className="h-5 w-5 text-zinc-400" />
          </Link>
          <Link
            href="/profile/settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            <Settings className="h-5 w-5 text-zinc-400" />
          </Link>
        </div>
      </header>

      {/* PR Alert */}
      {prSummary.length > 0 && (
        <section className="animate-fadeIn rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-6 mx-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">New Personal Records</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {prSummary.map((entry) => (
                    <span
                      key={entry.label}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-300"
                    >
                      {entry.label} {entry.count > 1 ? `x${entry.count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrSummary}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Readiness Section */}
      <section className="stagger-item mx-1">
        <ReadinessCard readiness={readiness} loading={loading} />
      </section>

      {/* Main Actions */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 px-1">
        {/* Primary CTA */}
        <Link
          href={isSessionActive ? "/workout/active" : "/start"}
          className={`stagger-item group relative flex flex-col justify-between overflow-hidden rounded-[2rem] p-8 transition-all hover:scale-[1.02] active:scale-[0.98] ${isSessionActive
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20'
            }`}
        >
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black italic tracking-tight text-white">
                {isSessionActive ? "RESUME SESSION" : "START SESSION"}
              </h3>
              <p className="text-sm font-medium text-white/80">
                {isSessionActive ? "Continue your training" : "Log a new workout"}
              </p>
            </div>
          </div>
          <ArrowRight className="absolute bottom-8 right-8 h-6 w-6 text-white/50 transition-transform group-hover:translate-x-1" />

          {/* Decorative background circle */}
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </Link>

        {/* Secondary Actions Grid */}
        <div className="grid grid-cols-2 gap-4 sm:col-span-1 lg:col-span-2">
          <Link
            href="/programs"
            className="surface-card stagger-item group flex flex-col justify-between p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <BookOpen className="h-6 w-6 text-emerald-400" />
            <div className="space-y-1 pt-8">
              <h4 className="text-lg font-black italic text-zinc-100">PROGRAMS</h4>
              <p className="text-xs text-zinc-500">View training plans</p>
            </div>
          </Link>

          <Link
            href="/history"
            className="surface-card stagger-item group flex flex-col justify-between p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <HistoryIcon className="h-6 w-6 text-amber-400" />
            <div className="space-y-1 pt-8">
              <h4 className="text-lg font-black italic text-zinc-100">HISTORY</h4>
              <p className="text-xs text-zinc-500">Previous sessions</p>
            </div>
          </Link>

          <Link
            href="/analytics"
            className="surface-card stagger-item group flex flex-col justify-between p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <BarChart3 className="h-6 w-6 text-blue-400" />
            <div className="space-y-1 pt-8">
              <h4 className="text-lg font-black italic text-zinc-100">ANALYTICS</h4>
              <p className="text-xs text-zinc-500">Track progress</p>
            </div>
          </Link>

          <Link
            href="/workout/new?type=empty"
            className="surface-card stagger-item group flex flex-col justify-between p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <RotateCcw className="h-6 w-6 text-zinc-100/40" />
            <div className="space-y-1 pt-8">
              <h4 className="text-lg font-black italic text-zinc-100">QUICK LOG</h4>
              <p className="text-xs text-zinc-500">Empty session</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Consistency Chart */}
      <section className="stagger-item mx-1">
        <WeeklyConsistency workoutDates={workoutDates} />
      </section>

      {/* Status Footer */}
      {lastUpdated && !loading && (
        <footer className="flex flex-col items-center justify-center gap-4 pt-4 opacity-50 pb-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              System Active • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="h-px w-12 bg-zinc-900" />
        </footer>
      )}

      {error && (
        <p className="text-center text-xs text-rose-400/50">
          Analytics server currently unreachable. Some data may be local.
        </p>
      )}
    </div>
  );
}
