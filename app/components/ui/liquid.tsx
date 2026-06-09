'use client';

import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
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
    'inline-flex items-center justify-center gap-2 rounded-[1.05rem] font-medium tracking-normal transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
    density === 'compact' ? 'min-h-10 px-3 text-xs' : 'min-h-12 px-4 text-sm',
    variant === 'action' &&
      'liquid-action-button',
    variant === 'danger' &&
      'border border-rose-400/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/18',
    variant === 'elevated' &&
      'border border-white/12 bg-white/[0.09] text-zinc-100 shadow-[0_16px_50px_-35px_rgba(255,255,255,0.5)] hover:bg-white/[0.13]',
    variant === 'neutral' &&
      'border border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09] hover:text-white',
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
          ? 'border border-[rgba(119,224,169,0.38)] bg-[rgba(67,201,135,0.12)] text-[rgb(137,226,178)] hover:bg-[rgba(67,201,135,0.18)]'
          : variant === 'danger'
            ? 'border border-rose-400/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/18'
            : variant === 'elevated'
              ? 'border border-white/12 bg-white/[0.08] text-zinc-100 hover:bg-white/[0.12]'
              : 'border border-white/10 bg-white/[0.045] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100',
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
          ? 'border-[rgba(119,224,169,0.22)] bg-[rgba(67,201,135,0.075)] text-[rgb(155,230,190)]'
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
      <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-base font-medium text-current">{value}</div>
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
  useBodyScrollLock(open, 'liquid-action-sheet');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Dismiss details"
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="liquid-surface liquid-surface-elevated relative max-h-[82dvh] w-full max-w-lg overflow-hidden rounded-[1.55rem] p-0 shadow-[0_32px_110px_-45px_rgba(0,0,0,1)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-medium tracking-tight text-zinc-50">{title}</h2>
            {description && <p className="mt-1 text-sm leading-5 text-zinc-400">{description}</p>}
          </div>
          <IconButton label="Close details" onClick={() => onOpenChange(false)} className="h-9 w-9">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="max-h-[58dvh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/8 px-5 py-4">{footer}</div>}
      </section>
    </div>
  );
}
