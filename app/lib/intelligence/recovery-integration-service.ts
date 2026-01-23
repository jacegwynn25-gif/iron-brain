/**
 * Recovery Integration Service
 *
 * Bridges the biological simulator modules with the app's database.
 * This is the critical integration layer that makes everything work together.
 *
 * Flow:
 * 1. Fetch workout history from database
 * 2. Fetch context data (sleep, nutrition, stress)
 * 3. Build recovery state using decay engine
 * 4. Calculate injury risk
 * 5. Apply Bayesian calibration if available
 * 6. Translate to simple messages for UI
 * 7. Cache results in recovery_snapshots table
 */

import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import {
  buildRecoveryState,
  type RecoveryState,
  type FatigueEvent
} from './recovery/decay-engine';
import {
  buildConnectiveTissueState,
  EXERCISE_CONNECTIVE_STRESS,
  type ConnectiveTissueState
} from './recovery/connective-tissue';
import {
  type EnergySystemState
} from './recovery/energy-systems';
import {
  calculateOverallRecoveryCapacity,
  type SleepData,
  type NutritionData,
  type StressData,
  type UserDemographics,
  type MenstrualCycleData
} from './recovery/context-modifiers';
import {
  buildInjuryRiskAssessment,
  type InjuryRiskAssessment
} from './recovery/injury-risk-scoring';
import {
  generateReadinessMessage,
  generateMuscleStatusList,
  generateInjuryWarning,
  type ReadinessMessage,
  type SimpleMuscleStatus,
  type SimpleWarning
} from './recovery/user-messaging';

/**
 * Complete Recovery Assessment Result
 */
export interface RecoveryAssessment {
  // Core State
  recoveryState: RecoveryState;
  injuryRisk: InjuryRiskAssessment;

  // Simplified for UI
  readinessMessage: ReadinessMessage;
  muscleStatuses: SimpleMuscleStatus[];
  injuryWarning: SimpleWarning | null;

  // Metadata
  computedAt: Date;
  dataQuality: 'high' | 'medium' | 'low'; // Based on available context data
  confidence: number; // 0-1
}

type RecoveryHistoryRow = Database['public']['Functions']['get_workout_history_for_recovery']['Returns'][number];
type UserContextRow = Database['public']['Tables']['user_context_data']['Row'];

/**
 * Fetch workout history and convert to fatigue events
 */
async function fetchWorkoutHistory(
  userId: string,
  daysBack: number = 90
): Promise<FatigueEvent[]> {
  const { data, error } = await supabase
    .rpc('get_workout_history_for_recovery', {
      p_user_id: userId,
      p_days_back: daysBack
    });

  if (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }

  const rows: RecoveryHistoryRow[] = data ?? [];
  return rows.map((row) => ({
    timestamp: new Date(row.event_timestamp),
    exerciseName: row.exercise_name,
    sets: row.sets,
    reps: row.reps,
    weight: row.weight,
    rpe: row.rpe,
    volume: row.volume,
    effectiveVolume: row.effective_volume,
    initialFatigue: row.initial_fatigue
  }));
}

/**
 * Fetch user context data (sleep, nutrition, stress)
 */
