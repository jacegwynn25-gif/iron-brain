'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Copy,
  Dumbbell,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useRequireAuth } from '@/app/lib/hooks/useRequireAuth';
import { useWorkoutDataContext } from '@/app/providers/WorkoutDataProvider';
import { useUnitPreference } from '@/app/lib/hooks/useUnitPreference';
import { supabase } from '@/app/lib/supabase/client';
import { getCustomExercises } from '@/app/lib/exercises/custom-exercises';
import { getUserMaxes } from '@/app/lib/maxes/maxes-service';
import {
  buildCoachExport,
  type CoachContextRecord,
  type CoachDemographicsRecord,
  type CoachProfileRecord,
} from '@/app/lib/coach/export';
import type { CustomExercise, UserMax } from '@/app/lib/types';

function CopyBlock({
  title,
  description,
  body,
  onCopy,
  copied,
}: {
  title: string;
  description: string;
  body: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <section className="surface-card space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black italic text-zinc-100">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[28rem] overflow-auto rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4 text-[11px] leading-5 text-zinc-300 whitespace-pre-wrap">
        {body}
      </pre>
    </section>
  );
}

export default function CoachExportPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth();
  const { workouts, loading: workoutsLoading } = useWorkoutDataContext();
  const { weightUnit } = useUnitPreference();

  const [profile, setProfile] = useState<CoachProfileRecord | null>(null);
  const [demographics, setDemographics] = useState<CoachDemographicsRecord | null>(null);
  const [contextEntries, setContextEntries] = useState<CoachContextRecord[]>([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [maxes, setMaxes] = useState<UserMax[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user?.id) return;

    let cancelled = false;

    const load = async () => {
      setLoadingData(true);
      setError(null);

      try {
        const [
          profileResult,
          demographicsResult,
          contextResult,
          customExerciseResult,
          maxResult,
        ] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('display_name, username, experience_level, bio')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('user_demographics')
            .select('age, sex, athletic_background, training_age, bodyweight, height, current_injuries, chronic_conditions')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_context_data')
            .select('date, sleep_hours, sleep_quality, protein_intake, calorie_balance, subjective_readiness')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(3),
          getCustomExercises(user.id),
          getUserMaxes(user.id),
        ]);

        if (cancelled) return;

        if (profileResult.error) throw profileResult.error;
        if (demographicsResult.error) throw demographicsResult.error;
        if (contextResult.error) throw contextResult.error;

        setProfile(profileResult.data
          ? {
            displayName: profileResult.data.display_name,
            username: profileResult.data.username,
            experienceLevel: profileResult.data.experience_level,
            bio: profileResult.data.bio,
          }
          : null);

        setDemographics(demographicsResult.data
          ? {
            age: demographicsResult.data.age,
            sex: demographicsResult.data.sex,
            athleticBackground: demographicsResult.data.athletic_background,
            trainingAge: demographicsResult.data.training_age,
            bodyweightKg: demographicsResult.data.bodyweight,
            heightCm: demographicsResult.data.height,
            currentInjuries: demographicsResult.data.current_injuries,
            chronicConditions: demographicsResult.data.chronic_conditions,
          }
          : null);

        setContextEntries((contextResult.data ?? []).map((entry) => ({
          date: entry.date,
          sleepHours: entry.sleep_hours,
          sleepQuality: entry.sleep_quality,
          proteinIntake: entry.protein_intake,
          calorieBalance: entry.calorie_balance,
          subjectiveReadiness: entry.subjective_readiness,
        })));
        setCustomExercises(customExerciseResult);
        setMaxes(maxResult);
      } catch (err) {
        console.error('Failed to load coach export data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load coach export data.');
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, user?.id]);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  const bundle = useMemo(() => {
    if (!user) return null;
    return buildCoachExport({
      email: user.email,
      authMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
      preferredWeightUnit: weightUnit,
      profile,
      demographics,
      latestContextEntries: contextEntries,
      workouts,
      customExercises,
      maxes,
    });
  }, [contextEntries, customExercises, demographics, maxes, profile, user, weightUnit, workouts]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch (err) {
      console.error(`Failed to copy ${key}:`, err);
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-12 pt-4 sm:pt-10">
        <div className="animate-pulse space-y-4 px-1">
          <div className="h-8 w-32 rounded-lg bg-zinc-800" />
          <div className="h-4 w-48 rounded bg-zinc-800" />
          <div className="h-96 rounded-2xl bg-zinc-800" />
        </div>
      </div>
    );
  }

  const loading = loadingData || workoutsLoading || !bundle;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300 shadow-lg shadow-emerald-500/10">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Prompt Export</p>
            <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">COACH EXPORT</h1>
            <p className="max-w-3xl text-[11px] text-zinc-500 sm:text-xs">
              Iron Brain already knows a lot about you. This page turns that data into a ChatGPT-ready coach context, plus it flags the few things the app still cannot infer cleanly.
            </p>
          </div>
        </div>
      </header>

      {loading && (
        <section className="surface-card mx-1 p-5">
          <p className="text-sm text-zinc-300">Assembling coach context from profile, workouts, recovery data, and exercise history…</p>
        </section>
      )}

      {!loading && bundle && (
        <>
          <section className="grid gap-3 px-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-card p-4 sm:p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Athlete</div>
              <div className="mt-2 text-xl font-black italic text-zinc-100">{bundle.athleteName}</div>
              <div className="mt-1 text-xs text-zinc-500">{bundle.goalLabel} • {bundle.experienceLabel}</div>
            </div>
            <div className="surface-card p-4 sm:p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Current Program</div>
              <div className="mt-2 text-xl font-black italic text-zinc-100">{bundle.currentProgramLabel}</div>
              <div className="mt-1 text-xs text-zinc-500">{bundle.scheduleLabel}</div>
            </div>
            <div className="surface-card p-4 sm:p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Workout Data</div>
              <div className="mt-2 text-xl font-black italic text-zinc-100">{bundle.workoutsWithSets}</div>
              <div className="mt-1 text-xs text-zinc-500">sessions with set-level logs</div>
            </div>
            <div className="surface-card p-4 sm:p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Exercise Library</div>
              <div className="mt-2 text-xl font-black italic text-zinc-100">{bundle.customExerciseCount}</div>
              <div className="mt-1 text-xs text-zinc-500">{bundle.equipmentLabel}</div>
            </div>
          </section>

          {(bundle.missingFields.length > 0 || bundle.dataWarnings.length > 0) && (
            <section className="grid gap-3 px-1 lg:grid-cols-2">
              <div className="surface-card p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Clipboard className="h-4.5 w-4.5 text-amber-300" />
                  <h2 className="text-sm font-black italic text-zinc-100">Still Missing</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {bundle.missingFields.map((item) => (
                    <div key={item} className="rounded-2xl border border-zinc-900 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-300" />
                  <h2 className="text-sm font-black italic text-zinc-100">Data Warnings</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {bundle.dataWarnings.length > 0 ? bundle.dataWarnings.map((item) => (
                    <div key={item} className="rounded-2xl border border-zinc-900 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
                      {item}
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
                      No data-quality warnings detected.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="px-1">
            <CopyBlock
              title="Full Export"
              description="Copy this when you want the whole package in one shot."
              body={bundle.combinedExport}
              onCopy={() => void handleCopy('combined', bundle.combinedExport)}
              copied={copiedKey === 'combined'}
            />
          </section>

          <section className="grid gap-4 px-1 lg:grid-cols-2">
            <CopyBlock
              title="System Prompt"
              description="Persistent coach identity, athlete profile, working weights, rules, and known gaps."
              body={bundle.systemPrompt}
              onCopy={() => void handleCopy('system', bundle.systemPrompt)}
              copied={copiedKey === 'system'}
            />
            <CopyBlock
              title="Exercise Draft"
              description="Inferred exercise preference file from custom movements and session history."
              body={bundle.exercisePreferenceDraft}
              onCopy={() => void handleCopy('exercise', bundle.exercisePreferenceDraft)}
              copied={copiedKey === 'exercise'}
            />
            <CopyBlock
              title="Lift Log Snapshot"
              description="Recent working weights, maxes, and recent set-level sessions."
              body={bundle.liftLogSnapshot}
              onCopy={() => void handleCopy('log', bundle.liftLogSnapshot)}
              copied={copiedKey === 'log'}
            />
            <CopyBlock
              title="Prompt Stack"
              description="Starter prompts for setup, programming, next-session planning, deloads, and plateau work."
              body={bundle.promptStack}
              onCopy={() => void handleCopy('prompts', bundle.promptStack)}
              copied={copiedKey === 'prompts'}
            />
          </section>
        </>
      )}

      {error && !loading && (
        <section className="surface-card mx-1 p-5">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-4.5 w-4.5" />
            <p className="text-sm font-semibold">Failed to load coach export data</p>
          </div>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
        </section>
      )}

      <section className="grid gap-3 px-1 sm:grid-cols-2">
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-emerald-300" />
            <h2 className="text-sm font-black italic text-zinc-100">What This Solves</h2>
          </div>
          <p className="mt-3 text-xs leading-6 text-zinc-400">
            The X workflow assumes you manually retype everything into an external chat. This export uses the actual Iron Brain account data you already logged, so you only need to answer the gaps instead of rebuilding your profile from scratch.
          </p>
        </div>
        <div className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4.5 w-4.5 text-emerald-300" />
            <h2 className="text-sm font-black italic text-zinc-100">Current Limitation</h2>
          </div>
          <p className="mt-3 text-xs leading-6 text-zinc-400">
            Iron Brain still does not store explicit exercise likes/dislikes, planned weekly availability, or full nutrition targets. Those are the main items the generated prompt will still ask you to confirm.
          </p>
        </div>
      </section>
    </div>
  );
}
