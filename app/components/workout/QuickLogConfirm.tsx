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
        aria-label="Close quick log confirmation"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-zinc-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-emerald-300">
              Quick Log
            </p>
            <h2 className="mt-1 text-2xl font-black italic leading-none tracking-tight text-white">
              START EMPTY SESSION?
            </h2>
            <p className="mt-2 text-sm leading-snug text-zinc-400">
              Use this when you want a blank workout and will add movements yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 border-t border-zinc-900 bg-zinc-900/35 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="quick-log-confirm-start"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-950 active:bg-emerald-500"
          >
            <Zap className="h-4 w-4" strokeWidth={3} />
            Start Quick Log
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-400 active:bg-zinc-900"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
