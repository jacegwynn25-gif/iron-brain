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
          No worries. Your card was not charged. Optional support is always available from the dashboard.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => router.push('/upgrade')}
          className="liquid-action-button group inline-flex items-center gap-2 rounded-[1.05rem] px-8 py-4 text-sm font-black italic text-zinc-950 transition-all active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 text-zinc-950/60 transition-transform group-hover:-translate-x-1" />
          BACK TO SUPPORT
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
