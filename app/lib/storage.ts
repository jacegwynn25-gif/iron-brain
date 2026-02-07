import { logger } from './logger';
import { WorkoutSession, SetLog } from './types';
import { shouldTriggerAutoReduction, calculateAdjustedWeight, calculateMuscleFatigue } from './fatigueModel';
import { supabase } from './supabase/client';
import { saveFatigueSnapshot, getRecoveryProfiles } from './fatigue/cross-session';
import { calculateWorkoutSFR, saveSFRAnalysis } from './fatigue/sfr';
import { defaultExercises } from './programs';
import { createUuid, isValidUuid } from './uuid';
import { queueOperation, isOnline } from './sync/offline-queue';
import type { PostgrestError } from '@supabase/supabase-js';
import { convertWeight } from './units';

const STORAGE_KEYS = {
  WORKOUT_HISTORY: 'iron_brain_workout_history',
  USER_SETTINGS: 'iron_brain_user_settings',
  CURRENT_CYCLE: 'iron_brain_current_cycle',
  ACTIVE_SESSION: 'iron_brain_active_session',
  SESSION_TIMESTAMP: 'iron_brain_session_timestamp',
  SESSION_VERSION: 'iron_brain_session_version',
} as const;

let activeUserNamespace = 'default';
let isNamespaceInitialized = false;

type WorkoutMetadata = {
  programId?: string;
  programName?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: string;
  dayName?: string;
};

/**
 * Set user namespace and migrate any orphaned workouts
 * This fixes the issue where workouts stored under 'default' aren't visible
 * after logging in with a user ID
 */
const normalizeNamespace = (value?: string | null) => {
  if (!value || value === 'default' || value === 'guest') return 'default';
  return value;
};

const migrateWorkoutsBetweenNamespaces = (fromNamespace: string, toNamespace: string) => {
  if (fromNamespace === toNamespace || typeof window === 'undefined') return;

  const oldKey = `${STORAGE_KEYS.WORKOUT_HISTORY}__${fromNamespace}`;
  const newKey = `${STORAGE_KEYS.WORKOUT_HISTORY}__${toNamespace}`;

  try {
    const oldData = localStorage.getItem(oldKey);
    const oldWorkouts = oldData ? JSON.parse(oldData) : [];

    const newData = localStorage.getItem(newKey);
    const newWorkouts = newData ? JSON.parse(newData) : [];

    const stripPrefix = (id: string) => (typeof id === 'string' && id.startsWith('session_') ? id.substring(8) : id);
    const newIds = new Set(
      Array.isArray(newWorkouts) ? newWorkouts.map((workout: { id?: string }) => stripPrefix(workout.id ?? '')) : []
    );
    const uniqueOld = Array.isArray(oldWorkouts)
      ? oldWorkouts.filter((workout: { id?: string }) => !newIds.has(stripPrefix(workout.id ?? '')))
      : [];

    if (uniqueOld.length > 0) {
      logger.debug(`🔄 Migrating ${uniqueOld.length} workouts from ${fromNamespace} to ${toNamespace}`);
      const merged = Array.isArray(newWorkouts) ? [...newWorkouts, ...uniqueOld] : uniqueOld;
      localStorage.setItem(newKey, JSON.stringify(merged));
      logger.debug('✅ Workouts migrated successfully');
    }
  } catch (err) {
    console.error('Failed to migrate workouts on namespace change:', err);
  }
};

export function setUserNamespace(userId: string | null) {
  const normalizedCurrent = normalizeNamespace(activeUserNamespace);

  if (normalizedCurrent !== activeUserNamespace) {
    migrateWorkoutsBetweenNamespaces(activeUserNamespace, normalizedCurrent);
    activeUserNamespace = normalizedCurrent;
  }

  const newNamespace = normalizeNamespace(userId);

  if (newNamespace !== normalizedCurrent && typeof window !== 'undefined') {
    const shouldMigrateWorkouts = normalizedCurrent === 'default' && newNamespace !== 'default';
    if (shouldMigrateWorkouts) {
      migrateWorkoutsBetweenNamespaces(normalizedCurrent, newNamespace);
    }
  }

  activeUserNamespace = newNamespace;
  isNamespaceInitialized = true;
}

const getKey = (base: string) => {
  if (!isNamespaceInitialized && typeof window !== 'undefined') {
    console.warn('Storage accessed before namespace initialized. Using default namespace.');
  }
  return `${base}__${activeUserNamespace}`;
};

// Reserved for future exercise slug -> UUID mapping if needed.

// ============================================================
// ACTIVE SESSION MANAGEMENT (Anti-Data Loss)
// ============================================================

export interface ActiveSessionPayload {
  session: WorkoutSession;
  weekNumber: number;
  dayIndex: number;
  programId: string;
  currentSetIndex?: number;
  currentExerciseId?: string;
  view?: 'selection' | 'logging' | 'rest';
  isResting?: boolean;
  restTimerSeconds?: number | null;
  restTimerStartedAt?: string | null;
  lastUpdated?: string;
  savedAt: string; // ISO timestamp
  version: number; // For future schema migrations
}

/**
 * Save active workout session with comprehensive error handling
 * This is called whenever session state changes to prevent data loss
 */
export function saveActiveSession(
  payload: Omit<ActiveSessionPayload, 'savedAt' | 'version'>,
  userNamespace?: string
): boolean {
  try {
    const namespace = userNamespace || activeUserNamespace;

    const fullPayload: ActiveSessionPayload = {
      ...payload,
      savedAt: new Date().toISOString(),
      lastUpdated: payload.lastUpdated ?? new Date().toISOString(),
      version: 1,
    };

    const key = `${STORAGE_KEYS.ACTIVE_SESSION}__${namespace}`;
    localStorage.setItem(key, JSON.stringify(fullPayload));

    // Save timestamp separately for quick staleness checks
    localStorage.setItem(
      `${STORAGE_KEYS.SESSION_TIMESTAMP}__${namespace}`,
      fullPayload.savedAt
    );

    logger.debug('💾 Active session saved:', {
      sets: fullPayload.session.sets.length,
      completed: fullPayload.session.sets.filter(s => s.completed).length,
      savedAt: fullPayload.savedAt,
    });

    return true;
  } catch (error) {
    console.error('Failed to save active session:', error);

    // If localStorage is full, try to clear old sessions
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded, attempting cleanup...');
      clearStaleActiveSessions();
      // Retry once after cleanup
      try {
        const namespace = userNamespace || activeUserNamespace;
        const key = `${STORAGE_KEYS.ACTIVE_SESSION}__${namespace}`;
        const fullPayload: ActiveSessionPayload = {
          ...payload,
          savedAt: new Date().toISOString(),
          version: 1,
        };
        localStorage.setItem(key, JSON.stringify(fullPayload));
        logger.debug('✅ Session saved after cleanup');
        return true;
      } catch {
        console.error('Failed even after cleanup - storage critically full');
        return false;
      }
    }

    return false;
  }
}

