'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CM_TO_INCHES, KG_TO_LBS } from '../units';
import { supabase } from '../supabase/client';
import { useAuth } from '../supabase/auth-context';

type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'iron_brain_unit_system';
const STORAGE_EVENT = 'iron_brain_unit_system_change';
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

const normalizeUnitSystem = (value?: string | null): UnitSystem | null => {
  if (value === 'metric' || value === 'imperial') return value;
  return null;
};

const unitSystemFromWeightUnit = (value?: string | null): UnitSystem | null => {
  if (value === 'kg') return 'metric';
  if (value === 'lbs') return 'imperial';
  return null;
};

const weightUnitFromSystem = (system: UnitSystem): 'kg' | 'lbs' =>
  system === 'metric' ? 'kg' : 'lbs';

const getLocaleUnitSystem = (): UnitSystem => {
  if (typeof navigator === 'undefined') return 'metric';

  try {
    const LocaleCtor = (Intl as unknown as { Locale?: new (tag: string) => { measurementSystem?: string } }).Locale;
    if (LocaleCtor) {
      const locale = new LocaleCtor(navigator.language);
      const measurementSystem = (locale as Intl.Locale & { measurementSystem?: string }).measurementSystem;
      if (measurementSystem === 'metric') return 'metric';
      if (measurementSystem === 'us' || measurementSystem === 'uk') return 'imperial';
    }
  } catch {
    // Ignore locale parsing errors and fall back to region heuristic.
  }

  const locale = navigator.languages?.[0] ?? navigator.language;
  const region = locale?.split(/[-_]/)[1]?.toUpperCase() ?? null;
  if (region && IMPERIAL_REGIONS.has(region)) return 'imperial';

  return 'metric';
};

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
  const { user, loading: authLoading } = useAuth();
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [hydrated, setHydrated] = useState(false);
  const syncedUserRef = useRef<string | null>(null);

  // Load preference from localStorage after hydration
  useEffect(() => {
    const stored = normalizeUnitSystem(localStorage.getItem(STORAGE_KEY));
    const resolved = stored ?? getLocaleUnitSystem();
    setUnitSystemState(resolved);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, resolved);
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
  const applyUnitSystem = useCallback((system: UnitSystem) => {
    setUnitSystemState(system);
    localStorage.setItem(STORAGE_KEY, system);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  // Sync preference from account settings (source of truth when logged in)
  useEffect(() => {
    if (!hydrated || authLoading) return;

    if (!user?.id) {
      syncedUserRef.current = null;
      return;
    }

    if (syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;

    let active = true;

    const syncFromAccount = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('weight_unit')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn('Failed to load unit preference from account settings:', error.message);
        return;
      }

      const systemFromDb = unitSystemFromWeightUnit(data?.weight_unit ?? null);
      if (systemFromDb) {
        applyUnitSystem(systemFromDb);
        return;
      }

      void supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, weight_unit: weightUnitFromSystem(unitSystem) },
          { onConflict: 'user_id' }
        );
    };

    void syncFromAccount();

    return () => {
      active = false;
    };
  }, [applyUnitSystem, authLoading, hydrated, user?.id, unitSystem]);

  const setUnitSystem = useCallback((system: UnitSystem) => {
    applyUnitSystem(system);
    if (!user?.id) return;
    void supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, weight_unit: weightUnitFromSystem(system) },
        { onConflict: 'user_id' }
      );
  }, [applyUnitSystem, user]);

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
