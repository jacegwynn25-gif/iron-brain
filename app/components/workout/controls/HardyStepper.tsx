'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLongPress } from '@/app/lib/hooks/useLongPress';

interface HardyStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  label: string;
  layout?: 'horizontal' | 'vertical';
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
  layout = 'horizontal',
  onLabelClick,
}: HardyStepperProps) {
  const isVertical = layout === 'vertical';
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

  const centerClasses = 'hover:opacity-90';
  const containerClasses = isVertical ? 'flex w-full flex-col gap-1.5' : 'flex w-full items-center gap-3';
  const buttonBaseClasses = 'bg-zinc-900/80 text-zinc-400 active:scale-[0.97] transition-colors';
  const horizontalButtonClasses = `h-14 w-14 shrink-0 rounded-full ${buttonBaseClasses}`;
  const verticalButtonClasses = `h-14 w-full rounded-full ${buttonBaseClasses}`;
  const valueButtonClasses = `text-center transition-colors ${centerClasses} ${
    onLabelClick ? 'cursor-pointer' : 'cursor-default'
  }`;

  return (
    <div className={containerClasses}>
      {isVertical ? (
        <>
          <button
            type="button"
            onClick={onLabelClick}
            disabled={!onLabelClick}
            className={`${valueButtonClasses} w-full py-1`}
          >
            <div>
              <p className="text-5xl font-black leading-none text-zinc-100 sm:text-6xl">{formatValue(value, step)}</p>
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">{label}</p>
            </div>
          </button>

          <div className="grid w-full grid-cols-2 gap-2">
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
              className={verticalButtonClasses}
            >
              <Minus className="mx-auto h-8 w-8" />
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
              className={verticalButtonClasses}
            >
              <Plus className="mx-auto h-8 w-8" />
            </button>
          </div>
        </>
      ) : (
        <>
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
            className={horizontalButtonClasses}
          >
            <Minus className="mx-auto h-8 w-8" />
          </button>

          <button
            type="button"
            onClick={onLabelClick}
            disabled={!onLabelClick}
            className={`${valueButtonClasses} flex flex-1 items-center justify-center px-4 py-2`}
          >
            <div>
              <p className="text-5xl font-black leading-none text-zinc-100 sm:text-6xl">{formatValue(value, step)}</p>
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">{label}</p>
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
            className={horizontalButtonClasses}
          >
            <Plus className="mx-auto h-8 w-8" />
          </button>
        </>
      )}
    </div>
  );
}
