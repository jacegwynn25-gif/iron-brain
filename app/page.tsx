import { Suspense } from 'react';
import Dashboard from '@/app/components/Dashboard';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-white">Loading Spotter...</div>}>
      <Dashboard />
    </Suspense>
  );
}