/**
 * Get active session with automatic staleness check
 * Returns null if no session exists or if it's corrupted
 */
export function getActiveSession(
  userNamespace?: string,
  maxAgeHours: number = 24
): { payload: ActiveSessionPayload; ageHours: number; isStale: boolean } | null {
  try {
    const namespace = userNamespace || activeUserNamespace;
    const key = `${STORAGE_KEYS.ACTIVE_SESSION}__${namespace}`;
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    const payload = JSON.parse(raw) as ActiveSessionPayload;

    // Validate payload structure
    if (!payload.session || !payload.programId || !payload.savedAt) {
      console.warn('Invalid session payload detected, clearing...');
      clearActiveSession(namespace);
      return null;
    }

    // Check session age
    const savedAt = new Date(payload.savedAt);
    const now = new Date();
    const ageHours = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
    const isStale = ageHours > maxAgeHours;

    if (isStale) {
      console.warn(`Active session is ${ageHours.toFixed(1)}h old - marked as stale`);
    } else {
      logger.debug(`✅ Active session found: ${ageHours.toFixed(1)}h old`);
    }

    return { payload, ageHours, isStale };
  } catch (error) {
    console.error('Failed to load active session:', error);
    // Clear corrupted session
    if (userNamespace) {
      clearActiveSession(userNamespace);
    }
    return null;
  }
}

/**
 * Clear active session for a specific user
 */
export function clearActiveSession(userNamespace?: string): void {
  try {
    const namespace = userNamespace || activeUserNamespace;
    const key = `${STORAGE_KEYS.ACTIVE_SESSION}__${namespace}`;
    const tsKey = `${STORAGE_KEYS.SESSION_TIMESTAMP}__${namespace}`;

    localStorage.removeItem(key);
    localStorage.removeItem(tsKey);

    logger.debug('🗑️ Active session cleared for:', namespace);
  } catch (error) {
    console.error('Failed to clear active session:', error);
  }
}

/**
 * Clean up stale active sessions from all users (maintenance)
 * Called automatically when storage quota is exceeded
 */
function clearStaleActiveSessions(): void {
  try {
    const keysToRemove: string[] = [];
    const staleThresholdHours = 48;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_KEYS.SESSION_TIMESTAMP)) continue;

      const timestamp = localStorage.getItem(key);
      if (!timestamp) continue;

      const savedAt = new Date(timestamp);
      const ageHours = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);

      // Remove sessions older than 48 hours
      if (ageHours > staleThresholdHours) {
        const namespace = key.split('__')[1];
        keysToRemove.push(`${STORAGE_KEYS.ACTIVE_SESSION}__${namespace}`);
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));

    if (keysToRemove.length > 0) {
      logger.debug(`🧹 Cleaned up ${keysToRemove.length / 2} stale sessions`);
    }
  } catch (error) {
    console.error('Failed to clean stale sessions:', error);
  }
}

// ============================================================
// WORKOUT HISTORY STORAGE
// ============================================================

