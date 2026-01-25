import type { WeightUnit } from './types';

export type UnitSystem = 'metric' | 'imperial';

export const KG_TO_LBS = 2.20462;
export const CM_TO_INCHES = 0.393701;

export const normalizeWeightUnit = (value?: string | null): WeightUnit =>
  value === 'kg' ? 'kg' : 'lbs';

export const unitSystemToWeightUnit = (system: UnitSystem): WeightUnit =>
  system === 'metric' ? 'kg' : 'lbs';

export const unitSystemToHeightUnit = (system: UnitSystem): 'cm' | 'in' =>
  system === 'metric' ? 'cm' : 'in';

export const weightUnitToUnitSystem = (unit: WeightUnit): UnitSystem =>
  unit === 'kg' ? 'metric' : 'imperial';

export const kgToLbs = (kg: number): number => kg * KG_TO_LBS;
export const lbsToKg = (lbs: number): number => lbs / KG_TO_LBS;

export const cmToInches = (cm: number): number => cm * CM_TO_INCHES;
export const inchesToCm = (inches: number): number => inches / CM_TO_INCHES;

export const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number => {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'kg' ? kgToLbs(value) : lbsToKg(value);
};

export const convertLength = (value: number, fromUnit: 'cm' | 'in', toUnit: 'cm' | 'in'): number => {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'cm' ? cmToInches(value) : inchesToCm(value);
};

