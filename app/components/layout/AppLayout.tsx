'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Dumbbell,
  LayoutDashboard,
  History,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { restoreLeakedBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';
import WorkoutMiniBar from '@/app/components/workout/WorkoutMiniBar';
import { useActiveSessionOptional } from '@/app/providers/ActiveSessionProvider';

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
  { id: 'log', label: 'Log', href: '/start', icon: Dumbbell, coach: 'start-button' },
  { id: 'programs', label: 'Programs', href: '/programs', icon: BookOpen, coach: 'programs-tab' },
  { id: 'history', label: 'History', href: '/history', icon: History, coach: 'history-tab' },
  { id: 'analytics', label: 'Insights', href: '/analytics', icon: BarChart3 },
];

const commandItems = navItems.filter((item) => ['dashboard', 'log', 'programs'].includes(item.id));

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

function IronBrainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="6 12 52 36" aria-hidden="true" className={className}>
      <text
        x="13"
        y="33"
        fill="currentColor"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="22"
        fontStyle="italic"
        fontWeight="950"
        letterSpacing="-2.5"
      >
        IB
      </text>
      <rect x="17" y="40" width="30" height="3.5" rx="1" fill="currentColor" />
      <rect x="12" y="38.5" width="3" height="6.5" rx="1" fill="currentColor" />
      <rect x="49" y="38.5" width="3" height="6.5" rx="1" fill="currentColor" />
      <rect x="8" y="39.4" width="2.5" height="4.8" rx="1" fill="currentColor" />
      <rect x="53.5" y="39.4" width="2.5" height="4.8" rx="1" fill="currentColor" />
    </svg>
  );
}

