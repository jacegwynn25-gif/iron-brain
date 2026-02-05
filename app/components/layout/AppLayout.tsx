'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  NotebookPen,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  coach?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { id: 'log', label: 'Log', href: '/start', icon: NotebookPen, coach: 'start-button' },
  { id: 'history', label: 'History', href: '/history', icon: History },
  // Keep Settings as the 4th primary tab.
  { id: 'settings', label: 'Settings', href: '/profile/settings', icon: Settings },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname() ?? '/';
  const hideBottomNav =
    pathname.includes('/workout/active') ||
    pathname === '/workout/readiness' ||
    pathname === '/workout/summary';

  return (
    <div className="relative min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-zinc-950" />
      <div
        className="pointer-events-none fixed inset-0 -z-20 opacity-70"
        style={{
          background:
            'radial-gradient(55rem 55rem at 14% 8%, rgba(148,163,184,0.11), transparent 45%), radial-gradient(50rem 50rem at 88% 10%, rgba(59,130,246,0.08), transparent 45%), radial-gradient(40rem 40rem at 55% 92%, rgba(34,197,94,0.07), transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-20 opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <main className={`relative mx-auto min-h-dvh w-full max-w-7xl px-4 safe-top sm:px-6 ${hideBottomNav ? 'pb-8' : 'pb-28'}`}>
        {children}
      </main>

      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-white/10 bg-zinc-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-around px-3 py-2 safe-bottom">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-coach={item.coach}
                  className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                    active ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[2]'} `} />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
