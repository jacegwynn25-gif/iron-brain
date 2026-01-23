/**
 * Exponential Decay Recovery Engine
 *
 * Core recovery calculation system using exponential decay models.
 * Replaces linear recovery with biologically-accurate modeling.
 *
 * Formula: Fatigue(t) = Initial_Fatigue × e^(-kt)
 * Where: k = ln(2) / half_life
 *
 * Research Foundation:
 * - Banister et al. (1975): Exponential decay in fitness-fatigue model
 * - Busso (2003): Time course of fatigue and recovery
 * - Mujika & Padilla (2003): Detraining and recovery timelines
 */

import {
  MUSCLE_RECOVERY_CONSTANTS,
  calculateMuscleRecovery,
  type MuscleArchitecture
} from './muscle-architecture';
import {
  EXERCISE_PATTERNS,
  getExercisePattern,
  calculateExerciseFatigue,
  type ExercisePattern
} from './exercise-patterns';

/**
 * Fatigue Event - Single instance of fatigue accumulation
 */
export interface FatigueEvent {
  timestamp: Date;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number; // 6-10 scale
  volume: number; // sets × reps × weight
  effectiveVolume: number; // Adjusted for RPE
  initialFatigue: number; // 0-100 scale (how much fatigue was created)
}

/**
 * Muscle Fatigue State - Current fatigue level for a muscle group
 */
export interface MuscleFatigueState {
  muscleName: string;
  currentFatigue: number; // 0-100 (0 = fully recovered, 100 = maximum fatigue)
  recoveryPercentage: number; // 0-100 (0 = no recovery, 100 = fully recovered)
  events: FatigueEvent[]; // Historical fatigue events
  lastTrainedAt: Date | null;
  estimatedFullRecoveryAt: Date | null;
}

/**
 * Exercise Fatigue State - Current fatigue for a specific exercise/movement pattern
 */
export interface ExerciseFatigueState {
  exerciseName: string;
  currentFatigue: number; // 0-100
  recoveryPercentage: number; // 0-100
  lastPerformedAt: Date | null;
  lastSessionRPE: number | null;
  estimatedFullRecoveryAt: Date | null;
  muscleContributions: {
    muscle: string;
    fatigue: number;
  }[];
}

/**
 * Overall Recovery State - Complete fatigue/recovery snapshot
 */
export interface RecoveryState {
  timestamp: Date;
  muscles: Map<string, MuscleFatigueState>;
  exercises: Map<string, ExerciseFatigueState>;
  globalFatigue: number; // 0-100 (systemic fatigue)
  overallRecoveryScore: number; // 0-100
}

/**
 * Calculate initial fatigue from a training set
 *
 * Fatigue calculation considers:
 * - Volume (sets × reps × weight)
 * - RPE intensity multiplier
 * - Muscle size (larger muscles = more fatigue capacity)
 * - Exercise complexity tier
 *
 * @returns Initial fatigue level (0-100)
 */
export function calculateInitialFatigue(
  sets: number,
  reps: number,
  weight: number,
  rpe: number,
  exerciseName: string,
  muscleName?: string
): number {
  const pattern = getExercisePattern(exerciseName);
  const volume = sets * reps * weight;

  // RPE multiplier (RPE 6 = 0.3x, RPE 10 = 1.5x)
  const rpeMultiplier = 0.3 + ((rpe - 6) / 4) * 1.2;

  // Complexity multiplier (Tier 3 = 1.5x, Tier 2 = 1.0x, Tier 1 = 0.7x)
  const complexityMultiplier = pattern
    ? (pattern.complexityTier === 3 ? 1.5 : pattern.complexityTier === 2 ? 1.0 : 0.7)
    : 1.0;

  // Muscle size multiplier (larger muscles have more capacity)
  let muscleMultiplier = 1.0;
  if (muscleName && MUSCLE_RECOVERY_CONSTANTS[muscleName]) {
    const muscle = MUSCLE_RECOVERY_CONSTANTS[muscleName];
    muscleMultiplier = muscle.massCategory === 'large' ? 0.8 :
                      muscle.massCategory === 'medium' ? 1.0 : 1.2;
  }

  // Base fatigue calculation (normalized to 0-100 scale)
  // Assumption: 10 sets × 10 reps × 100 lbs at RPE 10 = 100 fatigue for medium muscle
  const baseFatigue = (volume / 10000) * rpeMultiplier * complexityMultiplier * muscleMultiplier;

  return Math.min(100, Math.max(0, baseFatigue * 100));
}

