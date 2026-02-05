'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Apple, LogOut, MoonStar, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/supabase/auth-context';

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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-zinc-100" />
        <div>
          <p className="font-bold text-zinc-100">{name}</p>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
          enabled
            ? 'border-white/30 bg-zinc-200/20'
            : 'border-white/10 bg-zinc-950/80'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-zinc-100 transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { signOut } = useAuth();
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
    <div className="mx-auto w-full max-w-3xl space-y-4 py-6">
      <div className="rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-6 md:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">Account, integrations, and developer controls.</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-4 space-y-4">
          <div>
            <h2 className="text-zinc-100 font-bold">Integrations</h2>
            <p className="text-sm text-zinc-400">Connect recovery sources.</p>
          </div>

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
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-4 space-y-4">
          <div>
            <h2 className="text-zinc-100 font-bold">Account</h2>
            <p className="text-sm text-zinc-400">Manage your current session.</p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-bold text-red-100 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </span>
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-4 space-y-4">
          <div>
            <h2 className="text-zinc-100 font-bold">Developer</h2>
            <p className="text-sm text-zinc-400">Debug and testing utilities.</p>
          </div>

          <button
            type="button"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 font-bold text-zinc-100"
          >
            <span className="inline-flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Simulate Crash (Sleep Debt)
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
