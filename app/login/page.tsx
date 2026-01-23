'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModal } from '../components/Auth';
import { useAuth } from '../lib/supabase/auth-context';

const DEFAULT_REDIRECT = '/';

function getSafeReturnTo(value: string | null) {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith('/')) return DEFAULT_REDIRECT;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const resolveReturnTo = () => {
    if (typeof window === 'undefined') return DEFAULT_REDIRECT;
    const params = new URLSearchParams(window.location.search);
    return getSafeReturnTo(params.get('returnTo'));
  };

  useEffect(() => {
    if (!loading && user) {
      router.replace(resolveReturnTo());
    }
  }, [loading, user, router]);

  return (
    <div className="min-h-screen app-gradient safe-top">
      <AuthModal
        onSuccess={() => router.replace(resolveReturnTo())}
        hideClose
      />
    </div>
  );
}
