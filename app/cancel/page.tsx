'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, XCircle } from 'lucide-react';

export default function CancelPage() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 pb-12 pt-12 text-center sm:pt-20">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
        <XCircle className="h-10 w-10 text-zinc-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-black italic text-zinc-100">CHECKOUT CANCELLED</h1>
        <p className="text-sm text-zinc-400">
          No worries — your card was not charged. You can upgrade to Iron Pro anytime from your
          profile.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => router.push('/upgrade')}
          className="group inline-flex items-center gap-2 rounded-[1.25rem] bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-4 text-sm font-black italic text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 text-white/60 transition-transform group-hover:-translate-x-1" />
          BACK TO UPGRADE
        </button>
        <button
          onClick={() => router.push('/')}
          className="text-xs font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