export async function saveWorkout(
  session: WorkoutSession,
  providedUserId?: string | null,
  options?: { skipAnalytics?: boolean }
): Promise<void> {
  let sessionToQueue = session;
  try {
    // Normalize session ID to always include a valid UUID
    let workoutUuid = session.id.startsWith('session_')
      ? session.id.substring(8)
      : session.id;
    let sessionToSave = session;

    if (!isValidUuid(workoutUuid)) {
      workoutUuid = createUuid();
      sessionToSave = {
        ...session,
        id: `session_${workoutUuid}`,
      };
      console.warn('Invalid workout session ID detected; regenerated UUID.', {
        previousId: session.id,
        regeneratedId: sessionToSave.id,
      });
    }
    sessionToQueue = sessionToSave;

    // Always save to localStorage first (for offline support)
    const history = getWorkoutHistory();
    history.push(sessionToSave);
    localStorage.setItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY), JSON.stringify(history));
    logger.debug('✅ Saved to localStorage');

    const queueWorkout = () => {
      queueOperation('create', 'workout_sessions', sessionToSave);
    };

    if (!isOnline()) {
      logger.debug('📥 Offline - queued workout for sync');
      queueWorkout();
      return;
    }

    // Also save to Supabase if user is logged in
    let user: { id: string } | null = null;

    if (providedUserId) {
      user = { id: providedUserId };
    } else {
      // Add timeout to prevent hanging
      try {
        const getUserPromise = supabase.auth.getUser();
        const timeoutPromise: Promise<never> = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getUser timeout')), 5000)
        );

        const authResult: Awaited<ReturnType<typeof supabase.auth.getUser>> = await Promise.race([
          getUserPromise,
          timeoutPromise
        ]);

        const { data: { user: authUser }, error: userError } = authResult;

        if (userError) {
          console.error('Error getting user:', userError);
          queueWorkout();
          return;
        }

        user = authUser;
      } catch (error) {
        console.error('Auth check timed out or failed:', error);
        queueWorkout();
        return;
      }
    }

    if (user) {

      // Prepare program metadata for storage
      const metadata: WorkoutMetadata = {};
      if (sessionToSave.programId) metadata.programId = sessionToSave.programId;
      if (sessionToSave.programName) metadata.programName = sessionToSave.programName;
      if (sessionToSave.cycleNumber) metadata.cycleNumber = sessionToSave.cycleNumber;
      if (sessionToSave.weekNumber) metadata.weekNumber = sessionToSave.weekNumber;
      if (sessionToSave.dayOfWeek) metadata.dayOfWeek = sessionToSave.dayOfWeek;
      if (sessionToSave.dayName) metadata.dayName = sessionToSave.dayName;

      // Create workout session in Supabase with timeout
      let sessionData: { id?: string } | null = null;
      let sessionError: PostgrestError | null = null;

      try {
        const upsertPromise = supabase
          .from('workout_sessions')
          .upsert({
          id: workoutUuid,
          user_id: user.id,
          name: sessionToSave.dayName || sessionToSave.programName || 'Workout',
          date: sessionToSave.date,
          start_time: sessionToSave.startTime,
          end_time: sessionToSave.endTime,
          duration_minutes: sessionToSave.durationMinutes != null ? Math.round(Number(sessionToSave.durationMinutes)) : null,
          bodyweight: sessionToSave.bodyweight,
          notes: sessionToSave.notes,
          metadata: metadata,
          status: 'completed',
          total_sets: sessionToSave.sets?.length || 0,
          total_reps: Math.round(sessionToSave.sets?.reduce((sum, s) => sum + (Number(s.actualReps) || 0), 0) || 0),
          total_volume_load: Math.round(sessionToSave.sets?.reduce((sum, s) => sum + ((Number(s.actualWeight) || 0) * (Number(s.actualReps) || 0)), 0) || 0),
          average_rpe: sessionToSave.sets?.length ? sessionToSave.sets.reduce((sum, s) => sum + (Number(s.actualRPE) || 0), 0) / sessionToSave.sets.length : null,
        })
        .select()
        .single();

        const timeoutPromise: Promise<never> = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database upsert timeout after 10s')), 10000)
        );

        type UpsertResponse = Awaited<typeof upsertPromise>;
        const result: UpsertResponse = await Promise.race([upsertPromise, timeoutPromise]);
        sessionData = result.data;
        sessionError = result.error;
      } catch (error) {
        console.error('Upsert failed or timed out:', error);
        sessionError = {
          name: 'PostgrestError',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: '',
          hint: '',
          code: 'TIMEOUT'
        };
      }

      if (sessionError) {
        const errorPayload: Pick<PostgrestError, 'message' | 'details' | 'hint' | 'code'> = {
          message: sessionError.message,
          details: sessionError.details,
          hint: sessionError.hint,
          code: sessionError.code,
        };
        console.error('Failed to save workout session to Supabase:', errorPayload);
        queueWorkout();
        return; // Don't try to save sets if session failed
      }

      const sessionId = (sessionData as { id?: string } | null)?.id ?? workoutUuid;

      // Save each set (batched for speed)
      if (sessionToSave.sets && sessionToSave.sets.length > 0) {
        const setPayloads = sessionToSave.sets.map((set, index) => {
          const payload: Record<string, unknown> = {
            workout_session_id: workoutUuid,
            exercise_id: null, // Set to NULL - we use exercise_slug instead
            exercise_slug: set.exerciseId, // Store app exercise ID for backward compatibility
            program_set_id: null,
            order_index: index,
            set_index: set.setIndex ? Math.round(Number(set.setIndex)) : index + 1,
            // Prescribed values (what the program said to do)
            prescribed_reps: set.prescribedReps != null ? Math.round(Number(set.prescribedReps)).toString() : null,
            prescribed_rpe: set.prescribedRPE != null ? Number(set.prescribedRPE) : null,
            prescribed_rir: set.prescribedRIR != null ? Number(set.prescribedRIR) : null,
            prescribed_percentage: set.prescribedPercentage,
            // Actual values (what was actually done)
            actual_weight: set.actualWeight,
            weight_unit: set.weightUnit === 'kg' ? 'kg' : 'lbs',
            actual_reps: set.actualReps != null ? Math.round(Number(set.actualReps)) : null,
            actual_rpe: set.actualRPE != null ? Number(set.actualRPE) : null,
            actual_rir: set.actualRIR != null ? Number(set.actualRIR) : null,
            // Performance metrics
            e1rm: set.e1rm,
            volume_load:
              set.actualWeight && set.actualReps
                ? Math.round(Number(set.actualWeight) * Number(set.actualReps))
                : null,
            // Set metadata
            set_type: set.setType || 'straight',
            tempo: set.tempo,
            rest_seconds: set.restTakenSeconds != null ? Math.round(Number(set.restTakenSeconds)) : null,
            actual_seconds: set.setDurationSeconds != null ? Math.round(Number(set.setDurationSeconds)) : null,
            notes: set.notes,
            completed: set.completed !== false,
            skipped: set.completed === false,
          };

          if (set.id && isValidUuid(set.id)) {
            payload.id = set.id;
          }

          return payload;
        });

        const { error: setError } = await supabase.from('set_logs').insert(setPayloads);
        if (setError) {
          console.error('Failed to save set logs:', setError);
          queueWorkout();
        } else {
          logger.debug(`✅ Saved ${sessionToSave.sets.length} sets to Supabase`);
        }

        if (!options?.skipAnalytics) {
          // PHASE 2: Save fatigue snapshot for cross-session tracking
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && sessionToSave.sets.length > 0) {
              // Calculate fatigue for all trained muscles
              const completedSets = sessionToSave.sets.filter(s => s.completed && s.setType !== 'warmup');
              if (completedSets.length > 0) {
                // Track fatigue for all major muscle groups
                const muscleGroupsToTrack = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'triceps', 'biceps', 'abs', 'calves'];
                const fatigueScores = calculateMuscleFatigue(completedSets, muscleGroupsToTrack);

                // Filter to only muscles with meaningful fatigue (>5)
                const significantFatigue = fatigueScores.filter(f => f.fatigueLevel > 5);

                if (significantFatigue.length > 0) {
                  await saveFatigueSnapshot(user.id, sessionId, significantFatigue);
                  logger.debug(`✅ Saved fatigue snapshot for ${significantFatigue.length} muscle groups`);
                }

                // PHASE 2.5: Save to NEW recovery system (fatigue_events table)
                try {
                  await saveFatigueEventsToNewSystem(user.id, sessionId, completedSets);
                } catch (newSystemError) {
                  console.error('Could not save to new recovery system:', newSystemError);
                  // Non-critical - continue
                }

                // PHASE 3: Calculate and save SFR analysis
                try {
                  const sfrSummary = calculateWorkoutSFR(completedSets);
                  if (sfrSummary.exerciseAnalyses.length > 0) {
                    await saveSFRAnalysis(user.id, sessionId, sfrSummary);
                  }
                } catch (sfrError) {
                  console.warn('Could not save SFR analysis:', sfrError);
                  // Non-critical - continue
                }
              }
            }
          } catch (fatigueError) {
            console.warn('Could not save fatigue snapshot:', fatigueError);
            // Non-critical - continue
          }
        }
      } else {
        console.warn('No sets to save or session failed');
      }

      logger.debug('✅ Workout synced to Supabase!');
    } else {
      queueWorkout();
    }
  } catch (error) {
    console.error('Failed to save workout:', error);
    // Don't throw - we want localStorage save to succeed even if Supabase fails
    queueOperation('create', 'workout_sessions', sessionToQueue);
  }
}

export function getWorkoutHistory(): WorkoutSession[] {
  try {
    if (typeof window === 'undefined') {
      return [];
    }
    const data = localStorage.getItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY));
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load workout history:', error);
    return [];
  }
}

export function setWorkoutHistory(sessions: WorkoutSession[]): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY), JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to set workout history:', error);
  }
}

export function getWorkoutById(id: string): WorkoutSession | null {
  const history = getWorkoutHistory();
  return history.find(w => w.id === id) || null;
}

export async function deleteWorkout(id: string): Promise<void> {
  // Import trash functions dynamically to avoid circular dependencies
  const { moveToTrash } = await import('./trash');

  try {
    // Move to trash instead of permanent delete
    await moveToTrash(id);
    logger.debug(`✅ Moved workout ${id} to trash`);
  } catch (error) {
    console.error('Failed to move workout to trash:', error);
    throw error;
  }
}

