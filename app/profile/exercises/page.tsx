'use client';

import { useRouter } from 'next/navigation';

export default function ProfileExercisesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Profile</p>
              <h1 className="mt-3 text-3xl font-black text-white">Custom Exercises</h1>
              <p className="mt-2 text-sm text-zinc-400">Your private exercise library.</p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              Back to Profile
            </button>
          </div>
        </header>
        <div className="surface-panel p-6 text-sm text-zinc-400">Coming soon.</div>
      </div>
    </div>
  );
}
