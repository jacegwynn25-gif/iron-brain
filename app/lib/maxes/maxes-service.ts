import { supabase } from '../supabase/client';
import type { UserMax } from '../types';
import type { Database } from '../supabase/database.types';

const LOCAL_STORAGE_KEY = 'iron_brain_user_maxes';

type SupabaseUserMaxUpdate = Database['public']['Tables']['user_maxes']['Update'];

/**
 * Get all 1RM records for user
 * Loads from Supabase if logged in, falls back to localStorage
 */
export async function getUserMaxes(userId: string | null): Promise<UserMax[]> {
  // Try Supabase first if logged in
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_maxes')
        .select('*')
        .eq('user_id', userId)
        .order('exercise_name');

      if (!error && data) {
        const rows = data ?? [];
        return rows.map((d) => ({
          id: d.id,
          userId: d.user_id,
          exerciseId: d.exercise_id,
          exerciseName: d.exercise_name,
          weight: d.weight,
          unit: d.unit === 'kg' ? 'kg' : 'lbs',
          testedAt: d.tested_at,
          estimatedOrTested: d.estimated_or_tested === 'estimated' ? 'estimated' : 'tested',
          notes: d.notes ?? undefined,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err) {
      console.error('Failed to load maxes from Supabase:', err);
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
 * Get specific 1RM for exercise
 */
async function getUserMax(userId: string | null, exerciseId: string): Promise<UserMax | null> {
  const allMaxes = await getUserMaxes(userId);
  return allMaxes.find(m => m.exerciseId === exerciseId) || null;
}

/**
 * Create or update 1RM record
 */
export async function saveUserMax(
  userId: string | null,
  max: Omit<UserMax, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<UserMax> {
  const now = new Date().toISOString();
  const id = `max_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const newMax: UserMax = {
    ...max,
    id,
    userId: userId || 'local',
    createdAt: now,
    updatedAt: now,
  };

  // Check if max already exists for this exercise
  const existing = await getUserMax(userId, max.exerciseId);

  if (existing) {
    // Update existing
    await updateUserMax(userId, existing.id, max);
    return { ...existing, ...max, updatedAt: now };
  }

  // Create new
  if (userId) {
    try {
      const { error } = await supabase
        .from('user_maxes')
        .insert({
          id,
          user_id: userId,
          exercise_id: max.exerciseId,
          exercise_name: max.exerciseName,
          weight: max.weight,
          unit: max.unit,
          tested_at: max.testedAt,
          estimated_or_tested: max.estimatedOrTested,
          notes: max.notes,
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to save max to Supabase:', err);
    }
  }

  // Save to localStorage as backup
  try {
    const allMaxes = await getUserMaxes(userId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...allMaxes, newMax]));
  } catch (err) {
    console.error('Failed to save max to localStorage:', err);
  }

  return newMax;
}

/**
 * Update existing 1RM record
 */
async function updateUserMax(
  userId: string | null,
  maxId: string,
  updates: Partial<Omit<UserMax, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  if (userId) {
    try {
      const updateData: SupabaseUserMaxUpdate = { updated_at: now };

      if (updates.exerciseId) updateData.exercise_id = updates.exerciseId;
      if (updates.exerciseName) updateData.exercise_name = updates.exerciseName;
      if (updates.weight !== undefined) updateData.weight = updates.weight;
      if (updates.unit) updateData.unit = updates.unit;
      if (updates.testedAt !== undefined) updateData.tested_at = updates.testedAt;
      if (updates.estimatedOrTested) updateData.estimated_or_tested = updates.estimatedOrTested;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await supabase
        .from('user_maxes')
        .update(updateData)
        .eq('id', maxId);
    } catch (err) {
      console.error('Failed to update max in Supabase:', err);
    }
  }

  try {
    const allMaxes = await getUserMaxes(userId);
    const updated = allMaxes.map(m =>
      m.id === maxId
        ? { ...m, ...updates, updatedAt: now }
        : m
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update max in localStorage:', err);
  }
}

/**
 * Delete 1RM record
 */
export async function deleteUserMax(userId: string | null, maxId: string): Promise<void> {
  if (userId) {
    try {
      await supabase.from('user_maxes').delete().eq('id', maxId);
    } catch (err) {
      console.error('Failed to delete max from Supabase:', err);
    }
  }

  try {
    const allMaxes = await getUserMaxes(userId);
    const filtered = allMaxes.filter(m => m.id !== maxId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete max from localStorage:', err);
  }
}

/**
 * Check if max is stale (older than 3 months)
 */
export function isMaxStale(max: UserMax): boolean {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return new Date(max.testedAt) < threeMonthsAgo;
}
