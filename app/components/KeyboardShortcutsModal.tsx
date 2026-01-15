'use client';

import { X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'N', description: 'Start new workout' },
    { key: 'P', description: 'Open programs' },
    { key: 'H', description: 'View history' },
    { key: 'A', description: 'View analytics' },
    { key: 'U', description: 'Open utilities' },
    { key: 'D', description: 'Data management' },
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: 'ESC', description: 'Close modals' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white/5 backdrop-blur-xl p-6 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/10"
            >
              <span className="text-sm text-gray-300">
                {shortcut.description}
              </span>
              <kbd className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 font-mono text-sm font-semibold text-white">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Shortcuts don&apos;t work while typing in input fields
        </p>
      </div>
    </div>
  );
}
