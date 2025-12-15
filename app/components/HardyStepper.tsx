'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import NumericKeypad from './NumericKeypad';

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
    if (repeatTimeoutRef.current !== null) window.clearTimeout(repeatTimeoutRef.current);
    holdTimeoutRef.current = null;
    repeatTimeoutRef.current = null;
  }, []);

  const stop = useCallback(() => {
    pressedRef.current = false;
    clearTimers();
  }, [clearTimers]);

  const startRepeating = useCallback(() => {
    const accel = config?.accelerate !== false;
    const accelFactor = config?.accelFactor ?? 0.92;
    const minInterval = config?.minInterval ?? 55;
    const baseInterval = config?.startInterval ?? 160;

    const tick = () => {
      if (!pressedRef.current) return;
      action();
      if (accel) {
        intervalRef.current = Math.max(minInterval, intervalRef.current * accelFactor);
      }
      repeatTimeoutRef.current = window.setTimeout(tick, intervalRef.current);
    };

    intervalRef.current = baseInterval;
    tick();
  }, [action, config?.accelerate, config?.accelFactor, config?.minInterval, config?.startInterval]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
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
    [config?.startDelay, config?.startInterval, startRepeating]
  );

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
    handlePointerDown,
    handlePointerUp: stop,
    handlePointerCancel: stop,
    getSuppressClick: () => suppressClickRef.current,
    resetSuppressClick: () => {
      suppressClickRef.current = false;
    },
  };
}

interface HardyStepperProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onSanitize?: () => void;
  inputMode?: 'decimal' | 'numeric';
  displayUnit?: string;
  accelerate?: boolean;
}

export default function HardyStepper({
  label,
  value,
  onChange,
  onIncrement,
  onDecrement,
  onSanitize,
  inputMode = 'decimal',
  displayUnit,
  accelerate = true,
}: HardyStepperProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [editingValue, setEditingValue] = useState(value);

  const holdConfig: HoldConfig = accelerate
    ? { startInterval: 160, minInterval: 55, accelFactor: 0.92, accelerate: true }
    : { startInterval: 140, accelerate: false };

  const incHold = useHoldRepeat(onIncrement, holdConfig);
  const decHold = useHoldRepeat(onDecrement, holdConfig);

  useEffect(() => {
    if (!isEditing) {
      setEditingValue(value);
    }
  }, [value, isEditing]);

  const enterEditMode = () => {
    setEditingValue(value);
    setIsEditing(true);
    setShowKeypad(true);
  };

  const exitEditMode = () => {
    setIsEditing(false);
    setShowKeypad(false);
    onSanitize?.();
    onChange(editingValue);
  };

  const handleDecClick = () => {
    if (decHold.getSuppressClick()) {
      decHold.resetSuppressClick();
      return;
    }
    onDecrement();
  };

  const handleIncClick = () => {
    if (incHold.getSuppressClick()) {
      incHold.resetSuppressClick();
      return;
    }
    onIncrement();
  };

  const displayValue = value || '0';
  const editingDisplay = editingValue || '0';
  const allowDecimal = inputMode !== 'numeric';

  return (
    <div className="flex flex-col gap-1">
      <span className="text-center text-[11px] font-black uppercase tracking-[0.08em] text-purple-700 dark:text-purple-200">
        {label}
      </span>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="grid grid-cols-[40px_1fr_40px] divide-x divide-zinc-200 dark:divide-zinc-700">
          <button
            type="button"
            onPointerDown={decHold.handlePointerDown}
            onPointerUp={decHold.handlePointerUp}
            onPointerCancel={decHold.handlePointerCancel}
            onClick={handleDecClick}
            onContextMenu={(e) => e.preventDefault()}
            className="flex h-11 items-center justify-center bg-zinc-50 text-xl font-black text-zinc-700 transition-colors active:bg-zinc-200 select-none dark:bg-zinc-900 dark:text-zinc-200 dark:active:bg-zinc-700"
            aria-label={`Decrease ${label}`}
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              touchAction: 'manipulation',
            }}
          >
            <span className="pointer-events-none">−</span>
          </button>

          <div
            onClick={!isEditing ? enterEditMode : undefined}
            className={`flex min-w-0 h-11 items-center justify-center bg-white cursor-text dark:bg-zinc-950 ${
              isEditing ? 'ring-2 ring-purple-500/60' : ''
            }`}
          >
            {isEditing ? (
              <div className="flex w-full items-baseline justify-center gap-1 px-1">
                <span className="w-full min-w-0 bg-transparent text-center text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-xl">
                  {editingDisplay}
                </span>
                {displayUnit && (
                  <span className="flex-shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm">
                    {displayUnit}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-baseline justify-center gap-1 px-1 overflow-hidden">
                <span className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-xl">
                  {displayValue}
                </span>
                {displayUnit && (
                  <span className="flex-shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm">
                    {displayUnit}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onPointerDown={incHold.handlePointerDown}
            onPointerUp={incHold.handlePointerUp}
            onPointerCancel={incHold.handlePointerCancel}
            onClick={handleIncClick}
            onContextMenu={(e) => e.preventDefault()}
            className="flex h-11 items-center justify-center bg-zinc-50 text-xl font-black text-zinc-700 transition-colors active:bg-zinc-200 select-none dark:bg-zinc-900 dark:text-zinc-200 dark:active:bg-zinc-700"
            aria-label={`Increase ${label}`}
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              touchAction: 'manipulation',
            }}
          >
            <span className="pointer-events-none">+</span>
          </button>
        </div>
      </div>
      {showKeypad && (
        <NumericKeypad
          value={editingValue}
          onChange={setEditingValue}
          onClose={exitEditMode}
          allowDecimal={allowDecimal}
        />
      )}
    </div>
  );
}