async function fetchContextData(userId: string, days: number = 7): Promise<{
  sleepData: SleepData[];
  nutritionData: NutritionData | null;
  stressData: StressData | null;
  demographics: UserDemographics | null;
  cycleData: MenstrualCycleData | null;
}> {
  // Fetch last 7 days of context data
  const { data: contextRows } = await supabase
    .from('user_context_data')
    .select('*')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('date', { ascending: false });

  // Fetch demographics
  const { data: demoData } = await supabase
    .from('user_demographics')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Fetch latest cycle data (for female users)
  const { data: cycleRows } = await supabase
    .from('menstrual_cycle_data')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1);

  // Convert to typed objects
  const sleepRows = (contextRows ?? []).filter(
    (row): row is UserContextRow & { sleep_hours: number } => row.sleep_hours !== null
  );
  const sleepData: SleepData[] = sleepRows.map((row) => ({
    hours: row.sleep_hours,
    quality: row.sleep_quality || 'fair',
    interruptions: row.sleep_interruptions || 0,
    timestamp: new Date(row.date)
  }));

  const latestContext = contextRows?.[0];
  const nutritionData: NutritionData | null = latestContext ? {
    proteinIntake: latestContext.protein_intake || 1.6,
    carbIntake: latestContext.carb_intake || 3.0,
    calorieBalance: latestContext.calorie_balance || 'maintenance',
    hydrationLevel: latestContext.hydration_level || 'good',
    mealTiming: latestContext.meal_timing || 'fair',
    timestamp: new Date(latestContext.date)
  } : null;

  const stressData: StressData | null = latestContext ? {
    workStress: latestContext.work_stress || 5,
    lifeStress: latestContext.life_stress || 5,
    perceivedStress: latestContext.perceived_stress || 5,
    restingHeartRate: latestContext.resting_heart_rate || null,
    heartRateVariability: latestContext.heart_rate_variability || null,
    timestamp: new Date(latestContext.date)
  } : null;

  const demographics: UserDemographics | null = demoData ? {
    age: demoData.age || 30,
    sex: demoData.sex || 'male',
    trainingAge: demoData.training_age || 1,
    athleticBackground: demoData.athletic_background || 'intermediate',
    currentInjuries: demoData.current_injuries || [],
    chronicConditions: demoData.chronic_conditions || []
  } : null;

  const latestCycle = cycleRows?.[0];
  const cycleData: MenstrualCycleData | null = latestCycle ? {
    phase: latestCycle.phase,
    dayInCycle: latestCycle.day_in_cycle,
    symptomsPresent: latestCycle.symptoms || [],
    hormonalContraception: latestCycle.hormonal_contraception || false
  } : null;

  return {
    sleepData,
    nutritionData,
    stressData,
    demographics,
    cycleData
  };
}

/**
 * Build complete recovery assessment
 *
 * This is the main entry point - call this to get full recovery data.
 */
