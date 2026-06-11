'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ProfileExercisesPage() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item flex items-start justify-between gap-4 px-1">
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Profile</p>
          <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">CUSTOM EXERCISES</h1>
          <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Your private exercise library.</p>
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
        <div className="border-y border-white/8 py-5 text-sm text-zinc-500">Coming soon.</div>
      </section>
    </div>
  );
}
