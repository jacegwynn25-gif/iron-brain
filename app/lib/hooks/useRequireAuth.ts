'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../supabase/auth-context';

export interface RequireAuthOptions {
  redirectTo?: string;
  replace?: boolean;
  withReturnTo?: boolean;
  returnToParam?: string;
}

export interface RequireAuthResult {
  user: ReturnType<typeof useAuth>['user'];
  loading: boolean;
  ready: boolean;
}

export function useRequireAuth(options: RequireAuthOptions = {}): RequireAuthResult {
  const redirectTo = options.redirectTo ?? '/login';
  const replace = options.replace ?? true;
  const returnToParam = options.returnToParam ?? 'returnTo';
  const withReturnTo = options.withReturnTo ?? redirectTo === '/login';
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const returnTo = (() => {
        if (!withReturnTo || typeof window === 'undefined') return '';
        return `${window.location.pathname}${window.location.search}`;
      })();
      const target = (() => {
        if (!withReturnTo || !returnTo) return redirectTo;
        const separator = redirectTo.includes('?') ? '&' : '?';
        return `${redirectTo}${separator}${encodeURIComponent(returnToParam)}=${encodeURIComponent(returnTo)}`;
      })();
      if (replace) {
        router.replace(target);
      } else {
        router.push(target);
      }
    }
  }, [loading, user, router, redirectTo, replace, withReturnTo, returnToParam]);

  return {
    user,
    loading,
    ready: !loading && Boolean(user),
  };
}
