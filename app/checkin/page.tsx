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
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Recovery</p>
        <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">DAILY CHECK-IN</h1>
        <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Log sleep, nutrition, and stress markers.</p>
      </header>
      <section className="stagger-item px-1">
        <DailyCheckInForm onComplete={handleComplete} />
      </section>
    </div>
  );
}
