import { Suspense } from 'react';
import Dashboard from '@/app/components/Dashboard';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Iron Brain</h1>
          <p className="text-zinc-400">AI-Integrated Training Log</p>
        </div>

        <Suspense fallback={<div className="text-white">Loading Spotter...</div>}>
          <Dashboard />
        </Suspense>
      </div>
    </main>
  );
}