/**
 * Calculate effective volume adjusted for RPE
 *
 * Research: Only hard sets (RPE 7+) contribute meaningfully to fatigue
 * - RPE 9-10: 1.0x volume
 * - RPE 7-8: 0.7x volume
 * - RPE 6: 0.4x volume
 * - RPE <6: 0.1x volume (warm-up sets)
 */
export function calculateEffectiveVolume(
  volume: number,
  rpe: number
): number {
  if (rpe >= 9) return volume;
  if (rpe >= 7) return volume * 0.7;
  if (rpe >= 6) return volume * 0.4;
  return volume * 0.1;
}

/**
 * Calculate current fatigue using exponential decay
 *
 * @param initialFatigue - Fatigue level when event occurred (0-100)
 * @param halfLife - Half-life in hours
 * @param hoursSinceEvent - Time elapsed since event
 * @returns Current remaining fatigue (0-100)
 */
export function applyExponentialDecay(
  initialFatigue: number,
  halfLife: number,
  hoursSinceEvent: number
): number {
  if (hoursSinceEvent < 0) return initialFatigue;

  const k = Math.LN2 / halfLife;
  const remainingFatigue = initialFatigue * Math.exp(-k * hoursSinceEvent);

  return Math.max(0, remainingFatigue);
}

/**
 * Compound multiple fatigue events using superposition
 *
 * When multiple training sessions occur, fatigue compounds.
 * Each event decays independently, then we sum the remaining fatigue.
 *
 * @param events - Array of fatigue events
 * @param halfLife - Recovery half-life in hours
 * @param currentTime - Current timestamp
 * @returns Total current fatigue (0-100)
 */
export function compoundFatigueEvents(
  events: FatigueEvent[],
  halfLife: number,
  currentTime: Date = new Date()
): number {
  let totalFatigue = 0;

  for (const event of events) {
    const hoursSinceEvent = (currentTime.getTime() - event.timestamp.getTime()) / (1000 * 60 * 60);
    const remainingFatigue = applyExponentialDecay(event.initialFatigue, halfLife, hoursSinceEvent);
    totalFatigue += remainingFatigue;
  }

  return Math.min(100, totalFatigue);
}

/**
 * Calculate muscle fatigue state from training history
 *
 * @param muscleName - Name of muscle group
 * @param events - Training events affecting this muscle
 * @param currentTime - Current timestamp
 * @returns Complete muscle fatigue state
 */
export function calculateMuscleFatigueState(
  muscleName: string,
  events: FatigueEvent[],
  currentTime: Date = new Date()
): MuscleFatigueState {
  const muscleData = MUSCLE_RECOVERY_CONSTANTS[muscleName];
  if (!muscleData) {
    // Unknown muscle - use default recovery
    return {
      muscleName,
      currentFatigue: 0,
      recoveryPercentage: 100,
      events: [],
      lastTrainedAt: null,
      estimatedFullRecoveryAt: null
    };
  }

  // Calculate current fatigue from all events
  const currentFatigue = compoundFatigueEvents(events, muscleData.halfLife, currentTime);
  const recoveryPercentage = 100 - currentFatigue;

  // Find last training event
  const sortedEvents = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const lastTrainedAt = sortedEvents.length > 0 ? sortedEvents[0].timestamp : null;

  // Estimate full recovery time (when fatigue < 5%)
  let estimatedFullRecoveryAt: Date | null = null;
  if (currentFatigue > 5 && lastTrainedAt) {
    // Solve: 5 = currentFatigue × e^(-kt)
    // t = -ln(5 / currentFatigue) / k
    const k = Math.LN2 / muscleData.halfLife;
    const hoursToRecovery = -Math.log(5 / currentFatigue) / k;
    estimatedFullRecoveryAt = new Date(currentTime.getTime() + hoursToRecovery * 60 * 60 * 1000);
  }

  return {
    muscleName,
    currentFatigue,
    recoveryPercentage,
    events,
    lastTrainedAt,
    estimatedFullRecoveryAt
  };
}

