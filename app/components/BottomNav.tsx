'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, Plus, BarChart3, User } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'programs', label: 'Programs', icon: BookOpen, path: '/programs' },
  { id: 'start', label: 'Start', icon: Plus, path: '/start', isCenter: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      if (typeof window === 'undefined') return;
      const hidden = localStorage.getItem('iron_brain_hide_bottom_nav') === 'true';
      setIsHidden(hidden);
    };
    handleVisibility();
    window.addEventListener('storage', handleVisibility);
    window.addEventListener('iron_brain_nav_visibility', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleVisibility);
      window.removeEventListener('iron_brain_nav_visibility', handleVisibility);
    };
  }, []);

  // Don't show nav during active workout
  if (pathname?.includes('/workout/active') || isHidden) {
    return null;
  }

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path ||
            (item.path !== '/' && pathname?.startsWith(item.path));

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                data-coach="start-button"
                onClick={() => handleNavigation(item.path)}
                className="flex flex-col items-center justify-center -mt-6 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg shadow-purple-500/30 transition-transform active:scale-[0.98]">
                  <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          const coachAttr =
            item.id === 'programs' ? 'programs-tab' :
            item.id === 'analytics' ? 'analytics-tab' :
            undefined;

          return (
            <button
              key={item.id}
              data-coach={coachAttr}
              onClick={() => handleNavigation(item.path)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all active:scale-[0.98] ${
                isActive
                  ? 'text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon
                className={`w-6 h-6 transition-all ${
                  isActive ? 'scale-110' : ''
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] mt-1 font-medium ${
                isActive ? 'text-purple-400' : 'text-gray-500'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