export async function updateWorkoutDetails(
  id: string,
  updates: Partial<Pick<WorkoutSession, 'date' | 'startTime' | 'endTime' | 'durationMinutes'>>
): Promise<WorkoutSession | null> {
  try {
    const normalizeId = (value: string) => (value.startsWith('session_') ? value.substring(8) : value);
    const matches = (a: string, b: string) => normalizeId(a) === normalizeId(b);

    const history = getWorkoutHistory();
    const index = history.findIndex(session => matches(session.id, id));
    if (index === -1) {
      logger.debug('Workout not found for update:', id);
      return null;
    }

    const updatedSession: WorkoutSession = {
      ...history[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    history[index] = updatedSession;
    setWorkoutHistory(history);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting user for workout update:', userError);
      return updatedSession;
    }

    if (user) {
      const payload: Partial<{
        date: string;
        start_time: string | null;
        end_time: string | null;
        duration_minutes: number | null;
      }> = {};
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.startTime !== undefined) payload.start_time = updates.startTime;
      if (updates.endTime !== undefined) payload.end_time = updates.endTime;
      if (updates.durationMinutes !== undefined) payload.duration_minutes = updates.durationMinutes;

      if (Object.keys(payload).length > 0) {
        const normalizedId = normalizeId(id);
        const { error } = await supabase
          .from('workout_sessions')
          .update(payload)
          .eq('id', normalizedId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to update workout in Supabase:', error);
        }
      }
    }

    return updatedSession;
  } catch (error) {
    console.error('Failed to update workout details:', error);
    return null;
  }
}

// ============================================================
// EXERCISE HISTORY QUERIES
// ============================================================

