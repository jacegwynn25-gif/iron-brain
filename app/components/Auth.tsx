'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';

export function AuthModal({
  onClose,
  onSuccess,
  hideClose,
}: {
  onClose?: () => void;
  onSuccess?: () => void;
  hideClose?: boolean;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const isSignIn = mode === 'signin';

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    onClose?.();
  };

  const switchMode = () => {
    setMode(isSignIn ? 'signup' : 'signin');
    setError('');
  };

  const getOAuthRedirect = () => {
    if (typeof window === 'undefined') return undefined;

    const current = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams(window.location.search);
    const returnTo = window.location.pathname === '/login'
      ? params.get('returnTo') || '/'
      : current;

    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const { error } = await signInWithGoogle(getOAuthRedirect());
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignIn) {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          // Check if it's an email confirmation message
          if (error.message.includes('email')) {
            setError(error.message);
            setMode('signin');
            return; // Don't close modal, let them see the message
          }
          throw error;
        }
        handleSuccess();
      }
      if (isSignIn) {
        handleSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07080b]/90 p-4 backdrop-blur-xl">
      <div className="liquid-sheet-panel relative w-full max-w-md overflow-hidden p-5 text-white sm:p-7">
        {onClose && !hideClose && (
          <button
            onClick={onClose}
            className="liquid-icon-button absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white"
            aria-label="Close sign in"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-4 pr-10">
          <Image
            src="/icons/iron-brain-ib-192.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-[1.05rem] object-cover"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-emerald-300">
              Iron Brain
            </p>
            <h2 className="mt-1 text-3xl font-black italic leading-none tracking-tight text-zinc-100">
              {isSignIn ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </h2>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-zinc-400">
          Save workouts, sync programs, and keep history tied to your account.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-[1.05rem] border border-white/10 bg-white/[0.08] px-6 text-sm font-black italic tracking-tight text-zinc-100 transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-xs font-black not-italic text-zinc-950">
            G
          </span>
          {googleLoading ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
        </button>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-900" />
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">
            Or use email
          </span>
          <div className="h-px flex-1 bg-zinc-900" />
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="liquid-field mt-2 min-h-12 w-full px-4 text-base text-white placeholder:text-zinc-600"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="liquid-field mt-2 min-h-12 w-full px-4 text-base text-white placeholder:text-zinc-600"
              placeholder="Minimum 6 characters"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={`rounded-xl border px-4 py-3 text-sm leading-5 ${
              error.includes('verification') || error.includes('email')
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="liquid-action-button group flex min-h-12 w-full items-center justify-center gap-2 rounded-[1.05rem] px-6 text-sm font-black italic tracking-tight text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? 'WORKING...' : isSignIn ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
            {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <div className="mt-5 border-t border-white/8 pt-5 text-center">
          <button
            onClick={switchMode}
            className="text-sm font-bold text-zinc-400 transition-colors hover:text-zinc-100"
          >
            {isSignIn
              ? 'Need an account? Create one'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
