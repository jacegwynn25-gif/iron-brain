'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get('session_id');

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 pb-12 pt-12 text-center sm:pt-20">
      {sessionId ? (
        <div className="space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black italic text-zinc-100">THANK YOU FOR SUPPORTING IRON BRAIN</h1>
            <p className="text-sm text-zinc-400">
              Your optional support helps cover hosting and future development. The tracker stays free to use.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="liquid-action-button group inline-flex items-center gap-2 rounded-[1.05rem] px-8 py-4 text-sm font-black italic text-zinc-950 transition-all active:scale-[0.98]"
          >
            GO TO DASHBOARD
            <ArrowRight className="h-4 w-4 text-zinc-950/60 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <h1 className="text-3xl font-black italic text-rose-400">SOMETHING WENT WRONG</h1>
          <p className="text-sm text-zinc-400">
            We could not verify your payment. If you were charged, your account will be updated
            automatically within a few minutes.
          </p>
          <button
            onClick={() => router.push('/')}
            className="liquid-icon-button inline-flex items-center gap-2 rounded-[1.05rem] px-8 py-4 text-sm font-black italic text-zinc-100 transition-all active:scale-[0.98]"
          >
            GO TO DASHBOARD
          </button>
        </div>
      )}
    </div>
  );
}
