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
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <header className="border-b border-zinc-900 pb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Onboarding</p>
          <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Baseline Setup</h1>
          <p className="mt-3 text-sm text-zinc-500">Calibrate your training profile.</p>
        </header>
        <DemographicsForm onComplete={handleComplete} />
      </div>
    </div>
  );
}
