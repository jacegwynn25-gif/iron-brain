'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col items-center justify-center space-y-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rose-500/80">Error</p>
        <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">
          SOMETHING WENT WRONG
        </h1>
        <p className="text-sm text-zinc-500">
          An unexpected error occurred. Try refreshing the page or going back to the dashboard.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={reset}
          className="group inline-flex items-center gap-2 rounded-[1.25rem] bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-4 text-sm font-black italic text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4 text-white/60" />
          TRY AGAIN
        </button>
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
