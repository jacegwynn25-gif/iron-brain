'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgramTemplate } from '../types';
import { useAuth } from '../supabase/auth-context';
import {
  loadProgramsFromCloudWithCleanup,
  saveProgramToCloud,
  deleteProgramFromCloud,
  mergeProgramsWithCloud,
} from '../supabase/program-sync';
import { normalizePrograms } from '../programs/normalize';
import { allPrograms as BUILT_IN_TEMPLATES } from '../programs';

// ============================================
// STORAGE KEYS
// ============================================

const getStorageKeys = (namespaceId: string) => ({
  USER_PROGRAMS: `iron_brain_user_programs__${namespaceId}`,
  SELECTED_PROGRAM: `iron_brain_selected_program__${namespaceId}`,
});

// ============================================
// HOOK: usePrograms
// ============================================

export interface UseProgramsReturn {
  // State
  userPrograms: ProgramTemplate[];
  selectedProgram: ProgramTemplate | null;
  originalProgram: ProgramTemplate | null;
  loading: boolean;
  error: string | null;

  // Computed
  hasUnsavedChanges: boolean;
  allPrograms: ProgramTemplate[]; // userPrograms + built-in
  builtInProgramIds: Set<string>;

  // Actions
  loadPrograms: () => Promise<void>;
  selectProgram: (program: ProgramTemplate | null) => void;
  saveProgram: (program: ProgramTemplate) => Promise<void>;
  deleteProgram: (programId: string) => Promise<void>;
  discardChanges: () => void;
  updateSelectedProgram: (updates: Partial<ProgramTemplate>) => void;
  resolveProgramSelection: (program: ProgramTemplate) => ProgramTemplate;
}

interface UseProgramsOptions {
  namespaceId?: string;
  userId?: string | null;
}

