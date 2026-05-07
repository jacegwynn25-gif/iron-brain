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
}

interface ActiveSessionContextValue {
    /** Current snapshot of the active workout, or null if none */
    snapshot: ActiveSessionSnapshot | null;
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

function readStoredSession(storageKey: string): ActiveSessionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ActiveSessionSnapshot;
        // Basic validation
        if (!parsed.startTime || !Array.isArray(parsed.blocks) || !parsed.meta) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredSession(storageKey: string, snapshot: ActiveSessionSnapshot | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (snapshot) {
            localStorage.setItem(storageKey, JSON.stringify(snapshot));
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

    const flushWrite = useCallback(() => {
        if (storageKey && pendingWriteRef.current !== undefined) {
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
            snapshotRef.current?.status === 'active'
                ? snapshotRef.current
                : null;
        const pendingSnapshot = preStorageSnapshotRef.current ?? carriedSnapshot;
        const storedSnapshot = readStoredSession(storageKey);
        const nextSnapshot =
            pendingSnapshot?.status === 'active' ? pendingSnapshot : storedSnapshot;
        if (pendingSnapshot?.status === 'active') {
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
        snapshotRef.current = null;
        setSnapshot(null);
        preStorageSnapshotRef.current = null;
        setLoadedStorageKey(storageKey);
        // Clear immediately — no throttle for cleanup
        if (storageKey) {
            writeStoredSession(storageKey, null);
        }
        writeStoredSession(DEFAULT_STORAGE_KEY, null);
        pendingWriteRef.current = undefined;
        if (writeTimerRef.current) {
            clearTimeout(writeTimerRef.current);
            writeTimerRef.current = null;
        }
    }, [storageKey]);

    const activeSnapshot = loadedStorageKey === storageKey ? snapshot : null;
    const isSessionActive = activeSnapshot !== null && activeSnapshot.status === 'active';

    return (
        <ActiveSessionContext.Provider
            value={{ snapshot: activeSnapshot, isSessionActive, saveSnapshot, clearSession }}
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
