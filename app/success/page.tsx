'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/lib/supabase/auth-context';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    // Poll briefly to see if the webhook has processed
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      if (!user?.id || attempts > maxAttempts) {
        clearInterval(interval);
        setStatus('success'); // Assume success — webhook handles the actual upgrade
        return;
      }

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
          .from('user_profiles')
          .select('is_pro')
          .eq('id', user.id)
          .single();

        if (data?.is_pro) {
          clearInterval(interval);
          setStatus('success');
        }
      } catch {
        // Ignore polling errors
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionId, user?.id]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 pb-12 pt-12 text-center sm:pt-20">
      {status === 'verifying' && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
          <h1 className="text-2xl font-black italic text-zinc-100">Confirming Purchase...</h1>
          <p className="text-sm text-zinc-500">Please wait while we verify your payment.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black italic text-zinc-100">WELCOME TO IRON PRO</h1>
            <p className="text-sm text-zinc-400">
              Your payment was successful and your account has been upgraded.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="group inline-flex items-center gap-2 rounded-[1.25rem] bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-4 text-sm font-black italic text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            GO TO DASHBOARD
            <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6">
          <h1 className="text-3xl font-black italic text-rose-400">SOMETHING WENT WRONG</h1>
          <p className="text-sm text-zinc-400">
            We could not verify your payment. If you were charged, your account will be updated
            automatically within a few minutes.
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-[1.25rem] border border-zinc-700 bg-zinc-900 px-8 py-4 text-sm font-black italic text-zinc-100 transition-all hover:bg-zinc-800 active:scale-[0.98]"
          >
            GO TO DASHBOARD
          </button>
        </div>
      )}
    </div>
  );
}