export function usePrograms(options?: UseProgramsOptions): UseProgramsReturn {
  const { user } = useAuth();
  // Use provided userId or fall back to user?.id
  const effectiveUserId = options?.userId !== undefined ? options.userId : user?.id;
  // Use provided namespaceId or fall back to user?.id or 'guest'
  const namespaceId = options?.namespaceId ?? user?.id ?? 'guest';

  // State
  const [userPrograms, setUserPrograms] = useState<ProgramTemplate[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramTemplate | null>(null);
  const [originalProgram, setOriginalProgram] = useState<ProgramTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoized storage keys
  const storageKeys = useMemo(() => getStorageKeys(namespaceId), [namespaceId]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedProgram || !originalProgram) return false;
    return JSON.stringify(selectedProgram) !== JSON.stringify(originalProgram);
  }, [selectedProgram, originalProgram]);

  const builtInProgramIds = useMemo(
    () => new Set(BUILT_IN_TEMPLATES.map((p) => p.id)),
    []
  );

  const allPrograms = useMemo(() => {
    return [...BUILT_IN_TEMPLATES, ...userPrograms];
  }, [userPrograms]);

  // ============================================
  // LOAD PROGRAMS
  // ============================================

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Load from localStorage
      let localPrograms: ProgramTemplate[] = [];
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKeys.USER_PROGRAMS);
        if (stored) {
          try {
            localPrograms = JSON.parse(stored);
          } catch (e) {
            console.error('Failed to parse local programs:', e);
          }
        }
      }
      const localNormalized = normalizePrograms(localPrograms);
      localPrograms = localNormalized.programs;
      if (localNormalized.changedPrograms.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem(storageKeys.USER_PROGRAMS, JSON.stringify(localPrograms));
      }

      // 2. If user is logged in, merge with cloud
      if (effectiveUserId) {
        try {
          const { programs: cloudPrograms, changedPrograms } =
            await loadProgramsFromCloudWithCleanup(effectiveUserId);
          const merged = mergeProgramsWithCloud(localPrograms, cloudPrograms);
          const mergedNormalized = normalizePrograms(merged);
          localPrograms = mergedNormalized.programs;

          // Persist merged result
          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKeys.USER_PROGRAMS, JSON.stringify(localPrograms));
          }

          if (changedPrograms.length > 0) {
            await Promise.all(changedPrograms.map((program) => saveProgramToCloud(program, effectiveUserId)));
          }
        } catch (e) {
          console.error('Failed to load cloud programs:', e);
          // Continue with local programs
        }
      }

      setUserPrograms(localPrograms);

      // 3. Restore selected program
      if (typeof window !== 'undefined') {
        const selectedId = localStorage.getItem(storageKeys.SELECTED_PROGRAM);
        if (selectedId) {
          const found = localPrograms.find(p => p.id === selectedId) ||
                        BUILT_IN_TEMPLATES.find(p => p.id === selectedId);
          if (found) {
            setSelectedProgram(found);
            setOriginalProgram(JSON.parse(JSON.stringify(found)));
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load programs';
      setError(message);
      console.error('loadPrograms error:', e);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, storageKeys]);

  // ============================================
  // SELECT PROGRAM
  // ============================================

  const selectProgram = useCallback((program: ProgramTemplate | null) => {
    if (!program) {
      setSelectedProgram(null);
      setOriginalProgram(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKeys.SELECTED_PROGRAM);
      }
      return;
    }

    // Clone program to avoid mutations
    const cloned = JSON.parse(JSON.stringify(program));
    setSelectedProgram(cloned);
    setOriginalProgram(JSON.parse(JSON.stringify(program)));

    // Persist selection
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKeys.SELECTED_PROGRAM, program.id);
    }
  }, [storageKeys]);

  // ============================================
  // SAVE PROGRAM
  // ============================================

  const saveProgram = useCallback(async (program: ProgramTemplate) => {
    // Check if updating existing or creating new
    const existingIndex = userPrograms.findIndex(p => p.id === program.id);
    const isNew = existingIndex === -1;

    // Mark as custom
    const programToSave: ProgramTemplate = {
      ...program,
      isCustom: true,
    };

    // Update local state
    let updatedPrograms: ProgramTemplate[];
    if (isNew) {
      updatedPrograms = [...userPrograms, programToSave];
    } else {
      updatedPrograms = userPrograms.map(p =>
        p.id === program.id ? programToSave : p
      );
    }
    setUserPrograms(updatedPrograms);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKeys.USER_PROGRAMS, JSON.stringify(updatedPrograms));
    }

    // Sync to cloud if logged in
    if (effectiveUserId) {
      try {
        await saveProgramToCloud(programToSave, effectiveUserId);
        console.log(`✅ Saved program "${program.name}" to cloud`);
      } catch (e) {
        console.error('Failed to save program to cloud:', e);
        // Local save succeeded, cloud failed - acceptable for offline-first
      }
    }

    // Update original to match saved state
    if (selectedProgram?.id === program.id) {
      setOriginalProgram(JSON.parse(JSON.stringify(programToSave)));
      setSelectedProgram(programToSave);
    }
  }, [userPrograms, effectiveUserId, storageKeys, selectedProgram?.id]);

  // ============================================
  // DELETE PROGRAM
  // ============================================

  const deleteProgram = useCallback(async (programId: string) => {
    // Can't delete built-in templates
    if (BUILT_IN_TEMPLATES.some(p => p.id === programId)) {
      setError('Cannot delete built-in templates');
      return;
    }

    // Remove from local state
    const updatedPrograms = userPrograms.filter(p => p.id !== programId);
    setUserPrograms(updatedPrograms);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKeys.USER_PROGRAMS, JSON.stringify(updatedPrograms));
    }

    // Clear selection if deleted program was selected
    if (selectedProgram?.id === programId) {
      setSelectedProgram(null);
      setOriginalProgram(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKeys.SELECTED_PROGRAM);
      }
    }

    // Delete from cloud if logged in
    if (effectiveUserId) {
      try {
        await deleteProgramFromCloud(programId, effectiveUserId);
        console.log(`🗑️ Deleted program ${programId} from cloud`);
      } catch (e) {
        console.error('Failed to delete program from cloud:', e);
      }
    }
  }, [userPrograms, effectiveUserId, storageKeys, selectedProgram?.id]);

  // ============================================
  // DISCARD CHANGES
  // ============================================

  const discardChanges = useCallback(() => {
    if (originalProgram) {
      setSelectedProgram(JSON.parse(JSON.stringify(originalProgram)));
    }
  }, [originalProgram]);

  // ============================================
  // UPDATE SELECTED PROGRAM (for editing)
  // ============================================

  const updateSelectedProgram = useCallback((updates: Partial<ProgramTemplate>) => {
    if (!selectedProgram) return;
    setSelectedProgram(prev => prev ? { ...prev, ...updates } : null);
  }, [selectedProgram]);

  // ============================================
  // RESOLVE PROGRAM SELECTION (clone built-in)
  // ============================================

  const createId = useCallback((prefix: string) => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const resolveProgramSelection = useCallback((program: ProgramTemplate): ProgramTemplate => {
    const isBuiltIn = builtInProgramIds.has(program.id);
    if (!isBuiltIn) return program;

    // Check if user already cloned this built-in program
    const existingClone = userPrograms.find(
      (p) => p.name === program.name && p.id.startsWith('userprog_')
    );
    if (existingClone) return existingClone;

    // Clone built-in into user programs
    const clone: ProgramTemplate = {
      ...program,
      id: `userprog_${createId('prog')}`,
    };
    const updatedPrograms = [...userPrograms, clone];
    setUserPrograms(updatedPrograms);

    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKeys.USER_PROGRAMS, JSON.stringify(updatedPrograms));
    }

    // Sync clone to cloud
    if (effectiveUserId) {
      void saveProgramToCloud({ ...clone, isCustom: true }, effectiveUserId);
    }

    return clone;
  }, [builtInProgramIds, userPrograms, createId, storageKeys, effectiveUserId]);

  // ============================================
  // LOAD ON MOUNT & NAMESPACE CHANGE
  // ============================================

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    userPrograms,
    selectedProgram,
    originalProgram,
    loading,
    error,

    // Computed
    hasUnsavedChanges,
    allPrograms,
    builtInProgramIds,

    // Actions
    loadPrograms,
    selectProgram,
    saveProgram,
    deleteProgram,
    discardChanges,
    updateSelectedProgram,
    resolveProgramSelection,
  };
}
