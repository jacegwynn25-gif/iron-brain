'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Ruler, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';

interface SettingsLinkRowProps {
  href: string;
  label: string;
  description: string;
}

interface SettingsSectionProps {
  label: string;
  children: ReactNode;
}

function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <section className="stagger-item px-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px] sm:tracking-[0.3em]">
        {label}
      </p>
      <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-zinc-900 bg-zinc-950/60">
        {children}
      </div>
    </section>
  );
}

function SettingsLinkRow({ href, label, description }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-4 border-b border-zinc-900 px-4 py-4 transition-colors last:border-b-0 hover:bg-zinc-900/45 hover:text-zinc-100 sm:px-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight text-zinc-100">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-300" />
    </Link>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <h1 className="text-3xl font-black italic tracking-tight text-zinc-100 sm:text-4xl">SETTINGS</h1>
        <p className="mt-1 text-xs text-zinc-500">Account and preferences.</p>
      </header>

      <SettingsSection label="Preferences">
        <div className="border-b border-zinc-900 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70">
                <Ruler className="h-5 w-5 text-zinc-300" />
              </div>
              <div>
                <p className="text-base font-black italic tracking-tight text-zinc-100">UNITS</p>
                <p className="mt-1 text-xs text-zinc-500">Default display for new workout sets.</p>
              </div>
            </div>
            <div className="grid min-h-11 grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
              {[
                { value: 'imperial', label: 'LBS' },
                { value: 'metric', label: 'KG' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUnitSystem(option.value === 'metric' ? 'metric' : 'imperial')}
                  className={`rounded-lg px-4 text-[11px] font-black uppercase tracking-[0.18em] transition-colors ${unitSystem === option.value
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
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70">
              <ShieldCheck className="h-5 w-5 text-zinc-300" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black italic tracking-tight text-zinc-100">SIGNED IN</p>
              <p className="mt-1 truncate text-xs text-zinc-500">{user?.email ?? 'Authenticated account'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
