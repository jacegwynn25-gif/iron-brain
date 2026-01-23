/**
 * User-Friendly Translation Layer
 *
 * Converts PhD-level recovery calculations into simple, actionable messages.
 *
 * Philosophy: All the nerdy shit happens in the background.
 * The user sees: Green/Yellow/Red lights + simple next steps.
 */

import { InjuryRiskAssessment } from './injury-risk-scoring';
import { RecoveryState } from './decay-engine';

/**
 * Traffic Light Status
 */
export type TrafficLightStatus = 'green' | 'yellow' | 'red';

/**
 * Simple Readiness Message
 */
export interface ReadinessMessage {
  status: TrafficLightStatus;
  emoji: string;
  title: string;
  subtitle: string;
  actionItems: string[];
  canTrain: boolean;
  canPR: boolean;
  shouldReduceWeight: boolean;
  weightAdjustment: number; // -30 to +10 (percentage)
}

/**
 * Simple Muscle Status
 */
export interface SimpleMuscleStatus {
  muscle: string;
  status: TrafficLightStatus;
  emoji: string;
  message: string;
  daysUntilReady: number | null;
}

/**
 * Simple Warning
 */
export interface SimpleWarning {
  severity: 'info' | 'warning' | 'critical';
  emoji: string;
  title: string;
  message: string;
  actions: string[];
}

/**
 * Convert recovery percentage to traffic light status
 */
export function getTrafficLightStatus(recoveryPercentage: number): TrafficLightStatus {
  if (recoveryPercentage >= 85) return 'green';
  if (recoveryPercentage >= 60) return 'yellow';
  return 'red';
}

/**
 * Generate pre-workout readiness message
 *
 * @param overallRecovery - Overall recovery score (0-100)
 * @param muscleRecovery - Primary muscle group recovery (0-100)
 * @param injuryRisk - Injury risk assessment
 * @returns Simple, actionable message
 */
export function generateReadinessMessage(
  overallRecovery: number,
  muscleRecovery: number,
  injuryRisk: InjuryRiskAssessment
): ReadinessMessage {
  const status = getTrafficLightStatus(muscleRecovery);

  // Critical injury risk overrides everything
  if (injuryRisk.overallRiskLevel === 'critical' || injuryRisk.overallRiskLevel === 'very_high') {
    return {
      status: 'red',
      emoji: '🛑',
      title: 'SKIP IT',
      subtitle: 'Training now = 3x higher injury risk',
      actionItems: [
        'Take today off',
        `Come back in ${injuryRisk.estimatedSafeTrainingDate ? Math.ceil((injuryRisk.estimatedSafeTrainingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 3} days`,
        'Your body will thank you'
      ],
      canTrain: false,
      canPR: false,
      shouldReduceWeight: true,
      weightAdjustment: -100 // Don't train at all
    };
  }

  if (status === 'green') {
    return {
      status: 'green',
      emoji: '💪',
      title: 'READY TO CRUSH',
      subtitle: "You're recovered and ready to perform",
      actionItems: [
        'Add 5-10 lbs from last time',
        "Go for a PR if it's there",
        'Push hard today'
      ],
      canTrain: true,
      canPR: true,
      shouldReduceWeight: false,
      weightAdjustment: muscleRecovery >= 95 ? 5 : 0 // 5% bonus if fully recovered
    };
  }

  if (status === 'yellow') {
    const reduction = Math.round((100 - muscleRecovery) / 3); // 60% recovery = 13% reduction
    return {
      status: 'yellow',
      emoji: '🤔',
      title: 'EASE UP TODAY',
      subtitle: "You're still fatigued. Train but scale back.",
      actionItems: [
        `Reduce weight ${reduction}%`,
        'Focus on technique',
        'No PRs today'
      ],
      canTrain: true,
      canPR: false,
      shouldReduceWeight: true,
      weightAdjustment: -reduction
    };
  }

  // Red
  return {
    status: 'red',
    emoji: '🛑',
    title: 'SKIP IT',
    subtitle: 'Not recovered enough to train safely',
    actionItems: [
      'Take today off',
      'Rest 1-2 more days',
      'Come back stronger'
    ],
    canTrain: false,
    canPR: false,
    shouldReduceWeight: true,
    weightAdjustment: -100
  };
}

/**
 * Generate simple muscle status list
 *
 * @param recoveryState - Complete recovery state
 * @returns Array of simple muscle statuses
 */
