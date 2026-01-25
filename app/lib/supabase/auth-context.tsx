'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './client';
import { syncPendingWorkouts } from './auto-sync';
import { setUserNamespace } from '../storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  namespaceId: string | null;
  namespaceReady: boolean;
  isSyncing: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [namespaceId, setNamespaceId] = useState<string | null>(null);
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track last applied session to prevent duplicate state changes
  const lastAppliedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const applySessionState = (nextSession: Session | null) => {
      if (!active) return;

      // Deduplicate: Don't re-apply if same session user
      const sessionKey = nextSession?.user?.id ?? 'null';
      if (sessionKey === lastAppliedSessionRef.current) {
        console.log('[Auth] Session already applied, skipping:', sessionKey);
        return;
      }
      lastAppliedSessionRef.current = sessionKey;

      const currentUser = nextSession?.user ?? null;
      const newNamespaceId = currentUser?.id ?? null;

      console.log('[Auth] Applying session state:', { hasUser: !!currentUser, userId: newNamespaceId });
      setUserNamespace(newNamespaceId);
      setNamespaceId(newNamespaceId);
      setNamespaceReady(true);
      setSession(nextSession);
      setUser(currentUser);
      setLoading(false);
    };

    const syncPending = async (userId: string) => {
      setIsSyncing(true);
      console.log('[Auth] Starting workout sync...');
      try {
        await syncPendingWorkouts(userId);
        console.log('[Auth] Workout sync complete');
      } catch (err) {
        console.error('[Auth] Failed to sync pending workouts:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    const reconcileSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 8000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (!session?.user) return;
        applySessionState(session);
        syncPending(session.user.id);
      } catch (error) {
        console.error('❌ Failed to reconcile session:', error);
      }
    };

    const getInitialSession = async () => {
      let didTimeout = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      console.log('[Auth] Getting initial session...');
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
          timeoutId = setTimeout(() => {
            didTimeout = true;
            console.log('[Auth] Session fetch timed out after 3s');
            resolve({ data: { session: null } });
          }, 3000);
        });

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        // CRITICAL: Clear timeout if session resolved first to prevent cascade
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        console.log('[Auth] Initial session result:', { hasSession: !!session, didTimeout });
        applySessionState(session);

        if (session?.user) {
          syncPending(session.user.id);
        } else if (didTimeout) {
          console.log('[Auth] Attempting session reconciliation...');
          void reconcileSession();
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('[Auth] Failed to get initial session:', error);

        // Assume logged out and continue
        applySessionState(null);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        applySessionState(session);

        // Create user profile if this is a new signup
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile(session.user.id);
          syncPending(session.user.id);
        }
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
        },
      });
      if (error) throw error;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        throw new Error('Check your email inbox for a confirmation link, then sign in.');
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      // Try Supabase signout with timeout
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );

      try {
        const result = await Promise.race([signOutPromise, timeoutPromise]) as { error: Error | null };
        if (result?.error) {
          console.error('❌ Supabase signOut error:', result.error);
        }
      } catch (timeoutError) {
        console.warn('⚠️ Supabase signOut timed out, forcing local sign out:', timeoutError);
        // Don't await - fire and forget to prevent hanging
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch (error) {
      console.error('❌ Error during signout:', error);
    }

    // ALWAYS clear state, regardless of Supabase call success
    // This ensures the UI updates even if the API call hangs
    lastAppliedSessionRef.current = 'null';
    setUserNamespace(null);
    setNamespaceId(null);
    setNamespaceReady(true);
    setUser(null);
    setSession(null);
    console.log('[Auth] Signed out successfully');
  };

  const value = {
    user,
    session,
    loading,
    namespaceId,
    namespaceReady,
    isSyncing,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to ensure user profile exists
async function ensureUserProfile(userId: string) {
  // Check if profile exists
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) {
    // Create profile and settings
    await Promise.all([
      supabase.from('user_profiles').insert({
        id: userId,
        experience_level: 'intermediate',
      }),
      supabase.from('user_settings').insert({
        user_id: userId,
      }),
    ]);
  }
}
