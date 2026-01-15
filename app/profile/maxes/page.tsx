'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import MaxesManager from '../../components/program-builder/MaxesManager';

export default function ProfileMaxesPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <button
          onClick={() => router.push('/profile')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </button>
        <MaxesManager userId={user?.id || null} />
      </div>
    </div>
  );
}
