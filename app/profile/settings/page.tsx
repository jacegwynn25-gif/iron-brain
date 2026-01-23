'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import DataManagement from '../../components/DataManagement';

export default function ProfileSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">Profile</p>
              <h1 className="mt-3 text-3xl font-black text-white">Settings</h1>
              <p className="mt-2 text-sm text-zinc-400">Manage your data and preferences.</p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Profile
            </button>
          </div>
        </header>
        <DataManagement />
      </div>
    </div>
  );
}