export function generateMuscleStatusList(
  recoveryState: RecoveryState
): SimpleMuscleStatus[] {
  const statuses: SimpleMuscleStatus[] = [];

  // Sort by recovery percentage (lowest first - most fatigued)
  const sortedMuscles = Array.from(recoveryState.muscles.entries())
    .sort((a, b) => a[1].recoveryPercentage - b[1].recoveryPercentage);

  for (const [muscleName, state] of sortedMuscles) {
    const status = getTrafficLightStatus(state.recoveryPercentage);
    let emoji = '🟢';
    let message = 'Ready';
    let daysUntilReady: number | null = null;

    if (status === 'yellow') {
      emoji = '🟡';
      const hoursUntilReady = state.estimatedFullRecoveryAt
        ? (state.estimatedFullRecoveryAt.getTime() - Date.now()) / (1000 * 60 * 60)
        : 24;
      daysUntilReady = Math.ceil(hoursUntilReady / 24);
      message = `${Math.round(state.recoveryPercentage)}% (rest ${daysUntilReady} more day${daysUntilReady === 1 ? '' : 's'})`;
    } else if (status === 'red') {
      emoji = '🔴';
      const hoursUntilReady = state.estimatedFullRecoveryAt
        ? (state.estimatedFullRecoveryAt.getTime() - Date.now()) / (1000 * 60 * 60)
        : 48;
      daysUntilReady = Math.ceil(hoursUntilReady / 24);
      message = `Skip work (rest ${daysUntilReady} days)`;
    }

    statuses.push({
      muscle: muscleName,
      status,
      emoji,
      message,
      daysUntilReady
    });
  }

  return statuses;
}

/**
 * Generate simple injury warning
 *
 * @param injuryRisk - Injury risk assessment
 * @returns Simple warning message (or null if no warning needed)
 */
export function generateInjuryWarning(
  injuryRisk: InjuryRiskAssessment
): SimpleWarning | null {
  if (injuryRisk.overallRiskLevel === 'low') {
    return null;
  }

  if (injuryRisk.overallRiskLevel === 'critical') {
    return {
      severity: 'critical',
      emoji: '🚨',
      title: 'STOP - INJURY RISK CRITICAL',
      message: 'Training at current load is extremely dangerous. Your body needs rest NOW.',
      actions: [
        'Take 1-2 weeks completely off',
        'Consider seeing a sports medicine professional',
        'When you return, cut volume in half'
      ]
    };
  }

  if (injuryRisk.overallRiskLevel === 'very_high') {
    return {
      severity: 'critical',
      emoji: '⚠️',
      title: 'SLOW DOWN',
      message: "You're pushing too hard this week. Injury risk is 3x higher right now.",
      actions: [
        'Take 2 rest days',
        'Then cut volume in half next week',
        'Trust the process. You\'ll come back stronger.'
      ]
    };
  }

  if (injuryRisk.overallRiskLevel === 'high') {
    return {
      severity: 'warning',
      emoji: '⚠️',
      title: 'Ease Up',
      message: 'Your training load is elevated. Reduce intensity to stay healthy.',
      actions: [
        'Reduce volume 30% this week',
        'Add an extra rest day',
        'Focus on recovery: sleep, nutrition, stress'
      ]
    };
  }

  // Moderate
  return {
    severity: 'info',
    emoji: 'ℹ️',
    title: 'Watch It',
    message: 'Fatigue is building up. Monitor closely.',
    actions: [
      'Consider a lighter session today',
      'Prioritize 8+ hours sleep',
      'Check back tomorrow for updated status'
    ]
  };
}

/**
 * Generate set recommendation message
 *
 * @param predictedWeight - Recommended weight (lbs)
 * @param lastWeight - Weight from last session (lbs)
 * @param confidence - Confidence level (0-1)
 * @param muscleRecovery - Recovery percentage (0-100)
 * @returns Simple set recommendation
 */
