'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  NotebookPen,
  BookOpen,
  History,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, type TouchEvent } from 'react';

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
  { id: 'programs', label: 'Programs', href: '/programs', icon: BookOpen, coach: 'programs-tab' },
  { id: 'history', label: 'History', href: '/history', icon: History, coach: 'history-tab' },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const hideBottomNav =
    pathname.includes('/workout/active') ||
    pathname === '/workout/readiness' ||
    pathname === '/workout/summary';
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const routeHistoryRef = useRef<string[]>([pathname]);
  const isBackNavRef = useRef(false);

  useEffect(() => {
    if (isBackNavRef.current) {
      isBackNavRef.current = false;
      return;
    }
    const history = routeHistoryRef.current;
    if (history[history.length - 1] !== pathname) {
      history.push(pathname);
      if (history.length > 30) {
        history.shift();
      }
    }
  }, [pathname]);

  const shouldIgnoreSwipe = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[data-swipe-ignore="true"]')) return true;
    if (target.closest('[data-swipe-scope="local"]')) return true;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return true;
    return false;
  };

  const handleSwipeStart = (event: TouchEvent) => {
    if (shouldIgnoreSwipe(event.target)) {
      swipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleSwipeEnd = (event: TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      const history = routeHistoryRef.current;
      if (history.length <= 1) return;
      history.pop();
      const previous = history[history.length - 1];
      isBackNavRef.current = true;
      router.push(previous);
    }
  };

  return (
    <div
      className="relative min-h-dvh bg-zinc-950 text-zinc-100"
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
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
        <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-zinc-800 bg-zinc-950/98 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative mx-auto flex w-full max-w-2xl items-center justify-between px-2 pb-[calc(env(safe-area-inset-bottom)+0.12rem)] pt-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-coach={item.coach}
                  className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                    active
                      ? 'text-emerald-300'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[2.1]'}`} />
                  <span className={`text-[10px] font-semibold leading-none ${active ? 'tracking-[0.02em]' : ''}`}>
                    {item.label}
                  </span>
                  {active && (
                    <span className="absolute top-0 h-0.5 w-7 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
