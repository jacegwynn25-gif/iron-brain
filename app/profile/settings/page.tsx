'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Ruler, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';
import { liquidButtonClass } from '../../components/ui/liquid';

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
      <p className="iron-label">
        {label}
      </p>
      <div className="mt-3 divide-y divide-white/8 border-y border-white/8">
        {children}
      </div>
    </section>
  );
}

function SettingsLinkRow({ href, label, description }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-4 px-1 py-4 transition-colors hover:text-zinc-100 sm:px-0"
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
        <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Settings</h1>
      </header>

      <SettingsSection label="Preferences">
        <div className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="liquid-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Ruler className="h-5 w-5 text-zinc-300" />
              </div>
              <div>
                <p className="iron-display text-base text-zinc-100">Units</p>
              </div>
            </div>
            <div className="liquid-segmented grid min-h-11 grid-cols-2 gap-1 p-1">
              {[
                { value: 'imperial', label: 'LBS' },
                { value: 'metric', label: 'KG' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUnitSystem(option.value === 'metric' ? 'metric' : 'imperial')}
                  data-active={unitSystem === option.value ? 'true' : 'false'}
                  className="liquid-segmented-item px-4 text-[11px] font-semibold"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SettingsLinkRow
          href="/profile/maxes"
          label="My maxes"
          description="One-rep max data for percentage work."
        />
      </SettingsSection>

      <SettingsSection label="Account">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="liquid-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <ShieldCheck className="h-5 w-5 text-zinc-300" />
            </div>
            <div className="min-w-0">
              <p className="iron-display text-base text-zinc-100">Signed in</p>
              <p className="mt-1 truncate text-xs text-zinc-500">{user?.email ?? 'Authenticated account'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className={liquidButtonClass({
              variant: 'danger',
              density: 'compact',
              className: 'min-h-10 px-4 text-[11px]',
            })}
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
