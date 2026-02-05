import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

interface LongPressOptions {
  holdDelayMs?: number;
  repeatDelayMs?: number;
  accelerationAfterMs?: number;
  acceleratedRepeatMs?: number;
}

interface LongPressHandlers<T extends HTMLElement> {
  onMouseDown: (event: MouseEvent<T>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (event: TouchEvent<T>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onContextMenu: (event: MouseEvent<T>) => void;
}

export function useLongPress<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  options: LongPressOptions = {}
): LongPressHandlers<T> {
  const {
    holdDelayMs = 300,
    repeatDelayMs = 100,
    accelerationAfterMs = 2000,
    acceleratedRepeatMs = 50,
  } = options;

  const isPressingRef = useRef(false);
  const pressStartRef = useRef(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    isPressingRef.current = false;
    clearTimers();
  }, [clearTimers]);

  const start = useCallback(() => {
    if (isPressingRef.current) return;

    isPressingRef.current = true;
    pressStartRef.current = Date.now();

    callback();

    const runRepeater = () => {
      if (!isPressingRef.current) return;

      callback();

      const elapsed = Date.now() - pressStartRef.current;
      const nextDelay = elapsed >= accelerationAfterMs ? acceleratedRepeatMs : repeatDelayMs;

      repeatTimeoutRef.current = setTimeout(runRepeater, nextDelay);
    };

    holdTimeoutRef.current = setTimeout(() => {
      runRepeater();
    }, holdDelayMs);
  }, [accelerationAfterMs, acceleratedRepeatMs, callback, holdDelayMs, repeatDelayMs]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    onMouseDown: () => start(),
    onMouseUp: () => stop(),
    onMouseLeave: () => stop(),
    onTouchStart: (event) => {
      event.preventDefault();
      start();
    },
    onTouchEnd: () => stop(),
    onTouchCancel: () => stop(),
    onContextMenu: (event) => {
      event.preventDefault();
    },
  };
}
