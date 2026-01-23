'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  ChevronRight,
  Pause,
  Play,
  X,
  Plus,
} from 'lucide-react';
import { getPriorityAlert, PriorityAlert } from '../lib/storage';
import type { WorkoutSession } from '../lib/types';

interface NextSetInfo {
  exerciseName: string;
  exerciseId: string;
  muscleGroups: string[];
  setNumber: number;
  totalSets: number;
  prescribedReps: string | number;
  targetRPE?: number;
  targetRIR?: number;
  suggestedWeight?: number;
  weightReasoning?: string;
  lastWeight?: number | null;
  lastReps?: number;
}

interface RestTimerProps {
  isActive: boolean;
  duration: number;
  onComplete: (addExtraSet: boolean) => void;
  onSkip: (addExtraSet: boolean) => void;
  nextSetInfo?: NextSetInfo;
  currentSessionSets?: WorkoutSession['sets'];
  onApplyWeightSuggestion?: (weight: number) => void;
  onReduceReps?: (amount: number) => void;
  onIncreaseRest?: (seconds: number) => void;
  onSkipExercise?: () => void;
  isLastSetOfExercise: boolean;
  exerciseName: string;
}

export default function RestTimer({
  isActive,
  duration,
  onComplete,
  onSkip,
  nextSetInfo,
  currentSessionSets = [],
  onApplyWeightSuggestion,
  onReduceReps,
  onIncreaseRest,
  onSkipExercise,
  isLastSetOfExercise,
  exerciseName,
}: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const [priorityAlert, setPriorityAlert] = useState<PriorityAlert | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [addExtraSet, setAddExtraSet] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const remainingRef = useRef<number>(duration);
  const pausedRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  const alertFetchedRef = useRef(false);
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

  useEffect(() => {
    remainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  // Reset when rest timer becomes active
  useEffect(() => {
    if (isActive) {
      setAlertDismissed(false);
      alertFetchedRef.current = false;
      setAddExtraSet(false);
    }
  }, [isActive]);

  // Fetch priority alert ONCE when rest starts
  useEffect(() => {
    async function fetchAlert() {
      if (!isActive || !nextSetInfo || alertFetchedRef.current) return;

      try {
        alertFetchedRef.current = true;

        const alert = await getPriorityAlert(
          nextSetInfo.exerciseId,
          currentSessionSets,
          nextSetInfo.lastWeight
        );

        // Only show if not "none"
        if (alert.type !== 'none') {
          setPriorityAlert(alert);
        }
      } catch (error) {
        console.error('Failed to fetch priority alert:', error);
      } finally {
        // No-op
      }
    }

    fetchAlert();
  }, [isActive, nextSetInfo, currentSessionSets]);

  const playCompletionSound = () => {
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
        onCompleteRef.current?.(addExtraSetRef.current);
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
    onSkipRef.current?.(addExtraSetRef.current);
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

  const handleAlertAction = (action: PriorityAlert['actions'][0]) => {
    switch (action.action) {
      case 'reduce_reps':
        onReduceReps?.(action.value || 2);
        break;
      case 'increase_rest':
        onIncreaseRest?.(action.value || 60);
        break;
      case 'reduce_weight':
      case 'apply_weight':
        if (action.value) {
          onApplyWeightSuggestion?.(action.value);
        }
        break;
      case 'skip_exercise':
        onSkipExercise?.();
        break;
      case 'dismiss':
        break;
    }
    setAlertDismissed(true);
  };

  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = duration > 0 ? ((duration - timeRemaining) / duration) * 100 : 0;

  const isAlmostDone = timeRemaining <= 10;
  const isComplete = timeRemaining === 0;

  const showAlert = priorityAlert && !alertDismissed && priorityAlert.type !== 'none';

  const getAlertColors = () => {
    if (!priorityAlert) return { border: '', bg: '', iconBg: '', iconColor: '' };

    switch (priorityAlert.severity) {
      case 'critical':
        return {
          border: 'border-red-500/30',
          bg: 'bg-red-500/5',
          iconBg: 'bg-red-500/10',
          iconColor: 'text-red-400',
        };
      case 'warning':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-500/5',
          iconBg: 'bg-amber-500/10',
          iconColor: 'text-amber-400',
        };
      case 'info':
        return {
          border: 'border-blue-500/30',
          bg: 'bg-blue-500/5',
          iconBg: 'bg-blue-500/10',
          iconColor: 'text-blue-400',
        };
      default:
        return {
          border: 'border-white/10',
          bg: 'bg-white/5',
          iconBg: 'bg-white/10',
          iconColor: 'text-gray-400',
        };
    }
  };

  const getAlertIcon = () => {
    if (!priorityAlert) return null;
    switch (priorityAlert.severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5" />;
      case 'warning':
        return <Activity className="h-5 w-5" />;
      case 'info':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const colors = getAlertColors();

  return (
    <div className="fixed inset-0 z-50 flex flex-col app-gradient safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="h-5 w-5" />
          <span className="text-sm font-medium">Rest Period</span>
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all active:scale-[0.98]"
        >
          Skip
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 sm:px-6">
        {/* Timer Display */}
        <div className="mx-auto max-w-md py-6 text-center sm:py-10">
          <div
            className={`text-7xl font-black tabular-nums sm:text-8xl ${
              isComplete
                ? 'text-green-400'
                : isAlmostDone
                  ? 'text-orange-400'
                  : 'text-white'
            }`}
          >
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>

          {/* Progress Bar */}
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete
                  ? 'bg-green-500'
                  : isAlmostDone
                    ? 'bg-orange-500'
                    : 'bg-purple-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Timer Controls */}
          {!isComplete && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => handleAddTime(-15)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/10 text-gray-200 transition-all active:scale-[0.98]"
              >
                <span className="text-sm font-bold">-15</span>
              </button>
              <button
                onClick={togglePause}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 border border-white/10 text-white transition-all active:scale-[0.98]"
              >
                {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </button>
              <button
                onClick={() => handleAddTime(15)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/10 text-gray-200 transition-all active:scale-[0.98]"
              >
                <span className="text-sm font-bold">+15</span>
              </button>
              <button
                onClick={() => handleAddTime(30)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/10 text-gray-200 transition-all active:scale-[0.98]"
              >
                <span className="text-sm font-bold">+30</span>
              </button>
            </div>
          )}
        </div>

        {/* Priority Alert */}
        {showAlert && (
          <div className="mx-auto mb-4 max-w-md animate-fadeIn">
            <div
              className={`rounded-2xl border ${colors.border} ${colors.bg} backdrop-blur-xl p-4 sm:p-5 shadow-xl`}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.iconBg}`}>
                    <div className={colors.iconColor}>{getAlertIcon()}</div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{priorityAlert.title}</h3>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {Math.round(priorityAlert.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAlertDismissed(true)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Message */}
              <p className="mb-4 text-sm text-gray-300 leading-relaxed">{priorityAlert.message}</p>

              {/* Actions */}
              {priorityAlert.actions.length > 0 && (
                <div className="space-y-2">
                  {priorityAlert.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAlertAction(action)}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-all ${
                        action.type === 'primary'
                          ? priorityAlert.severity === 'critical'
                            ? 'bg-red-500 hover:bg-red-600 text-white font-medium shadow-md active:scale-[0.98]'
                            : priorityAlert.severity === 'warning'
                              ? 'bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-md active:scale-[0.98]'
                              : 'bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-md active:scale-[0.98]'
                          : 'bg-white/10 border border-white/10 text-gray-200 text-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{action.label}</span>
                        {action.type === 'primary' && (
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Recommended</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Scientific Basis */}
              {priorityAlert.scientificBasis && (
                <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="font-semibold text-gray-300">Research:</span>{' '}
                    {priorityAlert.scientificBasis}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last Set Summary */}
        {isLastSetOfExercise && (
          <div className="mx-auto w-full max-w-md px-6 mt-4 animate-fadeIn">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-emerald-400 text-lg">✓</span>
                <h3 className="text-xl font-bold text-white">{exerciseName} Complete</h3>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Great work! Move to next exercise or add volume?
              </p>

              <button
                onClick={() => setAddExtraSet(!addExtraSet)}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 ${
                  addExtraSet
                    ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-transparent border-white/20 text-gray-300 hover:border-white/40'
                }`}
              >
                <Plus className="w-5 h-5" />
                {addExtraSet ? 'Extra Set Added!' : 'Add Extra Set'}
              </button>
            </div>
          </div>
        )}

        {/* Next Set Info */}
        {(!isLastSetOfExercise || addExtraSet) && nextSetInfo && (
          <div className="mx-auto max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Up Next
                </span>
                <span className="text-xs font-medium text-gray-500">
                  Set {nextSetInfo.setNumber} of {nextSetInfo.totalSets}
                </span>
              </div>

              <h2 className="mb-4 text-xl font-black text-white">{nextSetInfo.exerciseName}</h2>

              {/* Suggested Weight - Prominent Display */}
              {nextSetInfo.suggestedWeight ? (
                <div className="mb-4 rounded-xl btn-primary p-4 text-center shadow-lg">
                  <div className="text-4xl font-black text-white">
                    {nextSetInfo.suggestedWeight} lbs
                  </div>
                  <div className="mt-1 text-sm font-medium text-white/80">
                    {nextSetInfo.prescribedReps} reps
                    {nextSetInfo.targetRPE && ` @ RPE ${nextSetInfo.targetRPE}`}
                    {nextSetInfo.targetRIR != null && ` (${nextSetInfo.targetRIR} RIR)`}
                  </div>
                  {nextSetInfo.weightReasoning && (
                    <div className="mt-2 text-xs text-white/60">{nextSetInfo.weightReasoning}</div>
                  )}
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-lg font-semibold text-gray-300">
                    {nextSetInfo.prescribedReps} reps
                    {nextSetInfo.targetRPE && ` @ RPE ${nextSetInfo.targetRPE}`}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">No weight suggestion available</div>
                </div>
              )}

              {/* Previous Performance */}
              {nextSetInfo.lastWeight != null && nextSetInfo.lastReps != null && (
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-center text-sm text-gray-400">
                  Previous: {nextSetInfo.lastWeight} lbs × {nextSetInfo.lastReps} reps
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Button - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent px-4 pt-4 sm:px-6 safe-bottom-with-min">
        <div className="mx-auto max-w-md">
          <button
            onClick={handleSkip}
            className={`w-full rounded-xl py-4 text-lg font-semibold text-white shadow-xl transition-all active:scale-[0.98] ${
              isComplete
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'btn-primary'
            }`}
          >
            {isLastSetOfExercise && !addExtraSet
              ? 'Finish Exercise'
              : isComplete
                ? 'Continue to Next Set'
                : 'Skip Rest & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
