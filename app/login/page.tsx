'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModal } from '../components/Auth';
import { useAuth } from '../lib/supabase/auth-context';

const DEFAULT_REDIRECT = '/';

function getSafeReturnTo(value: string | null) {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith('/')) return DEFAULT_REDIRECT;
  if (value.startsWith('//')) return DEFAULT_REDIRECT;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const resolveReturnTo = useCallback(() => {
    if (typeof window === 'undefined') return DEFAULT_REDIRECT;
    const params = new URLSearchParams(window.location.search);
    return getSafeReturnTo(params.get('returnTo'));
  }, []);

  const resolvePostLoginTarget = useCallback(() => {
    const returnTo = resolveReturnTo();
    if (!user) {
      return returnTo;
    }
    if (user.user_metadata?.onboarding_complete === true) {
      return returnTo;
    }
    return `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
  }, [resolveReturnTo, user]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(resolvePostLoginTarget());
    }
  }, [loading, user, router, resolvePostLoginTarget]);

  return (
    <div className="min-h-screen bg-zinc-950 safe-top">
      <AuthModal
        onSuccess={() => router.replace(resolvePostLoginTarget())}
        hideClose
      />
    </div>
  );
}
