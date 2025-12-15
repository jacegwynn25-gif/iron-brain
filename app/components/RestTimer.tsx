'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowUpCircle, ArrowDownCircle, Clock, ChevronRight, Pause, Play, X } from 'lucide-react';

interface FatigueAlert {
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  affectedMuscles: string[];
  reasoning: string;
  scientificBasis: string;
}

interface WeightRecommendation {
  type: 'increase' | 'decrease' | 'maintain';
  suggestedWeight: number;
  currentWeight?: number;
  reasoning: string;
  confidence: number;
  scientificBasis: string;
}

interface NextSetInfo {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  prescribedReps: string | number;
  targetRPE?: number;
  targetRIR?: number;
  suggestedWeight?: number;
  weightReasoning?: string;
  lastWeight?: number;
  lastReps?: number;
}

interface RestTimerProps {
  isActive: boolean;
  duration: number;
  onComplete?: () => void;
  onSkip?: () => void;
  nextSetInfo?: NextSetInfo;
  fatigueAlert?: FatigueAlert | null;
  weightRecommendation?: WeightRecommendation | null;
  onApplyWeightSuggestion?: (weight: number) => void;
}

export default function RestTimer({
  isActive,
  duration,
  onComplete,
  onSkip,
  nextSetInfo,
  fatigueAlert,
  weightRecommendation,
  onApplyWeightSuggestion,
}: RestTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
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

  // Reset dismissed alerts when rest timer becomes active
  useEffect(() => {
    if (isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissedAlerts(new Set());
    }
  }, [isActive]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleApplyWeight = (weight: number) => {
    onApplyWeightSuggestion?.(weight);
    setDismissedAlerts(prev => new Set(prev).add('weight'));
  };

  const dismissAlert = (alertType: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertType));
  };

  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = duration > 0 ? ((duration - timeRemaining) / duration) * 100 : 0;

  const isAlmostDone = timeRemaining <= 10;
  const isComplete = timeRemaining === 0;

  // Determine which alert to show (fatigue takes priority)
  const showFatigueAlert = fatigueAlert && !dismissedAlerts.has('fatigue');
  const showWeightRec = weightRecommendation && 
    weightRecommendation.type !== 'maintain' && 
    !dismissedAlerts.has('weight') &&
    !showFatigueAlert;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock className="h-5 w-5" />
          <span className="text-sm font-medium">Rest Period</span>
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
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
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
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
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <span className="text-sm font-bold">-15</span>
              </button>
              <button
                onClick={togglePause}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-white transition-colors hover:bg-zinc-600"
              >
                {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
              </button>
              <button
                onClick={() => handleAddTime(15)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <span className="text-sm font-bold">+15</span>
              </button>
              <button
                onClick={() => handleAddTime(30)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <span className="text-sm font-bold">+30</span>
              </button>
            </div>
          )}
        </div>

        {/* Smart Alert - Fatigue Warning */}
        {showFatigueAlert && (
          <div className="mx-auto mb-4 max-w-md animate-fadeIn">
            <div className="rounded-2xl border-2 border-red-500/50 bg-gradient-to-br from-red-900/40 to-red-950/60 p-4 shadow-lg">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-300">Fatigue Detected</h3>
                    <p className="text-xs text-red-400/80">
                      {fatigueAlert.affectedMuscles.join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert('fatigue')}
                  className="rounded-lg p-1 text-red-400/60 hover:bg-red-500/20 hover:text-red-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-3 text-sm text-red-200/90">{fatigueAlert.reasoning}</p>
              {weightRecommendation && weightRecommendation.type === 'decrease' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApplyWeight(weightRecommendation.suggestedWeight)}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-red-400 active:scale-[0.98]"
                  >
                    Apply {weightRecommendation.suggestedWeight} lbs
                  </button>
                  <button
                    onClick={() => dismissAlert('fatigue')}
                    className="rounded-xl bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/30"
                  >
                    Ignore
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Smart Alert - Weight Recommendation (non-fatigue) */}
        {showWeightRec && (
          <div className="mx-auto mb-4 max-w-md animate-fadeIn">
            <div
              className={`rounded-2xl border-2 p-4 shadow-lg ${
                weightRecommendation.type === 'increase'
                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-900/40 to-emerald-950/60'
                  : 'border-amber-500/50 bg-gradient-to-br from-amber-900/40 to-amber-950/60'
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      weightRecommendation.type === 'increase'
                        ? 'bg-emerald-500/20'
                        : 'bg-amber-500/20'
                    }`}
                  >
                    {weightRecommendation.type === 'increase' ? (
                      <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <h3
                    className={`font-bold ${
                      weightRecommendation.type === 'increase' ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {weightRecommendation.type === 'increase' ? 'Ready to Progress!' : 'Adjust Load'}
                  </h3>
                </div>
                <button
                  onClick={() => dismissAlert('weight')}
                  className={`rounded-lg p-1 ${
                    weightRecommendation.type === 'increase'
                      ? 'text-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-300'
                      : 'text-amber-400/60 hover:bg-amber-500/20 hover:text-amber-300'
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p
                className={`mb-3 text-sm ${
                  weightRecommendation.type === 'increase' ? 'text-emerald-200/90' : 'text-amber-200/90'
                }`}
              >
                {weightRecommendation.reasoning}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApplyWeight(weightRecommendation.suggestedWeight)}
                  className={`flex-1 rounded-xl py-2.5 text-center text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] ${
                    weightRecommendation.type === 'increase'
                      ? 'bg-emerald-500 hover:bg-emerald-400'
                      : 'bg-amber-500 hover:bg-amber-400'
                  }`}
                >
                  Apply {weightRecommendation.suggestedWeight} lbs
                </button>
                <button
                  onClick={() => dismissAlert('weight')}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    weightRecommendation.type === 'increase'
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  }`}
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Next Set Info */}
        {nextSetInfo && (
          <div className="mx-auto max-w-md">
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4 shadow-lg backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Up Next
                </span>
                <span className="text-xs font-medium text-zinc-500">
                  Set {nextSetInfo.setNumber} of {nextSetInfo.totalSets}
                </span>
              </div>

              <h2 className="mb-4 text-xl font-black text-white">{nextSetInfo.exerciseName}</h2>

              {/* Suggested Weight - Prominent Display */}
              {nextSetInfo.suggestedWeight ? (
                <div className="mb-4 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 p-4 text-center shadow-lg">
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
                <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-800/80 p-4 text-center">
                  <div className="text-lg font-bold text-zinc-300">
                    {nextSetInfo.prescribedReps} reps
                    {nextSetInfo.targetRPE && ` @ RPE ${nextSetInfo.targetRPE}`}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">No weight suggestion available</div>
                </div>
              )}

              {/* Previous Performance */}
              {nextSetInfo.lastWeight != null && nextSetInfo.lastReps != null && (
                <div className="rounded-lg bg-zinc-900/50 px-3 py-2 text-center text-sm text-zinc-400">
                  Previous: {nextSetInfo.lastWeight} lbs × {nextSetInfo.lastReps} reps
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Button - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent px-4 pb-6 pt-4 sm:px-6">
        <div className="mx-auto max-w-md">
          {isComplete ? (
            <button
              onClick={handleSkip}
              className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 py-4 text-lg font-black text-white shadow-xl transition-all hover:from-green-400 hover:to-emerald-400 active:scale-[0.98]"
            >
              Continue to Next Set →
            </button>
          ) : (
            <button
              onClick={handleSkip}
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-4 text-lg font-black text-white shadow-xl transition-all hover:from-purple-500 hover:to-fuchsia-500 active:scale-[0.98]"
            >
              Skip Rest & Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
