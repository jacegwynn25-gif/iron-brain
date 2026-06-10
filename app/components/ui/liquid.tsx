'use client';

import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/app/lib/hooks/useBodyScrollLock';

type Variant = 'neutral' | 'elevated' | 'action' | 'danger';
type Density = 'compact' | 'default';
type Tone = 'neutral' | 'emerald' | 'amber' | 'rose' | 'cyan';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function densityClass(density: Density): string {
  return density === 'compact' ? 'p-3' : 'p-4 sm:p-5';
}

export function liquidButtonClass({
  variant = 'neutral',
  density = 'default',
  className,
}: {
  variant?: Variant;
  density?: Density;
  className?: string;
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-[1.05rem] tracking-normal transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
    density === 'compact' ? 'min-h-10 px-3 text-xs' : 'min-h-12 px-4 text-sm',
    variant === 'action' &&
      'liquid-action-button font-black italic tracking-tight text-zinc-950',
    variant === 'danger' &&
      'border border-rose-400/35 bg-rose-500/12 font-semibold text-rose-100 hover:bg-rose-500/18',
    variant === 'elevated' &&
      'border border-white/12 bg-white/[0.09] font-semibold text-zinc-100 shadow-[0_16px_50px_-35px_rgba(255,255,255,0.5)] hover:bg-white/[0.13]',
    variant === 'neutral' &&
      'border border-white/10 bg-white/[0.055] font-semibold text-zinc-200 hover:bg-white/[0.09] hover:text-white',
    className
  );
}

export function LiquidSurface({
  variant = 'neutral',
  density = 'default',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: Exclude<Variant, 'action' | 'danger'>;
  density?: Density;
}) {
  return (
    <div
      className={cn(
        variant === 'elevated' ? 'liquid-surface liquid-surface-elevated' : 'liquid-surface',
        densityClass(density),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function LiquidButton({
  variant = 'neutral',
  density = 'default',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  density?: Density;
}) {
  return (
    <button type="button" className={liquidButtonClass({ variant, density, className })} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  variant = 'neutral',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Variant;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-[0.96] disabled:opacity-50',
        variant === 'action'
          ? 'liquid-icon-button text-emerald-300 hover:text-emerald-200'
          : variant === 'danger'
            ? 'border border-rose-400/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/18'
          : variant === 'elevated'
              ? 'liquid-icon-button text-zinc-100 hover:text-white'
              : 'liquid-icon-button text-zinc-400 hover:text-zinc-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MetricChip({
  label,
  value,
  tone = 'neutral',
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[1rem] border px-3 py-2.5',
        tone === 'emerald'
          ? 'border-emerald-300/20 bg-emerald-400/[0.075] text-emerald-200'
          : tone === 'amber'
            ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100'
            : tone === 'rose'
              ? 'border-rose-300/25 bg-rose-300/[0.08] text-rose-100'
              : tone === 'cyan'
                ? 'border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100'
                : 'border-white/8 bg-white/[0.04] text-zinc-100',
        className
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-base font-black italic text-current">{value}</div>
    </div>
  );
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useBodyScrollLock(open, 'liquid-action-sheet', { hideBottomNav: false });

  useEffect(() => {
    if (!open) return;
    const previousSheetOpen = document.body.getAttribute('data-liquid-sheet-open');
    document.body.setAttribute('data-liquid-sheet-open', 'true');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousSheetOpen == null) {
        document.body.removeAttribute('data-liquid-sheet-open');
      } else {
        document.body.setAttribute('data-liquid-sheet-open', previousSheetOpen);
      }
    };
  }, [onOpenChange, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-start justify-end px-3 pb-3 pt-[calc(env(safe-area-inset-top)+4.9rem)] sm:px-6 sm:pb-6 sm:pt-6">
      <button
        type="button"
        aria-label="Dismiss menu"
        className="liquid-scrim absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="liquid-surface liquid-surface-elevated liquid-sheet-panel relative max-h-[70dvh] w-full max-w-[19.25rem] overflow-hidden rounded-[1.15rem] p-0 shadow-[0_32px_110px_-45px_rgba(0,0,0,1)]"
        style={{
          backdropFilter: 'blur(52px) saturate(1.24) contrast(1.05)',
          WebkitBackdropFilter: 'blur(52px) saturate(1.24) contrast(1.05)',
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-3.5 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-50">{title}</h2>
            {description && <p className="mt-0.5 text-xs leading-5 text-zinc-400">{description}</p>}
          </div>
          <IconButton label="Close menu" onClick={() => onOpenChange(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="max-h-[48dvh] overflow-y-auto px-3.5 py-3">{children}</div>
        {footer && <div className="border-t border-white/8 px-3.5 py-3">{footer}</div>}
      </section>
    </div>,
    document.body
  );
}
