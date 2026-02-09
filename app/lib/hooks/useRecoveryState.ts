'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import {
  calculateTrainingReadiness,
  type TrainingReadiness
} from '../intelligence/recovery-integration-service';

interface UseRecoveryStateOptions {
  autoRefresh?: boolean; // Auto-refresh every N minutes
  refreshIntervalMinutes?: number; // Default 30 minutes
}

interface UseRecoveryStateResult {
  readiness: TrainingReadiness | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * React hook to fetch and manage training readiness data
 */
export function useRecoveryState(
  options: UseRecoveryStateOptions = {}
): UseRecoveryStateResult {
  const {
    autoRefresh = false,
    refreshIntervalMinutes = 30
  } = options;

  const { user } = useAuth();
  const [readiness, setReadiness] = useState<TrainingReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!user?.id) {
      setReadiness(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await calculateTrainingReadiness(user.id);
      setReadiness(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching training readiness:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch training readiness data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    const intervalMs = refreshIntervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      void fetchReadiness();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalMinutes, user?.id, fetchReadiness]);

  const refresh = useCallback(async () => {
    await fetchReadiness();
  }, [fetchReadiness]);

  return {
    readiness,
    loading,
    error,
    refresh,
    lastUpdated
  };
}
