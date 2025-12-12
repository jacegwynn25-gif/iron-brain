'use client';

import { useEffect, useMemo, useRef } from 'react';

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
  acceleration?: number;
};

function useAcceleratingHold(action: () => void, config?: HoldConfig) {
  const holdDelayRef = useRef<NodeJS.Timeout | null>(null);
  const repeatRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<number>(config?.startInterval ?? 150); // ~6-7/s start

  const clearTimers = () => {
    if (holdDelayRef.current) clearTimeout(holdDelayRef.current);
    if (repeatRef.current) clearTimeout(repeatRef.current);
    holdDelayRef.current = null;
    repeatRef.current = null;
  };

  useEffect(() => clearTimers, []);

  const startRepeating = () => {
    intervalRef.current = config?.startInterval ?? 150;
    const tick = () => {
      action();
      intervalRef.current = Math.max(
        config?.minInterval ?? 60, // cap ~16/s
        intervalRef.current * (config?.acceleration ?? 0.9)
      );
      repeatRef.current = setTimeout(tick, intervalRef.current);
    };
    repeatRef.current = setTimeout(tick, intervalRef.current);
  };

  const handlePointerDown = () => {
    action(); // initial step
    holdDelayRef.current = setTimeout(startRepeating, config?.startDelay ?? 320);
  };

  const stop = () => {
    clearTimers();
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
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
  const precision = useMemo(() => {
    const parts = step.toString().split('.');
    return parts[1]?.length || 0;
  }, [step]);

  const formatValue = (val: number) => val.toFixed(precision);

  const incrementValue = (amount: number) => {
    const current = parseFloat(value) || 0;
    const nextRaw = current + amount;
    const rounded = Math.round(nextRaw / step) * step;
    const clamped = Math.max(min, rounded);
    onChange(formatValue(clamped));
  };

  const sanitizeInput = () => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      onChange('');
      return;
    }
    const rounded = Math.round(num / step) * step;
    const clamped = Math.max(min, rounded);
    onChange(formatValue(clamped));
  };

  const incHandlers = useAcceleratingHold(() => incrementValue(step));
  const decHandlers = useAcceleratingHold(() => incrementValue(-step));

  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        <span>{label}</span>
        {unit && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {unit}
          </span>
        )}
      </label>

      {/* Input with inline buttons (plus left, minus right) */}
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        {/* Increment on left */}
        <button
          type="button"
          {...incHandlers}
          className="h-11 w-11 flex-shrink-0 rounded-xl bg-white text-base font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          aria-label={`Increase ${label}`}
        >
          +{step}
        </button>

        {/* Main Input */}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={sanitizeInput}
          placeholder={placeholder}
          step={step}
          className="flex-1 border-none bg-transparent text-center text-3xl font-black text-zinc-900 focus:outline-none focus:ring-0 dark:text-zinc-50"
        />

        {/* Decrement on right */}
        <button
          type="button"
          {...decHandlers}
          className="h-11 w-11 flex-shrink-0 rounded-xl bg-white text-base font-black text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          aria-label={`Decrease ${label}`}
        >
          -{step}
        </button>
      </div>
    </div>
  );
}
