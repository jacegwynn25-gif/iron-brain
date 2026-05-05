'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Crown,
  Loader2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/app/lib/supabase/auth-context';

export default function UpgradePage() {
  const router = useRouter();
  const { user, session, isPro } = useAuth();
  const [loadingTier, setLoadingTier] = useState<'lifetime' | 'monthly' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (tier: 'lifetime' | 'monthly') => {
    setError(null);
    if (!user || !session?.access_token) {
      router.push(`/login?returnTo=${encodeURIComponent('/upgrade')}`);
      return;
    }

    setLoadingTier(tier);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.redirectToMonthly && tier === 'lifetime') {
          setError('Lifetime slots are sold out. Monthly subscription is still available.');
          setLoadingTier(null);
          return;
        }
        throw new Error(data.error || 'Checkout failed');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoadingTier(null);
    }
  };

  if (isPro) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8 pb-12 pt-12 text-center sm:pt-20">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
          <Crown className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-zinc-100">You&apos;re already Pro</h1>
          <p className="text-sm text-zinc-400">
            You have full access to all Iron Brain features.
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="group inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 active:bg-emerald-500"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    );
  }

  const features = [
    'Pre-workout readiness scores',
    'Muscle recovery tracking',
    'Advanced analytics & trends',
    'Injury risk warnings',
    'Set recommendations',
    'Priority support',
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-12 pt-4 sm:space-y-10 sm:pt-10">
      <header className="stagger-item px-1 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">
          Subscription
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
          Iron Pro
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Readiness, recovery, and deeper training trends when you want more context.
        </p>
      </header>

      {error && (
        <div className="mx-1 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300 sm:mx-0">
          {error}
        </div>
      )}

      <section className="grid gap-4 px-1 sm:grid-cols-2 sm:gap-6">
        {/* Founding Member */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <div className="relative flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                Limited Offer
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100">Founding Member</h2>
              <p className="mt-1 text-sm text-zinc-500">One-time payment. Lifetime access.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">$149</span>
              <span className="text-sm text-zinc-500">one-time</span>
            </div>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout('lifetime')}
              disabled={loadingTier !== null}
              className="group mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 active:bg-emerald-500 disabled:opacity-60"
            >
              {loadingTier === 'lifetime' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Become a Founding Member
                  <ArrowRight className="h-4 w-4 text-zinc-950/60 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Monthly */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <div className="relative flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-zinc-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                Monthly
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100">Pro Monthly</h2>
              <p className="mt-1 text-sm text-zinc-500">Flexible. Cancel anytime.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">$12.99</span>
              <span className="text-sm text-zinc-500">/month</span>
            </div>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout('monthly')}
              disabled={loadingTier !== null}
              className="group mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3.5 text-sm font-bold text-zinc-100 transition-colors hover:bg-zinc-800 active:bg-zinc-950 disabled:opacity-60"
            >
              {loadingTier === 'monthly' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Subscribe Monthly
                  <ArrowRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <footer className="px-1 text-center">
        <p className="text-xs text-zinc-600">
          Secure payment via Stripe. No hidden fees. Cancel monthly anytime.
        </p>
      </footer>
    </div>
  );
}
