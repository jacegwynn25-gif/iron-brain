'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, TrendingUp, Zap, Target, Check, Loader2 } from 'lucide-react';
import { useRequireAuth } from '../lib/hooks/useRequireAuth';
import { useAuth } from '../lib/supabase/auth-context';
import { supabase } from '../lib/supabase/client';
import { useUnitPreference } from '../lib/hooks/useUnitPreference';
import FancySelect from '../components/ui/FancySelect';

type Goal = 'strength' | 'muscle' | 'fitness' | 'sport';
type Experience = 'beginner' | 'intermediate' | 'advanced';

const goals = [
  { id: 'strength', label: 'Build Strength', description: 'Lift heavier and move more weight', icon: Dumbbell },
  { id: 'muscle', label: 'Build Muscle', description: 'Maximize hypertrophy and size', icon: TrendingUp },
  { id: 'fitness', label: 'General Fitness', description: 'Endurance, conditioning, and health', icon: Zap },
  { id: 'sport', label: 'Sport Performance', description: 'Train for athletic output', icon: Target },
];

const experiences = [
  { id: 'beginner', label: 'Beginner', description: 'Less than 1 year of training' },
  { id: 'intermediate', label: 'Intermediate', description: '1-3 years of consistent training' },
  { id: 'advanced', label: 'Advanced', description: '3+ years, understand programming' },
];

const getSafeReturnTo = (value: string | null) => {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  if (value.startsWith('/onboarding') || value.startsWith('/login')) return '/';
  return value;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    unitSystem,
    setUnitSystem,
    displayWeight,
    parseWeightInput,
    weightUnit,
    weightRange,
  } = useUnitPreference();

  const resolveReturnTo = useCallback(() => {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    return getSafeReturnTo(params.get('returnTo'));
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.user_metadata?.onboarding_complete === true) {
      router.replace(resolveReturnTo());
    }
  }, [ready, user, router, resolveReturnTo]);

  const canSubmit = Boolean(goal && experience) && !isSaving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!user?.id) {
      setError('You must be signed in to complete onboarding.');
      return;
    }

    if (!goal || !experience) {
      setError('Select your goal and experience level to continue.');
      return;
    }

    setIsSaving(true);

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          user_goal: goal,
          experience_level: experience,
        },
      });
      if (authError) throw authError;

      const demographicsPayload: {
        user_id: string;
        athletic_background?: Experience;
        bodyweight?: number | null;
      } = {
        user_id: user.id,
        athletic_background: experience,
      };

      if (bodyweight !== null) {
        demographicsPayload.bodyweight = bodyweight;
      }

      const { error: demoError } = await supabase
        .from('user_demographics')
        .upsert(demographicsPayload, { onConflict: 'user_id' });

      if (demoError) throw demoError;

      router.replace(resolveReturnTo());
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 safe-top">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <header className="border-b border-zinc-900 pb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Baseline</p>
          <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">
            First-Run Setup
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Tell us your goal and training experience. You can refine everything else later.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="surface-panel rounded-2xl p-6">
            <p className="section-label">Primary Goal</p>
            <div className="mt-4 grid gap-3">
              {goals.map((item) => {
                const Icon = item.icon;
                const selected = goal === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGoal(item.id as Goal)}
                    className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        selected ? 'bg-emerald-500/80' : 'bg-zinc-900'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${selected ? 'text-white' : 'text-zinc-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-zinc-500">{item.description}</div>
                    </div>
                    {selected && <Check className="h-5 w-5 text-emerald-300" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface-panel rounded-2xl p-6">
            <p className="section-label">Experience</p>
            <div className="mt-4 grid gap-3">
              {experiences.map((item) => {
                const selected = experience === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExperience(item.id as Experience)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-zinc-500">{item.description}</div>
                    </div>
                    {selected && <Check className="h-5 w-5 text-emerald-300" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface-panel rounded-2xl p-6">
            <p className="section-label">Optional</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Measurement System
                </label>
                <FancySelect
                  value={unitSystem}
                  options={[
                    { value: 'imperial', label: 'Imperial (lbs)' },
                    { value: 'metric', label: 'Metric (kg)' },
                  ]}
                  onChange={(value) => setUnitSystem(value === 'metric' ? 'metric' : 'imperial')}
                  ariaLabel="Measurement system"
                  buttonClassName="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-700"
                  listClassName="max-h-44 overflow-y-auto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Bodyweight ({weightUnit}) <span className="text-xs text-zinc-500">(optional)</span>
                </label>
                <input
                  type="number"
                  min={weightRange.min}
                  max={weightRange.max}
                  step="0.1"
                  value={displayWeight(bodyweight)}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value);
                    if (Number.isNaN(value)) {
                      setBodyweight(null);
                    } else {
                      setBodyweight(parseWeightInput(value));
                    }
                  }}
                  placeholder={`e.g. ${weightUnit === 'kg' ? '75' : '165'}`}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.25em] transition-all ${
              canSubmit
                ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
                : 'border border-zinc-800 bg-zinc-950/50 text-zinc-500'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Complete Setup'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