export function getExerciseHistory(exerciseId: string): WorkoutSession[] {
  const history = getWorkoutHistory();
  return history
    .filter(session => session.sets.some(set => set.exerciseId === exerciseId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getLastWorkoutForExercise(exerciseId: string): {
  session: WorkoutSession;
  bestSet: WorkoutSession['sets'][0];
} | null {
  const exerciseHistory = getExerciseHistory(exerciseId);
  if (exerciseHistory.length === 0) return null;

  const lastSession = exerciseHistory[0];
  const exerciseSets = lastSession.sets.filter(s => s.exerciseId === exerciseId && s.completed);

  if (exerciseSets.length === 0) return null;

  // Find best set (highest E1RM, or highest weight × reps if no E1RM)
  const scoreInLbs = (set: WorkoutSession['sets'][0]) => {
    const fromUnit = set.weightUnit ?? 'lbs';
    const reps = set.actualReps ?? 0;
    const weightLbs = set.actualWeight != null ? convertWeight(set.actualWeight, fromUnit, 'lbs') : 0;
    const e1rmLbs = set.e1rm != null ? convertWeight(set.e1rm, fromUnit, 'lbs') : null;
    return e1rmLbs ?? (weightLbs * reps);
  };

  const bestSet = exerciseSets.reduce((best, current) => {
    return scoreInLbs(current) > scoreInLbs(best) ? current : best;
  });

  return { session: lastSession, bestSet };
}

// ============================================================
// PERFORMANCE ANALYTICS
// ============================================================

export function getPersonalRecords(exerciseId: string) {
  const history = getExerciseHistory(exerciseId);
  const allSets = history.flatMap(session =>
    session.sets.filter(s => s.exerciseId === exerciseId && s.completed)
  );

  if (allSets.length === 0) return null;

  const weightInLbs = (set: SetLog) =>
    set.actualWeight != null ? convertWeight(set.actualWeight, set.weightUnit ?? 'lbs', 'lbs') : 0;

  const e1rmInLbs = (set: SetLog) =>
    set.e1rm != null ? convertWeight(set.e1rm, set.weightUnit ?? 'lbs', 'lbs') : 0;

  const volumeInLbs = (set: SetLog) => {
    const reps = set.actualReps ?? 0;
    return weightInLbs(set) * reps;
  };

  // Max weight (for any rep count)
  const maxWeightSet = allSets.reduce((max, current) =>
    weightInLbs(current) > weightInLbs(max) ? current : max
  );

  // Max reps (for any weight)
  const maxRepsSet = allSets.reduce((max, current) =>
    (current.actualReps || 0) > (max.actualReps || 0) ? current : max
  );

  // Max E1RM
  const maxE1RMSet = allSets.reduce((max, current) =>
    e1rmInLbs(current) > e1rmInLbs(max) ? current : max
  );

  // Max volume (weight × reps)
  const maxVolumeSet = allSets.reduce((max, current) =>
    volumeInLbs(current) > volumeInLbs(max) ? current : max
  );

  return {
    maxWeight: {
      weight: weightInLbs(maxWeightSet),
      reps: maxWeightSet.actualReps || 0,
      date: maxWeightSet.timestamp || '',
    },
    maxReps: {
      weight: weightInLbs(maxRepsSet),
      reps: maxRepsSet.actualReps || 0,
      date: maxRepsSet.timestamp || '',
    },
    maxE1RM: {
      e1rm: e1rmInLbs(maxE1RMSet),
      weight: weightInLbs(maxE1RMSet),
      reps: maxE1RMSet.actualReps || 0,
      date: maxE1RMSet.timestamp || '',
    },
    maxVolume: {
      volume: volumeInLbs(maxVolumeSet),
      weight: weightInLbs(maxVolumeSet),
      reps: maxVolumeSet.actualReps || 0,
      date: maxVolumeSet.timestamp || '',
    },
  };
}

// ============================================================
// SMART WEIGHT SUGGESTIONS
// ============================================================

export interface WeightSuggestion {
  suggestedWeight: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'previous_performance' | 'rpe_adjustment' | 'volume_fatigue' | 'recovery_state' | 'default';
  fatigueAlert?: {
    severity: 'mild' | 'moderate' | 'high' | 'critical';
    affectedMuscles: string[];
    scientificBasis: string;
    detailedExplanation: string;
    recommendations?: Array<{
      type: 'reduce_weight' | 'reduce_reps' | 'increase_rest' | 'skip_exercise' | 'swap_exercise';
      description: string;
      newWeight?: number;
      newReps?: number | string;
      newRest?: number;
      confidence: 'high' | 'medium' | 'low';
    }>;
  };
  recoveryWarning?: {
    muscleGroup: string;
    readinessScore: number;        // 1-10
    recoveryPercentage: number;    // 0-100
    daysSinceLastTraining: number;
    suggestion: string;
  };
}

export async function suggestWeight(
  exerciseId: string,
  targetReps: number,
  targetRPE?: number | null,
  currentSessionSets?: WorkoutSession['sets']
): Promise<WeightSuggestion | null> {
  // Reduced logging to prevent console spam
  // logger.debug('\n💡 SUGGEST WEIGHT called for:', exerciseId);

  // PRIORITY 0: Check cross-session recovery state (chronic fatigue)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get muscle groups for this exercise
      const exercise = defaultExercises.find(ex => ex.id === exerciseId);
      const primaryMuscles = exercise?.muscleGroups.map(mg => mg.toLowerCase()) || [];

      if (primaryMuscles.length > 0) {
        // Check recovery state for primary muscle
        const recoveryProfiles = await getRecoveryProfiles(user.id, primaryMuscles);
        const primaryMuscleRecovery = recoveryProfiles[0]; // Worst recovery (sorted by readiness)

        // If muscle isn't recovered, suggest weight reduction
        if (primaryMuscleRecovery && primaryMuscleRecovery.readinessScore < 7) {
          const lastWorkout = getLastWorkoutForExercise(exerciseId);
          const referenceWeight = lastWorkout?.bestSet.actualWeight;

          if (referenceWeight) {
            // Scale reduction based on readiness (readiness 6 = 5%, readiness 3 = 15%)
            const reductionPercent = Math.min(0.20, (7 - primaryMuscleRecovery.readinessScore) * 0.025);
            const adjustedWeight = Math.round(referenceWeight * (1 - reductionPercent));

            return {
              suggestedWeight: adjustedWeight,
              reasoning: `${primaryMuscleRecovery.muscleGroup} is ${Math.round(primaryMuscleRecovery.recoveryPercentage)}% recovered (${primaryMuscleRecovery.daysSinceLastTraining}d ago). Reduced ${Math.round(reductionPercent * 100)}% for optimal performance.`,
              confidence: 'high',
              basedOn: 'recovery_state',
              recoveryWarning: {
                muscleGroup: primaryMuscleRecovery.muscleGroup,
                readinessScore: primaryMuscleRecovery.readinessScore,
                recoveryPercentage: primaryMuscleRecovery.recoveryPercentage,
                daysSinceLastTraining: primaryMuscleRecovery.daysSinceLastTraining,
                suggestion: reductionPercent > 0.10
                  ? `Consider switching to a different muscle group or taking a rest day`
                  : `Train conservatively and focus on technique`,
              },
            };
          }
        }
      }
    }
  } catch (err) {
    // Recovery check is non-critical - continue to other suggestions
    console.debug('Could not check recovery state:', err);
  }

  // PRIORITY 1: Check for acute session fatigue (works WITHOUT previous history)
  const completedSets = currentSessionSets?.filter(s => s.completed) || [];
  // logger.debug('   Completed sets in session:', completedSets.length);

  if (completedSets.length > 0) {
    // logger.debug('   🔬 Running fatigue analysis...');
    const fatigueAlert = shouldTriggerAutoReduction(completedSets, exerciseId);

    if (fatigueAlert.shouldAlert) {
      // Reduced logging - main alert already logged by fatigue model
      // logger.debug('   🚨 FATIGUE ALERT TRIGGERED:', fatigueAlert.severity);

      // Find reference weight to base reduction on
      // Option 1: Most recent weight used for THIS exercise in current session
      const recentSetsSameExercise = completedSets
        .filter(s => s.exerciseId === exerciseId && s.actualWeight && s.actualWeight > 0)
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      let referenceWeight: number | null = recentSetsSameExercise[0]?.actualWeight || null;
      // logger.debug('   🏋️ Reference weight from current session:', referenceWeight);

      // Option 2: If no current session data for this exercise, try history
      if (!referenceWeight) {
        const lastWorkout = getLastWorkoutForExercise(exerciseId);
        referenceWeight = lastWorkout?.bestSet.actualWeight || null;
        // logger.debug('   📚 Reference weight from history:', referenceWeight);
      }

      // Option 3: If still no weight, use any recent weight from session (for new exercises)
      if (!referenceWeight) {
        const anyRecentSet = completedSets
          .filter(s => s.actualWeight && s.actualWeight > 0)
          .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];

        if (anyRecentSet) {
          // Use 80% of recent weight as starting point for new exercise
          referenceWeight = Math.round(anyRecentSet.actualWeight! * 0.8);
          // logger.debug('   🎯 Estimated reference weight:', referenceWeight);
        }
      }

      if (referenceWeight) {
        const adjustedWeight = calculateAdjustedWeight(referenceWeight, fatigueAlert);
        const fatigueScores = calculateMuscleFatigue(completedSets, fatigueAlert.affectedMuscles);

        // Build detailed explanation - plain text, no markdown
        const topFatigue = fatigueScores[0];
        const topContributors = topFatigue?.contributingSets.slice(0, 3) || [];

        let detailedExplanation = fatigueAlert.reasoning;

        if (topContributors.length > 0) {
          const contributorList = topContributors
            .map(c => `${c.exerciseName} Set ${c.setIndex} (+${c.rpeOvershoot.toFixed(1)} RPE)`)
            .join(', ');
          detailedExplanation += ` Contributing sets: ${contributorList}.`;
        }

        const reductionPercent = Math.round(fatigueAlert.suggestedReduction * 100);
        detailedExplanation += ` Recommended: reduce by ${reductionPercent}% to ${adjustedWeight}lbs.`;

        // logger.debug('   ✅ Returning fatigue-based suggestion:', adjustedWeight, 'lbs');

        return {
          suggestedWeight: adjustedWeight,
          reasoning: fatigueAlert.reasoning,
          confidence: fatigueAlert.confidence >= 0.8 ? 'high' : fatigueAlert.confidence >= 0.6 ? 'medium' : 'low',
          basedOn: 'rpe_adjustment',
          fatigueAlert: {
            severity: fatigueAlert.severity,
            affectedMuscles: fatigueAlert.affectedMuscles,
            scientificBasis: fatigueAlert.scientificBasis,
            detailedExplanation,
            recommendations: fatigueAlert.recommendations,
          },
        };
      } else {
        // logger.debug('   ⚠️ Fatigue detected but no reference weight available');
      }
    } else {
      // logger.debug('   ✓ No fatigue alert triggered');
    }
  } else {
    // logger.debug('   ℹ️ No completed sets yet - cannot assess fatigue');
  }

  // PRIORITY 2: Try historical progression (only if no fatigue alert)
  // logger.debug('   📖 Checking previous workout history...');
  const lastWorkout = getLastWorkoutForExercise(exerciseId);

  if (!lastWorkout) {
    // logger.debug('   ❌ No previous workout history - returning null');
    return null; // No history and no fatigue alert
  }

  // logger.debug('   ✓ Found previous workout history');
  const { bestSet } = lastWorkout;
  const lastWeight = bestSet.actualWeight || 0;
  const lastReps = bestSet.actualReps || 0;
  const lastRPE = bestSet.actualRPE || null;

  // If same reps, suggest small progression
  if (targetReps === lastReps && lastRPE && targetRPE) {
    if (lastRPE < targetRPE - 1) {
      // Last time was too easy, increase weight
      const increase = Math.round(lastWeight * 0.025); // 2.5% increase
      return {
        suggestedWeight: lastWeight + increase,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. You can handle more.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    } else if (lastRPE > targetRPE + 1) {
      // Last time was too hard, decrease weight
      const decrease = Math.round(lastWeight * 0.025); // 2.5% decrease
      return {
        suggestedWeight: lastWeight - decrease,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. Reducing slightly.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    } else {
      // RPE was on target, use same weight
      return {
        suggestedWeight: lastWeight,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. Good match.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    }
  }

  // Different rep count - use E1RM to estimate
  if (bestSet.e1rm && targetReps !== lastReps) {
    const estimatedWeight = Math.round(bestSet.e1rm / (1 + targetReps / 30)); // Reverse Epley formula
    return {
      suggestedWeight: estimatedWeight,
      reasoning: `Based on your E1RM of ${bestSet.e1rm}lbs, estimated for ${targetReps} reps.`,
      confidence: 'medium',
      basedOn: 'previous_performance',
    };
  }

  // Fallback: use last weight
  return {
    suggestedWeight: lastWeight,
    reasoning: `Last time: ${lastWeight}lbs x${lastReps}`,
    confidence: 'low',
    basedOn: 'previous_performance',
  };
}

// ============================================================
// PROGRESSIVE OVERLOAD ANALYSIS
// ============================================================

export type ProgressionStatus = 'ready' | 'maintain' | 'deload';

export interface ProgressionRecommendation {
  status: ProgressionStatus;
  indicator: string; // '⬆️', '●', '⬇️'
  message: string;
  confidence: 'high' | 'medium' | 'low';
  suggestion: {
    action: 'increase' | 'maintain' | 'decrease';
    amount?: number; // lbs
    percentage?: number; // 0.025 = 2.5%
  };
}

/**
 * Analyzes recent performance to determine if user is ready for progressive overload
 * Based on:
 * - Consistent completion of prescribed reps at target RPE
 * - Avoiding excessive RPE overshoot
 * - Accumulated fatigue levels
 */
export function analyzeProgressionReadiness(
  exerciseId: string,
  targetReps: number,
  targetRPE: number | null | undefined
): ProgressionRecommendation {
  const history = getExerciseHistory(exerciseId);

  // No history = maintain current weight
  if (history.length === 0) {
    return {
      status: 'maintain',
      indicator: '●',
      message: 'No previous data - establish baseline',
      confidence: 'high',
      suggestion: {
        action: 'maintain',
      },
    };
  }

  // Analyze last 2-3 sessions for this exercise
  const recentSessions = history.slice(0, 3);
  const allRecentSets = recentSessions.flatMap(session =>
    session.sets.filter(s => s.exerciseId === exerciseId && s.completed)
  );

  if (allRecentSets.length === 0) {
    return {
      status: 'maintain',
      indicator: '●',
      message: 'No recent completed sets',
      confidence: 'high',
      suggestion: {
        action: 'maintain',
      },
    };
  }

  // Count how many sessions achieved target reps + RPE
  let sessionsAtTarget = 0;
  let sessionsOvershot = 0;

  for (const session of recentSessions) {
    const sessionSets = session.sets.filter(s => s.exerciseId === exerciseId && s.completed);
    if (sessionSets.length === 0) continue;

    // Check if ALL sets in this session hit target
    const allSetsHitReps = sessionSets.every(s => (s.actualReps || 0) >= targetReps);
    const avgRPE = sessionSets.reduce((sum, s) => sum + (s.actualRPE || 0), 0) / sessionSets.length;

    if (allSetsHitReps && targetRPE) {
      if (Math.abs(avgRPE - targetRPE) <= 0.5) {
        sessionsAtTarget++;
      } else if (avgRPE > targetRPE + 1) {
        sessionsOvershot++;
      }
    }
  }

  // READY TO PROGRESS: 2+ sessions at target
  if (sessionsAtTarget >= 2) {
    return {
      status: 'ready',
      indicator: '⬆️',
      message: `${sessionsAtTarget} sessions at target - ready to increase!`,
      confidence: 'high',
      suggestion: {
        action: 'increase',
        amount: 5, // Standard 5lb increase
        percentage: 0.025, // 2.5%
      },
    };
  }

  // DELOAD: 2+ sessions with high RPE overshoot
  if (sessionsOvershot >= 2) {
    return {
      status: 'deload',
      indicator: '⬇️',
      message: `${sessionsOvershot} sessions with RPE overshoot - suggest deload`,
      confidence: 'high',
      suggestion: {
        action: 'decrease',
        percentage: 0.1, // 10% reduction
      },
    };
  }

  // Check for recent fatigue issues
  const lastSession = recentSessions[0];
  const lastSessionSets = lastSession.sets.filter(s => s.completed);
  if (lastSessionSets.length > 0) {
    const fatigueAlert = shouldTriggerAutoReduction(lastSessionSets, exerciseId);
    if (fatigueAlert.shouldAlert && fatigueAlert.severity === 'critical') {
      return {
        status: 'deload',
        indicator: '⬇️',
        message: 'Severe fatigue detected - reduce load',
        confidence: 'high',
        suggestion: {
          action: 'decrease',
          percentage: fatigueAlert.suggestedReduction,
        },
      };
    }
  }

  // DEFAULT: Maintain current weight
  return {
    status: 'maintain',
    indicator: '●',
    message: 'Keep working at current weight',
    confidence: 'medium',
    suggestion: {
      action: 'maintain',
    },
  };
}

// ============================================================
// CYCLE MANAGEMENT
// ============================================================

export function getCurrentCycle(programId: string): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_CYCLE);
    const cycles: Record<string, number> = data ? JSON.parse(data) : {};
    return cycles[programId] || 1;
  } catch (error) {
    console.error('Failed to get current cycle:', error);
    return 1;
  }
}

