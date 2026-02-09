'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Apple, ChevronRight, LogOut, MoonStar, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';

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
  const { signOut } = useAuth();
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
  const [ouraEnabled, setOuraEnabled] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      router.push('/login');
    } finally {
      setIsSigningOut(false);
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
          <IntegrationToggle
            icon={MoonStar}
            name="Oura Ring"
            description="Sleep and readiness sync placeholder"
            enabled={ouraEnabled}
            onToggle={() => setOuraEnabled((current) => !current)}
          />
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
