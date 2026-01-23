/**
 * Contextual Recovery Modifiers
 *
 * External factors that significantly affect recovery capacity.
 * These modifiers adjust base recovery rates from tissue-level calculations.
 *
 * Research Foundation:
 * - Halson (2014): Sleep and the elite athlete
 * - Dattilo et al. (2011): Sleep and muscle recovery
 * - Arnal et al. (2016): Effects of sleep extension on performance
 * - Phillips (2014): Protein requirements and optimal body composition
 * - Kreher & Schwartz (2012): Overtraining syndrome - stress and performance
 */

/**
 * Sleep Quality Assessment
 */
export interface SleepData {
  hours: number; // Total sleep hours (0-12)
  quality: 'poor' | 'fair' | 'good' | 'excellent'; // Subjective quality
  interruptions: number; // Number of wake-ups
  timestamp: Date;
}

/**
 * Nutrition Quality Assessment
 */
export interface NutritionData {
  proteinIntake: number; // Grams per kg bodyweight
  carbIntake: number; // Grams per kg bodyweight
  calorieBalance: 'deficit' | 'maintenance' | 'surplus';
  hydrationLevel: 'poor' | 'fair' | 'good' | 'excellent';
  mealTiming: 'poor' | 'fair' | 'good'; // Post-workout nutrition timing
  timestamp: Date;
}

/**
 * Stress Level Assessment
 */
export interface StressData {
  workStress: number; // 0-10 scale
  lifeStress: number; // 0-10 scale
  perceivedStress: number; // 0-10 scale (overall)
  restingHeartRate: number | null; // bpm (elevated = stress/overtraining)
  heartRateVariability: number | null; // ms (low = poor recovery)
  timestamp: Date;
}

/**
 * Training Age & Demographics
 */
export interface UserDemographics {
  age: number; // Years
  sex: 'male' | 'female' | 'other';
  trainingAge: number; // Years of consistent training
  athleticBackground: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  currentInjuries: string[]; // Active injuries
  chronicConditions: string[]; // Chronic health conditions
}

/**
 * Menstrual Cycle Tracking (for female users)
 */
export interface MenstrualCycleData {
  phase: 'follicular' | 'ovulation' | 'luteal' | 'menstruation' | 'unknown';
  dayInCycle: number | null; // 1-28+ (nullable if unknown)
  symptomsPresent: string[]; // e.g., cramps, fatigue, etc.
  hormonalContraception: boolean;
}

/**
 * Calculate sleep recovery modifier
 *
 * Research:
 * - Optimal: 7-9 hours, good quality = 1.0x recovery
 * - Suboptimal: 6-7 hours = 0.85x recovery
 * - Poor: <6 hours or poor quality = 0.65-0.75x recovery
 * - Excellent: 8-9 hours, excellent quality = 1.1-1.15x recovery
 *
 * @param sleepData - Last 7 days of sleep data
 * @returns Recovery multiplier (0.5-1.2)
 */
export function calculateSleepModifier(sleepData: SleepData[]): number {
  if (sleepData.length === 0) return 1.0; // No data = assume average

  // Average sleep hours over last 7 days
  const avgHours = sleepData.reduce((sum, s) => sum + s.hours, 0) / sleepData.length;

  // Quality score (poor=1, fair=2, good=3, excellent=4)
  const qualityScores = sleepData.map(s => {
    switch (s.quality) {
      case 'poor': return 1;
      case 'fair': return 2;
      case 'good': return 3;
      case 'excellent': return 4;
      default: return 2;
    }
  });
  const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;

  // Average interruptions
  const avgInterruptions = sleepData.reduce((sum, s) => sum + s.interruptions, 0) / sleepData.length;

  // Base modifier from hours
  let modifier = 1.0;
  if (avgHours >= 8 && avgHours <= 9) {
    modifier = 1.1; // Optimal range
  } else if (avgHours >= 7) {
    modifier = 1.0; // Good
  } else if (avgHours >= 6) {
    modifier = 0.85; // Suboptimal
  } else if (avgHours >= 5) {
    modifier = 0.7; // Poor
  } else {
    modifier = 0.55; // Very poor
  }

  // Adjust for quality (±0.15)
  const qualityAdjustment = (avgQuality - 2.5) * 0.06; // -0.09 to +0.09
  modifier += qualityAdjustment;

  // Adjust for interruptions (each interruption = -0.03)
  const interruptionPenalty = Math.min(0.2, avgInterruptions * 0.03);
  modifier -= interruptionPenalty;

  return Math.max(0.5, Math.min(1.2, modifier));
}