export function incrementCycle(programId: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_CYCLE);
    const cycles: Record<string, number> = data ? JSON.parse(data) : {};
    cycles[programId] = (cycles[programId] || 1) + 1;
    localStorage.setItem(STORAGE_KEYS.CURRENT_CYCLE, JSON.stringify(cycles));
  } catch (error) {
    console.error('Failed to increment cycle:', error);
  }
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export const storage = {
  // Active session management (anti-data loss)
  saveActiveSession,
  getActiveSession,
  clearActiveSession,

  // Workout history
  saveWorkout,
  getWorkoutHistory,
  setWorkoutHistory,
  getWorkoutById,
  updateWorkoutDetails,
  deleteWorkout,
  deleteWorkoutSession: deleteWorkout, // Alias for clarity

  // Exercise history & analytics
  getExerciseHistory,
  getLastWorkoutForExercise,
  getPersonalRecords,
  suggestWeight,
  analyzeProgressionReadiness,

  // Cycle management
  getCurrentCycle,
  incrementCycle,

  // NEW: Priority Alert System
  getPriorityAlert,
};

// ============================================================
// NEW: PRIORITY-BASED ALERT SYSTEM
// ============================================================

export type AlertType = 'true_fatigue' | 'low_readiness' | 'rpe_calibration' | 'none';
export type AlertPriority = 1 | 2 | 3 | 4; // Lower number = higher priority

