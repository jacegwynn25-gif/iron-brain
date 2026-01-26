'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { getSyncStatus, type SyncStatus } from '../lib/supabase/auto-sync';

interface SyncStatusIndicatorProps {
  className?: string;
}

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    // Update status on mount
    setSyncStatus(getSyncStatus());

    // Listen for sync status changes
    const handleSyncStatusChange = (event: CustomEvent<SyncStatus>) => {
      setSyncStatus(event.detail);

      // Show "just synced" checkmark briefly
      if (!event.detail.isSyncing && event.detail.pendingWorkouts === 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    };

    window.addEventListener('syncStatusChanged', handleSyncStatusChange as EventListener);

    return () => {
      window.removeEventListener('syncStatusChanged', handleSyncStatusChange as EventListener);
    };
  }, []);

  // Don't show if no workouts
  if (syncStatus.totalWorkouts === 0) return null;

  // Show syncing spinner
  if (syncStatus.isSyncing) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Syncing {syncStatus.pendingWorkouts} workouts...</span>
        </div>
      </div>
    );
  }

  // Show just synced checkmark
  if (justSynced) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-xs text-green-400">
          <Check className="h-3 w-3" />
          <span>All workouts synced</span>
        </div>
      </div>
    );
  }

  // Show pending workouts
  if (syncStatus.pendingWorkouts > 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-xs text-yellow-400">
          <CloudOff className="h-3 w-3" />
          <span>{syncStatus.pendingWorkouts} pending sync</span>
        </div>
      </div>
    );
  }

  // Show synced status
  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Cloud className="h-3 w-3" />
        <span>Synced</span>
      </div>
    </div>
  );
}
