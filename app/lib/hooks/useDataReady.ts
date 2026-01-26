'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import { setUserNamespace } from '../storage';

export interface DataReadyState {
  /** Whether it's safe to access user data (auth loaded, namespace set, sync complete) */
  isReady: boolean;
  /** Whether we're still initializing (auth loading, namespace not set, or syncing) */
  isInitializing: boolean;
  /** The current namespace ID (user ID or 'default' for guest) */
  namespaceId: string;
  /** The user ID if logged in, null if guest */
  userId: string | null;
  /** Wait for the data layer to be ready (returns immediately if already ready) */
  waitForReady: () => Promise<void>;
}

/**
 * Gates all data access behind auth readiness.
 * Use this hook to ensure namespace is properly initialized before reading/writing data.
 *
 * This solves the timing issue where components try to access localStorage
 * before the user namespace is set, causing them to read from the wrong namespace.
 *
 * Usage:
 * ```ts
 * const { isReady, namespaceId } = useDataReady();
 *
 * useEffect(() => {
 *   if (!isReady) return;
 *   // Safe to access data - namespace is guaranteed to be set
 *   const workouts = getWorkoutHistory();
 * }, [isReady]);
 * ```
 */
export function useDataReady(): DataReadyState {
  const { user, loading: authLoading, namespaceReady, isSyncing } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);
  const resolversRef = useRef<Array<() => void>>([]);
  const lastUserIdRef = useRef<string | null>(null);

  const namespaceId = user?.id ?? 'default';

  useEffect(() => {
    // All conditions must be true for data to be ready
    const ready = !authLoading && namespaceReady && !isSyncing;

    if (ready && !initRef.current) {
      // Initialize namespace ONCE when ready
      setUserNamespace(user?.id ?? null);
      initRef.current = true;
      lastUserIdRef.current = user?.id ?? null;
      setIsReady(true);

      // Resolve all pending waiters
      resolversRef.current.forEach(resolve => resolve());
      resolversRef.current = [];
    }

    // Reset on user change (login/logout)
    if (initRef.current && user?.id !== lastUserIdRef.current) {
      // User changed - re-initialize
      setUserNamespace(user?.id ?? null);
      lastUserIdRef.current = user?.id ?? null;
      // No need to set isReady to false here - the namespace is immediately updated
    }
  }, [authLoading, namespaceReady, isSyncing, user?.id]);

  const waitForReady = useCallback((): Promise<void> => {
    if (isReady) return Promise.resolve();
    return new Promise(resolve => {
      resolversRef.current.push(resolve);
    });
  }, [isReady]);

  return {
    isReady,
    isInitializing: authLoading || !namespaceReady || isSyncing,
    namespaceId,
    userId: user?.id ?? null,
    waitForReady,
  };
}