/**
 * Calculate exercise-specific fatigue state
 *
 * Combines muscle fatigue + movement pattern recovery + CNS recovery
 *
 * @param exerciseName - Name of exercise
 * @param events - Training events for this specific exercise
 * @param muscleStates - Current state of all muscles
 * @param currentTime - Current timestamp
 * @returns Complete exercise fatigue state
 */
export function calculateExerciseFatigueState(
  exerciseName: string,
  events: FatigueEvent[],
  muscleStates: Map<string, MuscleFatigueState>,
  currentTime: Date = new Date()
): ExerciseFatigueState {
  const pattern = getExercisePattern(exerciseName);

  // Find last performance
  const sortedEvents = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const lastPerformedAt = sortedEvents.length > 0 ? sortedEvents[0].timestamp : null;
  const lastSessionRPE = sortedEvents.length > 0 ? sortedEvents[0].rpe : null;

  if (!pattern || !lastPerformedAt) {
    return {
      exerciseName,
      currentFatigue: 0,
      recoveryPercentage: 100,
      lastPerformedAt,
      lastSessionRPE,
      estimatedFullRecoveryAt: null,
      muscleContributions: []
    };
  }

  // Calculate hours since last performed
  const hoursSinceLastPerformed = (currentTime.getTime() - lastPerformedAt.getTime()) / (1000 * 60 * 60);

  // Build muscle recovery map
  const muscleRecoveryMap = new Map<string, number>();
  for (const [muscleName, state] of muscleStates.entries()) {
    muscleRecoveryMap.set(muscleName, state.recoveryPercentage);
  }

  // Calculate combined fatigue using exercise-patterns logic
  const fatigueResult = calculateExerciseFatigue(
    exerciseName,
    hoursSinceLastPerformed,
    muscleRecoveryMap
  );

  const currentFatigue = 100 - fatigueResult.totalRecovery;
  const recoveryPercentage = fatigueResult.totalRecovery;

  // Build muscle contributions
  const muscleContributions = fatigueResult.breakdown.map(b => ({
    muscle: b.muscle,
    fatigue: b.contributionToFatigue
  }));

  // Estimate full recovery time
  let estimatedFullRecoveryAt: Date | null = null;
  if (currentFatigue > 5) {
    const k = Math.LN2 / pattern.halfLife;
    const hoursToRecovery = -Math.log(5 / Math.max(currentFatigue, 5)) / k;
    estimatedFullRecoveryAt = new Date(currentTime.getTime() + hoursToRecovery * 60 * 60 * 1000);
  }

  return {
    exerciseName,
    currentFatigue,
    recoveryPercentage,
    lastPerformedAt,
    lastSessionRPE,
    estimatedFullRecoveryAt,
    muscleContributions
  };
}

/**
 * Build complete recovery state from training history
 *
 * This is the main entry point for the decay engine.
 *
 * @param trainingHistory - All training events (from database)
 * @param currentTime - Current timestamp
 * @returns Complete recovery state with muscles + exercises
 */
