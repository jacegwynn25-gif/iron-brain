'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, LogOut, MoonStar } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';
import { supabase } from '../../lib/supabase/client';

interface SettingsLinkRowProps {
  href: string;
  label: string;
  description: string;
}

interface SettingsSectionProps {
  label: string;
  children: ReactNode;
}

interface OuraConnection {
  is_active: boolean | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  scope: string | null;
}

function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <section className="stagger-item px-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px] sm:tracking-[0.3em]">
        {label}
      </p>
      <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        {children}
      </div>
    </section>
  );
}

function SettingsLinkRow({ href, label, description }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 border-b border-zinc-900 px-4 py-4 transition-colors last:border-b-0 hover:bg-zinc-900/35 hover:text-zinc-100 sm:px-5"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-300" />
    </Link>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, user } = useAuth();
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [ouraConnection, setOuraConnection] = useState<OuraConnection | null>(null);
  const [ouraLoading, setOuraLoading] = useState(false);
  const [ouraSyncing, setOuraSyncing] = useState(false);
  const [ouraError, setOuraError] = useState<string | null>(null);
  const [ouraNotice, setOuraNotice] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      router.push('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  const loadOuraConnection = useCallback(async () => {
    if (!user?.id) return;
    setOuraError(null);
    const { data, error } = await supabase
      .from('fitness_tracker_connections')
      .select('is_active, last_sync_at, last_sync_status, scope')
      .eq('user_id', user.id)
      .eq('provider', 'oura')
      .maybeSingle();

    if (error) {
      setOuraError('Failed to load Oura connection');
      return;
    }

    setOuraConnection(data ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadOuraConnection();
  }, [user?.id, loadOuraConnection]);

  useEffect(() => {
    const status = searchParams.get('oura');
    const reason = searchParams.get('reason');
    if (!status) return;
    if (status === 'connected') {
      setOuraNotice('Oura connected. Sync now to import the latest data.');
    } else if (status === 'error') {
      setOuraError(
        reason ? `Oura connection failed (${reason}).` : 'Oura connection failed. Please try again.'
      );
    }
  }, [searchParams]);

  const handleOuraConnect = async () => {
    setOuraLoading(true);
    setOuraError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setOuraError('Please sign in again to connect Oura.');
        return;
      }

      const response = await fetch('/api/oura/connect', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload.url) {
        setOuraError('Failed to start Oura connection.');
        return;
      }

      window.location.href = payload.url;
    } catch {
      setOuraError('Failed to start Oura connection.');
    } finally {
      setOuraLoading(false);
    }
  };

  const handleOuraDisconnect = async () => {
    setOuraLoading(true);
    setOuraError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setOuraError('Please sign in again to disconnect Oura.');
        return;
      }

      const response = await fetch('/api/oura/disconnect', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setOuraError('Failed to disconnect Oura.');
        return;
      }

      await loadOuraConnection();
    } catch {
      setOuraError('Failed to disconnect Oura.');
    } finally {
      setOuraLoading(false);
    }
  };

  const handleOuraSync = async () => {
    if (!ouraConnection?.is_active) return;
    setOuraSyncing(true);
    setOuraError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setOuraError('Please sign in again to sync Oura.');
        return;
      }

      const mode = ouraConnection.last_sync_at ? 'incremental' : 'backfill';
      const days = ouraConnection.last_sync_at ? 7 : 30;

      const response = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, days }),
      });

      if (!response.ok) {
        setOuraError('Oura sync failed. Try again in a minute.');
        return;
      }

      await loadOuraConnection();
      setOuraNotice('Oura sync complete.');
    } catch {
      setOuraError('Oura sync failed.');
    } finally {
      setOuraSyncing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/80 sm:text-[10px] sm:tracking-[0.4em]">Profile</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">Settings</h1>
        <p className="mt-1 text-xs text-zinc-500">Account, integrations, and preferences.</p>
      </header>

      <SettingsSection label="Integrations">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70">
                <MoonStar className="h-4 w-4 text-zinc-200" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-100">Oura Ring</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${ouraConnection?.is_active
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                    }`}>
                    {ouraConnection?.is_active ? 'Connected' : 'Off'}
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
                  Sync sleep and readiness data for recovery insights.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {ouraConnection?.is_active && (
                <button
                  type="button"
                  onClick={handleOuraSync}
                  disabled={ouraSyncing || ouraLoading}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
                >
                  {ouraSyncing ? 'Syncing...' : 'Sync'}
                </button>
              )}
              {ouraConnection?.is_active ? (
                <button
                  type="button"
                  onClick={handleOuraDisconnect}
                  disabled={ouraLoading || ouraSyncing}
                  className="rounded-full border border-rose-400/40 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-200 transition-colors hover:border-rose-300/70 hover:text-rose-100 disabled:opacity-60"
                >
                  {ouraLoading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOuraConnect}
                  disabled={ouraLoading}
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200 transition-colors hover:border-emerald-300/70 hover:text-emerald-100 disabled:opacity-60"
                >
                  {ouraLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Status</p>
              <p className="mt-1 text-zinc-300">{ouraConnection?.is_active ? 'Connected' : 'Not connected'}</p>
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Last Sync</p>
              <p className="mt-1 text-zinc-300">
                {ouraConnection?.last_sync_at
                  ? new Date(ouraConnection.last_sync_at).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Last Result</p>
              <p className="mt-1 text-zinc-300">{ouraConnection?.last_sync_status || 'No sync yet'}</p>
            </div>
          </div>

          {ouraNotice && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {ouraNotice}
            </div>
          )}

          {ouraError && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {ouraError}
            </div>
          )}

          <p className="mt-3 text-[11px] text-zinc-600">
            Oura membership is required for Gen3 and Ring 4 data access.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection label="Preferences">
        <div className="border-b border-zinc-900 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">Units</p>
              <p className="mt-1 text-xs text-zinc-500">Default display for new workout sets.</p>
            </div>
            <div className="grid grid-cols-2 rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
              {[
                { value: 'imperial', label: 'LBS' },
                { value: 'metric', label: 'KG' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUnitSystem(option.value === 'metric' ? 'metric' : 'imperial')}
                  className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-colors ${unitSystem === option.value
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SettingsLinkRow
          href="/profile/maxes"
          label="My Maxes"
          description="Manage one-rep max data used by percentages and suggestions."
        />
      </SettingsSection>

      <SettingsSection label="Account">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">Signed In</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{user?.email ?? 'Authenticated account'}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
