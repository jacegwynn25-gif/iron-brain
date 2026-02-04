/**
 * Spotter user messaging layer.
 *
 * This module only formats messages from already computed readiness data.
 */

import type { TrainingReadiness } from '../recovery-integration-service';

export type SpotterMode = 'recovery_focused' | 'balanced' | 'high_performance';

export interface DailyBriefing {
  mode: SpotterMode;
  title: string;
  message: string;
  recommendation: string;
  score: number;
  modifier: number;
}

export function generateDailyBriefing(readiness: TrainingReadiness): DailyBriefing {
  if (readiness.score < 50) {
    return {
      mode: 'recovery_focused',
      title: 'Recovery Focused',
      message: `Recovery-focused day. ${readiness.reason}`,
      recommendation: readiness.recommendation,
      score: readiness.score,
      modifier: readiness.modifier
    };
  }

  if (readiness.score > 80) {
    return {
      mode: 'high_performance',
      title: 'High Performance',
      message: `High-performance day. ${readiness.reason}`,
      recommendation: readiness.recommendation,
      score: readiness.score,
      modifier: readiness.modifier
    };
  }

  return {
    mode: 'balanced',
    title: 'Balanced Training',
    message: `Train with moderation. ${readiness.reason}`,
    recommendation: readiness.recommendation,
    score: readiness.score,
    modifier: readiness.modifier
  };
}

export function generateSpotterBriefing(readiness: TrainingReadiness): DailyBriefing {
  return generateDailyBriefing(readiness);
}
