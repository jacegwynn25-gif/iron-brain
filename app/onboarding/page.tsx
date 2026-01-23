'use client';

import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../lib/hooks/useRequireAuth';
import DemographicsForm from '../components/onboarding/DemographicsForm';

export default function OnboardingPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();

  const handleComplete = () => {
    // Redirect to home after completing onboarding
    router.push('/');
  };

  if (!ready) {
    return null;
  }

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <p className="section-label">Onboarding</p>
          <h1 className="mt-3 text-3xl font-black text-white">Baseline Setup</h1>
          <p className="mt-2 text-sm text-zinc-400">Calibrate your training profile.</p>
        </header>
        <DemographicsForm onComplete={handleComplete} />
      </div>
    </div>
  );
}