/**
 * Calculate nutrition recovery modifier
 *
 * Research:
 * - Protein: 1.6-2.2 g/kg optimal for recovery
 * - Carbs: 3-7 g/kg for glycogen resynthesis
 * - Calorie surplus: 1.05-1.1x recovery
 * - Calorie deficit: 0.85-0.9x recovery (harder to recover in deficit)
 * - Post-workout nutrition timing critical
 *
 * @param nutritionData - Recent nutrition data
 * @param bodyweight - User bodyweight in kg
 * @returns Recovery multiplier (0.7-1.15)
 */
export function calculateNutritionModifier(
  nutritionData: NutritionData | null,
  bodyweight: number
): number {
  if (!nutritionData) return 0.95; // No data = assume slightly suboptimal

  let modifier = 1.0;

  // Protein intake (critical for muscle recovery)
  if (nutritionData.proteinIntake >= 1.6 && nutritionData.proteinIntake <= 2.5) {
    modifier += 0.05; // Optimal protein
  } else if (nutritionData.proteinIntake >= 1.2) {
    modifier += 0.0; // Adequate
  } else if (nutritionData.proteinIntake >= 0.8) {
    modifier -= 0.1; // Suboptimal
  } else {
    modifier -= 0.2; // Inadequate
  }

  // Carb intake (critical for glycogen)
  if (nutritionData.carbIntake >= 3 && nutritionData.carbIntake <= 7) {
    modifier += 0.05; // Optimal carbs
  } else if (nutritionData.carbIntake >= 2) {
    modifier += 0.0; // Adequate
  } else {
    modifier -= 0.1; // Low carb (slower glycogen recovery)
  }

  // Calorie balance
  switch (nutritionData.calorieBalance) {
    case 'surplus':
      modifier += 0.05; // Easier to recover in surplus
      break;
    case 'maintenance':
      modifier += 0.0;
      break;
    case 'deficit':
      modifier -= 0.15; // Harder to recover in deficit
      break;
  }

  // Hydration
  const hydrationBonus = {
    poor: -0.1,
    fair: -0.03,
    good: 0.0,
    excellent: 0.03
  };
  modifier += hydrationBonus[nutritionData.hydrationLevel];

  // Meal timing (post-workout nutrition)
  const timingBonus = {
    poor: -0.08,
    fair: -0.02,
    good: 0.03
  };
  modifier += timingBonus[nutritionData.mealTiming];

  return Math.max(0.7, Math.min(1.15, modifier));
}

/**
 * Calculate stress recovery modifier
 *
 * Research:
 * - High cortisol impairs recovery (muscle protein synthesis)
 * - Elevated RHR = sympathetic overdrive (poor recovery)
 * - Low HRV = low parasympathetic (poor recovery)
 * - Chronic stress = 20-40% slower recovery
 *
 * @param stressData - Recent stress data
 * @returns Recovery multiplier (0.6-1.05)
 */
