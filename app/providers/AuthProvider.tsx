'use client';

import React from 'react';
import { AuthProvider as SupabaseAuthProvider } from '../lib/supabase/auth-context';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}
