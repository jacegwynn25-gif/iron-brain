'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/supabase/auth-context';
import { buildLoginUrl, getReturnToFromLocation } from '../lib/auth/redirects';
import { migrateLocalStorageToSupabase, hasLocalStorageData } from '../lib/supabase/migrate';
import { Cloud, CloudOff } from 'lucide-react';

export function CloudSyncButton() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState('');

  const handleEnableSync = async () => {
    if (user) {
      // Already logged in, check if we need to migrate
      if (hasLocalStorageData()) {
        setMigrating(true);
        const result = await migrateLocalStorageToSupabase();
        setMigrationMessage(result.message);
        setMigrating(false);

        // Clear message after 5 seconds
        setTimeout(() => setMigrationMessage(''), 5000);
      }
    } else {
      router.push(buildLoginUrl(getReturnToFromLocation()));
    }
  };

  if (migrating) {
    return (
      <div className="flex items-center gap-2 text-purple-300">
        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Syncing to cloud...</span>
      </div>
    );
  }

  if (migrationMessage) {
    return (
      <div className="text-sm text-emerald-300">
        {migrationMessage}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="flex items-center gap-2 text-emerald-300">
              <Cloud className="w-4 h-4" />
              <span className="text-sm">Cloud sync enabled</span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={handleEnableSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-white font-semibold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            <CloudOff className="w-4 h-4" />
            <span>Enable Cloud Sync</span>
          </button>
        )}
      </div>

    </>
  );
}
