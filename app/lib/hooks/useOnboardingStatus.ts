'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase/client';
import { useAuth } from '../supabase/auth-context';

export function useOnboardingStatus() {
  const { user } = useAuth();
  const router = useRouter();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsComplete(null);
      setLoading(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_demographics')
          .select('user_id')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = not found, which is expected for new users
          console.error('Error checking onboarding status:', error);
        }

        setIsComplete(!!data);
      } catch (err) {
        console.error('Error checking onboarding:', err);
        setIsComplete(false);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  const requireOnboarding = (currentPath: string) => {
    // Skip redirect if already on onboarding page
    if (currentPath === '/onboarding') return;

    // Skip redirect if onboarding is complete or still loading
    if (loading || isComplete) return;

    // Redirect to onboarding if incomplete
    if (isComplete === false && user) {
      router.push('/onboarding');
    }
  };

  return {
    isComplete,
    loading,
    requireOnboarding
  };
}
