'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import DataManagement from '../../components/DataManagement';

export default function ProfileSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-6 hover:text-purple-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </button>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your data and preferences</p>
        </div>
        <DataManagement />
      </div>
    </div>
  );
}
