'use client';

import { Zap, X } from 'lucide-react';
import { useBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';

interface QuickLogConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function QuickLogConfirm({ isOpen, onClose, onConfirm }: QuickLogConfirmProps) {
  useBodyScrollLock(isOpen, 'quick-log-confirm');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/90 px-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-md sm:items-center sm:p-4"
      data-testid="quick-log-confirm"
    >
      <button
        type="button"
        aria-label="Close freestyle confirmation"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="liquid-primary-card relative w-full max-w-sm overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="iron-label text-emerald-300">
              Freestyle
            </p>
            <h2 className="iron-display mt-1 text-2xl leading-none text-white">
              Start empty session?
            </h2>
            <p className="mt-2 text-sm leading-snug text-zinc-400">
              Use this when you want a blank workout and will add movements yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 border-t border-white/8 bg-black/10 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="quick-log-confirm-start"
            className="liquid-action-button flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black italic tracking-tight text-zinc-950 active:bg-emerald-500"
          >
            <Zap className="h-4 w-4" strokeWidth={3} />
            Start freestyle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-xs font-semibold text-zinc-400 active:bg-white/[0.08]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
