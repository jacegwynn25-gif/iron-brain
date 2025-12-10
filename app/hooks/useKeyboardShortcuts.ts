'use client';

import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const matchingShortcut = shortcuts.find(
        (shortcut) =>
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          (shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey) &&
          (shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey) &&
          (shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey)
      );

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export const KEYBOARD_SHORTCUTS = {
  NEW_WORKOUT: { key: 'n', description: 'Start new workout' },
  PROGRAMS: { key: 'p', description: 'Open programs' },
  HISTORY: { key: 'h', description: 'View history' },
  ANALYTICS: { key: 'a', description: 'View analytics' },
  UTILITIES: { key: 'u', description: 'Open utilities' },
  DATA: { key: 'd', description: 'Data management' },
  HELP: { key: '?', shiftKey: true, description: 'Show keyboard shortcuts' },
  ESCAPE: { key: 'Escape', description: 'Close modals' },
};
