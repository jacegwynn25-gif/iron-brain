'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  HeartHandshake,
  Settings,
  Sparkles,
  X,
  Plus,
  User,
} from 'lucide-react';
import { useRecoveryState } from '@/app/lib/hooks/useRecoveryState';
import type { PersonalRecordHit } from '@/app/lib/supabase/workouts';
import { ReadinessCard } from './dashboard/ReadinessCard';
import { WeeklyConsistency } from './dashboard/WeeklyConsistency';
import { useActiveSession } from '@/app/providers/ActiveSessionProvider';
import { useWorkoutDataContext } from '@/app/providers/WorkoutDataProvider';
import { useAuth } from '@/app/lib/supabase/auth-context';
import { AuthModal } from './Auth';

function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { readiness, loading, error, lastUpdated } = useRecoveryState();
  const { isReady: activeSessionReady, isSessionActive } = useActiveSession();
  const { workouts, loading: workoutsLoading } = useWorkoutDataContext();
  const [recentPrHits, setRecentPrHits] = useState<PersonalRecordHit[]>([]);
  const [localProfileResolved, setLocalProfileResolved] = useState(false);
  const [hasPriorLocalUse, setHasPriorLocalUse] = useState(false);

  const workoutDates = useMemo(() => {
    const dates = new Set<string>();
    workouts.forEach((workout) => {
      const dateKey = toLocalDateKey(workout.date) ?? toLocalDateKey(workout.startTime) ?? toLocalDateKey(workout.endTime);
      if (dateKey) dates.add(dateKey);
    });
    return Array.from(dates);
  }, [workouts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const localOnboardingComplete = localStorage.getItem('iron_brain_onboarding_complete') === 'true';
      const localCoachMarksComplete = localStorage.getItem('iron_brain_coach_marks_complete') === 'true';

      setHasPriorLocalUse(localOnboardingComplete || localCoachMarksComplete || workouts.length > 0);
    } catch {
    } finally {
      setLocalProfileResolved(true);
    }
  }, [workouts.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('iron_brain_last_pr_hits');
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | PersonalRecordHit[]
        | { hits?: PersonalRecordHit[]; createdAt?: string };
      const hits = Array.isArray(parsed) ? parsed : parsed.hits ?? [];
      if (hits.length > 0) setRecentPrHits(hits);
    } catch {
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

  const showReadiness = loading || Boolean(readiness);
  const showSystemFooter = lastUpdated && !loading && Boolean(readiness?.hasRecoveryInput);
  const showFreshUserAuthPrompt =
    localProfileResolved &&
    !authLoading &&
    !workoutsLoading &&
    !user &&
    !hasPriorLocalUse;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-4 pt-2 sm:space-y-7 sm:pt-8">
      {showFreshUserAuthPrompt && (
        <AuthModal
          hideClose
          onSuccess={() => setHasPriorLocalUse(true)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-2xl font-black italic tracking-normal text-zinc-100 sm:text-4xl">
            IRON BRAIN
          </h1>
          <Link
            href="/upgrade"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/85 transition-colors hover:text-amber-200"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Support Iron Brain
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:h-10 sm:w-10"
          >
            <User className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
          <Link
            href="/profile/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 transition-colors hover:border-zinc-700 hover:bg-zinc-900 sm:h-10 sm:w-10"
          >
            <Settings className="h-4.5 w-4.5 text-zinc-400 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </header>

      {/* PR Alert */}
      {prSummary.length > 0 && (
        <section className="animate-fadeIn rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:rounded-3xl sm:p-6 mx-1">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 sm:h-10 sm:w-10">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 sm:text-xs">New Personal Records</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {prSummary.map((entry) => (
                    <span
                      key={entry.label}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-300 sm:text-[10px]"
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
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-200 sm:h-8 sm:w-8"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Readiness Section */}
      {showReadiness && (
        <section className="stagger-item mx-1">
          <ReadinessCard readiness={readiness} loading={loading} />
        </section>
      )}

      {/* Main Action */}
      <section className="px-1">
        <Link
          href={activeSessionReady && isSessionActive ? "/workout/new" : "/start"}
          className={`stagger-item group relative flex min-h-14 items-center justify-between overflow-hidden rounded-[1rem] px-4 py-3 transition-all hover:scale-[1.01] active:scale-[0.99] sm:min-h-20 sm:rounded-[1.25rem] sm:px-6 sm:py-5 ${activeSessionReady && isSessionActive
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20'
            }`}
        >
          <div className="relative z-10 flex items-center gap-3 sm:gap-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-md sm:h-9 sm:w-9 sm:rounded-xl">
              <Plus className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black italic tracking-normal text-white sm:text-lg">
                {activeSessionReady && isSessionActive ? "RESUME SESSION" : "START TRAINING"}
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold text-white/70 sm:text-xs">
                {activeSessionReady && isSessionActive ? "Continue the workout in progress" : "Planned session or empty log"}
              </p>
            </div>
          </div>
          <ArrowRight className="relative z-10 h-4 w-4 text-white/50 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />

          {/* Decorative background circle */}
          <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-white/10 blur-2xl sm:h-24 sm:w-24" />
        </Link>
      </section>

      {/* Consistency Chart */}
      <section className="stagger-item mx-1">
        <WeeklyConsistency workoutDates={workoutDates} loading={workoutsLoading && workoutDates.length === 0} />
      </section>

      {/* Status Footer */}
      {showSystemFooter && (
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
