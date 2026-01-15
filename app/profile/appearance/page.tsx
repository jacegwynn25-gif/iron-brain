'use client';

import { useRouter } from 'next/navigation';

export default function ProfileAppearancePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 safe-top">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <button
          onClick={() => router.push('/profile')}
          className="text-purple-400 text-sm font-medium"
        >
          Back to Profile
        </button>
        <div className="mt-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Appearance</h1>
          <p className="text-gray-400 text-sm mt-1">Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
