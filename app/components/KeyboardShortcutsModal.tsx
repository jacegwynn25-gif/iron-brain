'use client';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800"
            >
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {shortcut.description}
              </span>
              <kbd className="rounded border border-zinc-300 bg-white px-3 py-1 font-mono text-sm font-semibold text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
          Shortcuts don&apos;t work while typing in input fields
        </p>
      </div>
    </div>
  );
}
