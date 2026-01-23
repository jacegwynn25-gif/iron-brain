'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    let active = true;

    const applySessionState = (nextSession: Session | null) => {
      if (!active) return;
      const currentUser = nextSession?.user ?? null;
      const newNamespaceId = currentUser?.id ?? null;

      setUserNamespace(newNamespaceId);
      setNamespaceId(newNamespaceId);
      setNamespaceReady(true);
      setSession(nextSession);
      setUser(currentUser);
      setLoading(false);
    };

    const syncPending = (userId: string) => {
      setTimeout(() => {
        syncPendingWorkouts(userId).catch(err => {
          console.error('Failed to sync pending workouts on load:', err);
        });
      }, 1000);
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
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => {
            didTimeout = true;
            resolve({ data: { session: null } });
          }, 3000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        applySessionState(session);

        if (session?.user) {
          syncPending(session.user.id);
        } else if (didTimeout) {
          void reconcileSession();
        }
      } catch (error) {
        console.error('❌ Failed to get initial session:', error);

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
      // Create a promise that races with a timeout
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );

      try {
        const result = await Promise.race([signOutPromise, timeoutPromise]) as { error: Error | null };

        if (result && result.error) {
          console.error('❌ Supabase signOut error:', result.error);
          throw result.error;
        }
      } catch (timeoutError) {
        console.warn('⚠️ Supabase signOut timed out, forcing local sign out:', timeoutError);
      }

      // Explicitly reset namespace and state to ensure clean sign-out
      setUserNamespace(null);
      setNamespaceId(null);
      setNamespaceReady(true);
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('❌ Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    namespaceId,
    namespaceReady,
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
