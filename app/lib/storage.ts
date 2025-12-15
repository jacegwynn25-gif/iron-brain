import { WorkoutSession } from './types';
import { shouldTriggerAutoReduction, calculateAdjustedWeight, calculateMuscleFatigue } from './fatigueModel';

const STORAGE_KEYS = {
  WORKOUT_HISTORY: 'iron_brain_workout_history',
  USER_SETTINGS: 'iron_brain_user_settings',
  CURRENT_CYCLE: 'iron_brain_current_cycle',
} as const;

let activeUserNamespace = 'default';

export function setUserNamespace(userId: string | null) {
  activeUserNamespace = userId ? userId : 'default';
}

const getKey = (base: string) => `${base}__${activeUserNamespace}`;

// ============================================================
// WORKOUT HISTORY STORAGE
// ============================================================

export function saveWorkout(session: WorkoutSession): void {
  try {
    const history = getWorkoutHistory();
    history.push(session);
    localStorage.setItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY), JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save workout:', error);
  }
}

export function getWorkoutHistory(): WorkoutSession[] {
  try {
    const data = localStorage.getItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY));
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load workout history:', error);
    return [];
  }
}

export function setWorkoutHistory(sessions: WorkoutSession[]): void {
  try {
    localStorage.setItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY), JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to set workout history:', error);
  }
}

export function getWorkoutById(id: string): WorkoutSession | null {
  const history = getWorkoutHistory();
  return history.find(w => w.id === id) || null;
}

