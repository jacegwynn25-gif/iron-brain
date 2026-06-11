'use client';

import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../lib/hooks/useRequireAuth';
import DailyCheckInForm from '../components/checkin/DailyCheckInForm';

export default function CheckInPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();

  const handleComplete = () => {
    // Redirect back to home after completing check-in
    router.push('/');
  };

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-12 pt-4 sm:pt-10">
        <div className="animate-pulse space-y-4 px-1">
          <div className="h-8 w-48 rounded-lg bg-zinc-800" />
          <div className="h-4 w-32 rounded bg-zinc-800" />
          <div className="border-y border-white/8 py-12">
            <div className="h-4 w-3/4 rounded bg-zinc-800" />
            <div className="mt-5 h-12 rounded-xl bg-zinc-800" />
            <div className="mt-3 h-12 rounded-xl bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Check-in</h1>
        <p className="mt-1 text-xs text-zinc-500">Log recovery context for today.</p>
      </header>
      <section className="stagger-item px-1">
        <DailyCheckInForm onComplete={handleComplete} />
      </section>
    </div>
  );
}
