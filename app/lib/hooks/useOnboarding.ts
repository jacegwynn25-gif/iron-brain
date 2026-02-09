'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '../supabase/auth-context';
import { supabase } from '../supabase/client';

export type Goal = 'strength' | 'muscle' | 'fitness' | 'sport';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
type Sex = 'male' | 'female' | 'other';

interface OnboardingFormData {
  goal: Goal | null;
  experience: Experience | null;
  age: number | null;
  sex: Sex | null;
  bodyweight: number | null;
}

interface UseOnboardingReturn {
  // Navigation state
  step: number;
  totalSteps: number;

  // Form data
  formData: OnboardingFormData;

  // Async state
  error: Error | null;
  isSaving: boolean;

  // Computed
  canProceed: boolean;
  isComplete: boolean;

  // Actions
  advance: () => void;
  back: () => void;
  setGoal: (goal: Goal) => void;
  setExperience: (experience: Experience) => void;
  setAge: (age: number | null) => void;
  setSex: (sex: Sex | null) => void;
  setBodyweight: (bodyweight: number | null) => void;
  save: () => Promise<boolean>;
  reset: () => void;
}

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: 'iron_brain_onboarding_complete',
  USER_GOAL: 'iron_brain_user_goal',
  USER_EXPERIENCE: 'iron_brain_user_experience',
} as const;

const INITIAL_FORM_DATA: OnboardingFormData = {
  goal: null,
  experience: null,
  age: null,
  sex: null,
  bodyweight: null,
};

export function useOnboarding(): UseOnboardingReturn {
  const { user } = useAuth();

  // State
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const totalSteps = 5; // 0: Welcome, 1: Goal, 2: Experience, 3: Demographics, 4: Complete

  // Computed: can proceed to next step
  const canProceed = (() => {
    switch (step) {
      case 0:
        return true; // Welcome - always can proceed
      case 1:
        return formData.goal !== null;
      case 2:
        return formData.experience !== null;
      case 3:
        return formData.age !== null && formData.sex !== null;
      case 4:
        return true; // Complete screen
      default:
        return false;
    }
  })();

  // Actions
  const advance = useCallback(() => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    }
  }, [step]);

  const back = useCallback(() => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const setGoal = useCallback((goal: Goal) => {
    setFormData((prev) => ({ ...prev, goal }));
    setError(null);
  }, []);

  const setExperience = useCallback((experience: Experience) => {
    setFormData((prev) => ({ ...prev, experience }));
    setError(null);
  }, []);

  const setAge = useCallback((age: number | null) => {
    setFormData((prev) => ({ ...prev, age }));
    setError(null);
  }, []);

  const setSex = useCallback((sex: Sex | null) => {
    setFormData((prev) => ({ ...prev, sex }));
    setError(null);
  }, []);

  const setBodyweight = useCallback((bodyweight: number | null) => {
    setFormData((prev) => ({ ...prev, bodyweight }));
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setFormData(INITIAL_FORM_DATA);
    setError(null);
    setIsComplete(false);
  }, []);

  // Save to localStorage + Supabase
  const save = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      // 1. Always save to localStorage (offline-first)
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      localStorage.setItem(STORAGE_KEYS.USER_GOAL, formData.goal ?? '');
      localStorage.setItem(STORAGE_KEYS.USER_EXPERIENCE, formData.experience ?? '');

      // 2. If logged in, sync to Supabase
      if (user) {
        // Update auth metadata
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            onboarding_complete: true,
            user_goal: formData.goal ?? undefined,
            experience_level: formData.experience ?? undefined,
          },
        });

        if (authError) {
          throw new Error(`Auth update failed: ${authError.message}`);
        }

        // Save demographics if provided
        if (formData.age && formData.sex) {
          const trainingAge =
            formData.experience === 'beginner'
              ? 0.5
              : formData.experience === 'intermediate'
                ? 2
                : 5;

          const { error: demoError } = await supabase.from('user_demographics').upsert(
            {
              user_id: user.id,
              age: formData.age,
              sex: formData.sex,
              training_age: trainingAge,
              athletic_background: formData.experience ?? 'beginner',
              bodyweight: formData.bodyweight,
              height: null,
              current_injuries: [],
              chronic_conditions: [],
            },
            {
              onConflict: 'user_id',
            }
          );

          if (demoError) {
            throw new Error(`Demographics save failed: ${demoError.message}`);
          }
        }
      }

      setIsComplete(true);
      return true;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save onboarding data');
      setError(errorObj);
      console.error('Onboarding save error:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, formData]);

  return {
    step,
    totalSteps,
    formData,
    error,
    isSaving,
    canProceed,
    isComplete,
    advance,
    back,
    setGoal,
    setExperience,
    setAge,
    setSex,
    setBodyweight,
    save,
    reset,
  };
}
