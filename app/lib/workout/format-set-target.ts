import type { WeightUnit } from '@/app/lib/types';
import type { TrainingRecommendation, TrainingRecommendationTarget } from '@/app/lib/intelligence/training-recommendations';

export function formatSetTargetWeight(
  value: number | null | undefined,
  unit: WeightUnit | string | null | undefined
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const label = unit === 'kg' ? 'kg' : 'lbs';
  const display = label === 'kg' ? Number(value.toFixed(2)).toString() : Math.round(value).toString();
  return `${display} ${label}`;
}

export function formatSetTarget(
  target: TrainingRecommendationTarget | null | undefined,
  unitFallback: WeightUnit | string | null | undefined = 'lbs'
): string | null {
  const unit = target?.weightUnit ?? unitFallback;
  const weightText = formatSetTargetWeight(target?.weight ?? null, unit);
  const repsText = target?.reps != null ? `${Math.round(target.reps)}` : null;
  const joined = [weightText, repsText].filter(Boolean).join(' × ');
  if (joined) return joined;
  if (target?.restSeconds != null) return `+${target.restSeconds}s rest`;
  return null;
}

export function formatRecommendationSource(source: TrainingRecommendation['source']): string {
  if (source === 'exercise_history') return 'History';
  if (source === 'session_fatigue') return 'Set Signal';
  if (source === 'load_pressure') return 'Load';
  if (source === 'performance_trend') return 'Trend';
  if (source === 'prescription') return 'Plan';
  if (source === 'readiness') return 'Readiness';
  if (source === 'e1rm') return 'Max Data';
  if (source === 'program_load') return 'Program';
  return 'Baseline';
}

export function formatRecommendationTrustLabel(
  recommendation: Pick<TrainingRecommendation, 'confidence' | 'dataSufficiency' | 'evidenceSource'> | null | undefined
): string | null {
  if (!recommendation) return null;
  if (
    recommendation.dataSufficiency === 'baseline' ||
    recommendation.evidenceSource === 'baseline'
  ) {
    return 'Baseline';
  }
  if (
    recommendation.confidence === 'low' ||
    recommendation.dataSufficiency === 'limited'
  ) {
    return 'Limited data';
  }
  return null;
}

export function formatRecommendationA11yDetail(recommendation: TrainingRecommendation): string {
  const source = formatRecommendationSource(recommendation.source);
  const data = recommendation.dataSufficiency ? `, ${recommendation.dataSufficiency} data` : '';
  return `${source} signal. ${recommendation.confidence} confidence${data}.`;
}
