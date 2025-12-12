'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react';

interface RestTimerProps {
  isActive: boolean;
  duration: number; // seconds
  onComplete?: () => void;
  onSkip?: () => void;
  nextSetInfo?: {
    exerciseName: string;
    setNumber: number;
    totalSets: number;
    prescribedReps: string | number;
    targetRPE?: number;
    targetRIR?: number;
    lastWeight?: number;
    lastReps?: number;
  };
}

export default function RestTimer({ isActive, duration, onComplete, onSkip, nextSetInfo }: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const remainingRef = useRef<number>(duration);
  const pausedRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  useEffect(() => {
    remainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const playCompletionSound = () => {
    // Create a simple beep using Web Audio API
    try {
      const AudioCtx = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      const audioContext = new AudioCtx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      console.log('Audio not supported');
    }
  };

  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endTimeRef.current = null;
    completedRef.current = false;
  };

  // Countdown logic based on end timestamp
  useEffect(() => {
    if (!isActive) {
      clearTimer();
      setTimeRemaining(duration);
      setIsPaused(false);
      return;
    }

    endTimeRef.current = Date.now() + duration * 1000;
    completedRef.current = false;
    setIsPaused(false);
    pausedRef.current = false;

    const tick = () => {
      if (!endTimeRef.current) return;
      if (pausedRef.current) return;
      const msLeft = endTimeRef.current - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      setTimeRemaining(secLeft);
      if (secLeft === 0 && !completedRef.current) {
        completedRef.current = true;
        clearTimer();
        onCompleteRef.current?.();
        playCompletionSound();
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 250);

    return () => clearTimer();
  }, [isActive, duration]);

  const handleSkip = () => {
    clearTimer();
    setTimeRemaining(0);
    onSkipRef.current?.();
  };

  const handleAddTime = (seconds: number) => {
    if (endTimeRef.current && !pausedRef.current) {
      endTimeRef.current += seconds * 1000;
    }
    setTimeRemaining(prev => {
      const next = prev + seconds;
      remainingRef.current = next;
      return next;
    });
  };

  const togglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      if (!next) {
        const secsLeft = remainingRef.current;
        endTimeRef.current = Date.now() + secsLeft * 1000;
      }
      return next;
    });
  };

  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = ((duration - timeRemaining) / duration) * 100;

  const isAlmostDone = timeRemaining <= 10;
  const isComplete = timeRemaining === 0;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className={`w-[400px] max-w-[90vw] rounded-2xl border-2 shadow-2xl transition-all ${
        isComplete
          ? 'border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/30'
          : isAlmostDone
            ? 'border-orange-500 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/30'
            : 'border-blue-500 bg-white dark:border-blue-600 dark:bg-zinc-900'
      }`}>
        <div className="p-6">
          {/* Timer Display */}
          <div className="text-center">
            <div className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {isComplete ? 'Rest Complete!' : 'Rest Timer'}
            </div>
            <div className={`text-6xl font-bold tabular-nums ${
              isComplete
                ? 'text-green-600 dark:text-green-400'
                : isAlmostDone
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-blue-600 dark:text-blue-400'
            }`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>

            {/* Progress Bar */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`h-full transition-all duration-1000 ${
                  isComplete
                    ? 'bg-green-500'
                    : isAlmostDone
                      ? 'bg-orange-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Next Set Preview */}
          {nextSetInfo && !isComplete && (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  ↓ Next Set
                </span>
              </div>
              <div className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">
                {nextSetInfo.exerciseName}
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">
                  Set {nextSetInfo.setNumber} of {nextSetInfo.totalSets}
                </span>
                <span>•</span>
                <span>
                  {nextSetInfo.prescribedReps} reps
                  {nextSetInfo.targetRPE && ` @ RPE ${nextSetInfo.targetRPE}`}
                  {nextSetInfo.targetRIR && ` (${nextSetInfo.targetRIR} RIR)`}
                </span>
              </div>
              {nextSetInfo.lastWeight && nextSetInfo.lastReps && (
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Last set: {nextSetInfo.lastWeight} lbs × {nextSetInfo.lastReps}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {!isComplete && (
              <>
                <button
                  onClick={togglePause}
                  className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => handleAddTime(30)}
                  className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  +30s
                </button>
                <button
                  onClick={handleSkip}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Skip
                </button>
              </>
            )}
            {isComplete && (
              <button
                onClick={handleSkip}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                Continue ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
