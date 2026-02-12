import { supabase } from '../supabase/client';
import type { CustomExercise } from '../types';

const LOCAL_STORAGE_KEY = 'iron_brain_custom_exercises';
const CLOUD_REQUEST_TIMEOUT_MS = 8000;

const EQUIPMENT_VALUES: CustomExercise['equipment'][] = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
];

const EXERCISE_TYPE_VALUES: CustomExercise['exerciseType'][] = ['compound', 'isolation'];

const MOVEMENT_PATTERN_VALUES: NonNullable<CustomExercise['movementPattern']>[] = [
  'push',
  'pull',
  'squat',
  'hinge',
  'carry',
  'rotation',
  'other',
];

function normalizeEquipment(value: string): CustomExercise['equipment'] {
  return EQUIPMENT_VALUES.includes(value as CustomExercise['equipment']) ? (value as CustomExercise['equipment']) : 'other';
}

function normalizeExerciseType(value: string): CustomExercise['exerciseType'] {
  return EXERCISE_TYPE_VALUES.includes(value as CustomExercise['exerciseType'])
    ? (value as CustomExercise['exerciseType'])
    : 'compound';
}

function normalizeMovementPattern(value: string | null): CustomExercise['movementPattern'] {
  if (!value) return undefined;
  return MOVEMENT_PATTERN_VALUES.includes(value as NonNullable<CustomExercise['movementPattern']>)
    ? (value as NonNullable<CustomExercise['movementPattern']>)
    : 'other';
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const operationPromise = Promise.resolve(promise);
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([operationPromise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function readLocalCustomExercises(): CustomExercise[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as CustomExercise[]) : [];
  } catch {
    return [];
  }
}

function persistLocalCustomExercises(exercises: CustomExercise[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exercises));
}

function mergeCustomExercises(
  cloudExercises: CustomExercise[],
  localExercises: CustomExercise[]
): CustomExercise[] {
  const byId = new Map<string, CustomExercise>();
  localExercises.forEach((exercise) => byId.set(exercise.id, exercise));
  cloudExercises.forEach((exercise) => byId.set(exercise.id, exercise));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all custom exercises for user
 * Loads from Supabase if logged in and merges with localStorage backup
 */
export async function getCustomExercises(userId: string | null): Promise<CustomExercise[]> {
  const localExercises = readLocalCustomExercises();

  // Try Supabase first if logged in
  if (userId) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('custom_exercises')
          .select('*')
          .eq('user_id', userId)
          .order('name'),
        CLOUD_REQUEST_TIMEOUT_MS,
        'Timed out loading custom exercises from cloud'
      );

      if (!error && data) {
        // Transform from snake_case database to camelCase TypeScript
        const rows = data ?? [];
        const cloudExercises = rows.map((d) => ({
          id: d.id,
          userId: d.user_id,
          name: d.name,
          slug: d.slug,
          equipment: normalizeEquipment(d.equipment),
          exerciseType: normalizeExerciseType(d.exercise_type),
          primaryMuscles: d.primary_muscles || [],
          secondaryMuscles: d.secondary_muscles || [],
          movementPattern: normalizeMovementPattern(d.movement_pattern),
          trackWeight: d.track_weight ?? true,
          trackReps: d.track_reps ?? true,
          trackTime: d.track_time ?? false,
          defaultRestSeconds: d.default_rest_seconds || 90,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        const merged = mergeCustomExercises(cloudExercises, localExercises);
        persistLocalCustomExercises(merged);
        return merged;
      }
    } catch (err) {
      console.error('Failed to load custom exercises from Supabase:', err);
    }
  }

  return localExercises;
}

/**
 * Create custom exercise
 * Saves locally first, then syncs to Supabase in the background if logged in
 */
export async function createCustomExercise(
  userId: string | null,
  exercise: Omit<CustomExercise, 'id' | 'userId' | 'slug' | 'createdAt' | 'updatedAt'>
): Promise<CustomExercise> {
  const now = new Date().toISOString();
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const slug = exercise.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const newExercise: CustomExercise = {
    ...exercise,
    id,
    userId: userId || 'local',
    slug,
    createdAt: now,
    updatedAt: now,
  };

  // Save locally first so the UI never blocks on network/cloud.
  try {
    const existing = readLocalCustomExercises();
    const merged = mergeCustomExercises([newExercise], existing);
    persistLocalCustomExercises(merged);
  } catch (err) {
    console.error('Failed to save custom exercise to localStorage:', err);
  }

  // Sync to Supabase in the background.
  if (userId) {
    void (async () => {
      try {
        const { error } = await withTimeout(
          supabase
            .from('custom_exercises')
            .insert({
              id,
              user_id: userId,
              name: exercise.name,
              slug,
              equipment: exercise.equipment,
              exercise_type: exercise.exerciseType,
              primary_muscles: exercise.primaryMuscles,
              secondary_muscles: exercise.secondaryMuscles,
              movement_pattern: exercise.movementPattern,
              track_weight: exercise.trackWeight,
              track_reps: exercise.trackReps,
              track_time: exercise.trackTime,
              default_rest_seconds: exercise.defaultRestSeconds,
            }),
          CLOUD_REQUEST_TIMEOUT_MS,
          'Timed out saving custom exercise to cloud'
        );
        if (error) {
          throw error;
        }
      } catch (err) {
        console.error('Failed to save custom exercise to Supabase:', err);
      }
    })();
  }

  return newExercise;
}
