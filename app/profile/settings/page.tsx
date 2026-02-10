'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Apple, ChevronRight, LogOut, MoonStar, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';
import { supabase } from '../../lib/supabase/client';

interface IntegrationToggleProps {
  icon: LucideIcon;
  name: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function IntegrationToggle({
  icon: Icon,
  name,
  description,
  enabled,
  onToggle,
}: IntegrationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-900 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">{name}</p>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all ${
          enabled
            ? 'border-emerald-400/60 bg-emerald-500/20'
            : 'border-zinc-700 bg-zinc-900'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-zinc-100 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

interface SettingsLinkRowProps {
  href: string;
  label: string;
  description: string;
}

interface OuraConnection {
  is_active: boolean | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  scope: string | null;
}

function SettingsLinkRow({ href, label, description }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 border-b border-zinc-900 py-4 transition-colors hover:text-zinc-100"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">{label}</p>
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
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
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
    if (!status) return;
    if (status === 'connected') {
      setOuraNotice('Oura connected. Sync now to import the latest data.');
    } else if (status === 'error') {
      setOuraNotice('Oura connection failed. Please try again.');
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
    } catch (error) {
      console.error('Oura connect error:', error);
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
    } catch (error) {
      console.error('Oura disconnect error:', error);
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
    } catch (error) {
      console.error('Oura sync error:', error);
      setOuraError('Oura sync failed.');
    } finally {
      setOuraSyncing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-8 pt-6 sm:pt-10">
      <header className="border-b border-zinc-900 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">Profile</p>
        <h1 className="mt-2 text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-zinc-500">Account, integrations, and preferences.</p>
      </header>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Integrations</p>
        <div className="mt-2">
          <IntegrationToggle
            icon={Apple}
            name="Apple Health"
            description="Health data sync placeholder"
            enabled={appleHealthEnabled}
            onToggle={() => setAppleHealthEnabled((current) => !current)}
          />
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <MoonStar className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-200">Oura Ring</p>
                  <p className="mt-1 text-xs text-zinc-500">Sync sleep and readiness data to power recovery insights.</p>
                </div>
              </div>
              {ouraConnection?.is_active ? (
                <button
                  type="button"
                  onClick={handleOuraDisconnect}
                  disabled={ouraLoading}
                  className="inline-flex items-center rounded-full border border-rose-400/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-200 transition-colors hover:border-rose-300/70 hover:text-rose-100 disabled:opacity-60"
                >
                  {ouraLoading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOuraConnect}
                  disabled={ouraLoading}
                  className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200 transition-colors hover:border-emerald-300/70 hover:text-emerald-100 disabled:opacity-60"
                >
                  {ouraLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span>
                Status: {ouraConnection?.is_active ? 'Connected' : 'Not connected'}
              </span>
              <span>
                Last sync:{' '}
                {ouraConnection?.last_sync_at
                  ? new Date(ouraConnection.last_sync_at).toLocaleString()
                  : 'Never'}
              </span>
              {ouraConnection?.last_sync_status && (
                <span>Last result: {ouraConnection.last_sync_status}</span>
              )}
            </div>

            {ouraConnection?.is_active && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleOuraSync}
                  disabled={ouraSyncing}
                  className="inline-flex items-center rounded-full border border-zinc-700 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
                >
                  {ouraSyncing ? 'Syncing...' : 'Sync now'}
                </button>
              </div>
            )}

            {ouraNotice && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {ouraNotice}
              </div>
            )}

            {ouraError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {ouraError}
              </div>
            )}

            <p className="mt-3 text-[11px] text-zinc-600">
              Note: Oura membership is required for Gen3 and Ring 4 data access.
            </p>
          </div>
        </div>
      </section>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Preferences</p>
        <div className="mt-2">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">Units</p>
            <p className="mt-1 text-xs text-zinc-500">Controls weight and measurement display.</p>
            <div className="mt-3 inline-flex rounded-full border border-zinc-800 bg-zinc-950/70 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => unitSystem !== 'imperial' && setUnitSystem('imperial')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  unitSystem === 'imperial' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400'
                }`}
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => unitSystem !== 'metric' && setUnitSystem('metric')}
                className={`rounded-full px-3 py-1 transition-colors ${
                  unitSystem === 'metric' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-400'
                }`}
              >
                kg
              </button>
            </div>
          </div>
          <SettingsLinkRow
            href="/profile/appearance"
            label="Appearance"
            description="Theme and visual preferences."
          />
          <SettingsLinkRow
            href="/profile/notifications"
            label="Notifications"
            description="Control reminders and alert behavior."
          />
          <SettingsLinkRow
            href="/profile/maxes"
            label="My Maxes"
            description="Manage one-rep max data."
          />
          <SettingsLinkRow
            href="/profile/exercises"
            label="Custom Exercises"
            description="Edit personal movement library."
          />
        </div>
      </section>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Account</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? 'Signing Out...' : 'Sign Out'}
        </button>
      </section>

      <section className="pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Developer</p>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-zinc-800 px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          <Wrench className="h-4 w-4" />
          Simulate Crash (Sleep Debt)
        </button>
      </section>
    </div>
  );
}
