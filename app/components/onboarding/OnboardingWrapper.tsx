'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/supabase/auth-context';
import { supabase } from '../../lib/supabase/client';
import CoachMarks from './CoachMarks';

const EXCLUDED_PATHS = ['/login', '/onboarding', '/reset-auth'];

const isExcludedPath = (pathname: string) =>
  EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

const getSafeReturnTo = (value: string) => {
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  if (value.startsWith('/login') || value.startsWith('/onboarding')) return '/';
  return value;
};

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const legacyCheckRef = useRef<string | null>(null);
  const legacyCompletionRef = useRef<{ userId: string | null; complete: boolean }>({
    userId: null,
    complete: false,
  });

  useEffect(() => {
    if (!user?.id) {
      legacyCompletionRef.current = { userId: null, complete: false };
      legacyCheckRef.current = null;
      return;
    }
    if (legacyCompletionRef.current.userId !== user.id) {
      legacyCompletionRef.current = { userId: user.id, complete: false };
      legacyCheckRef.current = null;
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setShowCoachMarks(false);
      return;
    }

    const excluded = isExcludedPath(pathname);
    const onboardingComplete =
      user.user_metadata?.onboarding_complete === true || legacyCompletionRef.current.complete;
    const coachComplete = user.user_metadata?.coach_marks_complete === true;

    if (onboardingComplete) {
      setShowCoachMarks(!excluded && !coachComplete);
      return;
    }

    setShowCoachMarks(false);

    if (excluded) {
      return;
    }

    const fullPath = typeof window === 'undefined'
      ? pathname
      : `${window.location.pathname}${window.location.search}`;

    if (legacyCheckRef.current === user.id) {
      const returnTo = getSafeReturnTo(fullPath);
      router.replace(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    legacyCheckRef.current = user.id;
    let cancelled = false;

    const resolveLegacyOnboarding = async () => {
      try {
        const { data, error } = await supabase
          .from('user_demographics')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data?.user_id) {
          legacyCompletionRef.current = { userId: user.id, complete: true };
          const { error: updateError } = await supabase.auth.updateUser({
            data: { onboarding_complete: true },
          });
          if (updateError) {
            console.error('Failed to sync onboarding metadata:', updateError);
          }
          return;
        }

        const returnTo = getSafeReturnTo(fullPath);
        router.replace(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
      } catch (err) {
        console.error('Failed to resolve onboarding state:', err);
        const returnTo = getSafeReturnTo(fullPath);
        router.replace(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
      }
    };

    resolveLegacyOnboarding();

    return () => {
      cancelled = true;
    };
  }, [loading, user, pathname, router]);

  const handleCoachMarksComplete = () => {
    setShowCoachMarks(false);
  };

  return (
    <>
      {children}

      {showCoachMarks && (
        <CoachMarks onComplete={handleCoachMarksComplete} />
      )}
    </>
  );
}
