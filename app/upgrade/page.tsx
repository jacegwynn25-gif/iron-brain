'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  HeartHandshake,
  Loader2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/app/lib/supabase/auth-context';

export default function UpgradePage() {
  const router = useRouter();
  const { user, session, isPro } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSupportCheckout = async () => {
    setError(null);
    if (!user || !session?.access_token) {
      router.push(`/login?returnTo=${encodeURIComponent('/upgrade')}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: 'lifetime' }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.redirectToMonthly) {
          setError('One-time support is not available right now.');
          setLoading(false);
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
      setLoading(false);
    }
  };

  if (isPro) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8 pb-12 pt-12 text-center sm:pt-20">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
          <HeartHandshake className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic tracking-tight text-zinc-100">THANK YOU</h1>
          <p className="text-sm text-zinc-400">
            Your optional support helps cover hosting and future development.
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

  const supportNotes = [
    'The workout tracker stays free to use.',
    'Support helps cover hosting and future development.',
    'Secure checkout is handled by Stripe.',
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12 pt-4 sm:space-y-10 sm:pt-10">
      <header className="stagger-item px-1 text-center">
        <h1 className="text-4xl font-black italic tracking-tight text-zinc-100 sm:text-5xl">
          SUPPORT IRON BRAIN
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Iron Brain is free while I keep improving it. If it helps your training, optional support helps cover hosting and future development.
        </p>
      </header>

      {error && (
        <div className="mx-1 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300 sm:mx-0">
          {error}
        </div>
      )}

      <section className="px-1">
        <div className="rounded-[1.5rem] border border-amber-300/70 bg-amber-400 p-6 text-zinc-950 shadow-[0_26px_70px_-36px_rgba(251,191,36,1)] sm:p-8">
          <div className="relative flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-zinc-950" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-950/80">
                Optional Support
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black italic tracking-tight">SUPPORT IRON BRAIN</h2>
              <p className="mt-1 text-sm font-medium text-zinc-900/70">
                Completely optional. No features are locked behind this.
              </p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black tracking-tight">$149</span>
              <span className="text-sm font-semibold text-zinc-900/65">optional one-time support</span>
            </div>
            <ul className="space-y-2.5">
              {supportNotes.map((note) => (
                <li key={note} className="flex items-center gap-2 text-sm font-medium text-zinc-950/85">
                  <Check className="h-4 w-4 text-zinc-950" />
                  {note}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleSupportCheckout}
              disabled={loading}
              className="group mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3.5 text-sm font-black italic tracking-tight text-amber-300 transition-colors hover:bg-zinc-900 active:bg-black disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Support Iron Brain
                  <ArrowRight className="h-4 w-4 text-amber-300/70 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <footer className="px-1 text-center">
        <p className="text-xs text-zinc-600">
          Secure payment via Stripe. Completely optional. The tracker stays free to use.
        </p>
      </footer>
    </div>
  );
}
