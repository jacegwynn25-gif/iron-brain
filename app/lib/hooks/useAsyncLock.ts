'use client';

import { useRef, useCallback } from 'react';

export interface AsyncLock {
  /** Whether the lock is currently held */
  isLocked: boolean;
  /** Execute a function with the lock held - guarantees cleanup even on errors */
  withLock: <T>(fn: () => Promise<T>) => Promise<T | null>;
  /** Manually acquire the lock (returns false if already locked) */
  acquire: () => boolean;
  /** Manually release the lock */
  release: () => void;
}

/**
 * Creates a lock that prevents concurrent async operations.
 * The `withLock` function GUARANTEES the lock is released even on errors or early returns.
 *
 * Usage:
 * ```ts
 * const { withLock } = useAsyncLock();
 *
 * const loadData = useCallback(async () => {
 *   const result = await withLock(async () => {
 *     // This code will only run if lock is not held
 *     const data = await fetchData();
 *     return data;
 *   });
 *
 *   if (result === null) {
 *     // Lock was held, operation was skipped
 *     return;
 *   }
 *   // Use result...
 * }, [withLock]);
 * ```
 */
export function useAsyncLock(): AsyncLock {
  const lockRef = useRef(false);

  const acquire = useCallback((): boolean => {
    if (lockRef.current) return false;
    lockRef.current = true;
    return true;
  }, []);

  const release = useCallback((): void => {
    lockRef.current = false;
  }, []);

  const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (!acquire()) {
      return null;
    }

    try {
      return await fn();
    } finally {
      release();
    }
  }, [acquire, release]);

  return {
    get isLocked() { return lockRef.current; },
    withLock,
    acquire,
    release,
  };
}
