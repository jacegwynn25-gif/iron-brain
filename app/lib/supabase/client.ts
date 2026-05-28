import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createConfiguredSupabaseClient() {
  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

type BrowserSupabaseClient = ReturnType<typeof createConfiguredSupabaseClient>;

function createMissingSupabaseClient(): BrowserSupabaseClient {
  const offlineError = new Error('Supabase environment variables are not configured');
  const offlineResult = Promise.resolve({ data: null, error: offlineError, count: null, status: 503, statusText: 'Offline' });

  const offlineQuery = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return offlineResult.then.bind(offlineResult);
      if (prop === 'catch') return offlineResult.catch.bind(offlineResult);
      if (prop === 'finally') return offlineResult.finally.bind(offlineResult);
      if (prop === Symbol.toStringTag) return 'Promise';
      return () => offlineQuery;
    },
  });

  const offlineAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    }),
    signUp: async () => ({ data: { user: null, session: null }, error: offlineError }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: offlineError }),
    signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: offlineError }),
    signOut: async () => ({ error: null }),
  };

  return new Proxy({ auth: offlineAuth } as unknown as BrowserSupabaseClient, {
    get(target, prop) {
      if (prop === 'auth') return offlineAuth;
      if (prop === 'from') return () => offlineQuery;
      if (prop === 'rpc') return () => offlineQuery;
      return target[prop as keyof typeof target];
    },
  });
}

// Client-side Supabase client (uses anon key with RLS)
export const supabase: BrowserSupabaseClient = isSupabaseConfigured
  ? createConfiguredSupabaseClient()
  : createMissingSupabaseClient();

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Helper to sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
