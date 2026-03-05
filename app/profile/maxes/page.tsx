'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import MaxesManager from '../../components/program-builder/MaxesManager';

export default function ProfileMaxesPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item flex items-start justify-between gap-4 px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Profile</p>
          <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">1RMs &amp; MAXES</h1>
          <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Maintain your strength ceilings.</p>
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="surface-card inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </header>
      <section className="stagger-item px-1">
        <MaxesManager userId={user?.id || null} />
      </section>
    </div>
  );
}