export function calculateStressModifier(stressData: StressData | null): number {
  if (!stressData) return 1.0; // No data = assume average

  let modifier = 1.0;

  // Perceived stress (0-10 scale)
  if (stressData.perceivedStress <= 3) {
    modifier += 0.05; // Low stress
  } else if (stressData.perceivedStress <= 5) {
    modifier += 0.0; // Moderate
  } else if (stressData.perceivedStress <= 7) {
    modifier -= 0.15; // High stress
  } else {
    modifier -= 0.3; // Very high stress
  }

  // Work + Life stress combined
  const totalStress = stressData.workStress + stressData.lifeStress;
  if (totalStress > 14) {
    modifier -= 0.1; // Extreme combined stress
  }

  // Resting Heart Rate (elevated RHR = overtraining/stress)
  if (stressData.restingHeartRate !== null) {
    // Typical RHR: 50-70 bpm (athletes)
    // Elevated: >75 bpm
    if (stressData.restingHeartRate > 80) {
      modifier -= 0.15; // Significantly elevated
    } else if (stressData.restingHeartRate > 75) {
      modifier -= 0.08; // Moderately elevated
    } else if (stressData.restingHeartRate < 60) {
      modifier += 0.03; // Good recovery (low RHR)
    }
  }

  // Heart Rate Variability (low HRV = poor recovery)
  if (stressData.heartRateVariability !== null) {
    // Typical HRV: 50-100 ms (varies by individual)
    // Low HRV = <40 ms (poor recovery)
    // High HRV = >80 ms (good recovery)
    if (stressData.heartRateVariability < 40) {
      modifier -= 0.2; // Very low HRV (overtraining)
    } else if (stressData.heartRateVariability < 60) {
      modifier -= 0.05; // Low HRV
    } else if (stressData.heartRateVariability > 80) {
      modifier += 0.05; // High HRV (good recovery)
    }
  }

  return Math.max(0.6, Math.min(1.05, modifier));
}

/**
 * Calculate training age & age recovery modifier
 *
 * Research:
 * - Beginners: Faster recovery (1.1-1.2x) - less muscle damage
 * - Intermediates: Normal recovery (1.0x)
 * - Advanced: Slower recovery (0.9-0.95x) - more muscle damage from heavier loads
 * - Elite: Slowest recovery (0.85-0.9x) - extreme training stress
 * - Age: ~1% slower recovery per year after 30
 *
 * @param demographics - User demographics
 * @returns Recovery multiplier (0.7-1.2)
 */
export function calculateTrainingAgeModifier(demographics: UserDemographics): number {
  let modifier = 1.0;

  // Training age effect
  switch (demographics.athleticBackground) {
    case 'beginner':
      modifier = 1.15; // Faster recovery (less damage)
      break;
    case 'intermediate':
      modifier = 1.0;
      break;
    case 'advanced':
      modifier = 0.93;
      break;
    case 'elite':
      modifier = 0.88; // Slower recovery (more damage from extreme loads)
      break;
  }

  // Age effect (decline after 30)
  if (demographics.age > 30) {
    const yearsOver30 = demographics.age - 30;
    const agePenalty = yearsOver30 * 0.008; // 0.8% per year
    modifier -= agePenalty;
  }

  // Bonus for youth (<25)
  if (demographics.age < 25) {
    modifier += 0.05;
  }

  // Active injury penalty
  if (demographics.currentInjuries.length > 0) {
    const injuryPenalty = demographics.currentInjuries.length * 0.08;
    modifier -= injuryPenalty;
  }

  // Chronic condition penalty
  if (demographics.chronicConditions.length > 0) {
    const conditionPenalty = demographics.chronicConditions.length * 0.05;
    modifier -= conditionPenalty;
  }

  return Math.max(0.7, Math.min(1.2, modifier));
}

/**
 * Calculate menstrual cycle recovery modifier (for female users)
 *
 * Research:
 * - Follicular phase (Days 1-14): Higher testosterone, better recovery (1.05x)
 * - Ovulation (Day 14): Peak performance potential (1.08x)
 * - Luteal phase (Days 15-28): Higher progesterone, slower recovery (0.92x)
 * - Menstruation (Days 1-5): Fatigue, reduced capacity (0.88x)
 * - Individual variation is high (some women show no cycle effect)
 *
 * @param cycleData - Menstrual cycle data
 * @returns Recovery multiplier (0.85-1.1)
 */
