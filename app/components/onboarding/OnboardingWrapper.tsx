'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/supabase/auth-context';
import OnboardingFlow from './OnboardingFlow';
import CoachMarks from './CoachMarks';

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const forceOnboarding = params.get('onboarding') === '1';
    const forceCoachMarks = params.get('coach') === '1';

    if (forceOnboarding) {
      setShowOnboarding(true);
      setShowCoachMarks(false);
      setIsChecking(false);
      return;
    }

    if (forceCoachMarks) {
      setShowOnboarding(false);
      setShowCoachMarks(true);
      setIsChecking(false);
      return;
    }

    const onboardingLocal = localStorage.getItem('iron_brain_onboarding_complete') === 'true';
    const coachLocal = localStorage.getItem('iron_brain_coach_marks_complete') === 'true';
    const onboardingRemote = user?.user_metadata?.onboarding_complete === true;
    const coachRemote = user?.user_metadata?.coach_marks_complete === true;

    if (!onboardingLocal && onboardingRemote) {
      localStorage.setItem('iron_brain_onboarding_complete', 'true');
    }
    if (!coachLocal && coachRemote) {
      localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    }

    const onboardingDone = onboardingLocal || onboardingRemote;
    const coachDone = coachLocal || coachRemote;

    if (!onboardingDone) {
      setShowOnboarding(true);
      setShowCoachMarks(false);
    } else if (!coachDone) {
      setShowOnboarding(false);
      setShowCoachMarks(true);
    } else {
      setShowOnboarding(false);
      setShowCoachMarks(false);
    }

    setIsChecking(false);
  }, [loading, user?.id, user?.user_metadata?.onboarding_complete, user?.user_metadata?.coach_marks_complete]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowCoachMarks(true);
  };

  const handleCoachMarksComplete = () => {
    setShowCoachMarks(false);
  };

  if (isChecking) {
    return null;
  }

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
