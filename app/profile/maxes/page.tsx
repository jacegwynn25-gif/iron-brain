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
          <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">1RMs and maxes</h1>
        </div>
        <button
          type="button"
          aria-label="Back to profile"
          onClick={() => router.push('/profile')}
          className="liquid-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>
      <section className="stagger-item px-1">
        <MaxesManager userId={user?.id || null} />
      </section>
    </div>
  );
}
