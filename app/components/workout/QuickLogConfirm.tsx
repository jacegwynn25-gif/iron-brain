'use client';

import { Zap, X } from 'lucide-react';
import { useBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';
import { liquidButtonClass } from '@/app/components/ui/liquid';

interface QuickLogConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function QuickLogConfirm({ isOpen, onClose, onConfirm }: QuickLogConfirmProps) {
  useBodyScrollLock(isOpen, 'quick-log-confirm', { hideBottomNav: false });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center bg-black/35 px-3 pt-[calc(env(safe-area-inset-top)+5.15rem)] sm:p-4 sm:pt-[calc(env(safe-area-inset-top)+6rem)]"
      data-testid="quick-log-confirm"
    >
      <button
        type="button"
        aria-label="Close freestyle confirmation"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="liquid-sheet-panel relative w-full max-w-xs overflow-hidden rounded-[1.2rem] p-0">
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Freestyle
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 border-t border-white/8 p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="quick-log-confirm-start"
            className={liquidButtonClass({
              variant: 'action',
              density: 'compact',
              className: 'min-h-11 w-full rounded-xl',
            })}
          >
            <Zap className="h-4 w-4" strokeWidth={3} />
            Start freestyle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-xs font-semibold text-zinc-400 active:bg-white/[0.08]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
