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
    console.log(message);
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

      // Step 2: Clear auth-related localStorage (preserve onboarding/coach marks)
      addLog('2️⃣  Clearing auth-related localStorage...');

      // Preserve these device-specific flags
      const preserveKeys = [
        'iron_brain_onboarding_complete',
        'iron_brain_coach_marks_complete'
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
        <header className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
          <p className="section-label">System Reset</p>
          <h1 className="mt-3 text-3xl font-black text-white">Emergency Auth Reset</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use this if your app is stuck or will not let you sign in or out.
          </p>
        </header>

        <section className="space-y-6">
          <div className="surface-panel rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-purple-500 animate-pulse"></div>
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
              <div className="rounded-xl bg-black/40 p-4 font-mono text-xs">
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
              className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 font-bold text-white shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {logs.length > 0 ? 'Resetting...' : 'Reset Auth State'}
            </button>

            <button
              onClick={() => router.push('/')}
              disabled={logs.length > 0}
              className="rounded-xl border border-white/20 bg-white/10 px-6 py-4 font-semibold text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>

          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-sm text-blue-300 mb-2 font-semibold">💡 When to use this:</p>
            <ul className="ml-4 list-disc space-y-1 text-xs text-blue-200">
              <li>App is stuck on loading screen forever</li>
              <li>Sign out button does not work</li>
              <li>Cannot save workouts or data</li>
              <li>Getting timeout errors everywhere</li>
              <li>After updating auth code and need fresh start</li>
            </ul>
          </div>

          <div className="text-center text-xs text-zinc-500">
            To use this page, navigate to: <code className="bg-white/10 px-2 py-1 rounded">/reset-auth</code>
          </div>
        </section>
      </div>
    </div>
  );
}
