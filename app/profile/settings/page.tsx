'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Dumbbell, LogOut, Ruler, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';
import { useUnitPreference } from '../../lib/hooks/useUnitPreference';
import { liquidButtonClass } from '../../components/ui/liquid';

interface SettingsLinkRowProps {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}

interface SettingsSectionProps {
  label: string;
  children: ReactNode;
}

function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <section className="stagger-item px-1">
      <h2 className="text-xs font-semibold text-zinc-500">
        {label}
      </h2>
      <div className="mt-2 divide-y divide-white/8 border-y border-white/8">
        {children}
      </div>
    </section>
  );
}

function SettingsLinkRow({ href, label, description, icon }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center justify-between gap-4 px-1 py-4 transition-colors hover:text-zinc-100 sm:px-0"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-500 transition-colors group-hover:text-zinc-300">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-zinc-100">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>
        </div>
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
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-12 pt-4 sm:space-y-8 sm:pt-10">
      <header className="stagger-item px-1">
        <h1 className="iron-display text-3xl text-zinc-100 sm:text-4xl">Settings</h1>
      </header>

      <SettingsSection label="Preferences">
        <div className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-500">
                <Ruler className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-zinc-100">Units</p>
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
          label="1RMs and maxes"
          description="One-rep max data for percentage work."
          icon={<Dumbbell className="h-4.5 w-4.5" />}
        />
      </SettingsSection>

      <SettingsSection label="Account">
        <SettingsLinkRow
          href="/profile"
          label="Profile overview"
          description="Workout count, streak, and account summary."
          icon={<User className="h-4.5 w-4.5" />}
        />
        {user && (
          <SettingsLinkRow
            href="/profile/coach"
            label="Coach export"
            description="Context bundle for coaching and review."
            icon={<Sparkles className="h-4.5 w-4.5" />}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-500">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-zinc-100">
                {user ? 'Account' : 'Guest mode'}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{user?.email ?? 'Local data on this device'}</p>
            </div>
          </div>
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={liquidButtonClass({
                density: 'compact',
                className: 'min-h-10 rounded-full px-4 text-[11px] disabled:cursor-wait disabled:opacity-50',
              })}
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
