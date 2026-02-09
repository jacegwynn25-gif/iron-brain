'use client';

import { useState, useEffect, useCallback } from 'react';
import { CM_TO_INCHES, KG_TO_LBS } from '../units';

type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'iron_brain_unit_system';
const STORAGE_EVENT = 'iron_brain_unit_system_change';

interface UnitConversions {
  // Weight conversions
  kgToLbs: (kg: number) => number;
  lbsToKg: (lbs: number) => number;
  // Height conversions
  cmToInches: (cm: number) => number;
  inchesToCm: (inches: number) => number;
  // Display helpers - convert from metric (storage) to display unit
  displayWeight: (kg: number | null) => string;
  displayHeight: (cm: number | null) => string;
  // Labels
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
  // Validation ranges
  weightRange: { min: number; max: number };
  heightRange: { min: number; max: number };
}

interface UseUnitPreferenceReturn extends UnitConversions {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  // Parse user input to metric for storage
  parseWeightInput: (value: number) => number;
  parseHeightInput: (value: number) => number;
}

export function useUnitPreference(): UseUnitPreferenceReturn {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [hydrated, setHydrated] = useState(false);

  // Load preference from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'metric' || stored === 'imperial') {
      setUnitSystemState(stored);
    }
    setHydrated(true);
  }, []);

  // Sync unit preference across multiple hook instances (and tabs)
  useEffect(() => {
    const syncFromStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'metric' || stored === 'imperial') {
        setUnitSystemState(stored);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      syncFromStorage();
    };

    const handleCustomEvent = () => {
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener(STORAGE_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener(STORAGE_EVENT, handleCustomEvent);
    };
  }, []);

  // Save preference to localStorage
  const setUnitSystem = useCallback((system: UnitSystem) => {
    setUnitSystemState(system);
    localStorage.setItem(STORAGE_KEY, system);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  // Conversion functions
  const kgToLbs = useCallback((kg: number) => kg * KG_TO_LBS, []);
  const lbsToKg = useCallback((lbs: number) => lbs / KG_TO_LBS, []);
  const cmToInches = useCallback((cm: number) => cm * CM_TO_INCHES, []);
  const inchesToCm = useCallback((inches: number) => inches / CM_TO_INCHES, []);

  // Display helpers - convert from metric (storage) to display unit
  const displayWeight = useCallback((kg: number | null): string => {
    if (kg === null) return '';
    const value = unitSystem === 'metric' ? kg : kgToLbs(kg);
    return value.toFixed(1);
  }, [unitSystem, kgToLbs]);

  const displayHeight = useCallback((cm: number | null): string => {
    if (cm === null) return '';
    const value = unitSystem === 'metric' ? cm : cmToInches(cm);
    return value.toFixed(1);
  }, [unitSystem, cmToInches]);

  // Parse user input to metric for storage
  const parseWeightInput = useCallback((value: number): number => {
    return unitSystem === 'metric' ? value : lbsToKg(value);
  }, [unitSystem, lbsToKg]);

  const parseHeightInput = useCallback((value: number): number => {
    return unitSystem === 'metric' ? value : inchesToCm(value);
  }, [unitSystem, inchesToCm]);

  // Labels based on unit system
  const weightUnit: 'kg' | 'lbs' = unitSystem === 'metric' ? 'kg' : 'lbs';
  const heightUnit: 'cm' | 'in' = unitSystem === 'metric' ? 'cm' : 'in';

  // Validation ranges
  const weightRange = unitSystem === 'metric'
    ? { min: 30, max: 300 }
    : { min: 66, max: 660 };
  const heightRange = unitSystem === 'metric'
    ? { min: 100, max: 250 }
    : { min: 39, max: 98 };

  return {
    unitSystem: hydrated ? unitSystem : 'metric', // Prevent hydration mismatch
    setUnitSystem,
    kgToLbs,
    lbsToKg,
    cmToInches,
    inchesToCm,
    displayWeight,
    displayHeight,
    parseWeightInput,
    parseHeightInput,
    weightUnit,
    heightUnit,
    weightRange,
    heightRange,
  };
}