export function calculateMenstrualCycleModifier(
  cycleData: MenstrualCycleData | null
): number {
  if (!cycleData || cycleData.phase === 'unknown') return 1.0;

  // Hormonal contraception typically dampens cycle effects
  if (cycleData.hormonalContraception) return 1.0;

  let modifier = 1.0;

  switch (cycleData.phase) {
    case 'follicular':
      modifier = 1.05; // Rising estrogen, good recovery
      break;
    case 'ovulation':
      modifier = 1.08; // Peak hormones, best recovery
      break;
    case 'luteal':
      modifier = 0.92; // Rising progesterone, slower recovery
      break;
    case 'menstruation':
      modifier = 0.88; // Bleeding, fatigue, reduced capacity
      break;
  }

  // Symptom penalties
  if (cycleData.symptomsPresent.includes('severe_cramps')) {
    modifier -= 0.1;
  }
  if (cycleData.symptomsPresent.includes('extreme_fatigue')) {
    modifier -= 0.12;
  }
  if (cycleData.symptomsPresent.includes('heavy_bleeding')) {
    modifier -= 0.08;
  }

  return Math.max(0.85, Math.min(1.1, modifier));
}

/**
 * Calculate overall recovery capacity from all contextual factors
 *
 * @param sleepData - Recent sleep data
 * @param nutritionData - Recent nutrition data
 * @param stressData - Recent stress data
 * @param demographics - User demographics
 * @param cycleData - Menstrual cycle data (if applicable)
 * @param bodyweight - User bodyweight in kg
 * @returns Combined recovery modifier (0.4-1.4)
 */
export function calculateOverallRecoveryCapacity(
  sleepData: SleepData[],
  nutritionData: NutritionData | null,
  stressData: StressData | null,
  demographics: UserDemographics,
  cycleData: MenstrualCycleData | null,
  bodyweight: number
): {
  overallModifier: number;
  breakdown: {
    sleep: number;
    nutrition: number;
    stress: number;
    trainingAge: number;
    menstrualCycle: number;
  };
  limitingFactors: string[];
  recommendations: string[];
} {
  const sleepMod = calculateSleepModifier(sleepData);
  const nutritionMod = calculateNutritionModifier(nutritionData, bodyweight);
  const stressMod = calculateStressModifier(stressData);
  const trainingAgeMod = calculateTrainingAgeModifier(demographics);
  const cycleMod = demographics.sex === 'female'
    ? calculateMenstrualCycleModifier(cycleData)
    : 1.0;

  // Combined modifier (multiplicative)
  const overallModifier = sleepMod * nutritionMod * stressMod * trainingAgeMod * cycleMod;

  // Identify limiting factors (modifiers < 0.9)
  const limitingFactors: string[] = [];
  const recommendations: string[] = [];

  if (sleepMod < 0.9) {
    limitingFactors.push('Sleep');
    recommendations.push('Prioritize 7-9 hours of quality sleep. Recovery is 15-30% slower with poor sleep.');
  }

  if (nutritionMod < 0.9) {
    limitingFactors.push('Nutrition');
    recommendations.push('Increase protein to 1.6-2.2 g/kg bodyweight and ensure adequate carbs (3-5 g/kg) for glycogen replenishment.');
  }

  if (stressMod < 0.9) {
    limitingFactors.push('Stress');
    recommendations.push('High life stress is impairing recovery. Consider deload week, meditation, or stress management techniques.');
  }

  if (trainingAgeMod < 0.9) {
    if (demographics.currentInjuries.length > 0) {
      limitingFactors.push('Active Injuries');
      recommendations.push(`Active injuries detected: ${demographics.currentInjuries.join(', ')}. Modify training around injuries.`);
    }
    if (demographics.athleticBackground === 'advanced' || demographics.athleticBackground === 'elite') {
      limitingFactors.push('Training Status');
      recommendations.push('As an advanced lifter, you require more recovery time between sessions. Consider extra rest days.');
    }
  }

  if (cycleMod < 0.9 && demographics.sex === 'female') {
    limitingFactors.push('Menstrual Cycle');
    recommendations.push('Luteal/menstrual phase detected. Consider reducing volume by 10-20% or focusing on technique work.');
  }

  return {
    overallModifier: Math.max(0.4, Math.min(1.4, overallModifier)),
    breakdown: {
      sleep: sleepMod,
      nutrition: nutritionMod,
      stress: stressMod,
      trainingAge: trainingAgeMod,
      menstrualCycle: cycleMod
    },
    limitingFactors,
    recommendations
  };
}