function NavIcon({ item, className }: { item: NavItem; className?: string }) {
  if (item.id === 'dashboard') {
    return <IronBrainMark className={className} />;
  }
  const Icon = item.icon;
  return <Icon className={className} />;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const activeSession = useActiveSessionOptional();
  const hideBottomNavByRoute =
    pathname.startsWith('/workout') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/reset-auth');
  const [hideBottomNavByOverlay, setHideBottomNavByOverlay] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isRoutePending, startRouteTransition] = useTransition();
  const routeHistoryRef = useRef<string[]>([pathname]);
  const isBackNavRef = useRef(false);
  const navPointerRef = useRef<{
    href: string;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const morePointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const touchHandledHrefRef = useRef<string | null>(null);
  const touchHandledMoreRef = useRef(false);

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
  const hasActiveMiniBar =
    !hideBottomNav &&
    activeSession?.snapshot?.status === 'active' &&
    !pathname.startsWith('/workout/new') &&
    !pathname.startsWith('/workout/active') &&
    pathname !== '/workout/readiness' &&
    pathname !== '/workout/summary';

  const navigateTo = useCallback((href: string) => {
    if (href === pathname) return;
    setMoreOpen(false);
    setPendingHref(href);
    startRouteTransition(() => {
      router.push(href);
    });
  }, [pathname, router]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('resize', close);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

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

  const handleMorePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    morePointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleMorePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const initial = morePointerRef.current;
    morePointerRef.current = null;
    if (!initial || initial.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - initial.x, event.clientY - initial.y);
    if (moved > 14) return;

    event.preventDefault();
    touchHandledMoreRef.current = true;
    setMoreOpen((current) => !current);
  };

  const handleMoreClick = () => {
    if (touchHandledMoreRef.current) {
      touchHandledMoreRef.current = false;
      return;
    }
    setMoreOpen((current) => !current);
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
    : hasActiveMiniBar
      ? 'pb-[10.25rem] md:pb-12 md:pl-28'
    : isDashboardRoute
      ? 'pb-[5.1rem] md:pb-12 md:pl-28'
      : 'pb-24 md:pb-12 md:pl-28';
  const activeCommandRouteIndex = commandItems.findIndex((item) => isActivePath(pathname, item.href));
  const pendingCommandRouteIndex = pendingHref ? commandItems.findIndex((item) => item.href === pendingHref) : -1;
  const activeCommandIndex =
    moreOpen
      ? commandItems.length
      : pendingHref
        ? pendingCommandRouteIndex >= 0
          ? pendingCommandRouteIndex
          : commandItems.length
        : activeCommandRouteIndex >= 0
          ? activeCommandRouteIndex
          : commandItems.length;
  const activeDesktopRouteIndex = Math.max(0, navItems.findIndex((item) => isActivePath(pathname, item.href)));
  const pendingDesktopRouteIndex = pendingHref ? navItems.findIndex((item) => item.href === pendingHref) : -1;
  const activeDesktopIndex = pendingDesktopRouteIndex >= 0 ? pendingDesktopRouteIndex : activeDesktopRouteIndex;
  const commandDockStyle = {
    '--active-index': activeCommandIndex,
    '--item-count': commandItems.length + 1,
  } as CSSProperties;
  const desktopDockStyle = {
    '--active-index': activeDesktopIndex,
    '--item-count': navItems.length,
  } as CSSProperties;

  return (
      <div className="relative min-h-dvh bg-zinc-950 text-zinc-100">
        <div className="pointer-events-none fixed inset-0 -z-20 bg-zinc-950" />
        <div className="liquid-ambient pointer-events-none fixed inset-0 -z-20 opacity-90" />

      {(pendingHref || isRoutePending) && (
        <div className="fixed inset-x-0 top-0 z-[120] h-0.5 bg-emerald-500/15">
          <div className="h-full w-2/3 animate-pulse bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.62)]" />
        </div>
      )}

      <main className={`relative mx-auto box-border min-h-dvh w-full max-w-7xl px-4 safe-top sm:px-6 ${mainChromeClass}`}>
        {children}
      </main>

      {!hideBottomNav && <WorkoutMiniBar />}

      {!hideBottomNav && (
        <nav
          data-testid="app-bottom-nav"
          aria-label="Primary navigation"
          className="app-bottom-nav pointer-events-auto fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.25rem)] z-[90] mx-auto flex max-w-[19rem] justify-center touch-manipulation md:inset-x-auto md:bottom-auto md:left-6 md:top-1/2 md:block md:w-[4.9rem] md:-translate-y-1/2"
        >
          <div
            className="liquid-command-dock relative z-10 grid min-h-[4.15rem] w-full items-center justify-center rounded-full p-[0.32rem] md:hidden"
            style={commandDockStyle}
          >
            <span className="liquid-command-indicator" aria-hidden="true" />
            {commandItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const pending = pendingHref === item.href;
              const visibleLabel = item.id === 'dashboard' ? 'Today' : item.label;

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
                  className={`liquid-command-item [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] ${active
                    ? 'liquid-command-item-active'
                    : pending
                      ? 'text-emerald-200'
                      : 'text-zinc-300/68'
                    }`}
                >
                  <NavIcon item={item} className={`${item.id === 'dashboard' ? 'h-8 w-8' : 'h-5 w-5'} ${active || pending ? 'stroke-[2.35]' : 'stroke-[2]'}`} />
                  <span>{visibleLabel}</span>
                </Link>
              );
            })}

            <button
              type="button"
              aria-label="More routes"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              data-nav-item="more"
              className={`liquid-command-item liquid-command-more [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] ${moreOpen || activeCommandIndex === commandItems.length ? 'liquid-command-item-active' : 'text-zinc-300/68'}`}
              onPointerDown={handleMorePointerDown}
              onPointerUp={handleMorePointerUp}
              onPointerCancel={() => {
                morePointerRef.current = null;
              }}
              onClick={handleMoreClick}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          </div>

          {moreOpen && (
            <div className="md:hidden">
              <button
                type="button"
                aria-label="Dismiss routes"
                className="fixed inset-0 z-[-1] cursor-default bg-transparent"
                onClick={() => setMoreOpen(false)}
              />
              <div
                role="menu"
                aria-label="More routes"
                className="liquid-route-menu absolute bottom-[4.7rem] left-1/2 w-[min(18.25rem,calc(100vw-3rem))] -translate-x-1/2 rounded-[1.65rem] p-2"
              >
                {navItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const pending = pendingHref === item.href;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                      data-nav-item={`menu-${item.id}`}
                      onPointerDown={(event) => handleNavPointerDown(event, item.href)}
                      onPointerUp={(event) => handleNavPointerUp(event, item.href)}
                      onClick={(event) => handleNavClick(event, item.href)}
                      className={`liquid-route-menu-row ${active ? 'text-zinc-50' : pending ? 'text-emerald-200' : 'text-zinc-200'}`}
                    >
                      <span className="liquid-route-menu-icon">
                        <NavIcon item={item} className={`${item.id === 'dashboard' ? 'h-5 w-5' : 'h-[1.125rem] w-[1.125rem]'}`} />
                      </span>
                      <span>{item.label}</span>
                      {active && <span className="text-xs font-bold text-zinc-400">Current</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="liquid-nav-shell relative z-10 hidden w-full rounded-[1.875rem] md:block" style={desktopDockStyle}>
            <span className="liquid-nav-indicator" aria-hidden="true" />
            <div className="relative z-10 flex min-h-16 w-full items-stretch justify-between gap-0.5 p-1.5 md:min-h-0 md:flex-col md:gap-1 md:p-2">
            {navItems.map((item) => {
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
                    : 'text-zinc-300/70 hover:text-zinc-100'
                    }`}
                >
                  <NavIcon item={item} className={`${item.id === 'dashboard' ? 'h-6 w-6' : 'h-5 w-5'} ${active || pending ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                  <span className="sr-only text-[10px] font-bold leading-none tracking-normal sm:not-sr-only">
                    {item.label}
                  </span>
                  {pending && (
                    <span className="pointer-events-none absolute inset-x-3 bottom-1 h-px overflow-hidden rounded-full bg-emerald-500/20">
                      <span className="block h-full w-1/2 animate-pulse bg-emerald-500" />
                    </span>
                  )}
                </Link>
              );
            })}
            </div>
          </div>
        </nav>
      )}

    </div>
  );
}
