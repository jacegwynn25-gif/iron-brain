'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorkoutSession } from '../lib/types';

interface NextSetInfo {
  exerciseName?: string;
  setNumber?: number;
  weight?: number;
  reps?: number | string;
  prescribedReps?: string | number;
  suggestedWeight?: number;
}

interface RestTimerProps {
  isActive: boolean;
  duration: number;
  onComplete: (addExtraSet: boolean) => void;
  onSkip?: (addExtraSet: boolean) => void;
  nextSetInfo?: NextSetInfo;
  showUpNext?: boolean;
  currentSessionSets?: WorkoutSession['sets'];
  onApplyWeightSuggestion?: (weight: number) => void;
  onReduceReps?: (amount: number) => void;
  onIncreaseRest?: (seconds: number) => void;
  onSkipExercise?: () => void;
  isLastSetOfExercise?: boolean;
  exerciseName?: string;
}

export default function RestTimer({
  isActive,
  duration,
  onComplete,
  onSkip,
  nextSetInfo,
  showUpNext = true,
  isLastSetOfExercise = false,
  exerciseName,
}: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [addExtraSet, setAddExtraSet] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  const addExtraSetRef = useRef(addExtraSet);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  useEffect(() => {
    addExtraSetRef.current = addExtraSet;
  }, [addExtraSet]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = null;
    endTimeRef.current = null;
    completedRef.current = false;
  };

  useEffect(() => {
    if (!isActive) {
      clearTimer();
      setTimeRemaining(duration);
      setAddExtraSet(false);
      return;
    }

    endTimeRef.current = Date.now() + duration * 1000;
    completedRef.current = false;
    setTimeRemaining(duration);

    const tick = () => {
      if (!endTimeRef.current) return;
      const msLeft = endTimeRef.current - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      setTimeRemaining(secLeft);

      if (secLeft === 0 && !completedRef.current) {
        completedRef.current = true;
        clearTimer();
        onCompleteRef.current?.(addExtraSetRef.current);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 250);

    return () => clearTimer();
  }, [isActive, duration]);

  const handleSkip = () => {
    clearTimer();
    setTimeRemaining(0);
    if (onSkipRef.current) {
      onSkipRef.current(addExtraSetRef.current);
    } else {
      onCompleteRef.current?.(addExtraSetRef.current);
    }
  };

  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const nextWeight = nextSetInfo?.weight ?? nextSetInfo?.suggestedWeight ?? null;
  const nextReps = nextSetInfo?.reps ?? nextSetInfo?.prescribedReps ?? null;
  const nextExercise = nextSetInfo?.exerciseName ?? exerciseName;
  const upNextTextParts = [
    nextExercise ? `Up Next: ${nextExercise}` : 'Up Next',
    nextWeight != null ? `${nextWeight}lbs` : null,
    nextReps != null ? `${nextReps} reps` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black px-6 text-white">
      <div className="h-full flex flex-col items-center justify-center gap-8 text-center">
        <p className="text-7xl font-black tabular-nums text-white">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </p>

        {showUpNext && (
          <p className="text-2xl font-medium text-zinc-400">
            {upNextTextParts.join(' \u2022 ')}
          </p>
        )}

        <div className="flex items-center gap-6">
          {isLastSetOfExercise && (
            <button
              type="button"
              onClick={() => setAddExtraSet((current) => !current)}
              className="text-lg font-semibold text-emerald-400 drop-shadow-[0_0_14px_rgba(16,185,129,0.6)]"
            >
              {addExtraSet ? 'Bonus Set Added' : 'Add Bonus Set'}
            </button>
          )}

          <button
            type="button"
            onClick={handleSkip}
            className="text-base font-medium text-zinc-500 transition-colors hover:text-white"
          >
            Skip Rest
          </button>
        </div>
      </div>
    </div>
  );
}