export function deleteWorkout(id: string): void {
  try {
    const history = getWorkoutHistory();
    const filtered = history.filter(w => w.id !== id);
    localStorage.setItem(getKey(STORAGE_KEYS.WORKOUT_HISTORY), JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete workout:', error);
  }
}

// ============================================================
// EXERCISE HISTORY QUERIES
// ============================================================

export function getExerciseHistory(exerciseId: string): WorkoutSession[] {
  const history = getWorkoutHistory();
  return history
    .filter(session => session.sets.some(set => set.exerciseId === exerciseId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getLastWorkoutForExercise(exerciseId: string): {
  session: WorkoutSession;
  bestSet: WorkoutSession['sets'][0];
} | null {
  const exerciseHistory = getExerciseHistory(exerciseId);
  if (exerciseHistory.length === 0) return null;

  const lastSession = exerciseHistory[0];
  const exerciseSets = lastSession.sets.filter(s => s.exerciseId === exerciseId && s.completed);

  if (exerciseSets.length === 0) return null;

  // Find best set (highest E1RM, or highest weight × reps if no E1RM)
  const bestSet = exerciseSets.reduce((best, current) => {
    const currentScore = current.e1rm || (current.actualWeight || 0) * (current.actualReps || 0);
    const bestScore = best.e1rm || (best.actualWeight || 0) * (best.actualReps || 0);
    return currentScore > bestScore ? current : best;
  });

  return { session: lastSession, bestSet };
}

// ============================================================
// PERFORMANCE ANALYTICS
// ============================================================

export function getPersonalRecords(exerciseId: string) {
  const history = getExerciseHistory(exerciseId);
  const allSets = history.flatMap(session =>
    session.sets.filter(s => s.exerciseId === exerciseId && s.completed)
  );

  if (allSets.length === 0) return null;

  // Max weight (for any rep count)
  const maxWeightSet = allSets.reduce((max, current) =>
    (current.actualWeight || 0) > (max.actualWeight || 0) ? current : max
  );

  // Max reps (for any weight)
  const maxRepsSet = allSets.reduce((max, current) =>
    (current.actualReps || 0) > (max.actualReps || 0) ? current : max
  );

  // Max E1RM
  const maxE1RMSet = allSets.reduce((max, current) =>
    (current.e1rm || 0) > (max.e1rm || 0) ? current : max
  );

  // Max volume (weight × reps)
  const maxVolumeSet = allSets.reduce((max, current) =>
    (current.volumeLoad || 0) > (max.volumeLoad || 0) ? current : max
  );

  return {
    maxWeight: {
      weight: maxWeightSet.actualWeight || 0,
      reps: maxWeightSet.actualReps || 0,
      date: maxWeightSet.timestamp || '',
    },
    maxReps: {
      weight: maxRepsSet.actualWeight || 0,
      reps: maxRepsSet.actualReps || 0,
      date: maxRepsSet.timestamp || '',
    },
    maxE1RM: {
      e1rm: maxE1RMSet.e1rm || 0,
      weight: maxE1RMSet.actualWeight || 0,
      reps: maxE1RMSet.actualReps || 0,
      date: maxE1RMSet.timestamp || '',
    },
    maxVolume: {
      volume: maxVolumeSet.volumeLoad || 0,
      weight: maxVolumeSet.actualWeight || 0,
      reps: maxVolumeSet.actualReps || 0,
      date: maxVolumeSet.timestamp || '',
    },
  };
}

// ============================================================
// SMART WEIGHT SUGGESTIONS
// ============================================================

export interface WeightSuggestion {
  suggestedWeight: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'previous_performance' | 'rpe_adjustment' | 'volume_fatigue' | 'default';
  fatigueAlert?: {
    severity: 'mild' | 'moderate' | 'high' | 'critical';
    affectedMuscles: string[];
    scientificBasis: string;
    detailedExplanation: string;
  };
}

export function suggestWeight(
  exerciseId: string,
  targetReps: number,
  targetRPE?: number | null,
  currentSessionSets?: WorkoutSession['sets']
): WeightSuggestion | null {
  console.log('\n💡 SUGGEST WEIGHT called for:', exerciseId);

  // PRIORITY 1: Check for acute session fatigue (works WITHOUT previous history)
  const completedSets = currentSessionSets?.filter(s => s.completed) || [];
  console.log('   Completed sets in session:', completedSets.length);

  if (completedSets.length > 0) {
    console.log('   🔬 Running fatigue analysis...');
    const fatigueAlert = shouldTriggerAutoReduction(completedSets, exerciseId);

    if (fatigueAlert.shouldAlert) {
      console.log('   🚨 FATIGUE ALERT TRIGGERED:', fatigueAlert.severity);

      // Find reference weight to base reduction on
      // Option 1: Most recent weight used for THIS exercise in current session
      const recentSetsSameExercise = completedSets
        .filter(s => s.exerciseId === exerciseId && s.actualWeight && s.actualWeight > 0)
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      let referenceWeight: number | null = recentSetsSameExercise[0]?.actualWeight || null;
      console.log('   🏋️ Reference weight from current session:', referenceWeight);

      // Option 2: If no current session data for this exercise, try history
      if (!referenceWeight) {
        const lastWorkout = getLastWorkoutForExercise(exerciseId);
        referenceWeight = lastWorkout?.bestSet.actualWeight || null;
        console.log('   📚 Reference weight from history:', referenceWeight);
      }

      // Option 3: If still no weight, use any recent weight from session (for new exercises)
      if (!referenceWeight) {
        const anyRecentSet = completedSets
          .filter(s => s.actualWeight && s.actualWeight > 0)
          .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];

        if (anyRecentSet) {
          // Use 80% of recent weight as starting point for new exercise
          referenceWeight = Math.round(anyRecentSet.actualWeight! * 0.8);
          console.log('   🎯 Estimated reference weight:', referenceWeight);
        }
      }

      if (referenceWeight) {
        const adjustedWeight = calculateAdjustedWeight(referenceWeight, fatigueAlert);
        const fatigueScores = calculateMuscleFatigue(completedSets, fatigueAlert.affectedMuscles);

        // Build detailed explanation - plain text, no markdown
        const topFatigue = fatigueScores[0];
        const topContributors = topFatigue?.contributingSets.slice(0, 3) || [];

        let detailedExplanation = fatigueAlert.reasoning;

        if (topContributors.length > 0) {
          const contributorList = topContributors
            .map(c => `${c.exerciseName} Set ${c.setIndex} (+${c.rpeOvershoot.toFixed(1)} RPE)`)
            .join(', ');
          detailedExplanation += ` Contributing sets: ${contributorList}.`;
        }

        const reductionPercent = Math.round(fatigueAlert.suggestedReduction * 100);
        detailedExplanation += ` Recommended: reduce by ${reductionPercent}% to ${adjustedWeight}lbs.`;

        console.log('   ✅ Returning fatigue-based suggestion:', adjustedWeight, 'lbs');

        return {
          suggestedWeight: adjustedWeight,
          reasoning: fatigueAlert.reasoning,
          confidence: fatigueAlert.confidence >= 0.8 ? 'high' : fatigueAlert.confidence >= 0.6 ? 'medium' : 'low',
          basedOn: 'rpe_adjustment',
          fatigueAlert: {
            severity: fatigueAlert.severity,
            affectedMuscles: fatigueAlert.affectedMuscles,
            scientificBasis: fatigueAlert.scientificBasis,
            detailedExplanation,
          },
        };
      } else {
        console.log('   ⚠️ Fatigue detected but no reference weight available');
      }
    } else {
      console.log('   ✓ No fatigue alert triggered');
    }
  } else {
    console.log('   ℹ️ No completed sets yet - cannot assess fatigue');
  }

  // PRIORITY 2: Try historical progression (only if no fatigue alert)
  console.log('   📖 Checking previous workout history...');
  const lastWorkout = getLastWorkoutForExercise(exerciseId);

  if (!lastWorkout) {
    console.log('   ❌ No previous workout history - returning null');
    return null; // No history and no fatigue alert
  }

  console.log('   ✓ Found previous workout history');
  const { bestSet } = lastWorkout;
  const lastWeight = bestSet.actualWeight || 0;
  const lastReps = bestSet.actualReps || 0;
  const lastRPE = bestSet.actualRPE || null;

  // If same reps, suggest small progression
  if (targetReps === lastReps && lastRPE && targetRPE) {
    if (lastRPE < targetRPE - 1) {
      // Last time was too easy, increase weight
      const increase = Math.round(lastWeight * 0.025); // 2.5% increase
      return {
        suggestedWeight: lastWeight + increase,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. You can handle more.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    } else if (lastRPE > targetRPE + 1) {
      // Last time was too hard, decrease weight
      const decrease = Math.round(lastWeight * 0.025); // 2.5% decrease
      return {
        suggestedWeight: lastWeight - decrease,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. Reducing slightly.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    } else {
      // RPE was on target, use same weight
      return {
        suggestedWeight: lastWeight,
        reasoning: `Last time: ${lastWeight}lbs x${lastReps} @ RPE ${lastRPE}. Good match.`,
        confidence: 'high',
        basedOn: 'previous_performance',
      };
    }
  }

  // Different rep count - use E1RM to estimate
  if (bestSet.e1rm && targetReps !== lastReps) {
    const estimatedWeight = Math.round(bestSet.e1rm / (1 + targetReps / 30)); // Reverse Epley formula
    return {
      suggestedWeight: estimatedWeight,
      reasoning: `Based on your E1RM of ${bestSet.e1rm}lbs, estimated for ${targetReps} reps.`,
      confidence: 'medium',
      basedOn: 'previous_performance',
    };
  }

  // Fallback: use last weight
  return {
    suggestedWeight: lastWeight,
    reasoning: `Last time: ${lastWeight}lbs x${lastReps}`,
    confidence: 'low',
    basedOn: 'previous_performance',
  };
}

// ============================================================
// PROGRESSIVE OVERLOAD ANALYSIS
// ============================================================

export type ProgressionStatus = 'ready' | 'maintain' | 'deload';

export interface ProgressionRecommendation {
  status: ProgressionStatus;
  indicator: string; // '⬆️', '●', '⬇️'
  message: string;
  confidence: 'high' | 'medium' | 'low';
  suggestion: {
    action: 'increase' | 'maintain' | 'decrease';
    amount?: number; // lbs
    percentage?: number; // 0.025 = 2.5%
  };
}

/**
 * Analyzes recent performance to determine if user is ready for progressive overload
 * Based on:
 * - Consistent completion of prescribed reps at target RPE
 * - Avoiding excessive RPE overshoot
 * - Accumulated fatigue levels
 */
export function analyzeProgressionReadiness(
  exerciseId: string,
  targetReps: number,
  targetRPE: number | null | undefined
): ProgressionRecommendation {
  const history = getExerciseHistory(exerciseId);

  // No history = maintain current weight
  if (history.length === 0) {
    return {
      status: 'maintain',
      indicator: '●',
      message: 'No previous data - establish baseline',
      confidence: 'high',
      suggestion: {
        action: 'maintain',
      },
    };
  }

  // Analyze last 2-3 sessions for this exercise
  const recentSessions = history.slice(0, 3);
  const allRecentSets = recentSessions.flatMap(session =>
    session.sets.filter(s => s.exerciseId === exerciseId && s.completed)
  );

  if (allRecentSets.length === 0) {
    return {
      status: 'maintain',
      indicator: '●',
      message: 'No recent completed sets',
      confidence: 'high',
      suggestion: {
        action: 'maintain',
      },
    };
  }

  // Count how many sessions achieved target reps + RPE
  let sessionsAtTarget = 0;
  let sessionsOvershot = 0;

  for (const session of recentSessions) {
    const sessionSets = session.sets.filter(s => s.exerciseId === exerciseId && s.completed);
    if (sessionSets.length === 0) continue;

    // Check if ALL sets in this session hit target
    const allSetsHitReps = sessionSets.every(s => (s.actualReps || 0) >= targetReps);
    const avgRPE = sessionSets.reduce((sum, s) => sum + (s.actualRPE || 0), 0) / sessionSets.length;

    if (allSetsHitReps && targetRPE) {
      if (Math.abs(avgRPE - targetRPE) <= 0.5) {
        sessionsAtTarget++;
      } else if (avgRPE > targetRPE + 1) {
        sessionsOvershot++;
      }
    }
  }

  // READY TO PROGRESS: 2+ sessions at target
  if (sessionsAtTarget >= 2) {
    return {
      status: 'ready',
      indicator: '⬆️',
      message: `${sessionsAtTarget} sessions at target - ready to increase!`,
      confidence: 'high',
      suggestion: {
        action: 'increase',
        amount: 5, // Standard 5lb increase
        percentage: 0.025, // 2.5%
      },
    };
  }

  // DELOAD: 2+ sessions with high RPE overshoot
  if (sessionsOvershot >= 2) {
    return {
      status: 'deload',
      indicator: '⬇️',
      message: `${sessionsOvershot} sessions with RPE overshoot - suggest deload`,
      confidence: 'high',
      suggestion: {
        action: 'decrease',
        percentage: 0.1, // 10% reduction
      },
    };
  }

  // Check for recent fatigue issues
  const lastSession = recentSessions[0];
  const lastSessionSets = lastSession.sets.filter(s => s.completed);
  if (lastSessionSets.length > 0) {
    const fatigueAlert = shouldTriggerAutoReduction(lastSessionSets, exerciseId);
    if (fatigueAlert.shouldAlert && fatigueAlert.severity === 'critical') {
      return {
        status: 'deload',
        indicator: '⬇️',
        message: 'Severe fatigue detected - reduce load',
        confidence: 'high',
        suggestion: {
          action: 'decrease',
          percentage: fatigueAlert.suggestedReduction,
        },
      };
    }
  }

  // DEFAULT: Maintain current weight
  return {
    status: 'maintain',
    indicator: '●',
    message: 'Keep working at current weight',
    confidence: 'medium',
    suggestion: {
      action: 'maintain',
    },
  };
}

// ============================================================
// CYCLE MANAGEMENT
// ============================================================

export function getCurrentCycle(programId: string): number {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_CYCLE);
    const cycles: Record<string, number> = data ? JSON.parse(data) : {};
    return cycles[programId] || 1;
  } catch (error) {
    console.error('Failed to get current cycle:', error);
    return 1;
  }
}

export function incrementCycle(programId: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_CYCLE);
    const cycles: Record<string, number> = data ? JSON.parse(data) : {};
    cycles[programId] = (cycles[programId] || 1) + 1;
    localStorage.setItem(STORAGE_KEYS.CURRENT_CYCLE, JSON.stringify(cycles));
  } catch (error) {
    console.error('Failed to increment cycle:', error);
  }
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export const storage = {
  saveWorkout,
  getWorkoutHistory,
  setWorkoutHistory,
  getWorkoutById,
  deleteWorkout,
  deleteWorkoutSession: deleteWorkout, // Alias for clarity
  getExerciseHistory,
  getLastWorkoutForExercise,
  getPersonalRecords,
  suggestWeight,
  analyzeProgressionReadiness,
  getCurrentCycle,
  incrementCycle,
};
