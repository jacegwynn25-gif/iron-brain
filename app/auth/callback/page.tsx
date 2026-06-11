'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/supabase/auth-context';

const DEFAULT_REDIRECT = '/';
const AUTH_FALLBACK_DELAY_MS = 6500;

function getSafeNext(value: string | null) {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith('/')) return DEFAULT_REDIRECT;
  if (value.startsWith('//')) return DEFAULT_REDIRECT;
  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [nextPath, setNextPath] = useState(DEFAULT_REDIRECT);
  const [shouldFallbackToLogin, setShouldFallbackToLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(getSafeNext(params.get('next') ?? params.get('returnTo')));
  }, []);

  useEffect(() => {
    if (loading || user) return;

    const timeout = window.setTimeout(() => {
      setShouldFallbackToLogin(true);
    }, AUTH_FALLBACK_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;

    const target = user.user_metadata?.onboarding_complete === true
      ? nextPath
      : `/onboarding?returnTo=${encodeURIComponent(nextPath)}`;
    router.replace(target);
  }, [nextPath, router, user]);

  useEffect(() => {
    if (!shouldFallbackToLogin || user) return;
    router.replace(`/login?returnTo=${encodeURIComponent(nextPath)}`);
  }, [nextPath, router, shouldFallbackToLogin, user]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="liquid-sheet-panel w-full max-w-sm p-6 text-center">
        <Image
          src="/icons/iron-brain-ib-192.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto h-16 w-16 rounded-[1.05rem] object-cover"
          priority
        />
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.32em] text-emerald-300">
          Iron Brain
        </p>
        <h1 className="mt-2 text-3xl font-black italic leading-none tracking-tight text-zinc-100">
          SIGNING IN
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Finishing the secure Google sign-in.
        </p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]" />
        </div>
      </div>
    </div>
  );
}
