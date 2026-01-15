'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { storage } from '../lib/storage';
import { syncPendingWorkouts, getSyncStatus, forceSyncAllWorkouts } from '../lib/supabase/auto-sync';
import { useAuth } from '../lib/supabase/auth-context';
import type { Database } from '../lib/supabase/database.types';

type DebugInfo = Record<string, unknown>;

type SupabaseSessionRow = Pick<
  Database['public']['Tables']['workout_sessions']['Row'],
  'id' | 'date' | 'name' | 'deleted_at' | 'created_at'
>;

export function SyncDebugPanel() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    if (!user) {
      setDebugInfo({ error: 'Not logged in' });
      return;
    }

    setLoading(true);
    const info: DebugInfo = {};

    try {
      // 1. Check localStorage
      const localWorkouts = storage.getWorkoutHistory();
      info.localStorage = {
        count: localWorkouts.length,
        workouts: localWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          program: w.programName,
          day: w.dayName,
          sets: w.sets.length
        }))
      };

      // 2. Check sync status
      info.syncStatus = getSyncStatus();

      // 3. Check Supabase
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('id, date, name, deleted_at, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        info.supabase = { error: error.message };
      } else {
        const sessionRows: SupabaseSessionRow[] = sessions ?? [];
        const active = sessionRows.filter((s) => !s.deleted_at);
        const deleted = sessionRows.filter((s) => s.deleted_at);

        info.supabase = {
          total: sessionRows.length || 0,
          active: active.length,
          deleted: deleted.length,
          workouts: sessionRows.map((s) => ({
            id: s.id,
            date: s.date,
            name: s.name,
            status: s.deleted_at ? 'DELETED' : 'ACTIVE',
            deletedAt: s.deleted_at,
            createdAt: s.created_at
          }))
        };
      }

      // 4. Check for mismatches (strip "session_" prefix for comparison)
      const stripPrefix = (id: string) => id.startsWith('session_') ? id.substring(8) : id;
      const localIds = new Set(localWorkouts.map(w => stripPrefix(w.id)));
      const sessionRows: SupabaseSessionRow[] = sessions ?? [];
      const supabaseIds = new Set(sessionRows.filter((s) => !s.deleted_at).map((s) => s.id));

      info.analysis = {
        localOnly: localWorkouts.filter(w => !supabaseIds.has(stripPrefix(w.id))).map(w => w.id),
        supabaseOnly: sessionRows
          .filter((s) => !s.deleted_at && !localIds.has(s.id))
          .map((s) => s.id),
        inBoth: localWorkouts.filter(w => supabaseIds.has(stripPrefix(w.id))).map(w => w.id)
      };

      setDebugInfo(info);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDebugInfo({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await syncPendingWorkouts(user.id);
      alert('Sync triggered! Check the results.');
      runDiagnostics();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Sync failed: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const forceResync = async () => {
    if (!user) return;
    if (!confirm('Force re-sync ALL workouts? This will re-upload everything.')) return;

    setLoading(true);
    try {
      await forceSyncAllWorkouts(user.id);
      alert('Force sync complete!');
      runDiagnostics();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Force sync failed: ' + message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Please log in to use the sync debugger
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Run Diagnostics
        </button>
        <button
          onClick={triggerSync}
          disabled={loading}
          className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
        >
          Trigger Sync
        </button>
        <button
          onClick={forceResync}
          disabled={loading}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          Force Re-Sync All
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      )}

      {debugInfo && (
        <div className="rounded-xl bg-white border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
