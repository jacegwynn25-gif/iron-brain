'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth-context';
import { processQueue, setupOnlineListener, isOnline } from '../lib/sync/offline-queue';
import { logger } from '../lib/logger';

export default function SyncQueueListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const runSync = () => {
      if (!isOnline()) return;
      processQueue(supabase, user.id)
        .then(({ processed, failed }) => {
          if (processed > 0 || failed > 0) {
            logger.debug('📤 Offline queue processed', { processed, failed });
          }
        })
        .catch(err => {
          logger.debug('Failed to process offline queue:', err);
        });
    };

    runSync();
    return setupOnlineListener(runSync);
  }, [user?.id]);

  return null;
}