export async function buildCompleteRecoveryAssessment(
  userId: string,
  currentTime: Date = new Date()
): Promise<RecoveryAssessment> {
  const startTime = Date.now();

  // 1. Fetch all data in parallel
  const [
    workoutHistory,
    contextData
  ] = await Promise.all([
    fetchWorkoutHistory(userId),
    fetchContextData(userId)
  ]);

  // 2. Build recovery state using decay engine
  const recoveryState = buildRecoveryState(workoutHistory, currentTime);

  // 3. Build connective tissue states
  const connectiveTissueStates: ConnectiveTissueState[] = [];
  const connectiveTissueNames = Object.keys(EXERCISE_CONNECTIVE_STRESS);

  for (const structureName of connectiveTissueNames) {
    const workoutHistoryForStructure = workoutHistory.map(event => ({
      timestamp: event.timestamp,
      exerciseName: event.exerciseName,
      sets: event.sets,
      reps: event.reps,
      rpe: event.rpe,
      isEccentric: false, // TODO: Get from event
      isBallistic: false
    }));

    const state = buildConnectiveTissueState(
      structureName,
      workoutHistoryForStructure,
      currentTime
    );

    if (state.currentStress > 20) {
      connectiveTissueStates.push(state);
    }
  }

  // 4. Build energy system states (for primary muscles)
  const energyStates: EnergySystemState[] = [];

  // 5. Calculate contextual recovery capacity
  const recoveryCapacityResult = calculateOverallRecoveryCapacity(
    contextData.sleepData,
    contextData.nutritionData,
    contextData.stressData,
    contextData.demographics || {
      age: 30,
      sex: 'male',
      trainingAge: 1,
      athleticBackground: 'intermediate',
      currentInjuries: [],
      chronicConditions: []
    },
    contextData.cycleData
  );

  // 6. Calculate ACWR
  const { data: acwrData } = await supabase
    .rpc('calculate_acwr', { p_user_id: userId });
  const acwr = acwrData || 1.0;

  // 7. Build injury risk assessment
  const injuryRisk = buildInjuryRiskAssessment(
    acwr,
    recoveryState,
    connectiveTissueStates,
    energyStates,
    recoveryCapacityResult.overallModifier
  );

  // 8. Generate simple messages for UI
  const primaryMuscleRecovery = recoveryState.overallRecoveryScore;
  const readinessMessage = generateReadinessMessage(
    recoveryState.overallRecoveryScore,
    primaryMuscleRecovery,
    injuryRisk
  );

  const muscleStatuses = generateMuscleStatusList(recoveryState);
  const injuryWarning = generateInjuryWarning(injuryRisk);

  // 9. Determine data quality
  let dataQuality: 'high' | 'medium' | 'low' = 'low';
  if (contextData.sleepData.length >= 5 && contextData.nutritionData && contextData.demographics) {
    dataQuality = 'high';
  } else if (contextData.sleepData.length >= 3 || contextData.nutritionData) {
    dataQuality = 'medium';
  }

  const confidence = dataQuality === 'high' ? 0.9 : dataQuality === 'medium' ? 0.7 : 0.5;

  // 10. Cache result in recovery_snapshots table
  const computationTimeMs = Date.now() - startTime;

  const { error: snapshotError } = await supabase
    .from('recovery_snapshots')
    .insert({
      user_id: userId,
      snapshot_timestamp: currentTime.toISOString(),
      overall_recovery_score: recoveryState.overallRecoveryScore,
      global_fatigue: recoveryState.globalFatigue,
      acwr,
      injury_risk_score: injuryRisk.overallRiskScore,
      injury_risk_level: injuryRisk.overallRiskLevel,
      muscle_states: Object.fromEntries(
        Array.from(recoveryState.muscles.entries()).map(([name, state]) => [
          name,
          {
            currentFatigue: state.currentFatigue,
            recoveryPercentage: state.recoveryPercentage,
            lastTrainedAt: state.lastTrainedAt?.toISOString()
          }
        ])
      ),
      exercise_states: Object.fromEntries(
        Array.from(recoveryState.exercises.entries()).map(([name, state]) => [
          name,
          {
            currentFatigue: state.currentFatigue,
            recoveryPercentage: state.recoveryPercentage,
            lastPerformedAt: state.lastPerformedAt?.toISOString()
          }
        ])
      ),
      energy_states: {},
      connective_tissue_states: connectiveTissueStates.map(s => ({
        structure: s.structure,
        currentStress: s.currentStress,
        riskLevel: s.riskLevel
      })),
      warnings: injuryRisk.warnings,
      recommendations: injuryRisk.recommendations,
      computation_time_ms: computationTimeMs
    });
  if (snapshotError) {
    console.warn('Failed to cache recovery snapshot:', snapshotError);
  }

  return {
    recoveryState,
    injuryRisk,
    readinessMessage,
    muscleStatuses,
    injuryWarning,
    computedAt: currentTime,
    dataQuality,
    confidence
  };
}

/**
 * Get cached recovery assessment (if recent enough)
 */
export async function getCachedRecoveryAssessment(
  userId: string,
  maxAgeMinutes: number = 30
): Promise<RecoveryAssessment | null> {
  const { data } = await supabase
    .from('recovery_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('snapshot_timestamp', new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString())
    .order('snapshot_timestamp', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  // Reconstruct assessment from cached data
  // This is a simplified version - in production you'd want full reconstruction
  return null; // For now, always compute fresh
}

/**
 * Get recovery assessment (with caching)
 */
export async function getRecoveryAssessment(
  userId: string,
  useCached: boolean = true
): Promise<RecoveryAssessment> {
  if (useCached) {
    const cached = await getCachedRecoveryAssessment(userId);
    if (cached) return cached;
  }

  return buildCompleteRecoveryAssessment(userId);
}
