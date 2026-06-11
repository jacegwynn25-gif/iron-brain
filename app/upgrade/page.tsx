'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  HeartHandshake,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/app/lib/supabase/auth-context';

const SUPPORT_PRESETS = [3, 5, 10, 20, 50];
const MIN_SUPPORT_DOLLARS = 1;
const MAX_SUPPORT_DOLLARS = 500;

function parseSupportAmount(value: string): number | null {
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function formatAmountInput(amount: number) {
  return amount.toFixed(2).replace(/\.00$/, '');
}

export default function UpgradePage() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [amountInput, setAmountInput] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountCents = parseSupportAmount(amountInput);
  const amountIsValid =
    amountCents != null &&
    amountCents >= MIN_SUPPORT_DOLLARS * 100 &&
    amountCents <= MAX_SUPPORT_DOLLARS * 100;

  const handleSupportCheckout = async () => {
    setError(null);
    if (!amountIsValid || amountCents == null) {
      setError('Choose a support amount between $1 and $500.');
      return;
    }
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
        body: JSON.stringify({ amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
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

  const supportNotes = [
    'The workout tracker stays free to use.',
    'Support helps cover hosting and future development.',
    'Secure checkout is handled by Stripe.',
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-12 pt-3 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1 text-center">
        <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-5xl">
          SUPPORT IRON BRAIN
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          Iron Brain is free while I keep improving it. If it helps your training, optional support helps cover hosting and future development.
        </p>
      </header>

      {error && (
        <div className="mx-1 border-y border-rose-400/25 py-4 text-center text-sm text-rose-300 sm:mx-0">
          {error}
        </div>
      )}

      <section className="px-1">
        <div className="border-y border-white/8 py-5 sm:py-8">
          <div className="relative flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                Optional Support
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-zinc-100 sm:text-3xl">Support Iron Brain</h2>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                Completely optional. No features are locked behind this.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SUPPORT_PRESETS.map((amount) => {
                const selected = parseSupportAmount(amountInput) === amount * 100;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setAmountInput(formatAmountInput(amount))}
                    className={`min-h-10 rounded-xl border text-sm font-black transition-colors ${selected
                      ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
                      : 'border-white/8 bg-white/[0.035] text-zinc-300 hover:border-white/14 hover:text-zinc-100'
                      }`}
                  >
                    ${amount}
                  </button>
                );
              })}
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Custom Amount
              </span>
              <div className="liquid-field mt-2 flex items-center px-4">
                <span className="text-2xl font-black text-zinc-500">$</span>
                <input
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  inputMode="decimal"
                  aria-label="Support amount"
                  className="min-h-14 w-full bg-transparent px-2 text-3xl font-black tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700 sm:min-h-16 sm:text-4xl"
                  placeholder="10"
                />
              </div>
              <span className="mt-2 block text-xs font-semibold text-zinc-500">
                Choose any amount from $1 to $500.
              </span>
            </label>

            <ul className="space-y-2">
              {supportNotes.map((note) => (
                <li key={note} className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Check className="h-4 w-4 text-emerald-400" />
                  {note}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleSupportCheckout}
              disabled={loading || !amountIsValid}
              className="liquid-action-button group mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-[1.05rem] py-3 text-sm font-black italic tracking-tight text-zinc-950 transition-colors disabled:opacity-60 sm:min-h-12 sm:py-3.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Support Iron Brain
                  <ArrowRight className="h-4 w-4 text-zinc-950/60 transition-transform group-hover:translate-x-1" />
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