export function buildRecoveryState(
  trainingHistory: FatigueEvent[],
  currentTime: Date = new Date()
): RecoveryState {
  // Group events by muscle
  const eventsByMuscle = new Map<string, FatigueEvent[]>();

  for (const event of trainingHistory) {
    const pattern = getExercisePattern(event.exerciseName);
    if (!pattern) continue;

    for (const involvement of pattern.muscleInvolvement) {
      if (!eventsByMuscle.has(involvement.muscle)) {
        eventsByMuscle.set(involvement.muscle, []);
      }

      // Scale event fatigue by muscle involvement percentage
      const scaledEvent: FatigueEvent = {
        ...event,
        initialFatigue: event.initialFatigue * (involvement.percentage / 100)
      };

      eventsByMuscle.get(involvement.muscle)!.push(scaledEvent);
    }
  }

  // Calculate muscle states
  const muscleStates = new Map<string, MuscleFatigueState>();
  for (const [muscleName, events] of eventsByMuscle.entries()) {
    muscleStates.set(muscleName, calculateMuscleFatigueState(muscleName, events, currentTime));
  }

  // Group events by exercise
  const eventsByExercise = new Map<string, FatigueEvent[]>();
  for (const event of trainingHistory) {
    if (!eventsByExercise.has(event.exerciseName)) {
      eventsByExercise.set(event.exerciseName, []);
    }
    eventsByExercise.get(event.exerciseName)!.push(event);
  }

  // Calculate exercise states
  const exerciseStates = new Map<string, ExerciseFatigueState>();
  for (const [exerciseName, events] of eventsByExercise.entries()) {
    exerciseStates.set(
      exerciseName,
      calculateExerciseFatigueState(exerciseName, events, muscleStates, currentTime)
    );
  }

  // Calculate global fatigue (average of all muscle fatigue, weighted by mass)
  let totalFatigue = 0;
  let totalWeight = 0;
  for (const state of muscleStates.values()) {
    const muscleData = MUSCLE_RECOVERY_CONSTANTS[state.muscleName];
    const weight = muscleData?.massCategory === 'large' ? 3 :
                   muscleData?.massCategory === 'medium' ? 2 : 1;
    totalFatigue += state.currentFatigue * weight;
    totalWeight += weight;
  }
  const globalFatigue = totalWeight > 0 ? totalFatigue / totalWeight : 0;

  // Overall recovery score (inverse of global fatigue)
  const overallRecoveryScore = 100 - globalFatigue;

  return {
    timestamp: currentTime,
    muscles: muscleStates,
    exercises: exerciseStates,
    globalFatigue,
    overallRecoveryScore
  };
}

/**
 * Get recovery recommendations based on current state
 *
 * @param recoveryState - Current recovery state
 * @returns Actionable recommendations
 */
export function getRecoveryRecommendations(recoveryState: RecoveryState): {
  shouldRest: boolean;
  shouldDeload: boolean;
  trainableMuscles: string[];
  avoidMuscles: string[];
  trainableExercises: string[];
  avoidExercises: string[];
  warnings: string[];
} {
  const trainableMuscles: string[] = [];
  const avoidMuscles: string[] = [];
  const trainableExercises: string[] = [];
  const avoidExercises: string[] = [];
  const warnings: string[] = [];

  // Check muscles
  for (const [muscleName, state] of recoveryState.muscles.entries()) {
    if (state.recoveryPercentage >= 80) {
      trainableMuscles.push(muscleName);
    } else if (state.recoveryPercentage < 50) {
      avoidMuscles.push(muscleName);
      warnings.push(`${muscleName} only ${state.recoveryPercentage.toFixed(0)}% recovered`);
    }
  }

  // Check exercises
  for (const [exerciseName, state] of recoveryState.exercises.entries()) {
    if (state.recoveryPercentage >= 80) {
      trainableExercises.push(exerciseName);
    } else if (state.recoveryPercentage < 50) {
      avoidExercises.push(exerciseName);
    }
  }

  // Overall recommendations
  const shouldRest = recoveryState.overallRecoveryScore < 40;
  const shouldDeload = recoveryState.overallRecoveryScore < 60 && recoveryState.globalFatigue > 50;

  if (shouldRest) {
    warnings.push('Overall recovery is low (<40%). Consider a full rest day.');
  } else if (shouldDeload) {
    warnings.push('Moderate fatigue detected. Consider reducing volume or intensity by 20-30%.');
  }

  return {
    shouldRest,
    shouldDeload,
    trainableMuscles,
    avoidMuscles,
    trainableExercises,
    avoidExercises,
    warnings
  };
}
