'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import MaxesManager from '../../components/program-builder/MaxesManager';

export default function ProfileMaxesPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Profile</p>
              <h1 className="mt-3 text-3xl font-black text-white">1RMs & Maxes</h1>
              <p className="mt-2 text-sm text-zinc-400">Maintain your strength ceilings.</p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </button>
          </div>
        </header>
        <MaxesManager userId={user?.id || null} />
      </div>
    </div>
  );
}
