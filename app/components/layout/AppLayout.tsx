'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  History,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { restoreLeakedBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';
import WorkoutMiniBar from '@/app/components/workout/WorkoutMiniBar';

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
  { id: 'log', label: 'Log', href: '/start', icon: Zap, coach: 'start-button' },
  { id: 'programs', label: 'Programs', href: '/programs', icon: BookOpen, coach: 'programs-tab' },
  { id: 'history', label: 'History', href: '/history', icon: History, coach: 'history-tab' },
  { id: 'analytics', label: 'Insights', href: '/analytics', icon: LineChart },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const hideBottomNavByRoute =
    pathname.startsWith('/workout') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/reset-auth');
  const [hideBottomNavByOverlay, setHideBottomNavByOverlay] = useState(false);
  const routeHistoryRef = useRef<string[]>([pathname]);
  const isBackNavRef = useRef(false);
  const navPointerRef = useRef<{
    href: string;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const syncOverlayNavState = () => {
      setHideBottomNavByOverlay(document.body.getAttribute('data-hide-bottom-nav') === 'true');
    };
    syncOverlayNavState();

    const observer = new MutationObserver(syncOverlayNavState);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-hide-bottom-nav'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    restoreLeakedBodyScrollLock();
  }, [pathname]);

  const hideBottomNav = hideBottomNavByRoute || hideBottomNavByOverlay;

  const handleNavPointerDown = (event: PointerEvent<HTMLAnchorElement>, href: string) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    navPointerRef.current = {
      href,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleNavPointerUp = (event: PointerEvent<HTMLAnchorElement>, href: string) => {
    const initial = navPointerRef.current;
    navPointerRef.current = null;

    if (!initial || initial.href !== href || initial.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - initial.x, event.clientY - initial.y);
    if (moved > 14) return;

    event.preventDefault();
    router.push(href);
  };

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

  return (
    <div
      className="relative min-h-dvh bg-zinc-950 text-zinc-100"
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

      <main className={`relative mx-auto min-h-dvh w-full max-w-7xl px-4 safe-top sm:px-6 ${hideBottomNav ? 'pb-12' : 'pb-36'}`}>
        {children}
      </main>

      {!hideBottomNav && <WorkoutMiniBar />}

      {!hideBottomNav && (
        <nav className="app-bottom-nav pointer-events-auto fixed inset-x-0 bottom-0 z-[90] border-t border-zinc-800 bg-zinc-950/98 backdrop-blur-2xl touch-manipulation">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative mx-auto flex w-full max-w-2xl items-stretch justify-between px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  data-coach={item.coach}
                  data-nav-item={item.id}
                  onPointerDown={(event) => handleNavPointerDown(event, item.href)}
                  onPointerUp={(event) => handleNavPointerUp(event, item.href)}
                  onPointerCancel={() => {
                    navPointerRef.current = null;
                  }}
                  className={`group relative flex min-h-[4.25rem] min-w-0 flex-1 select-none flex-col items-center justify-center gap-1.5 rounded-xl px-1 transition-colors [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] active:bg-zinc-900/80 ${active
                    ? 'text-emerald-300'
                    : 'text-zinc-500'
                    }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-[2.1]'}`} />
                  <span className={`text-[10px] font-bold leading-none ${active ? 'tracking-[0.02em]' : ''}`}>
                    {item.label}
                  </span>
                  {active && (
                    <span className="pointer-events-none absolute top-0 h-0.5 w-7 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
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
