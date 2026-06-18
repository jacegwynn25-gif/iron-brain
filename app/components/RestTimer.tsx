'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { WorkoutSession } from '../lib/types';
import {
  recommendationHasApplyPatch,
  type TrainingRecommendation,
} from '../lib/intelligence/training-recommendations';
import { formatSetTarget, formatSetTargetWeight, formatRecommendationSource } from '../lib/workout/format-set-target';

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
  weightUnit?: 'lbs' | 'kg';
  currentSessionSets?: WorkoutSession['sets'];
  onApplyWeightSuggestion?: (weight: number) => void;
  onReduceReps?: (amount: number) => void;
  onIncreaseRest?: (seconds: number) => void;
  onSkipExercise?: () => void;
  isLastSetOfExercise?: boolean;
  exerciseName?: string;
  smartRecommendation?: TrainingRecommendation | null;
  onApplyRecommendation?: (recommendation: TrainingRecommendation) => void;
}

function formatReps(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.includes('rep') || normalized.includes('cluster')) return value;
    return `${value} reps`;
  }
  return `${value} reps`;
}

export default function RestTimer({
  isActive,
  duration,
  onComplete,
  onSkip,
  nextSetInfo,
  showUpNext = true,
  weightUnit = 'lbs',
  isLastSetOfExercise = false,
  exerciseName,
  smartRecommendation,
  onApplyRecommendation,
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

  const handleApplyRecommendation = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (smartRecommendation) {
      onApplyRecommendation?.(smartRecommendation);
    }
  };

  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const smartUnit = smartRecommendation?.target?.weightUnit ?? weightUnit;
  const smartRest = smartRecommendation?.target?.restSeconds;
  const smartTargetText = formatSetTarget(smartRecommendation?.target ?? null, smartUnit)
    || (smartRest != null ? `+${smartRest}s rest` : null);
  const hasSmartTarget = Boolean(smartRecommendation && smartTargetText);
  const nextWeight = hasSmartTarget ? null : nextSetInfo?.weight ?? nextSetInfo?.suggestedWeight ?? null;
  const nextReps = hasSmartTarget ? null : nextSetInfo?.reps ?? nextSetInfo?.prescribedReps ?? null;
  const nextExercise = nextSetInfo?.exerciseName ?? exerciseName;
  const upNextTextParts = [
    nextExercise ? `Up next: ${nextExercise}` : 'Up next',
    nextSetInfo?.setNumber != null && !hasSmartTarget ? `Set ${nextSetInfo.setNumber}` : null,
    nextWeight != null ? formatSetTargetWeight(nextWeight, weightUnit) : null,
    formatReps(nextReps),
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black px-6 text-white">
      <div className="h-full flex flex-col items-center justify-center gap-8 text-center">
        <p className="workout-timer text-7xl font-black tracking-tight text-white">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </p>

        {showUpNext && (
          <p className="text-2xl font-medium text-zinc-400">
            {upNextTextParts.join(' \u2022 ')}
          </p>
        )}

        {showUpNext && smartRecommendation && (
          <div
            className="liquid-sheet-panel w-full max-w-sm px-4 py-3 text-left"
            data-testid="smart-rest-target"
            aria-label={`Rest target ${smartTargetText ?? smartRecommendation.title}. ${formatRecommendationSource(smartRecommendation.source)} signal.`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-300">
                  Target
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-white" data-testid="smart-rest-target-value">
                  {smartTargetText ?? smartRecommendation.title}
                </p>
              </div>
              {recommendationHasApplyPatch(smartRecommendation) && smartRecommendation.confidence !== 'low' && (
                <button
                  type="button"
                  onClick={handleApplyRecommendation}
                  className="liquid-action-button shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-950 active:scale-95"
                  data-testid="smart-rest-apply"
                >
                  Apply
                </button>
              )}
            </div>
          </div>
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
