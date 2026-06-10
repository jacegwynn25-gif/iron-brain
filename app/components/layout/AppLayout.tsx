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
import { useCallback, useEffect, useRef, useState, useTransition, type MouseEvent, type PointerEvent } from 'react';
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

const PREFETCH_ROUTES = [
  '/start',
  '/programs',
  '/history',
  '/analytics',
  '/profile',
  '/profile/settings',
] as const;

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
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/reset-auth');
  const [hideBottomNavByOverlay, setHideBottomNavByOverlay] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isRoutePending, startRouteTransition] = useTransition();
  const routeHistoryRef = useRef<string[]>([pathname]);
  const isBackNavRef = useRef(false);
  const navPointerRef = useRef<{
    href: string;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const touchHandledHrefRef = useRef<string | null>(null);

  useEffect(() => {
    PREFETCH_ROUTES.forEach((href) => {
      try {
        router.prefetch(href);
      } catch {
        // Prefetch is opportunistic; navigation still works if the browser drops it.
      }
    });
  }, [router]);

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
    setPendingHref(null);

    if (!pathname.startsWith('/workout')) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
  }, [pathname]);

  const hideBottomNav = hideBottomNavByRoute || hideBottomNavByOverlay;

  const navigateTo = useCallback((href: string) => {
    if (href === pathname) return;
    setPendingHref(href);
    startRouteTransition(() => {
      router.push(href);
    });
  }, [pathname, router]);

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
    touchHandledHrefRef.current = href;
    navigateTo(href);
  };

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (touchHandledHrefRef.current === href) {
      touchHandledHrefRef.current = null;
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    navigateTo(href);
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

  const isDashboardRoute = pathname === '/';
  const mainChromeClass = hideBottomNav
    ? 'pb-12 md:pl-6'
    : isDashboardRoute
      ? 'pb-[5.55rem] md:pb-12 md:pl-28'
      : 'pb-24 md:pb-12 md:pl-28';

  return (
    <div className="relative min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-zinc-950" />
      <div className="liquid-ambient pointer-events-none fixed inset-0 -z-20 opacity-90" />
      <div className="liquid-grid pointer-events-none fixed inset-0 -z-20 opacity-55" />

      {(pendingHref || isRoutePending) && (
        <div className="fixed inset-x-0 top-0 z-[120] h-0.5 bg-emerald-400/15">
          <div className="h-full w-2/3 animate-pulse bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
        </div>
      )}

      <main className={`relative mx-auto box-border min-h-dvh w-full max-w-7xl px-4 safe-top sm:px-6 ${mainChromeClass}`}>
        {children}
      </main>

      {!hideBottomNav && <WorkoutMiniBar />}

      {!hideBottomNav && (
        <nav
          data-testid="app-bottom-nav"
          className="app-bottom-nav liquid-nav-shell pointer-events-auto fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] z-[90] mx-auto max-w-[28rem] rounded-[1.875rem] touch-manipulation md:inset-x-auto md:bottom-auto md:left-6 md:top-1/2 md:w-[4.9rem] md:-translate-y-1/2"
          style={{
            backdropFilter: 'blur(30px) saturate(1.16) contrast(1.03)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.16) contrast(1.03)',
          }}
        >
          <div className="relative z-10 flex min-h-16 w-full items-stretch justify-between gap-0.5 p-1.5 md:min-h-0 md:flex-col md:gap-1 md:p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              const pending = pendingHref === item.href;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  data-coach={item.coach}
                  data-nav-item={item.id}
                  data-pending={pending ? 'true' : undefined}
                  onPointerDown={(event) => handleNavPointerDown(event, item.href)}
                  onPointerUp={(event) => handleNavPointerUp(event, item.href)}
                  onClick={(event) => handleNavClick(event, item.href)}
                  onPointerCancel={() => {
                    navPointerRef.current = null;
                  }}
                  className={`liquid-nav-item group flex min-h-14 min-w-0 flex-1 select-none items-center justify-center rounded-[1.5rem] px-1 transition-all [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] active:scale-[0.97] sm:flex-col sm:gap-1 md:min-h-[4.1rem] md:flex-none ${active
                    ? 'liquid-nav-item-active'
                    : pending
                      ? 'text-emerald-200'
                    : 'text-zinc-300/70 hover:bg-white/[0.055] hover:text-zinc-100'
                    }`}
                >
                  <Icon className={`h-5 w-5 ${active || pending ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                  <span className="sr-only text-[10px] font-bold leading-none tracking-normal sm:not-sr-only">
                    {item.label}
                  </span>
                  {pending && (
                    <span className="pointer-events-none absolute inset-x-3 bottom-1 h-px overflow-hidden rounded-full bg-emerald-300/20">
                      <span className="block h-full w-1/2 animate-pulse bg-emerald-300" />
                    </span>
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
