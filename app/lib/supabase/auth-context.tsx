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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      const newNamespaceId = currentUser?.id ?? null;

      // Set namespace FIRST, before updating other state
      setUserNamespace(newNamespaceId);
      setNamespaceId(newNamespaceId);
      setNamespaceReady(true);

      setSession(session);
      setUser(currentUser);
      setLoading(false);

      // Sync pending workouts if already logged in
      if (session?.user) {
        setTimeout(() => {
          syncPendingWorkouts(session.user.id).catch(err => {
            console.error('Failed to sync pending workouts on load:', err);
          });
        }, 1000);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;
        const newNamespaceId = currentUser?.id ?? null;

        // Set namespace FIRST, before updating other state
        setUserNamespace(newNamespaceId);
        setNamespaceId(newNamespaceId);
        setNamespaceReady(true);

        setSession(session);
        setUser(currentUser);
        setLoading(false);

        // Create user profile if this is a new signup
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile(session.user.id);

          // Automatically sync any pending workouts from localStorage
          setTimeout(() => {
            syncPendingWorkouts(session.user.id).catch(err => {
              console.error('Failed to sync pending workouts:', err);
            });
          }, 1000); // Small delay to let UI settle
        }
      }
    );

    return () => subscription.unsubscribe();
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
      console.log('🚪 Starting sign out process...');
      console.log('Current session:', session);
      console.log('Current user:', user);

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

        console.log('✅ Supabase signOut successful');
      } catch (timeoutError) {
        console.warn('⚠️ Supabase signOut timed out, forcing local sign out:', timeoutError);
      }

      // Explicitly reset namespace and state to ensure clean sign-out
      setUserNamespace(null);
      setNamespaceId(null);
      setNamespaceReady(true);
      setUser(null);
      setSession(null);

      console.log('✅ Auth state reset complete');
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
