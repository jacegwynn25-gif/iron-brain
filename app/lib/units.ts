import type { WeightUnit } from './types';

export const KG_TO_LBS = 2.20462;
export const CM_TO_INCHES = 0.393701;

export const kgToLbs = (kg: number): number => kg * KG_TO_LBS;
export const lbsToKg = (lbs: number): number => lbs / KG_TO_LBS;

export const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number => {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'kg' ? kgToLbs(value) : lbsToKg(value);
};