export interface PriorityAlert {
  type: AlertType;
  priority: AlertPriority;
  severity: 'none' | 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actions: Array<{
    label: string;
    type: 'primary' | 'secondary';
    action: 'reduce_weight' | 'reduce_reps' | 'increase_rest' | 'skip_exercise' | 'apply_weight' | 'dismiss';
    value?: number; // For weight adjustments
  }>;
  scientificBasis: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Get single highest-priority alert for current workout state
 * Only ONE alert is shown at a time, based on priority
 *
 * UPGRADED WITH STATISTICAL RIGOR:
 * - Uses VBT (velocity-based training) for fatigue detection
 * - Bayesian RPE calibration with proper uncertainty quantification
 * - Confidence scores on all recommendations
 * - Research-validated thresholds (González-Badillo, Pareja-Blanco, Helms et al.)
 */
export async function getPriorityAlert(
  exerciseId: string,
  currentSessionSets: WorkoutSession['sets'],
  lastWeight?: number | null,
  displayWeightUnit: 'lbs' | 'kg' = 'lbs'
): Promise<PriorityAlert> {
  // Import upgraded detection functions with statistical rigor
  const { detectTrueFatigue, detectTrueFatigueEnhanced, analyzeRPECalibration } = await import('./fatigueModel');
  const { getRecoveryProfile } = await import('./fatigue/cross-session');

  const completedSets = currentSessionSets?.filter(s => s.completed) || [];

  // ============================================
  // PRIORITY 1: TRUE FATIGUE (CRITICAL - RED)
  // ============================================

  // Try to use enhanced hierarchical detection if we have historical data
  // Now uses intelligent caching for 5-7x speedup
  let trueFatigue;

  try {
    // Dynamically import caching functions and Supabase client
    const { getOrBuildHierarchicalModel } = await import('./supabase/model-cache');
    const { supabase } = await import('./supabase/client');

    const { data: { user } } = await supabase.auth.getUser();

    // Get historical workouts for hierarchical model
    const workoutHistory = getWorkoutHistory();

    // Filter to completed workouts and structure for hierarchical model
    const historicalWorkouts = workoutHistory
      .filter(w => w.endTime) // Filter to completed sessions
      .slice(-20) // Last 20 workouts
      .map(w => ({
        date: new Date(w.endTime!),
        exercises: w.sets.reduce((acc, set) => {
          const existing = acc.find(e => e.exerciseId === set.exerciseId);
          if (existing) {
            existing.sets.push(set);
          } else {
            acc.push({ exerciseId: set.exerciseId, sets: [set] });
          }
          return acc;
        }, [] as Array<{ exerciseId: string; sets: SetLog[] }>)
      }));

    // Use enhanced detection with hierarchical models if enough data
    if (historicalWorkouts.length >= 3 && user) {
      // Load hierarchical model from cache (2-3ms) or build fresh (15-20ms)
      // This caching gives us 5-7x speedup on subsequent calls
      await getOrBuildHierarchicalModel(user.id, historicalWorkouts);

      trueFatigue = detectTrueFatigueEnhanced(completedSets, exerciseId, {
        userId: user.id,
        historicalWorkouts
      });
    } else {
      // Fall back to standard VBT detection
      trueFatigue = detectTrueFatigue(completedSets, exerciseId);
    }
  } catch (err) {
    console.warn('Enhanced detection unavailable, using standard:', err);
    trueFatigue = detectTrueFatigue(completedSets, exerciseId);
  }

  if (trueFatigue.hasFatigue && (trueFatigue.severity === 'critical' || trueFatigue.severity === 'high')) {
    const actions: PriorityAlert['actions'] = [];

    // Primary action: Reduce reps or increase rest
    if (trueFatigue.severity === 'critical') {
      actions.push({
        label: 'Add 90s rest',
        type: 'primary',
        action: 'increase_rest',
        value: 90,
      });
      actions.push({
        label: 'Reduce reps by 3',
        type: 'secondary',
        action: 'reduce_reps',
        value: 3,
      });
      actions.push({
        label: 'Skip exercise',
        type: 'secondary',
        action: 'skip_exercise',
      });
    } else {
      // High fatigue
      actions.push({
        label: 'Reduce reps by 2',
        type: 'primary',
        action: 'reduce_reps',
        value: 2,
      });
      actions.push({
        label: 'Add 60s rest',
        type: 'secondary',
        action: 'increase_rest',
        value: 60,
      });
    }

    actions.push({
      label: 'Dismiss',
      type: 'secondary',
      action: 'dismiss',
    });

    return {
      type: 'true_fatigue',
      priority: 1,
      severity: 'critical',
      title: trueFatigue.severity === 'critical' ? 'Critical Fatigue' : 'High Fatigue',
      message: trueFatigue.reasoning,
      actions,
      scientificBasis: trueFatigue.scientificBasis,
      confidence: trueFatigue.confidence,
      metadata: {
        indicators: trueFatigue.indicators,
        affectedMuscles: trueFatigue.affectedMuscles,
        velocityLoss: trueFatigue.indicators.velocityLoss,
        // vbtAnalysis: trueFatigue.vbtAnalysis, // Commented out - VBT module deleted
        // Hierarchical model insights (if available)
        usingHierarchicalModel: 'usingHierarchicalModel' in trueFatigue ? trueFatigue.usingHierarchicalModel : false,
        personalizedAssessment: 'personalizedAssessment' in trueFatigue ? trueFatigue.personalizedAssessment : undefined,
        // Statistical power analysis (if available)
        powerAnalysis: 'powerAnalysis' in trueFatigue ? trueFatigue.powerAnalysis : undefined,
        // Data quality indicators (if available)
        dataQuality: 'dataQuality' in trueFatigue ? trueFatigue.dataQuality : undefined,
      },
    };
  }

  // ============================================
  // PRIORITY 2: LOW READINESS (WARNING - AMBER)
  // ============================================
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const exercise = defaultExercises.find(ex => ex.id === exerciseId);
      const primaryMuscle = exercise?.muscleGroups[0]?.toLowerCase();

      if (primaryMuscle) {
        const recoveryProfile = await getRecoveryProfile(user.id, primaryMuscle);

        if (recoveryProfile && recoveryProfile.readinessScore < 5) {
          const suggestedReduction = Math.round((7 - recoveryProfile.readinessScore) * 5);

          return {
            type: 'low_readiness',
            priority: 2,
            severity: 'warning',
            title: 'Low Muscle Readiness',
            message: `${recoveryProfile.muscleGroup} is only ${recoveryProfile.readinessScore.toFixed(1)}/10 ready (${Math.round(recoveryProfile.recoveryPercentage)}% recovered). Consider training lighter or choosing a different exercise.`,
            actions: lastWeight
              ? [
                  {
                    label: `Reduce weight by ${suggestedReduction}%`,
                    type: 'primary',
                    action: 'reduce_weight',
                    value: Math.round(lastWeight * (1 - suggestedReduction / 100)),
                  },
                  {
                    label: 'Continue anyway',
                    type: 'secondary',
                    action: 'dismiss',
                  },
                ]
              : [
                  {
                    label: 'Got it',
                    type: 'primary',
                    action: 'dismiss',
                  },
                ],
            scientificBasis: 'Schoenfeld & Grgic (2018): Insufficient recovery increases injury risk and reduces training quality.',
            confidence: 0.8,
            metadata: {
              readinessScore: recoveryProfile.readinessScore,
              recoveryPercentage: recoveryProfile.recoveryPercentage,
              muscleGroup: recoveryProfile.muscleGroup,
            },
          };
        }
      }
    }
  } catch (err) {
    console.warn('Could not check readiness:', err);
  }

  // ============================================
  // PRIORITY 3: RPE CALIBRATION (INFO - BLUE)
  // ============================================
  const rpeCalibration = analyzeRPECalibration(completedSets, exerciseId);

  if (rpeCalibration.needsAdjustment && lastWeight) {
    const newWeight =
      rpeCalibration.direction === 'increase'
        ? Math.round(lastWeight * (1 + rpeCalibration.suggestedChange))
        : Math.round(lastWeight * (1 - rpeCalibration.suggestedChange));

    return {
      type: 'rpe_calibration',
      priority: 3,
      severity: 'info',
      title: rpeCalibration.direction === 'increase' ? 'Weight Too Light' : 'Weight Too Heavy',
      message: rpeCalibration.reasoning,
      actions: [
        {
          label: `${rpeCalibration.direction === 'increase' ? 'Increase' : 'Reduce'} to ${newWeight} ${displayWeightUnit}`,
          type: 'primary',
          action: 'apply_weight',
          value: newWeight,
        },
        {
          label: 'Keep current weight',
          type: 'secondary',
          action: 'dismiss',
        },
      ],
      scientificBasis: rpeCalibration.bayesianAnalysis
        ? rpeCalibration.bayesianAnalysis.scientificBasis
        : 'Helms et al. (2018): RPE-based auto-regulation improves training accuracy and prevents under/overtraining.',
      confidence: rpeCalibration.confidence,
      metadata: {
        direction: rpeCalibration.direction,
        avgDeviation: rpeCalibration.avgDeviation,
        posteriorBias: rpeCalibration.posteriorBias, // Bayesian-updated belief
        credibleInterval: rpeCalibration.credibleInterval, // 95% credible interval
        suggestedChange: rpeCalibration.suggestedChange,
        bayesianAnalysis: rpeCalibration.bayesianAnalysis, // Full Bayesian data
      },
    };
  }

  // ============================================
  // NO ALERT NEEDED
  // ============================================
  return {
    type: 'none',
    priority: 4,
    severity: 'none',
    title: '',
    message: '',
    actions: [],
    scientificBasis: '',
    confidence: 0,
  };
}

