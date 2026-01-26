'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

interface QuickPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  placeholder?: string;
  unit?: string;
  min?: number;
}

type HoldConfig = {
  startDelay?: number;
  startInterval?: number;
  minInterval?: number;
  accelFactor?: number;
  accelerate?: boolean;
};

function useHoldRepeat(action: () => void, config?: HoldConfig) {
  const holdTimeoutRef = useRef<number | null>(null);
  const repeatTimeoutRef = useRef<number | null>(null);
  const intervalRef = useRef(config?.startInterval ?? 160);
  const pressedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (holdTimeoutRef.current !== null) window.clearTimeout(holdTimeoutRef.current);
    if (repeatTimeoutRef.current !== null)
      window.clearTimeout(repeatTimeoutRef.current);
    holdTimeoutRef.current = null;
    repeatTimeoutRef.current = null;
  }, []);

  const stop = useCallback(() => {
    pressedRef.current = false;
    clearTimers();
  }, [clearTimers]);

  const startRepeating = () => {
    const accelerate = config?.accelerate !== false;
    const accelFactor = config?.accelFactor ?? 0.92;
    const minInterval = config?.minInterval ?? 55;
    const baseInterval = config?.startInterval ?? 160;

    const tick = () => {
      if (!pressedRef.current) return;
      action();

      if (accelerate) {
        intervalRef.current = Math.max(minInterval, intervalRef.current * accelFactor);
      } else {
        intervalRef.current = baseInterval;
      }

      repeatTimeoutRef.current = window.setTimeout(
        tick,
        accelerate ? intervalRef.current : baseInterval
      );
    };

    intervalRef.current = baseInterval;
    tick();
  };

  useEffect(() => {
    const stopAll = () => stop();
    window.addEventListener('pointerup', stopAll);
    window.addEventListener('pointercancel', stopAll);
    window.addEventListener('blur', stopAll);
    return () => {
      window.removeEventListener('pointerup', stopAll);
      window.removeEventListener('pointercancel', stopAll);
      window.removeEventListener('blur', stopAll);
      clearTimers();
    };
  }, [clearTimers, stop]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (pressedRef.current) return;
      pressedRef.current = true;
      suppressClickRef.current = false;
      intervalRef.current = config?.startInterval ?? 160;

      holdTimeoutRef.current = window.setTimeout(() => {
        if (!pressedRef.current) return;
        suppressClickRef.current = true;
        startRepeating();
      }, config?.startDelay ?? 280);
    },
    onPointerUp: stop,
    onPointerLeave: () => {},
    onPointerCancel: stop,
    suppressClickRef,
    resetSuppressClick: () => {
      suppressClickRef.current = false;
    },
  };
}

/**
 * Ultra-simplified picker - just input and 3 smart buttons
 * Zero scrolling, maximum speed
 */
