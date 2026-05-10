export type MetricConfidence = 'low' | 'medium' | 'high';
export type MetricDataSufficiency = 'baseline' | 'limited' | 'enough' | 'high';

export interface MetricExplanation {
  metric: string;
  value: number | string;
  label: string;
  confidence: MetricConfidence;
  dataSufficiency: MetricDataSufficiency;
  inputs: string[];
  reason: string;
  nextAction: string;
}

export function dataSufficiencyFromSampleCount(count: number): MetricDataSufficiency {
  if (count >= 12) return 'high';
  if (count >= 6) return 'enough';
  if (count >= 1) return 'limited';
  return 'baseline';
}

export function confidenceFromDataSufficiency(dataSufficiency: MetricDataSufficiency): MetricConfidence {
  if (dataSufficiency === 'high') return 'high';
  if (dataSufficiency === 'enough') return 'medium';
  return 'low';
}
