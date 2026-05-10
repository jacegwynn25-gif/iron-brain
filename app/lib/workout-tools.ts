import type { WeightUnit } from './types';

export type PlateLoadInput = {
  targetWeight: number;
  unit: WeightUnit;
  barWeight?: number;
  availablePlates?: number[];
};

export type PlateLoadResult = {
  targetWeight: number;
  actualWeight: number;
  delta: number;
  barWeight: number;
  sideWeight: number;
  platesPerSide: Array<{ weight: number; count: number }>;
  unit: WeightUnit;
};

export type WarmupSetTarget = {
  weight: number;
  reps: number;
  label: string;
  percentage: number;
};

export type WarmupPlanInput = {
  targetWeight: number;
  targetReps: number;
  unit: WeightUnit;
  barWeight?: number;
};

const DEFAULT_BAR_WEIGHT: Record<WeightUnit, number> = {
  lbs: 45,
  kg: 20,
};

const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

const BARBELL_LOAD_INCREMENT: Record<WeightUnit, number> = {
  lbs: 5,
  kg: 2.5,
};

const WARMUP_STEPS = [
  { percentage: 0, reps: 10, label: 'BAR' },
  { percentage: 0.4, reps: 8, label: '40%' },
  { percentage: 0.55, reps: 5, label: '55%' },
  { percentage: 0.7, reps: 3, label: '70%' },
  { percentage: 0.82, reps: 1, label: '82%' },
];

function finitePositive(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function roundToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(value) || increment <= 0) return 0;
  return Number((Math.round(value / increment) * increment).toFixed(2));
}

function formatDelta(value: number): number {
  return Math.abs(value) < 0.001 ? 0 : Number(value.toFixed(2));
}

function warmupRepsForStep(percentage: number, defaultReps: number, targetReps: number): number {
  if (targetReps <= 3) {
    if (percentage === 0) return 5;
    if (percentage <= 0.4) return 3;
    return percentage <= 0.55 ? 2 : 1;
  }
  return defaultReps;
}

export function getDefaultBarWeight(unit: WeightUnit): number {
  return DEFAULT_BAR_WEIGHT[unit];
}

export function getDefaultPlates(unit: WeightUnit): number[] {
  return DEFAULT_PLATES[unit];
}

export function calculatePlateLoad(input: PlateLoadInput): PlateLoadResult {
  const unit = input.unit;
  const targetWeight = finitePositive(input.targetWeight, DEFAULT_BAR_WEIGHT[unit]);
  const barWeight = finitePositive(input.barWeight, DEFAULT_BAR_WEIGHT[unit]);
  const availablePlates = [...(input.availablePlates ?? DEFAULT_PLATES[unit])]
    .filter((plate) => Number.isFinite(plate) && plate > 0)
    .sort((a, b) => b - a);
  const smallestPlate = availablePlates[availablePlates.length - 1] ?? 0;
  const desiredSideWeight = Math.max(0, (targetWeight - barWeight) / 2);
  const closestSideWeight = smallestPlate > 0
    ? roundToIncrement(desiredSideWeight, smallestPlate)
    : 0;

  let remainingPerSide = closestSideWeight;
  const platesPerSide: Array<{ weight: number; count: number }> = [];

  for (const plate of availablePlates) {
    const count = Math.floor((remainingPerSide + 0.001) / plate);
    if (count <= 0) continue;
    platesPerSide.push({ weight: plate, count });
    remainingPerSide = Number((remainingPerSide - count * plate).toFixed(4));
  }

  const loadedSideWeight = platesPerSide.reduce((sum, plate) => sum + plate.weight * plate.count, 0);
  const actualWeight = Number((barWeight + loadedSideWeight * 2).toFixed(2));

  return {
    targetWeight,
    actualWeight,
    delta: formatDelta(actualWeight - targetWeight),
    barWeight,
    sideWeight: Number(loadedSideWeight.toFixed(2)),
    platesPerSide,
    unit,
  };
}

export function buildWarmupPlan(input: WarmupPlanInput): WarmupSetTarget[] {
  const unit = input.unit;
  const barWeight = finitePositive(input.barWeight, DEFAULT_BAR_WEIGHT[unit]);
  const targetWeight = finitePositive(input.targetWeight, 0);
  const targetReps = Math.max(1, Math.round(finitePositive(input.targetReps, 8)));
  if (targetWeight <= barWeight) return [];

  const increment = BARBELL_LOAD_INCREMENT[unit];
  const maxWarmupWeight = roundToIncrement(targetWeight - increment, increment);
  const usedWeights = new Set<number>();

  return WARMUP_STEPS.map((step): WarmupSetTarget | null => {
    const rawWeight = step.percentage === 0 ? barWeight : targetWeight * step.percentage;
    const weight = Math.min(maxWarmupWeight, Math.max(barWeight, roundToIncrement(rawWeight, increment)));
    if (weight >= targetWeight || usedWeights.has(weight)) return null;
    usedWeights.add(weight);

    return {
      weight,
      reps: warmupRepsForStep(step.percentage, step.reps, targetReps),
      label: step.label,
      percentage: step.percentage,
    };
  }).filter((set): set is WarmupSetTarget => Boolean(set));
}