export default function QuickPicker({
  label,
  value,
  onChange,
  step = 1,
  placeholder,
  unit,
  min = 0,
}: QuickPickerProps) {
  const valueRef = useRef<string>(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const precision = useMemo(() => {
    const parts = step.toString().split('.');
    return parts[1]?.length || 0;
  }, [step]);

  const formatValue = (val: number) => val.toFixed(precision);

  const incrementValue = (amount: number) => {
    const current = parseFloat(valueRef.current) || 0;
    const nextRaw = current + amount;
    const rounded = Math.round(nextRaw / step) * step;
    const clamped = Math.max(min, rounded);
    const nextStr = formatValue(clamped);
    valueRef.current = nextStr;
    onChange(nextStr);
  };

  const sanitizeInput = () => {
    const num = parseFloat(valueRef.current);
    if (isNaN(num)) {
      valueRef.current = '';
      onChange('');
      return;
    }
    const rounded = Math.round(num / step) * step;
    const clamped = Math.max(min, rounded);
    const formatted = formatValue(clamped);
    valueRef.current = formatted;
    onChange(formatted);
  };

  const control = label.toLowerCase().includes('weight') ? 'weight' : 'reps';
  const isWeight = control === 'weight';

  const holdConfig: HoldConfig = isWeight
    ? { startInterval: 160, minInterval: 55, accelFactor: 0.92, accelerate: true }
    : { startInterval: 140, accelerate: false };

  const incHandlers = useHoldRepeat(() => incrementValue(step), holdConfig);
  const decHandlers = useHoldRepeat(() => incrementValue(-step), holdConfig);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const logEvent = (_btn: 'plus' | 'minus', _type: string) => {
    // Debug logging removed for production
  };

  const addLogs = (
    base: ReturnType<typeof useHoldRepeat>,
    btn: 'plus' | 'minus'
  ) => ({
    onPointerDown: (e: React.PointerEvent) => {
      logEvent(btn, 'pointerdown');
      base.onPointerDown(e);
    },
    onPointerUp: () => {
      logEvent(btn, 'pointerup');
      base.onPointerUp();
    },
    onPointerLeave: () => {
      logEvent(btn, 'pointerleave');
      base.onPointerLeave();
    },
    onPointerCancel: () => {
      logEvent(btn, 'pointercancel');
      base.onPointerCancel();
    },
  });

  const plusHandlers = addLogs(incHandlers, 'plus');
  const minusHandlers = addLogs(decHandlers, 'minus');

  return (
    <div className="select-none">
      <label className="mb-2 flex flex-col items-center text-base font-black uppercase tracking-wide text-purple-700 dark:text-purple-200">
        <span>{label}</span>
      </label>

      {/* Input with inline buttons (minus left, value center, plus right) */}
      <div className="grid w-full grid-cols-[44px_1fr_44px] sm:grid-cols-[48px_1fr_48px] items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-1.5 py-1.5 shadow-sm overflow-visible dark:border-zinc-800 dark:bg-zinc-900/70 sm:px-2 sm:py-2">
        {/* Decrement on left */}
        <button
          type="button"
          {...minusHandlers}
          onClick={() => {
            logEvent('minus', 'click');
            if (decHandlers.suppressClickRef.current) {
              decHandlers.resetSuppressClick();
              return;
            }
            incrementValue(-step);
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white p-0 text-lg font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 select-none touch-none dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 sm:h-12 sm:w-12 sm:text-xl"
          aria-label={`Decrease ${label}`}
          style={{
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            touchAction: 'manipulation',
            pointerEvents: 'auto',
          }}
        >
          <span className="pointer-events-none select-none">-</span>
        </button>

        {/* Main Input */}
        <div className="min-w-0 w-full flex flex-col items-center justify-center px-1 sm:px-2">
          <div className="flex items-center justify-center gap-2 min-w-0 w-full flex-1">
            <input
              type="number"
              value={value}
              onChange={(e) => {
                valueRef.current = e.target.value;
                onChange(e.target.value);
              }}
              onBlur={sanitizeInput}
              placeholder={placeholder}
              step={step}
              className="w-full min-w-0 flex-1 border-none bg-transparent text-center text-2xl leading-none font-black tabular-nums text-zinc-900 select-text focus:outline-none focus:ring-0 dark:text-zinc-50 sm:text-3xl"
            />
            {unit && (
              <span className="hidden sm:inline text-sm font-bold text-zinc-500 dark:text-zinc-300">
                {unit}
              </span>
            )}
          </div>
          {unit && (
            <span className="mt-0.5 text-[11px] font-bold leading-none text-zinc-500 dark:text-zinc-300 sm:hidden">
              {unit}
            </span>
          )}
        </div>

        {/* Increment on right */}
        <button
          type="button"
          {...plusHandlers}
          onClick={() => {
            logEvent('plus', 'click');
            if (incHandlers.suppressClickRef.current) {
              incHandlers.resetSuppressClick();
              return;
            }
            incrementValue(step);
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white p-0 text-lg font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 select-none touch-none dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 sm:h-12 sm:w-12 sm:text-xl"
          aria-label={`Increase ${label}`}
          style={{
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            touchAction: 'manipulation',
            pointerEvents: 'auto',
          }}
        >
          <span className="pointer-events-none select-none">+</span>
        </button>
      </div>
    </div>
  );
}
