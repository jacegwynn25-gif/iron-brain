/**
 * Program template sync utilities for hybrid architecture
 * Maps app program IDs to database UUIDs for program_set_id population
 */

import { supabase } from './client';

// In-memory cache for program template UUIDs
// Key format: "app_program_id" → UUID
let programTemplateCache: Map<string, string> | null = null;

/**
 * Load all program templates from database and cache their UUIDs
 */
async function loadProgramTemplateCache(): Promise<void> {
  const { data: templates, error } = await supabase
    .from('program_templates')
    .select('id, app_program_id')
    .eq('is_system', true);

  if (error) {
    console.warn('Could not load program templates:', error.message);
    programTemplateCache = new Map();
    return;
  }

  programTemplateCache = new Map();
  (templates as any[])?.forEach((template: any) => {
    if (template.app_program_id) {
      programTemplateCache!.set(template.app_program_id, template.id);
    }
  });

  console.log(`✅ Loaded ${programTemplateCache.size} program templates into cache`);
}

/**
 * Get program template UUID by app program ID
 * Uses cached mapping for fast lookups
 */
export async function getProgramTemplateId(appProgramId: string): Promise<string | null> {
  // Lazy load cache on first use
  if (!programTemplateCache) {
    await loadProgramTemplateCache();
  }

  return programTemplateCache?.get(appProgramId) || null;
}

/**
 * Get program_set_id for a specific set in a program
 *
 * NOTE: This is a simplified version for the hybrid architecture.
 * Since we're not seeding program_weeks/program_days/program_sets tables,
 * this will always return null. The program_set_id column exists in the
 * database schema for future extensibility but is optional.
 *
 * When we eventually seed full program structures into the database,
 * this function can be enhanced to look up the actual program_set UUID.
 */
export async function getProgramSetId(
  programId: string,
  weekNumber: number,
  dayIndex: number,
  setIndex: number,
  exerciseId: string
): Promise<string | null> {
  // For now, return null since we're using the hybrid approach
  // (programs as JS objects, only templates table is seeded)
  return null;

  // Future implementation (when program_sets table is fully seeded):
  /*
  const { data, error } = await supabase
    .from('program_sets')
    .select('id')
    .eq('day_id', dayId)
    .eq('exercise_id', exerciseUuid)
    .eq('set_index', setIndex)
    .single();

  return data?.id || null;
  */
}

/**
 * Clear the cache (useful for testing or when programs are updated)
 */
export function clearProgramCache(): void {
  programTemplateCache = null;
}
