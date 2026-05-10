'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';

interface AppResilienceStatusProps {
  currentVersion: string;
}

interface VersionPayload {
  version?: string;
}

interface SyncQueueDetail {
  processed?: number;
  failed?: number;
}

const QUEUE_KEY_PREFIX = 'iron_brain_sync_queue';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function readQueuedOperationCount(): number {
  if (typeof window === 'undefined') return 0;

  let total = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(QUEUE_KEY_PREFIX)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(parsed)) total += parsed.length;
    }
  } catch {
    return 0;
  }

  return total;
}

export default function AppResilienceStatus({ currentVersion }: AppResilienceStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [queuedOperations, setQueuedOperations] = useState(0);
  const [syncNotice, setSyncNotice] = useState<SyncQueueDetail | null>(null);
  const syncNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkVersion = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;

    try {
      const response = await fetch(`/api/app-version?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = (await response.json()) as VersionPayload;
      if (payload.version) setRemoteVersion(payload.version);
    } catch {
      // Version checks should never interrupt the app.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncBrowserState = () => {
      setIsOnline(navigator.onLine);
      setQueuedOperations(readQueuedOperationCount());
    };

    const handleOnline = () => {
      syncBrowserState();
      void checkVersion();
    };

    const handleSyncQueue = (event: Event) => {
      const detail = (event as CustomEvent<SyncQueueDetail>).detail ?? {};
      setQueuedOperations(readQueuedOperationCount());
      if ((detail.processed ?? 0) > 0 || (detail.failed ?? 0) > 0) {
        setSyncNotice(detail);
        if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
        syncNoticeTimerRef.current = setTimeout(() => setSyncNotice(null), 5200);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncBrowserState();
        void checkVersion();
      }
    };

    syncBrowserState();
    void checkVersion();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', syncBrowserState);
    window.addEventListener('focus', checkVersion);
    window.addEventListener('iron-brain:sync-queue', handleSyncQueue);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = window.setInterval(checkVersion, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', syncBrowserState);
      window.removeEventListener('focus', checkVersion);
      window.removeEventListener('iron-brain:sync-queue', handleSyncQueue);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(interval);
      if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
    };
  }, [checkVersion]);

  const updateAvailable =
    Boolean(remoteVersion) &&
    remoteVersion !== currentVersion &&
    remoteVersion !== dismissedVersion &&
    isOnline;

  const status = useMemo(() => {
    if (!isOnline) {
      return {
        key: 'offline',
        icon: WifiOff,
        label: 'Offline Mode',
        title: 'Saving locally',
        body:
          queuedOperations > 0
            ? `${queuedOperations} change${queuedOperations === 1 ? '' : 's'} waiting to sync when you are back online.`
            : 'Workout changes stay on this device until connection returns.',
        tone: 'border-amber-400/35 bg-zinc-950/95 text-amber-200',
        action: null,
        dismissible: false,
      };
    }

    if (updateAvailable && remoteVersion) {
      return {
        key: 'update',
        icon: RefreshCw,
        label: 'Update Ready',
        title: 'New build available',
        body: 'Refresh to load the latest app. Active workouts stay saved locally.',
        tone: 'border-emerald-400/30 bg-zinc-950/95 text-emerald-200',
        action: 'refresh' as const,
        dismissible: true,
      };
    }

    if (syncNotice) {
      const failed = syncNotice.failed ?? 0;
      const processed = syncNotice.processed ?? 0;
      return {
        key: 'sync',
        icon: CheckCircle2,
        label: failed > 0 ? 'Sync Check' : 'Synced',
        title: failed > 0 ? 'Some changes are still queued' : 'Cloud backup updated',
        body:
          failed > 0
            ? `${failed} change${failed === 1 ? '' : 's'} will retry automatically.`
            : `${processed} queued change${processed === 1 ? '' : 's'} saved to cloud.`,
        tone: failed > 0 ? 'border-amber-400/35 bg-zinc-950/95 text-amber-200' : 'border-emerald-400/25 bg-zinc-950/95 text-emerald-200',
        action: null,
        dismissible: true,
      };
    }

    return null;
  }, [isOnline, queuedOperations, remoteVersion, syncNotice, updateAvailable]);

  if (!status) return null;

  const Icon = status.icon;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.65rem)] z-[95] flex justify-center">
      <div
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[1.1rem] border px-3 py-2.5 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.9)] backdrop-blur-xl ${status.tone}`}
        role="status"
        aria-live="polite"
        data-testid={`app-resilience-${status.key}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">
            {status.label}
          </p>
          <p className="mt-0.5 truncate text-xs font-black uppercase tracking-[0.08em] text-white">
            {status.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
            {status.body}
          </p>
        </div>
        {status.action === 'refresh' ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="rounded-lg bg-emerald-300 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-950 active:bg-emerald-400"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setDismissedVersion(remoteVersion)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              aria-label="Dismiss update notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : status.dismissible ? (
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
            aria-label="Dismiss status"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="h-8 w-1 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
