'use client';

import { supabase } from './client';
import { logger } from '../logger';
import type { ProgramTemplate } from '../types';
import { queueOperation, isOnline } from '../sync/offline-queue';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Json } from './database.types';
import { normalizeProgramMetadata, normalizePrograms } from '../programs/normalize';

const PROGRAM_SYNC_TIMEOUT_MS = 8000;

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

/**
 * Program Cloud Sync
 *
 * Automatically syncs custom programs to Supabase for cross-device access
 * - Auto-saves while building programs
 * - Loads programs from cloud on login
 * - Merges local and cloud (cloud wins for conflicts)
 */

/**
 * Save a program to Supabase
 */
export async function saveProgramToCloud(program: ProgramTemplate, userId: string): Promise<boolean> {
  try {
    if (!isOnline()) {
      queueOperation('update', 'custom_programs', { program });
      logger.debug('📥 Offline - queued program for sync');
      return true;
    }

    const { program: normalizedProgram } = normalizeProgramMetadata(program);
    const programData: Json = JSON.parse(JSON.stringify(normalizedProgram));

    const { error } = await withTimeout(
      supabase
        .from('custom_programs')
        .upsert({
          id: normalizedProgram.id,
          user_id: userId,
          program_data: programData,
          name: normalizedProgram.name,
          is_custom: normalizedProgram.isCustom ?? true,
          updated_at: new Date().toISOString(),
        }),
      PROGRAM_SYNC_TIMEOUT_MS,
      'Timed out saving program to cloud'
    );

    if (error) {
      const errorPayload: Pick<PostgrestError, 'message' | 'details' | 'hint' | 'code'> = {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      };
      console.error('Failed to save program to cloud:', errorPayload);
      logger.debug('Program sync error:', errorPayload);
      queueOperation('update', 'custom_programs', { program });
      return false;
    }

    logger.debug(`✅ Synced program "${normalizedProgram.name}" to cloud`);
    return true;
  } catch (err) {
    console.error('Error syncing program:', err);
    queueOperation('update', 'custom_programs', { program });
    return false;
  }
}

/**
 * Load all programs from Supabase
 */
function parseWeeks(value: Json): ProgramTemplate['weeks'] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as ProgramTemplate['weeks'];
}

function parseProgramTemplate(value: Json): ProgramTemplate | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Json>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') {
    return null;
  }

  const weeks = parseWeeks(record.weeks);
  if (!weeks) {
    return null;
  }

  return {
    id: record.id,
    schemaVersion: typeof record.schemaVersion === 'number'
      ? (record.schemaVersion as ProgramTemplate['schemaVersion'])
      : undefined,
    name: record.name,
    description: typeof record.description === 'string' ? record.description : undefined,
    author: typeof record.author === 'string' ? record.author : undefined,
    goal: typeof record.goal === 'string' ? (record.goal as ProgramTemplate['goal']) : undefined,
    experienceLevel: typeof record.experienceLevel === 'string'
      ? (record.experienceLevel as ProgramTemplate['experienceLevel'])
      : undefined,
    daysPerWeek: typeof record.daysPerWeek === 'number' ? record.daysPerWeek : undefined,
    weekCount: typeof record.weekCount === 'number' ? record.weekCount : undefined,
    intensityMethod: typeof record.intensityMethod === 'string'
      ? (record.intensityMethod as ProgramTemplate['intensityMethod'])
      : undefined,
    isCustom: typeof record.isCustom === 'boolean' ? record.isCustom : undefined,
    weeks,
  };
}

export async function loadProgramsFromCloudWithCleanup(userId: string): Promise<{
  programs: ProgramTemplate[];
  changedPrograms: ProgramTemplate[];
}> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('custom_programs')
        .select('program_data, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      PROGRAM_SYNC_TIMEOUT_MS,
      'Timed out loading programs from cloud'
    );

    if (error) {
      console.error('Failed to load programs from cloud:', error);
      return { programs: [], changedPrograms: [] };
    }

    const rows = (data ?? []) as Array<{ program_data: Json }>;
    const programs = rows
      .map(row => parseProgramTemplate(row.program_data))
      .filter((value): value is ProgramTemplate => value !== null);
    const normalized = normalizePrograms(programs);
    logger.debug(`📥 Loaded ${normalized.programs.length} programs from cloud`);
    return normalized;
  } catch (err) {
    console.error('Error loading programs from cloud:', err);
    return { programs: [], changedPrograms: [] };
  }
}

/**
 * Delete a program from Supabase
 */
export async function deleteProgramFromCloud(programId: string, userId: string): Promise<boolean> {
  try {
    if (!isOnline()) {
      queueOperation('delete', 'custom_programs', { programId });
      logger.debug('📥 Offline - queued program delete');
      return true;
    }

    const { error } = await withTimeout(
      supabase
        .from('custom_programs')
        .delete()
        .eq('id', programId)
        .eq('user_id', userId),
      PROGRAM_SYNC_TIMEOUT_MS,
      'Timed out deleting program from cloud'
    );

    if (error) {
      console.error('Failed to delete program from cloud:', error);
      queueOperation('delete', 'custom_programs', { programId });
      return false;
    }

    logger.debug(`🗑️ Deleted program ${programId} from cloud`);
    return true;
  } catch (err) {
    console.error('Error deleting program from cloud:', err);
    queueOperation('delete', 'custom_programs', { programId });
    return false;
  }
}

/**
 * Merge local and cloud programs (cloud wins for conflicts)
 */
export function mergeProgramsWithCloud(
  localPrograms: ProgramTemplate[],
  cloudPrograms: ProgramTemplate[]
): ProgramTemplate[] {
  // Create map of cloud programs by ID
  const cloudMap = new Map<string, ProgramTemplate>();
  cloudPrograms.forEach(p => cloudMap.set(p.id, p));

  // Create map of local programs by ID
  const localMap = new Map<string, ProgramTemplate>();
  localPrograms.forEach(p => localMap.set(p.id, p));

  // Merge: prefer cloud version for conflicts, keep local-only programs
  const mergedMap = new Map<string, ProgramTemplate>();

  // Add all cloud programs (they win conflicts)
  cloudPrograms.forEach(p => mergedMap.set(p.id, p));

  // Add local-only programs (not in cloud)
  localPrograms.forEach(p => {
    if (!cloudMap.has(p.id)) {
      mergedMap.set(p.id, p);
    }
  });

  const merged = Array.from(mergedMap.values());

  logger.debug('📊 Program merge:', {
    cloud: cloudPrograms.length,
    local: localPrograms.length,
    merged: merged.length,
    cloudWins: cloudPrograms.filter(cp => localMap.has(cp.id)).length,
    localOnly: localPrograms.filter(lp => !cloudMap.has(lp.id)).length,
  });

  return merged;
}
