'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/supabase/auth-context';
import OnboardingFlow from './OnboardingFlow';
import CoachMarks from './CoachMarks';

// Check onboarding status synchronously to prevent flash
const getInitialOnboardingState = () => {
  if (typeof window === 'undefined') {
    return { onboarding: false, coach: false };
  }

  // Check URL params first
  const params = new URLSearchParams(window.location.search);
  if (params.get('onboarding') === '1') {
    return { onboarding: true, coach: false };
  }
  if (params.get('coach') === '1') {
    return { onboarding: false, coach: true };
  }

  // Device-specific flags (localStorage only - never check Supabase user_metadata)
  const onboardingDone = localStorage.getItem('iron_brain_onboarding_complete') === 'true';
  const coachDone = localStorage.getItem('iron_brain_coach_marks_complete') === 'true';

  if (!onboardingDone) {
    return { onboarding: true, coach: false };
  } else if (!coachDone) {
    return { onboarding: false, coach: true };
  } else {
    return { onboarding: false, coach: false };
  }
};

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  // Initialize to false to prevent hydration mismatch
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);

  // Check onboarding status after hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Resolve onboarding visibility once auth is known.
  // We only show onboarding for signed-in users, and we trust cloud metadata
  // as a fallback when local flags are missing (new device/localStorage cleared).
  useEffect(() => {
    if (loading || !hydrated) return;

    if (!user) {
      setShowOnboarding(false);
      setShowCoachMarks(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const forceOnboarding = params.get('onboarding') === '1';
    const forceCoachMarks = params.get('coach') === '1';

    if (forceOnboarding) {
      setShowOnboarding(true);
      setShowCoachMarks(false);
      return;
    }

    if (forceCoachMarks) {
      setShowOnboarding(false);
      setShowCoachMarks(true);
      return;
    }

    const localState = getInitialOnboardingState();
    const cloudOnboardingComplete = user.user_metadata?.onboarding_complete === true;

    let onboardingComplete = !localState.onboarding;
    if (!onboardingComplete && cloudOnboardingComplete) {
      onboardingComplete = true;
      localStorage.setItem('iron_brain_onboarding_complete', 'true');
    }

    setShowOnboarding(!onboardingComplete);
    setShowCoachMarks(onboardingComplete && localState.coach);
  }, [loading, hydrated, user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowCoachMarks(true);
  };

  const handleCoachMarksComplete = () => {
    setShowCoachMarks(false);
  };

  return (
    <>
      {children}

      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {showCoachMarks && !showOnboarding && (
        <CoachMarks onComplete={handleCoachMarksComplete} />
      )}
    </>
  );
}
