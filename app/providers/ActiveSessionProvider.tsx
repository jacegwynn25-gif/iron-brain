'use client';

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import type { Block, ActiveCell } from '../lib/types/session';

// ============================================================
// TYPES
// ============================================================

export interface ActiveSessionMeta {
    programId: string;
    programName: string;
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

const STORAGE_KEY = 'iron_brain_active_session_v1';

function readStoredSession(): ActiveSessionSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ActiveSessionSnapshot;
        // Basic validation
        if (!parsed.startTime || !Array.isArray(parsed.blocks) || !parsed.meta) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredSession(snapshot: ActiveSessionSnapshot | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (snapshot) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } else {
            localStorage.removeItem(STORAGE_KEY);
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
    const [snapshot, setSnapshot] = useState<ActiveSessionSnapshot | null>(() =>
        readStoredSession()
    );

    // Throttle writes to localStorage to avoid perf issues during fast interactions
    const pendingWriteRef = useRef<ActiveSessionSnapshot | null | undefined>(undefined);
    const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushWrite = useCallback(() => {
        if (pendingWriteRef.current !== undefined) {
            writeStoredSession(pendingWriteRef.current ?? null);
            pendingWriteRef.current = undefined;
        }
    }, []);

    const scheduleWrite = useCallback(
        (value: ActiveSessionSnapshot | null) => {
            pendingWriteRef.current = value;
            if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
            writeTimerRef.current = setTimeout(flushWrite, 1500);
        },
        [flushWrite]
    );

    // Flush on unmount / page hide
    useEffect(() => {
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
    }, [flushWrite]);

    const saveSnapshot = useCallback(
        (next: ActiveSessionSnapshot) => {
            setSnapshot(next);
            scheduleWrite(next);
        },
        [scheduleWrite]
    );

    const clearSession = useCallback(() => {
        setSnapshot(null);
        // Clear immediately — no throttle for cleanup
        writeStoredSession(null);
        pendingWriteRef.current = undefined;
        if (writeTimerRef.current) {
            clearTimeout(writeTimerRef.current);
            writeTimerRef.current = null;
        }
    }, []);

    const isSessionActive = snapshot !== null && snapshot.status === 'active';

    return (
        <ActiveSessionContext.Provider
            value={{ snapshot, isSessionActive, saveSnapshot, clearSession }}
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
