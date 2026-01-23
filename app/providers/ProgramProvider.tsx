'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../lib/supabase/auth-context';
import { usePrograms, UseProgramsReturn } from '../lib/hooks/usePrograms';

/**
 * ProgramContext provides app-wide access to program state and actions.
 * This enables cross-page program management without prop drilling.
 */

const ProgramContext = createContext<UseProgramsReturn | null>(null);

interface ProgramProviderProps {
  children: ReactNode;
}

export function ProgramProvider({ children }: ProgramProviderProps) {
  const { user } = useAuth();
  const namespaceId = user?.id ?? 'guest';
  const userId = user?.id ?? null;

  const programs = usePrograms({ namespaceId, userId });

  return (
    <ProgramContext.Provider value={programs}>
      {children}
    </ProgramContext.Provider>
  );
}

/**
 * Hook to access program context.
 * Must be used within a ProgramProvider.
 */
export function useProgramContext(): UseProgramsReturn {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error('useProgramContext must be used within a ProgramProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if not in a ProgramProvider.
 * Useful for components that may be rendered outside the provider.
 */
export function useProgramContextOptional(): UseProgramsReturn | null {
  return useContext(ProgramContext);
}
