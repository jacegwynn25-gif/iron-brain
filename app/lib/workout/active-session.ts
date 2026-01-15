'use client';

import type { WorkoutSession } from '../types';
import {
  saveActiveSession as saveStoredSession,
  getActiveSession as getStoredSession,
  clearActiveSession as clearStoredSession,
} from '../storage';

const ACTIVE_SESSION_KEY = 'iron_brain_active_session';

export interface ActiveSessionState {
  session: WorkoutSession;
  currentSetIndex: number;
  currentExerciseId?: string;
  view?: 'selection' | 'logging' | 'rest';
  isResting: boolean;
  restTimerSeconds: number | null;
  restTimerStartedAt: string | null;
  lastUpdated: string;
  programId?: string;
  weekNumber?: number;
  dayIndex?: number;
}

// Save active session (call on every state change)
export function saveActiveSession(state: ActiveSessionState, userNamespace?: string): void {
  try {
    const toSave: ActiveSessionState = {
      ...state,
      lastUpdated: new Date().toISOString(),
    };

    saveStoredSession(
      {
        session: toSave.session,
        weekNumber: toSave.weekNumber ?? toSave.session.weekNumber ?? 1,
        dayIndex: toSave.dayIndex ?? toSave.session.metadata?.dayIndex ?? 0,
        programId: toSave.programId ?? toSave.session.programId ?? 'unknown',
        currentSetIndex: toSave.currentSetIndex,
        currentExerciseId: toSave.currentExerciseId,
        view: toSave.view,
        isResting: toSave.isResting,
        restTimerSeconds: toSave.restTimerSeconds,
        restTimerStartedAt: toSave.restTimerStartedAt,
        lastUpdated: toSave.lastUpdated,
      },
      userNamespace
    );
  } catch (err) {
    console.error('Failed to save active session:', err);
  }
}

// Get active session (call on app mount)
export function getActiveSession(userNamespace?: string): ActiveSessionState | null {
  try {
    const stored = getStoredSession(userNamespace, 4);
    if (!stored) return null;

    const { payload, ageHours } = stored;
    if (ageHours > 4) {
      clearActiveSession(userNamespace);
      return null;
    }

    return {
      session: payload.session,
      currentSetIndex: payload.currentSetIndex ?? payload.session.sets.filter(s => s.completed).length,
      currentExerciseId: payload.currentExerciseId ?? undefined,
      view: payload.view ?? undefined,
      isResting: payload.isResting ?? false,
      restTimerSeconds: payload.restTimerSeconds ?? null,
      restTimerStartedAt: payload.restTimerStartedAt ?? null,
      lastUpdated: payload.lastUpdated ?? payload.savedAt,
      programId: payload.programId,
      weekNumber: payload.weekNumber,
      dayIndex: payload.dayIndex,
    };
  } catch (err) {
    console.error('Failed to get active session:', err);
    return null;
  }
}

// Clear active session (call when workout completes or is discarded)
export function clearActiveSession(userNamespace?: string): void {
  try {
    clearStoredSession(userNamespace);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear active session:', err);
  }
}

// Check if there's an active session to resume
export function hasActiveSession(userNamespace?: string): boolean {
  return getActiveSession(userNamespace) !== null;
}

// Calculate remaining rest time if timer was running
export function calculateRemainingRest(state: ActiveSessionState): number | null {
  if (!state.isResting || !state.restTimerStartedAt || !state.restTimerSeconds) {
    return null;
  }

  const startedAt = new Date(state.restTimerStartedAt).getTime();
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const remaining = state.restTimerSeconds - elapsed;

  return remaining > 0 ? remaining : 0;
}
