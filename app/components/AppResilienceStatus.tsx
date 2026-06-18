'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';

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

type SyncQueueWindow = Window & {
  __ironBrainSyncQueueEvents?: SyncQueueDetail[];
  __ironBrainSyncQueueReady?: boolean;
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISMISSED_VERSION_KEY = 'iron_brain_dismissed_app_version';

export default function AppResilienceStatus({ currentVersion }: AppResilienceStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const syncBrowserState = (online = navigator.onLine) => {
      setIsOnline(online);
    };

    const handleOnline = () => {
      syncBrowserState(true);
      void checkVersion();
    };

    const handleOffline = () => {
      syncBrowserState(false);
    };

    const showSyncNotice = (detail: SyncQueueDetail) => {
      if ((detail.processed ?? 0) > 0) {
        setSyncNotice(detail);
        if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
        syncNoticeTimerRef.current = setTimeout(() => setSyncNotice(null), 5200);
      }
    };

    const handleSyncQueue = (event: Event) => {
      showSyncNotice((event as CustomEvent<SyncQueueDetail>).detail ?? {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncBrowserState();
        void checkVersion();
      }
    };

    syncBrowserState();
    setDismissedVersion(localStorage.getItem(DISMISSED_VERSION_KEY));
    const syncWindow = window as SyncQueueWindow;
    const queuedSyncEvents = syncWindow.__ironBrainSyncQueueEvents ?? [];
    syncWindow.__ironBrainSyncQueueEvents = [];
    syncWindow.__ironBrainSyncQueueReady = true;
    queuedSyncEvents.forEach(showSyncNotice);
    void checkVersion();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', checkVersion);
    window.addEventListener('iron-brain:sync-queue', handleSyncQueue);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = window.setInterval(checkVersion, CHECK_INTERVAL_MS);
    const browserStateInterval = window.setInterval(syncBrowserState, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', checkVersion);
      window.removeEventListener('iron-brain:sync-queue', handleSyncQueue);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      (window as SyncQueueWindow).__ironBrainSyncQueueReady = false;
      window.clearInterval(interval);
      window.clearInterval(browserStateInterval);
      if (syncNoticeTimerRef.current) clearTimeout(syncNoticeTimerRef.current);
    };
  }, [checkVersion]);

  const updateAvailable =
    Boolean(remoteVersion) &&
    remoteVersion !== currentVersion &&
    remoteVersion !== dismissedVersion &&
    isOnline;

  const status = useMemo(() => {
    if (updateAvailable && remoteVersion) {
      return {
        key: 'update',
        icon: RefreshCw,
        label: 'App Update',
        title: 'Refresh when free',
        body: 'A newer version is ready. Active workouts stay saved locally.',
        tone: 'text-emerald-200',
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
        label: failed > 0 ? 'Partly Synced' : 'Synced',
        title: failed > 0 ? 'Cloud backup partly updated' : 'Cloud backup updated',
        body:
          failed > 0
            ? `${processed} saved. ${failed} still retrying in the background.`
            : `${processed} queued change${processed === 1 ? '' : 's'} saved to cloud.`,
        tone: failed > 0 ? 'text-amber-200' : 'text-emerald-200',
        action: null,
        dismissible: true,
      };
    }

    return null;
  }, [remoteVersion, syncNotice, updateAvailable]);

  if (!status) return null;

  const Icon = status.icon;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.65rem)] z-[var(--z-toast)] flex justify-center">
      <div
        className={`liquid-sheet-panel pointer-events-auto flex w-full max-w-md items-center gap-3 px-3 py-2.5 ${status.tone}`}
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
              className="liquid-action-button rounded-lg px-2.5 py-2 text-[10px] font-black italic tracking-tight text-zinc-950"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissedVersion(remoteVersion);
                if (remoteVersion) localStorage.setItem(DISMISSED_VERSION_KEY, remoteVersion);
              }}
              className="liquid-icon-button flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200"
              aria-label="Dismiss update notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : status.dismissible ? (
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="liquid-icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200"
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
