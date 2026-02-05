'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLongPress } from '@/app/lib/hooks/useLongPress';

interface HardyStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  label: string;
  onLabelClick?: () => void;
}

function decimalsForStep(step: number): number {
  const value = step.toString();
  if (!value.includes('.')) return 0;
  return value.split('.')[1]?.length ?? 0;
}

function roundToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  const decimals = decimalsForStep(step);
  return Number(snapped.toFixed(decimals));
}

function formatValue(value: number, step: number): string {
  const decimals = decimalsForStep(step);
  return value.toFixed(decimals);
}

export default function HardyStepper({
  value,
  onChange,
  step = 0.5,
  label,
  onLabelClick,
}: HardyStepperProps) {
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const applyDelta = useCallback(
    (delta: number) => {
      const next = Math.max(0, roundToStep(valueRef.current + delta, step));
      valueRef.current = next;
      onChange(next);
    },
    [onChange, step]
  );

  const increaseHandlers = useLongPress<HTMLButtonElement>(() => {
    applyDelta(step);
  });

  const decreaseHandlers = useLongPress<HTMLButtonElement>(() => {
    applyDelta(-step);
  });

  const centerClasses = 'hover:bg-white/5';

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-zinc-900/40 p-3 backdrop-blur-xl">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        {...decreaseHandlers}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            applyDelta(-step);
          }
        }}
        className="h-20 w-20 shrink-0 rounded-2xl border border-white/10 bg-zinc-950/70 text-zinc-100 active:scale-[0.97]"
      >
        <Minus className="mx-auto h-8 w-8" />
      </button>

      <button
        type="button"
        onClick={onLabelClick}
        disabled={!onLabelClick}
        className={`flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-5 text-center transition-colors ${centerClasses} ${
          onLabelClick ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div>
          <p className="text-4xl font-bold text-zinc-100">{formatValue(value, step)}</p>
          <p className="text-zinc-400 text-xs uppercase tracking-[0.18em]">{label}</p>
        </div>
      </button>

      <button
        type="button"
        aria-label={`Increase ${label}`}
        {...increaseHandlers}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            applyDelta(step);
          }
        }}
        className="h-20 w-20 shrink-0 rounded-2xl border border-white/10 bg-zinc-950/70 text-zinc-100 active:scale-[0.97]"
      >
        <Plus className="mx-auto h-8 w-8" />
      </button>
    </div>
  );
}