/**
 * Save workout data to NEW recovery system (fatigue_events table)
 * This bridges the old and new recovery systems
 */
async function saveFatigueEventsToNewSystem(
  userId: string,
  sessionId: string,
  completedSets: SetLog[]
): Promise<void> {
  if (completedSets.length === 0) {
    return;
  }

  // Group sets by exercise to create fatigue events
  const exerciseMap = new Map<string, SetLog[]>();
  for (const set of completedSets) {
    if (!exerciseMap.has(set.exerciseId)) {
      exerciseMap.set(set.exerciseId, []);
    }
    exerciseMap.get(set.exerciseId)!.push(set);
  }

  // Create fatigue events for each exercise
  const fatigueEvents = [];
  for (const [exerciseId, sets] of exerciseMap.entries()) {
    // Get exercise name
    const exercise = defaultExercises.find(e => e.id === exerciseId);
    const exerciseName = exercise?.name || exerciseId;

    // Calculate aggregates for this exercise
    const totalSets = sets.length;
    const totalReps = sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
    const avgWeight = sets.reduce((sum, s) => sum + (s.actualWeight || 0), 0) / totalSets;
    const avgRpe = sets.reduce((sum, s) => sum + (s.actualRPE || 0), 0) / totalSets;
    const totalVolume = sets.reduce((sum, s) => (s.actualWeight || 0) * (s.actualReps || 0) + sum, 0);

    // Calculate effective volume (RPE-weighted)
    const effectiveVolume = sets.reduce((sum, s) => {
      const rpe = s.actualRPE || 7;
      const rpeMultiplier = rpe >= 9 ? 1.0 : rpe >= 7 ? 0.7 : 0.4;
      return sum + (s.actualWeight || 0) * (s.actualReps || 0) * rpeMultiplier;
    }, 0);

    // Estimate initial fatigue from RPE
    const initialFatigue = avgRpe >= 9 ? 80 : avgRpe >= 7 ? 50 : 30;

    // Create event (matches fatigue_events table schema)
    fatigueEvents.push({
      user_id: userId,
      timestamp: new Date().toISOString(),
      exercise_name: exerciseName,
      sets: totalSets,
      reps: Math.round(totalReps / totalSets), // avg reps per set
      weight: Math.round(avgWeight),
      rpe: Math.round(avgRpe * 10) / 10, // round to 1 decimal
      volume: Math.round(totalVolume),
      effective_volume: Math.round(effectiveVolume),
      initial_fatigue: Math.round(initialFatigue),
      set_duration: sets[0]?.setDurationSeconds || null,
      rest_interval: sets[0]?.restTakenSeconds || null,
      is_eccentric: false,  // TODO: detect from exercise type
      is_ballistic: false   // TODO: detect from exercise type
    });
  }

  // Bulk insert all events
  if (fatigueEvents.length > 0) {
    const { error } = await supabase
      .from('fatigue_events')
      .insert(fatigueEvents);

    if (error) {
      console.error('Failed to save fatigue events:', error);
      throw error;
    }
  }
}
