const isEnabled = (value: string | undefined): boolean => value === 'true';

export const FEATURES = {
  programCalendar: isEnabled(process.env.NEXT_PUBLIC_FEATURE_PROGRAM_CALENDAR),
  adherenceAnalytics: isEnabled(process.env.NEXT_PUBLIC_FEATURE_ADHERENCE_ANALYTICS),
  coachCollab: isEnabled(process.env.NEXT_PUBLIC_FEATURE_COACH_COLLAB),
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const isFeatureEnabled = (key: FeatureKey): boolean => FEATURES[key];
