import { supabase } from '../supabase/client';
import type { CustomExercise } from '../types';

const LOCAL_STORAGE_KEY = 'iron_brain_custom_exercises';

/**
 * Get all custom exercises for user
 * Loads from Supabase if logged in, falls back to localStorage
 */
export async function getCustomExercises(userId: string | null): Promise<CustomExercise[]> {
  // Try Supabase first if logged in
  if (userId) {
    try {
      const { data, error } = await (supabase as any)
        .from('custom_exercises')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (!error && data) {
        // Transform from snake_case database to camelCase TypeScript
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          name: d.name,
          slug: d.slug,
          equipment: d.equipment,
          exerciseType: d.exercise_type,
          primaryMuscles: d.primary_muscles || [],
          secondaryMuscles: d.secondary_muscles || [],
          movementPattern: d.movement_pattern,
          trackWeight: d.track_weight ?? true,
          trackReps: d.track_reps ?? true,
          trackTime: d.track_time ?? false,
          defaultRestSeconds: d.default_rest_seconds || 90,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err) {
      console.error('Failed to load custom exercises from Supabase:', err);
    }
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Create custom exercise
 * Saves to Supabase if logged in, always saves to localStorage as backup
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

  // Save to Supabase if logged in
  if (userId) {
    try {
      const { error } = await (supabase as any)
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
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to save custom exercise to Supabase:', err);
    }
  }

  // Also save to localStorage as backup
  try {
    const existing = await getCustomExercises(userId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...existing, newExercise]));
  } catch (err) {
    console.error('Failed to save custom exercise to localStorage:', err);
  }

  return newExercise;
}

/**
 * Update custom exercise
 */
export async function updateCustomExercise(
  userId: string | null,
  exerciseId: string,
  updates: Partial<Omit<CustomExercise, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  if (userId) {
    try {
      const updateData: any = {
        updated_at: now,
      };

      if (updates.name) {
        updateData.name = updates.name;
        updateData.slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (updates.equipment) updateData.equipment = updates.equipment;
      if (updates.exerciseType) updateData.exercise_type = updates.exerciseType;
      if (updates.primaryMuscles) updateData.primary_muscles = updates.primaryMuscles;
      if (updates.secondaryMuscles) updateData.secondary_muscles = updates.secondaryMuscles;
      if (updates.movementPattern) updateData.movement_pattern = updates.movementPattern;
      if (updates.trackWeight !== undefined) updateData.track_weight = updates.trackWeight;
      if (updates.trackReps !== undefined) updateData.track_reps = updates.trackReps;
      if (updates.trackTime !== undefined) updateData.track_time = updates.trackTime;
      if (updates.defaultRestSeconds) updateData.default_rest_seconds = updates.defaultRestSeconds;

      await (supabase as any)
        .from('custom_exercises')
        .update(updateData)
        .eq('id', exerciseId);
    } catch (err) {
      console.error('Failed to update in Supabase:', err);
    }
  }

  try {
    const existing = await getCustomExercises(userId);
    const updated = existing.map(e =>
      e.id === exerciseId
        ? { ...e, ...updates, updatedAt: now }
        : e
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update in localStorage:', err);
  }
}

/**
 * Delete custom exercise
 */
export async function deleteCustomExercise(userId: string | null, exerciseId: string): Promise<void> {
  if (userId) {
    try {
      await (supabase as any).from('custom_exercises').delete().eq('id', exerciseId);
    } catch (err) {
      console.error('Failed to delete from Supabase:', err);
    }
  }

  try {
    const existing = await getCustomExercises(userId);
    const filtered = existing.filter(e => e.id !== exerciseId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete from localStorage:', err);
  }
}
