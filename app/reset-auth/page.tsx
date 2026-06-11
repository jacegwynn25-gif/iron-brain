'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase/client';

/**
 * Emergency auth reset page
 * Use this if the app is stuck in a broken auth state
 */
export default function ResetAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Ready to reset...');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const performReset = async () => {
    try {
      setStatus('Resetting authentication...');
      addLog('🔄 Starting auth reset process');

      // Step 1: Sign out from Supabase
      addLog('1️⃣  Signing out from Supabase...');
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          addLog(`   ⚠️  Sign out error: ${error.message}`);
        } else {
          addLog('   ✅ Signed out from Supabase');
        }
      } catch {
        addLog('   ⚠️  Sign out failed or timed out (continuing anyway)');
      }

      // Step 2: Clear auth-related localStorage (preserve preferences)
      addLog('2️⃣  Clearing auth-related localStorage...');

      // Preserve user preferences
      const preserveKeys = [
        'iron_brain_unit_system'
      ];
      const preserved: Record<string, string> = {};
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) preserved[key] = value;
      });

      const itemCount = localStorage.length;
      localStorage.clear();

      // Restore preserved flags
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      addLog(`   ✅ Cleared ${itemCount} items, preserved ${Object.keys(preserved).length} flags`);

      // Step 3: Clear all sessionStorage
      addLog('3️⃣  Clearing sessionStorage...');
      const sessionCount = sessionStorage.length;
      sessionStorage.clear();
      addLog(`   ✅ Cleared ${sessionCount} items from sessionStorage`);

      // Step 4: Clear Supabase-specific keys (redundant but thorough)
      addLog('4️⃣  Removing Supabase auth keys...');
      const supabaseKeys = [
        'supabase.auth.token',
        'sb-access-token',
        'sb-refresh-token',
        'iron-brain-namespace'
      ];

      supabaseKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      addLog('   ✅ Removed Supabase auth keys');

      // Step 5: Success
      addLog('');
      addLog('✅ AUTH RESET COMPLETE!');
      addLog('');
      addLog('Redirecting to home page in 2 seconds...');

      setStatus('Reset complete! Redirecting...');

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Error during reset: ${errorMsg}`);
      setStatus('Reset failed - see logs');
    }
  };

  return (
    <div className="min-h-screen app-gradient safe-top">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        <header className="px-1">
          <p className="section-label">System Reset</p>
          <h1 className="mt-3 text-3xl font-black italic tracking-tight text-white">AUTH RESET</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Use this if your app is stuck or will not let you sign in or out.
          </p>
        </header>

        <section className="space-y-6">
          <div className="border-y border-white/8 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-lg font-semibold text-white">{status}</p>
            </div>

            {logs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-300">
                  This will:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-sm text-zinc-400">
                  <li>Sign you out from Supabase</li>
                  <li>Clear all browser storage (localStorage + sessionStorage)</li>
                  <li>Remove any corrupted auth tokens</li>
                  <li>Redirect you to the home page</li>
                </ul>
                <p className="text-sm text-amber-400 mt-4">
                  ⚠️ You&apos;ll need to sign in again after this
                </p>
              </div>
            )}

            {logs.length > 0 && (
              <div className="border-y border-white/8 py-4 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="text-zinc-300">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={performReset}
              disabled={logs.length > 0}
              className="flex-1 rounded-full border border-rose-400/30 bg-rose-500/14 px-6 py-4 font-bold text-rose-100 transition-all hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {logs.length > 0 ? 'Resetting...' : 'Reset Auth State'}
            </button>

            <button
              onClick={() => router.push('/')}
              disabled={logs.length > 0}
              className="liquid-icon-button rounded-full px-6 py-4 font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          <details className="border-y border-white/8 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">When to use this</summary>
            <ul className="ml-4 mt-3 list-disc space-y-1 text-xs text-zinc-400">
              <li>App is stuck on loading screen forever</li>
              <li>Sign out button does not work</li>
              <li>Cannot save workouts or data</li>
              <li>Getting timeout errors everywhere</li>
              <li>After updating auth code and need fresh start</li>
            </ul>
          </details>

          <div className="text-center text-xs text-zinc-500">
            To use this page, navigate to: <code className="bg-white/10 px-2 py-1 rounded">/reset-auth</code>
          </div>
        </section>
      </div>
    </div>
  );
}
