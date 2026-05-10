'use client';

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useMemo,
    type ReactNode,
} from 'react';
import type { Block, ActiveCell } from '../lib/types/session';
import { useAuth } from '../lib/supabase/auth-context';

// ============================================================
// TYPES
// ============================================================

export interface ActiveSessionMeta {
    programId: string;
    programName: string;
    weightUnit?: 'lbs' | 'kg';
    weekNumber?: number;
    dayName?: string;
    cycleNumber?: number;
    weekIndex?: number;
    dayIndex?: number;
}

export interface ActiveSessionSnapshot {
    status: 'active' | 'finished';
    startTime: string; // ISO string for serialization
    blocks: Block[];
    activeCell: ActiveCell | null;
    meta: ActiveSessionMeta;
    savedAt?: string;
    storageVersion?: number;
}

interface ActiveSessionContextValue {
    /** Current snapshot of the active workout, or null if none */
    snapshot: ActiveSessionSnapshot | null;
    /** Whether local active-session storage has been loaded for the current namespace */
    isReady: boolean;
    /** Whether a workout is currently in progress */
    isSessionActive: boolean;
    /** Store a new or updated session snapshot */
    saveSnapshot: (snapshot: ActiveSessionSnapshot) => void;
    /** Clear the active session (after finishing/discarding) */
    clearSession: () => void;
}

// ============================================================
// STORAGE KEY
// ============================================================

const BASE_STORAGE_KEY = 'iron_brain_active_session_v1';
const DEFAULT_STORAGE_KEY = `${BASE_STORAGE_KEY}__default`;
const ACTIVE_SESSION_CLEAR_MARKER_KEY = 'iron_brain_active_session_cleared_at';
const ACTIVE_SESSION_PENDING_KEY = 'iron_brain_active_session_pending';
const ACTIVE_SESSION_MAX_AGE_MS = 18 * 60 * 60 * 1000;
const ACTIVE_SESSION_STORAGE_VERSION = 2;
const ACTIVE_SESSION_STORAGE_PREFIXES = [
    'iron_brain_active_session',
    'iron_brain_active_session_v1',
    'iron_brain_session_timestamp',
    'iron_brain_session_version',
];

function readClearMarker(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(ACTIVE_SESSION_CLEAR_MARKER_KEY);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
}

function getSnapshotStartMs(snapshot: Pick<ActiveSessionSnapshot, 'startTime'>): number {
    const parsed = Date.parse(snapshot.startTime);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getSnapshotSavedMs(snapshot: ActiveSessionSnapshot): number {
    const saved = snapshot.savedAt ? Date.parse(snapshot.savedAt) : 0;
    if (Number.isFinite(saved) && saved > 0) return saved;
    return getSnapshotStartMs(snapshot);
}

function isSnapshotBlocked(snapshot: ActiveSessionSnapshot): boolean {
    const startMs = getSnapshotStartMs(snapshot);
    const savedMs = getSnapshotSavedMs(snapshot);
    if (startMs <= 0 || savedMs <= 0) return true;

    const clearMarker = readClearMarker();
    if (clearMarker > 0 && startMs <= clearMarker) return true;

    return Date.now() - savedMs > ACTIVE_SESSION_MAX_AGE_MS;
}

export function clearAllActiveSessionStorageKeys(): number {
    if (typeof window === 'undefined') return 0;

    let removed = 0;
    try {
        const keysToRemove: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key) continue;
            if (
                ACTIVE_SESSION_STORAGE_PREFIXES.some(
                    (prefix) => key === prefix || key.startsWith(`${prefix}__`)
                )
            ) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
            removed += 1;
        });
        localStorage.setItem(ACTIVE_SESSION_CLEAR_MARKER_KEY, String(Date.now()));
    } catch {
        // Continue even when localStorage is unavailable.
    }

    try {
        sessionStorage.removeItem(ACTIVE_SESSION_PENDING_KEY);
    } catch {
        // Ignore unavailable sessionStorage.
    }

    return removed;
}

function readStoredSession(storageKey: string): ActiveSessionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ActiveSessionSnapshot;
        // Basic validation
        if (!parsed.startTime || !Array.isArray(parsed.blocks) || !parsed.meta) {
            localStorage.removeItem(storageKey);
            return null;
        }
        if (isSnapshotBlocked(parsed)) {
            localStorage.removeItem(storageKey);
            return null;
        }
        return parsed;
    } catch {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Ignore unavailable storage.
        }
        return null;
    }
}

function writeStoredSession(storageKey: string, snapshot: ActiveSessionSnapshot | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (snapshot) {
            if (isSnapshotBlocked(snapshot)) return;
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    ...snapshot,
                    savedAt: new Date().toISOString(),
                    storageVersion: ACTIVE_SESSION_STORAGE_VERSION,
                })
            );
        } else {
            localStorage.removeItem(storageKey);
        }
    } catch {
        // Storage full or unavailable — silently fail
    }
}