export function generateSetRecommendation(
  predictedWeight: number,
  lastWeight: number | null,
  confidence: number,
  muscleRecovery: number
): {
  weight: number;
  reps: number;
  message: string;
  subMessage: string | null;
  showConfidence: boolean;
} {
  // Round to nearest 5 lbs (or 2.5 if using microplates)
  const roundedWeight = Math.round(predictedWeight / 5) * 5;

  let message = '';
  let subMessage: string | null = null;

  if (lastWeight !== null) {
    const diff = roundedWeight - lastWeight;
    if (diff > 0) {
      message = `${roundedWeight} lbs`;
      subMessage = `+${diff} lbs from last time 💪`;
    } else if (diff < 0) {
      message = `${roundedWeight} lbs`;
      subMessage = `${diff} lbs (you're fatigued, scale back)`;
    } else {
      message = `${roundedWeight} lbs`;
      subMessage = `Same as last time`;
    }
  } else {
    message = `${roundedWeight} lbs`;
    subMessage = confidence < 0.5 ? 'Estimate (no history)' : null;
  }

  return {
    weight: roundedWeight,
    reps: 5, // Default reps (could be dynamic later)
    message,
    subMessage,
    showConfidence: confidence < 0.5
  };
}

/**
 * Generate recovery tips based on limiting factors
 *
 * @param limitingFactors - Array of limiting factors from context modifiers
 * @returns Array of actionable tips
 */
export function generateRecoveryTips(
  limitingFactors: string[]
): string[] {
  const tips: string[] = [];

  if (limitingFactors.includes('Sleep')) {
    tips.push('🛏️ Get 8+ hours of sleep tonight');
    tips.push('📵 No screens 1 hour before bed');
  }

  if (limitingFactors.includes('Nutrition')) {
    tips.push('🍗 Eat 1.6-2.2g protein per kg bodyweight');
    tips.push('🍚 Consume carbs within 2 hours post-workout');
  }

  if (limitingFactors.includes('Stress')) {
    tips.push('🧘 Take 10 min to meditate or decompress');
    tips.push('📅 Consider a deload week to reduce stress');
  }

  if (limitingFactors.includes('Active Injuries')) {
    tips.push('🩹 Work around injuries - don\'t push through pain');
    tips.push('🏥 Consider seeing a professional if pain persists');
  }

  if (limitingFactors.includes('Menstrual Cycle')) {
    tips.push('📉 It\'s normal to feel weaker during this phase');
    tips.push('🎯 Focus on technique work instead of PRs');
  }

  // Default tips if no specific limiting factors
  if (tips.length === 0) {
    tips.push('💧 Stay hydrated (3-4 liters per day)');
    tips.push('🚶 Light activity helps recovery (walk, stretch)');
  }

  return tips;
}

/**
 * Generate progress message for analytics
 *
 * @param volumeChange - % change in volume vs last month
 * @param strengthChange - % change in estimated 1RM
 * @param injuryFreeDays - Days since last injury
 * @returns Motivational progress message
 */
export function generateProgressMessage(
  volumeChange: number,
  strengthChange: number,
  injuryFreeDays: number
): {
  emoji: string;
  title: string;
  message: string;
} {
  if (strengthChange > 10) {
    return {
      emoji: '🚀',
      title: 'Beast Mode',
      message: `You're ${strengthChange.toFixed(0)}% stronger than last month. Keep crushing it.`
    };
  }

  if (strengthChange > 5) {
    return {
      emoji: '📈',
      title: 'Getting Stronger',
      message: `+${strengthChange.toFixed(0)}% strength gain this month. Solid progress.`
    };
  }

  if (injuryFreeDays > 90) {
    return {
      emoji: '💎',
      title: 'Iron Consistency',
      message: `${injuryFreeDays} days injury-free. You're doing it right.`
    };
  }

  if (volumeChange > 20) {
    return {
      emoji: '⚠️',
      title: 'Slow Down',
      message: `Volume up ${volumeChange.toFixed(0)}% this month. Too much too fast = injury risk.`
    };
  }

  return {
    emoji: '💪',
    title: 'Stay Consistent',
    message: 'Keep showing up. Progress takes time.'
  };
}

/**
 * Convert technical ACWR to simple message
 *
 * @param acwr - Acute:Chronic workload ratio
 * @returns Simple explanation
 */
export function explainACWR(acwr: number): string {
  if (acwr > 2.0) {
    return "You're doing 2x your normal training load. Way too much. Cut it in half.";
  }
  if (acwr > 1.5) {
    return "You're pushing 50% harder than usual. Injury risk is 3x higher. Ease up.";
  }
  if (acwr > 1.3) {
    return "Training load is elevated. Watch for signs of overtraining.";
  }
  if (acwr >= 0.8) {
    return "Training load is in the sweet spot. Keep it up.";
  }
  return "Training load is too low. You're detraining. Add more volume.";
}