// ============================================================
// CONTEXT
// ============================================================

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
    const { namespaceId, namespaceReady } = useAuth();
    const storageKey = useMemo(
        () => (namespaceReady ? `${BASE_STORAGE_KEY}__${namespaceId ?? 'default'}` : DEFAULT_STORAGE_KEY),
        [namespaceId, namespaceReady]
    );
    const [snapshot, setSnapshot] = useState<ActiveSessionSnapshot | null>(null);
    const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
    const snapshotRef = useRef<ActiveSessionSnapshot | null>(snapshot);

    // Throttle writes to localStorage to avoid perf issues during fast interactions
    const pendingWriteRef = useRef<ActiveSessionSnapshot | null | undefined>(undefined);
    const preStorageSnapshotRef = useRef<ActiveSessionSnapshot | null>(null);
    const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClearTimeRef = useRef(0);

    const flushWrite = useCallback(() => {
        if (storageKey && pendingWriteRef.current !== undefined) {
            if (pendingWriteRef.current && isSnapshotBlocked(pendingWriteRef.current)) {
                pendingWriteRef.current = undefined;
                return;
            }
            writeStoredSession(storageKey, pendingWriteRef.current ?? null);
            pendingWriteRef.current = undefined;
        }
    }, [storageKey]);

    const scheduleWrite = useCallback(
        (value: ActiveSessionSnapshot | null) => {
            pendingWriteRef.current = value;
            if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
            writeTimerRef.current = setTimeout(flushWrite, 1500);
        },
        [flushWrite]
    );

    useLayoutEffect(() => {
        if (!storageKey) return;

        if (writeTimerRef.current) {
            clearTimeout(writeTimerRef.current);
            writeTimerRef.current = null;
        }
        pendingWriteRef.current = undefined;
        const carriedSnapshot =
            loadedStorageKey &&
            loadedStorageKey !== storageKey &&
            snapshotRef.current?.status === 'active' &&
            !isSnapshotBlocked(snapshotRef.current)
                ? snapshotRef.current
                : null;
        const pendingSnapshot = preStorageSnapshotRef.current ?? carriedSnapshot;
        const storedSnapshot = readStoredSession(storageKey);
        const nextSnapshot =
            pendingSnapshot?.status === 'active' && !isSnapshotBlocked(pendingSnapshot)
                ? pendingSnapshot
                : storedSnapshot;
        if (pendingSnapshot?.status === 'active' && !isSnapshotBlocked(pendingSnapshot)) {
            writeStoredSession(storageKey, pendingSnapshot);
            if (storageKey !== DEFAULT_STORAGE_KEY) {
                writeStoredSession(DEFAULT_STORAGE_KEY, null);
            }
        }
        preStorageSnapshotRef.current = null;
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        setLoadedStorageKey(storageKey);

        try {
            localStorage.removeItem(BASE_STORAGE_KEY);
        } catch {
            // Ignore unavailable storage.
        }
    }, [loadedStorageKey, storageKey]);

    // Flush on unmount / page hide
    useEffect(() => {
        if (!storageKey) return;

        const handleBeforeUnload = () => flushWrite();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushWrite();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            flushWrite();
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        };
    }, [flushWrite, storageKey]);

    const saveSnapshot = useCallback(
        (next: ActiveSessionSnapshot) => {
            const nextStartTime = Date.parse(next.startTime);
            const recentlyCleared = lastClearTimeRef.current > 0 && Date.now() - lastClearTimeRef.current < 5000;
            if (
                recentlyCleared &&
                Number.isFinite(nextStartTime) &&
                nextStartTime <= lastClearTimeRef.current
            ) {
                return;
            }
            if (isSnapshotBlocked(next)) return;

            const shouldWriteImmediately = storageKey && snapshotRef.current?.status !== 'active';
            if (storageKey) {
                setLoadedStorageKey(storageKey);
                preStorageSnapshotRef.current = null;
            } else {
                preStorageSnapshotRef.current = next;
            }
            snapshotRef.current = next;
            setSnapshot(next);
            if (storageKey) {
                if (shouldWriteImmediately) {
                    if (writeTimerRef.current) {
                        clearTimeout(writeTimerRef.current);
                        writeTimerRef.current = null;
                    }
                    pendingWriteRef.current = undefined;
                    writeStoredSession(storageKey, next);
                } else {
                    scheduleWrite(next);
                }
            } else {
                writeStoredSession(DEFAULT_STORAGE_KEY, next);
            }
        },
        [scheduleWrite, storageKey]
    );

    const clearSession = useCallback(() => {
        lastClearTimeRef.current = Date.now();
        pendingWriteRef.current = undefined;
        if (writeTimerRef.current) {
            clearTimeout(writeTimerRef.current);
            writeTimerRef.current = null;
        }
        clearAllActiveSessionStorageKeys();
        snapshotRef.current = null;
        setSnapshot(null);
        preStorageSnapshotRef.current = null;
        setLoadedStorageKey(storageKey);
    }, [storageKey]);

    const activeSnapshot = loadedStorageKey === storageKey ? snapshot : null;
    const isReady = loadedStorageKey === storageKey;
    const isSessionActive = activeSnapshot !== null && activeSnapshot.status === 'active';

    return (
        <ActiveSessionContext.Provider
            value={{ snapshot: activeSnapshot, isReady, isSessionActive, saveSnapshot, clearSession }}
        >
            {children}
        </ActiveSessionContext.Provider>
    );
}

// ============================================================
// HOOKS
// ============================================================

export function useActiveSession(): ActiveSessionContextValue {
    const context = useContext(ActiveSessionContext);
    if (!context) {
        throw new Error('useActiveSession must be used within an ActiveSessionProvider');
    }
    return context;
}

export function useActiveSessionOptional(): ActiveSessionContextValue | null {
    return useContext(ActiveSessionContext);
}
