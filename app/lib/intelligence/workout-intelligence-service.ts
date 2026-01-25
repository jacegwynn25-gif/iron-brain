/**
 * Workout Intelligence Service
 *
 * Unified service that connects PhD-level analytics models to real-time workout suggestions.
 * This is the bridge between AdvancedAnalyticsDashboard (analytics) and WorkoutLogger (real-time).
 *
 * Features:
 * - Pre-workout readiness assessment (ACWR, recovery, fitness-fatigue)
 * - Real-time set recommendations (hierarchical models, exercise-specific rates)
 * - Session fatigue monitoring (cumulative fatigue, RPE patterns)
 * - Post-workout model updates (cache invalidation, incremental updates)
 * - Offline-first with graceful degradation
 */

import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import { logger } from '../logger';
import type { WorkoutSession, SetLog } from '../types';
import { getWorkoutHistory } from '../storage';
import {
  calculateACWR,
  updateFitnessFatigueModel,
  calculateTrainingLoad,
  type FitnessFatigueModel,
  type WorkloadMetrics
} from '../stats/adaptive-recovery';
import {
  buildHierarchicalFatigueModel,
  type HierarchicalFatigueModel
} from '../stats/hierarchical-models';
import {
  getRecoveryProfiles,
  type RecoveryProfile
} from '../fatigue/cross-session';
import {
  getOrBuildHierarchicalModel,
  incrementalModelUpdate
} from '../supabase/model-cache';
import { convertWeight } from '../units';

// ============================================================
// INTERFACES
// ============================================================

export interface PreWorkoutReadiness {
  overallScore: number; // 1-10
  overallStatus: 'excellent' | 'good' | 'moderate' | 'poor';
  acwr: number;
  acwrStatus: string;
  fitnessScore: number;
  fatigueScore: number;
  performanceScore: number;
  muscleReadiness: Array<{
    muscle: string;
    score: number;
    status: 'ready' | 'recovering' | 'fatigued';
    recoveryPercentage: number;
    hoursUntilReady?: number;
  }>;
  warnings: string[];
  recommendations: string[];
  confidence: number; // 0-1
}

export interface SetRecommendation {
  suggestedWeight: number;
  suggestedReps: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  baseline: {
    source: 'historical' | 'prescribed' | 'default';
    weight: number;
    reps: number;
  };
  adjustments: Array<{
    factor: string;
    adjustment: number;
    reason: string;
  }>;
  fatigueAlert?: {
    severity: 'mild' | 'moderate' | 'high' | 'critical';
    message: string;
    suggestedReduction: number;
    affectedMuscles: string[];
  };
}

export interface SessionFatigueAssessment {
  overallFatigue: number; // 0-100
  shouldReduceWeight: boolean;
  reductionPercent: number;
  affectedMuscles: string[];
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  reasoning: string;
  indicators: {
    rpeOvershoot: number; // Average RPE overshoot
    formBreakdown: number; // Count of sets with form breakdown
    unintentionalFailure: number; // Count of unintentional failures
    volumeAccumulation: number; // Total volume this session
  };
  confidence: number; // 0-1
}

const defaultWorkloadMetrics: WorkloadMetrics = {
  acuteLoad: 0,
  chronicLoad: 0,
  acwr: 1.0,
  trainingMonotony: 0,
  trainingStrain: 0,
  status: 'maintaining',
  recommendation: '',
  scientificBasis: ''
};

const defaultFitnessFatigueModel: FitnessFatigueModel = {
  userId: 'local',
  muscleGroup: 'overall',
  fitnessDecayRate: 7,
  fatigueDecayRate: 2,
  fitnessGainCoefficient: 1,
  fatigueGainCoefficient: 2,
  currentFitness: 50,
  currentFatigue: 25,
  netPerformance: 25,
  lastTrained: new Date(0),
  confidence: 0
};

type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  | 'exercise_id'
  | 'exercise_slug'
  | 'set_index'
  | 'prescribed_reps'
  | 'prescribed_rpe'
  | 'prescribed_rir'
  | 'actual_weight'
  | 'weight_unit'
  | 'actual_reps'
  | 'actual_rpe'
  | 'actual_rir'
  | 'e1rm'
  | 'volume_load'
  | 'completed'
  | 'performed_at'
>;

type SupabaseWorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'] & {
  set_logs?: SupabaseSetLogRow[] | null;
};

type SessionMetadata = {
  programName?: string;
  programId?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: number;
  dayName?: string;
};

type ProProfileRow = {
  is_pro: boolean | null;
};

const resolveProStatus = (profile: unknown): boolean => {
  const profileData = profile as ProProfileRow | null;
  return profileData?.is_pro ?? false;
};

// ============================================================
// WORKOUT INTELLIGENCE SERVICE
// ============================================================

export class WorkoutIntelligenceService {
  private userId: string | null;
  private hierarchicalModel: HierarchicalFatigueModel | null = null;
  private fitnessFatigueModel: FitnessFatigueModel | null = null;
  private recoveryProfiles: RecoveryProfile[] = [];
  private acwrMetrics: WorkloadMetrics | null = null;
  private lastUpdate: number = 0;
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string | null) {
    this.userId = userId;
  }

  // ============================================================
  // PRE-WORKOUT READINESS ASSESSMENT
  // ============================================================

  async getPreWorkoutReadiness(plannedExercises?: string[]): Promise<PreWorkoutReadiness> {
    try {
      logger.debug('🏋️ getPreWorkoutReadiness: Starting for userId:', this.userId);

      // Check if user has Pro access
      let isPro = false;
      if (this.userId) {
        try {
          // TODO: Update types after running migration 003_subscription_system
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('is_pro')
            .eq('id', this.userId)
            .single();
          isPro = resolveProStatus(profile);
        } catch (err) {
          console.warn('Could not check Pro status:', err);
        }
      }

      // Ensure models are loaded
      logger.debug('📊 getPreWorkoutReadiness: Loading models...');
      await this.loadModels();
      logger.debug('✅ getPreWorkoutReadiness: Models loaded');

      // 1. Get ACWR metrics
      const acwrData = this.acwrMetrics ?? defaultWorkloadMetrics;
      logger.debug('📈 getPreWorkoutReadiness: ACWR data:', acwrData);

      // 2. Get recovery profiles
      let recoveryData: RecoveryProfile[] = [];
      if (this.userId) {
        try {
          logger.debug('💪 getPreWorkoutReadiness: Fetching recovery profiles...');
          recoveryData = await getRecoveryProfiles(this.userId);
          logger.debug('✅ getPreWorkoutReadiness: Got recovery profiles:', recoveryData.length);
        } catch (err) {
          console.warn('Could not load recovery profiles:', err);
        }
      }
      this.recoveryProfiles = recoveryData;

      // 3. Get fitness-fatigue state
      const ffModel = this.fitnessFatigueModel ?? defaultFitnessFatigueModel;

      // 4. Calculate muscle readiness for planned exercises
      const muscleReadiness = this.calculateMuscleReadiness(plannedExercises);

      // 5. Calculate overall readiness score (1-10)
      const overallScore = this.calculateOverallReadiness(
        acwrData.acwr,
        ffModel.netPerformance,
        muscleReadiness
      );

      // 6. Determine overall status
      const overallStatus = this.getReadinessStatus(overallScore);

      // 7. Generate warnings and recommendations
      const warnings = this.generateWarnings(acwrData, muscleReadiness, ffModel);
      const recommendations = this.generateRecommendations(acwrData, muscleReadiness, ffModel);

      // 8. Calculate confidence based on data availability
      const confidence = this.calculateReadinessConfidence();

      // Build full readiness result
      const fullReadiness: PreWorkoutReadiness = {
        overallScore,
        overallStatus,
        acwr: acwrData.acwr,
        acwrStatus: acwrData.status,
        fitnessScore: ffModel.currentFitness,
        fatigueScore: ffModel.currentFatigue,
        performanceScore: ffModel.netPerformance,
        muscleReadiness,
        warnings,
        recommendations,
        confidence
      };

      // If not Pro, return limited/blurred version
      if (!isPro) {
        return {
          overallScore: Math.round(fullReadiness.overallScore), // No decimals for free tier
          overallStatus: fullReadiness.overallStatus,
          acwr: 0, // Hidden
          acwrStatus: 'upgrade_required',
          fitnessScore: 0,
          fatigueScore: 0,
          performanceScore: 0,
          muscleReadiness: [], // Empty - no per-muscle breakdown
          warnings: ['Upgrade to Iron Pro to see detailed readiness metrics'],
          recommendations: ['Join Founding Members for $149 lifetime access', 'Or subscribe monthly for $12.99/month'],
          confidence: 0
        };
      }

      return fullReadiness;
    } catch (err) {
      console.error('Error calculating pre-workout readiness:', err);

      // Graceful degradation
      return {
        overallScore: 7,
        overallStatus: 'good',
        acwr: 1.0,
        acwrStatus: 'unknown',
        fitnessScore: 50,
        fatigueScore: 25,
        performanceScore: 25,
        muscleReadiness: [],
        warnings: ['Unable to calculate detailed readiness. Proceed with caution.'],
        recommendations: ['Start with lighter weights and assess how you feel.'],
        confidence: 0.3
      };
    }
  }

  // ============================================================
  // REAL-TIME SET RECOMMENDATION
  // ============================================================

  async getSetRecommendation(
    exerciseId: string,
    setNumber: number,
    targetReps: number,
    targetRPE: number | null,
    completedSessionSets: SetLog[]
  ): Promise<SetRecommendation> {
    try {
      // Check if user has Pro access
      let isPro = false;
      if (this.userId) {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('is_pro')
            .eq('id', this.userId)
            .single();
          isPro = resolveProStatus(profile);
        } catch (err) {
          console.warn('Could not check Pro status:', err);
        }
      }

      // Ensure models are loaded
      await this.loadModels();

      // 1. Get baseline weight (historical data or prescribed)
      const baseline = await this.getBaselineWeight(exerciseId, targetReps, completedSessionSets);

      // 2. Get exercise-specific fatigue rate from hierarchical model
      const exerciseFatigueRate = this.hierarchicalModel?.exerciseSpecificFactors.get(exerciseId)?.baselineFatigueRate || 0.15;

      // 3. Check muscle readiness for this exercise
      const muscleGroups = this.getMuscleGroupsForExercise(exerciseId);
      const muscleReadinessScores = muscleGroups.map(muscle => {
        const profile = this.recoveryProfiles.find(p => p.muscleGroup.toLowerCase() === muscle.toLowerCase());
        return profile?.readinessScore || 7; // Default to "good" if unknown
      });
      const avgMuscleReadiness = muscleReadinessScores.length > 0
        ? muscleReadinessScores.reduce((a, b) => a + b, 0) / muscleReadinessScores.length
        : 7;

      // 4. Calculate session fatigue
      const sessionFatigue = this.calculateSessionFatigue(completedSessionSets);

      // 5. Apply adjustments
      const adjustments: Array<{ factor: string; adjustment: number; reason: string }> = [];
      let finalWeight = baseline.weight;
      const finalReps = targetReps;

      // Adjustment 1: Muscle readiness
      if (avgMuscleReadiness < 6) {
        const reduction = (7 - avgMuscleReadiness) * 0.05; // 5% per point below 6
        adjustments.push({
          factor: 'muscle_readiness',
          adjustment: -reduction,
          reason: `Muscles not fully recovered (readiness: ${avgMuscleReadiness.toFixed(1)}/10)`
        });
        finalWeight *= (1 - reduction);
      }

      // Adjustment 2: ACWR (high workload)
      if (this.acwrMetrics && this.acwrMetrics.acwr > 1.5) {
        const reduction = (this.acwrMetrics.acwr - 1.3) * 0.1; // 10% per 0.1 above 1.3
        adjustments.push({
          factor: 'acwr_overreach',
          adjustment: -reduction,
          reason: `High training load (ACWR: ${this.acwrMetrics.acwr.toFixed(2)})`
        });
        finalWeight *= (1 - reduction);
      }

      // Adjustment 3: Session fatigue
      if (sessionFatigue > 60) {
        const reduction = (sessionFatigue - 50) * 0.003; // 0.3% per point above 50
        adjustments.push({
          factor: 'session_fatigue',
          adjustment: -reduction,
          reason: `High fatigue this session (${sessionFatigue.toFixed(0)}/100)`
        });
        finalWeight *= (1 - reduction);
      }

      // Adjustment 4: Exercise-specific fatigue rate (if higher than average)
      if (exerciseFatigueRate > 0.18) {
        const reduction = (exerciseFatigueRate - 0.15) * 0.5; // Reduce for high-fatigue exercises
        adjustments.push({
          factor: 'exercise_fatigue',
          adjustment: -reduction,
          reason: `This exercise fatigues you more than average`
        });
        finalWeight *= (1 - reduction);
      }

      // 6. Calculate confidence
      const confidence = this.calculateRecommendationConfidence(baseline.source, adjustments.length);

      // 7. Build reasoning
      const reasoning = this.buildRecommendationReasoning(baseline, adjustments);

      // 8. Check for fatigue alert
      const fatigueAlert = await this.checkFatigueAlert(completedSessionSets, sessionFatigue);

      // Build full recommendation
      const fullRecommendation: SetRecommendation = {
        suggestedWeight: Math.round(finalWeight),
        suggestedReps: finalReps,
        confidence,
        reasoning,
        baseline,
        adjustments,
        fatigueAlert
      };

      // If not Pro, return basic recommendation only
      if (!isPro) {
        return {
          suggestedWeight: baseline.weight, // No adjustments for free tier
          suggestedReps: finalReps,
          confidence: 'low',
          reasoning: 'Upgrade to Iron Pro for personalized weight recommendations based on your recovery and fatigue',
          baseline,
          adjustments: [],
          fatigueAlert: undefined
        };
      }

      return fullRecommendation;
    } catch (err) {
      console.error('Error generating set recommendation:', err);

      // Graceful fallback
      const historicalWeight = this.getLastWeightForExercise(exerciseId, completedSessionSets);
      return {
        suggestedWeight: historicalWeight || 135,
        suggestedReps: targetReps,
        confidence: 'low',
        reasoning: 'Using historical data only (models unavailable)',
        baseline: {
          source: 'default',
          weight: historicalWeight || 135,
          reps: targetReps
        },
        adjustments: []
      };
    }
  }

  // ============================================================
  // SESSION FATIGUE ASSESSMENT
  // ============================================================

  async assessSessionFatigue(completedSets: SetLog[]): Promise<SessionFatigueAssessment> {
    try {
      // Check if user has Pro access
      let isPro = false;
      if (this.userId) {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('is_pro')
            .eq('id', this.userId)
            .single();
          isPro = resolveProStatus(profile);
        } catch (err) {
          console.warn('Could not check Pro status:', err);
        }
      }

      // Free tier: basic fatigue tracking only
      if (!isPro) {
        const basicFatigue = Math.min(100, completedSets.length * 8); // Simple count-based
        return {
          overallFatigue: basicFatigue,
          shouldReduceWeight: basicFatigue > 60,
          reductionPercent: basicFatigue > 60 ? 10 : 0,
          affectedMuscles: [],
          severity: basicFatigue > 80 ? 'high' : basicFatigue > 60 ? 'moderate' : 'mild',
          reasoning: 'Upgrade to Iron Pro for detailed fatigue analysis and personalized recommendations',
          indicators: {
            rpeOvershoot: 0,
            formBreakdown: 0,
            unintentionalFailure: 0,
            volumeAccumulation: 0
          },
          confidence: 0.3
        };
      }

      if (completedSets.length === 0) {
        return {
          overallFatigue: 0,
          shouldReduceWeight: false,
          reductionPercent: 0,
          affectedMuscles: [],
          severity: 'mild',
          reasoning: 'No sets completed yet',
          indicators: {
            rpeOvershoot: 0,
            formBreakdown: 0,
            unintentionalFailure: 0,
            volumeAccumulation: 0
          },
          confidence: 1.0
        };
      }

      // 1. Calculate fatigue indicators
      const indicators = this.calculateFatigueIndicators(completedSets);

      // 2. Calculate overall fatigue score (0-100)
      const overallFatigue = this.calculateSessionFatigue(completedSets);

      // 3. Determine severity
      const severity = this.getFatigueSeverity(overallFatigue, indicators);

      // 4. Determine if weight reduction is needed
      const shouldReduceWeight = severity === 'high' || severity === 'critical';
      const reductionPercent = this.calculateReductionPercent(severity);

      // 5. Identify affected muscles
      const affectedMuscles = this.getAffectedMuscles(completedSets);

      // 6. Build reasoning
      const reasoning = this.buildFatigueReasoning(indicators, overallFatigue, severity);

      // 7. Calculate confidence
      const confidence = Math.min(1.0, completedSets.length / 5); // More sets = higher confidence

      return {
        overallFatigue,
        shouldReduceWeight,
        reductionPercent,
        affectedMuscles,
        severity,
        reasoning,
        indicators,
        confidence
      };
    } catch (err) {
      console.error('Error assessing session fatigue:', err);

      return {
        overallFatigue: 50,
        shouldReduceWeight: false,
        reductionPercent: 0,
        affectedMuscles: [],
        severity: 'moderate',
        reasoning: 'Unable to calculate detailed fatigue. Monitor how you feel.',
        indicators: {
          rpeOvershoot: 0,
          formBreakdown: 0,
          unintentionalFailure: 0,
          volumeAccumulation: 0
        },
        confidence: 0.3
      };
    }
  }

  // ============================================================
  // POST-WORKOUT MODEL UPDATE
  // ============================================================

  async recordWorkoutCompletion(session: WorkoutSession): Promise<void> {
    try {
      if (!this.userId) {
        logger.debug('No user ID, skipping model update');
        return;
      }

      // 1. Save workout to Supabase (if not already saved)
      // This is typically already done by storage.ts saveWorkoutSession

      // 2. Trigger incremental model update
      await incrementalModelUpdate(this.userId, session);
      logger.debug('✅ Incremental model update complete');

      // 3. Invalidate local cache (force reload on next use)
      this.hierarchicalModel = null;
      this.fitnessFatigueModel = null;
      this.recoveryProfiles = [];
      this.acwrMetrics = null;
      this.lastUpdate = 0;

      logger.debug('✅ Workout intelligence cache invalidated');
    } catch (err) {
      console.error('Error recording workout completion:', err);
      // Non-critical - models will rebuild next time
    }
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  private async loadWorkoutHistory(): Promise<WorkoutSession[]> {
    logger.debug('📂 loadWorkoutHistory: Starting...');

    // Load from localStorage
    const localWorkouts = getWorkoutHistory();
    logger.debug('💾 loadWorkoutHistory: Got local workouts:', localWorkouts.length);

    // If we have a userId, also load from Supabase
    if (this.userId) {
      try {
        logger.debug('☁️ loadWorkoutHistory: Querying Supabase for userId:', this.userId);
        const { data: sessions, error } = await supabase
          .from('workout_sessions')
          .select(`
            *,
            set_logs (*)
          `)
          .eq('user_id', this.userId)
          .order('date', { ascending: false });

        logger.debug('☁️ loadWorkoutHistory: Supabase query complete', {
          sessions: sessions?.length || 0,
          error: error?.message
        });

        if (error) {
          console.warn('Could not load workouts from Supabase:', error);
          return localWorkouts;
        }

        // Transform Supabase data to WorkoutSession format
        const sessionRows: SupabaseWorkoutSessionRow[] = sessions ?? [];
        const supabaseWorkouts: WorkoutSession[] = sessionRows.map((s) => {
          const metadata = (s.metadata ?? {}) as SessionMetadata;
          return {
            id: s.id,
            programId: metadata.programId || '',
            programName: metadata.programName || s.name || 'Unknown',
            cycleNumber: metadata.cycleNumber || 1,
            weekNumber: metadata.weekNumber || 1,
            dayOfWeek: metadata.dayOfWeek != null ? String(metadata.dayOfWeek) : '',
            dayName: metadata.dayName || '',
            date: s.date,
          startTime: s.start_time || undefined,
          endTime: s.end_time || undefined,
          durationMinutes: s.duration_minutes || undefined,
          totalVolumeLoad: s.total_volume_load || undefined,
          averageRPE: s.average_rpe || undefined,
          sets: (s.set_logs || []).map((sl) => ({
            exerciseId: sl.exercise_id || sl.exercise_slug || '',
            setIndex: sl.set_index || 0,
            prescribedReps: sl.prescribed_reps != null ? String(sl.prescribed_reps) : '0',
            prescribedRPE: sl.prescribed_rpe,
            prescribedRIR: sl.prescribed_rir,
            actualWeight: sl.actual_weight,
            weightUnit: sl.weight_unit === 'kg' ? 'kg' : 'lbs',
            actualReps: sl.actual_reps,
            actualRPE: sl.actual_rpe,
            actualRIR: sl.actual_rir,
            e1rm: sl.e1rm,
            volumeLoad: sl.volume_load,
            completed: sl.completed !== false,
            formBreakdown: undefined,
            reachedFailure: undefined,
            timestamp: sl.performed_at || undefined
          })),
          createdAt: s.created_at || new Date().toISOString(),
          updatedAt: s.updated_at || new Date().toISOString()
          };
        });

        // Merge local and Supabase (deduplicate by id)
        const allWorkouts = [...localWorkouts, ...supabaseWorkouts];
        const uniqueWorkouts = Array.from(
          new Map(allWorkouts.map(w => [w.id, w])).values()
        );

        logger.debug(`📊 Loaded ${uniqueWorkouts.length} total workouts (${localWorkouts.length} local + ${supabaseWorkouts.length} Supabase)`);
        return uniqueWorkouts;
      } catch (err) {
        console.warn('Error loading from Supabase:', err);
        return localWorkouts;
      }
    }

    return localWorkouts;
  }

  private async loadModels(): Promise<void> {
    const now = Date.now();
    logger.debug('🔧 loadModels: Checking cache...', {
      cacheAge: now - this.lastUpdate,
      cacheDuration: this.cacheDuration,
      hasModel: !!this.hierarchicalModel
    });

    if (now - this.lastUpdate < this.cacheDuration && this.hierarchicalModel) {
      logger.debug('✅ loadModels: Using cached models');
      return;
    }

    try {
      logger.debug('📚 loadModels: Loading workout history...');
      // Load workout history from both localStorage and Supabase
      const workoutHistory = await this.loadWorkoutHistory();
      const completedWorkouts = workoutHistory.filter(w => w.endTime);

      logger.debug('📊 loadModels: Got workouts:', {
        total: workoutHistory.length,
        completed: completedWorkouts.length
      });

      if (completedWorkouts.length < 3) {
        logger.debug('⚠️ loadModels: Not enough workout history for models (need 3, have ' + completedWorkouts.length + ')');
        this.lastUpdate = now;
        return;
      }

      // 1. Load/build hierarchical model
      if (this.userId) {
        try {
          const historicalForModel = completedWorkouts.map(w => ({
            date: new Date(w.endTime!),
            exercises: w.sets.reduce((acc, set) => {
              const existing = acc.find(e => e.exerciseId === set.exerciseId);
              if (existing) {
                existing.sets.push(set);
              } else {
                acc.push({ exerciseId: set.exerciseId, sets: [set] });
              }
              return acc;
            }, [] as Array<{ exerciseId: string; sets: typeof w.sets }>)
          }));

          this.hierarchicalModel = await getOrBuildHierarchicalModel(this.userId, historicalForModel);
        } catch (err) {
          console.warn('Could not load hierarchical model from cache:', err);
          // Build from scratch
          const historicalForModel = completedWorkouts.map(w => ({
            date: new Date(w.endTime!),
            exercises: w.sets.reduce((acc, set) => {
              const existing = acc.find(e => e.exerciseId === set.exerciseId);
              if (existing) {
                existing.sets.push(set);
              } else {
                acc.push({ exerciseId: set.exerciseId, sets: [set] });
              }
              return acc;
            }, [] as Array<{ exerciseId: string; sets: typeof w.sets }>)
          }));
          this.hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
        }
      } else {
        // No user ID, build locally
        const historicalForModel = completedWorkouts.map(w => ({
          date: new Date(w.endTime!),
          exercises: w.sets.reduce((acc, set) => {
            const existing = acc.find(e => e.exerciseId === set.exerciseId);
            if (existing) {
              existing.sets.push(set);
            } else {
              acc.push({ exerciseId: set.exerciseId, sets: [set] });
            }
            return acc;
          }, [] as Array<{ exerciseId: string; sets: typeof w.sets }>)
        }));
        this.hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
      }

      // 2. Calculate ACWR
      const workoutsWithLoad = completedWorkouts.map(w => ({
        date: new Date(w.endTime!),
        load: w.totalVolumeLoad || calculateTrainingLoad(w.sets)
      }));
      this.acwrMetrics = calculateACWR(workoutsWithLoad);

      // 3. Calculate Fitness-Fatigue
      const recentWorkouts = completedWorkouts.slice(-14); // Last 2 weeks
      let ffModel: FitnessFatigueModel | null = null;
      let lastWorkoutDate = new Date(recentWorkouts[0]?.endTime || Date.now());

      for (const workout of recentWorkouts) {
        const workoutDate = new Date(workout.endTime!);
        const daysSince = ffModel
          ? (workoutDate.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        const load = workout.totalVolumeLoad || calculateTrainingLoad(workout.sets);

        ffModel = updateFitnessFatigueModel(
          ffModel,
          'full_body',
          load,
          daysSince
        );

        lastWorkoutDate = workoutDate;
      }
      this.fitnessFatigueModel = ffModel;

      // 4. Load recovery profiles
      if (this.userId) {
        try {
          this.recoveryProfiles = await getRecoveryProfiles(this.userId);
        } catch (err) {
          console.warn('Could not load recovery profiles:', err);
        }
      }

      this.lastUpdate = now;
      logger.debug('✅ Workout intelligence models loaded');
    } catch (err) {
      console.error('Error loading models:', err);
    }
  }

  private calculateMuscleReadiness(plannedExercises?: string[]): PreWorkoutReadiness['muscleReadiness'] {
    const result: PreWorkoutReadiness['muscleReadiness'] = [];

    // If no recovery profiles, return empty
    if (this.recoveryProfiles.length === 0) {
      return result;
    }

    // If specific exercises planned, filter to relevant muscles
    let relevantProfiles = this.recoveryProfiles;
    if (plannedExercises && plannedExercises.length > 0) {
      const relevantMuscles = new Set<string>();
      plannedExercises.forEach(exId => {
        const muscles = this.getMuscleGroupsForExercise(exId);
        muscles.forEach(m => relevantMuscles.add(m.toLowerCase()));
      });
      relevantProfiles = this.recoveryProfiles.filter(p =>
        relevantMuscles.has(p.muscleGroup.toLowerCase())
      );
    }

    // Convert recovery profiles to readiness format
    for (const profile of relevantProfiles) {
      let status: 'ready' | 'recovering' | 'fatigued' = 'ready';
      if (profile.readinessScore < 6) status = 'fatigued';
      else if (profile.readinessScore < 8) status = 'recovering';

      const hoursUntilReady = profile.recoveryPercentage < 95
        ? Math.ceil((new Date(profile.estimatedFullRecoveryDate).getTime() - Date.now()) / (1000 * 60 * 60))
        : undefined;

      result.push({
        muscle: profile.muscleGroup,
        score: profile.readinessScore,
        status,
        recoveryPercentage: profile.recoveryPercentage,
        hoursUntilReady
      });
    }

    return result;
  }

  private calculateOverallReadiness(acwr: number, performance: number, muscleReadiness: PreWorkoutReadiness['muscleReadiness']): number {
    // Start with performance score (already 0-100)
    let score = performance / 10; // Convert to 1-10 scale

    // Adjust for ACWR
    if (acwr > 1.5) {
      score -= (acwr - 1.3) * 2; // Penalize overreaching
    } else if (acwr < 0.8) {
      score -= (0.8 - acwr) * 2; // Penalize detraining
    }

    // Adjust for muscle readiness
    if (muscleReadiness.length > 0) {
      const avgMuscleReadiness = muscleReadiness.reduce((sum, m) => sum + m.score, 0) / muscleReadiness.length;
      score = (score + avgMuscleReadiness) / 2; // Average with muscle readiness
    }

    return Math.max(1, Math.min(10, score));
  }

  private getReadinessStatus(score: number): 'excellent' | 'good' | 'moderate' | 'poor' {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'moderate';
    return 'poor';
  }

  private generateWarnings(
    acwrData: WorkloadMetrics,
    muscleReadiness: PreWorkoutReadiness['muscleReadiness'],
    ffModel: FitnessFatigueModel
  ): string[] {
    const warnings: string[] = [];

    // ACWR warnings
    if (acwrData.acwr > 2.0) {
      warnings.push('Critical: Training load is 2-4x higher than usual (high injury risk).');
    } else if (acwrData.acwr > 1.5) {
      warnings.push('High training load detected. Consider reducing volume or taking extra rest.');
    } else if (acwrData.acwr < 0.5) {
      warnings.push('Training load is very low. You may be losing fitness.');
    }

    // Muscle readiness warnings
    const fatiguedMuscles = muscleReadiness.filter(m => m.status === 'fatigued');
    if (fatiguedMuscles.length > 0) {
      warnings.push(`${fatiguedMuscles.map(m => m.muscle).join(', ')} not fully recovered (${fatiguedMuscles[0].score.toFixed(1)}/10).`);
    }

    // Performance warnings
    if (ffModel.netPerformance < 30) {
      warnings.push('Low performance state. Consider lighter training or rest day.');
    }

    return warnings;
  }

  private generateRecommendations(
    acwrData: WorkloadMetrics,
    muscleReadiness: PreWorkoutReadiness['muscleReadiness'],
    ffModel: FitnessFatigueModel
  ): string[] {
    const recommendations: string[] = [];

    // ACWR recommendations
    if (acwrData.acwr >= 0.8 && acwrData.acwr <= 1.3) {
      recommendations.push('Training load is in the optimal zone. Keep this workload.');
    } else if (acwrData.acwr > 1.5) {
      recommendations.push('Plan a deload week within 1-2 weeks');
    } else if (acwrData.acwr < 0.8) {
      recommendations.push('Gradually increase training volume');
    }

    // Muscle recommendations
    const recoveringMuscles = muscleReadiness.filter(m => m.status === 'recovering');
    if (recoveringMuscles.length > 0) {
      recommendations.push(`${recoveringMuscles.map(m => m.muscle).join(', ')} still recovering - consider lighter training`);
    }

    // Performance recommendations
    if (ffModel.netPerformance > 70) {
      recommendations.push('Great day to push for PRs.');
    }

    return recommendations;
  }

  private calculateReadinessConfidence(): number {
    let confidence = 0;

    // Base confidence from having models
    if (this.hierarchicalModel) confidence += 0.25;
    if (this.fitnessFatigueModel) confidence += 0.25;
    if (this.acwrMetrics) confidence += 0.25;
    if (this.recoveryProfiles.length > 0) confidence += 0.25;

    return confidence;
  }

  private async getBaselineWeight(
    exerciseId: string,
    targetReps: number,
    completedSessionSets: SetLog[]
  ): Promise<{ source: 'historical' | 'prescribed' | 'default'; weight: number; reps: number }> {
    // 1. Try to get from completed sets in this session (same exercise)
    const sameExerciseSets = completedSessionSets.filter(s => s.exerciseId === exerciseId);
    if (sameExerciseSets.length > 0) {
      const lastSet = sameExerciseSets[sameExerciseSets.length - 1];
      const lastWeightLbs = lastSet.actualWeight != null
        ? convertWeight(lastSet.actualWeight, lastSet.weightUnit ?? 'lbs', 'lbs')
        : null;
      return {
        source: 'historical',
        weight: lastWeightLbs || 135,
        reps: targetReps
      };
    }

    // 2. Try to estimate from user's 1RM (if available)
    const userMax = this.getUserMaxFromStorage(exerciseId);
    if (userMax) {
      const estimate = Math.round((userMax / (1 + targetReps / 30)) / 2.5) * 2.5;
      return {
        source: 'historical',
        weight: estimate,
        reps: targetReps
      };
    }

    // 3. Try to get from hierarchical model (best E1RM for this exercise)
    const exerciseProfile = this.hierarchicalModel?.exerciseSpecificFactors.get(exerciseId);
    if (exerciseProfile && exerciseProfile.sampleSize >= 3) {
      // Use average intensity from profile
      // This is a simplified approach - could use E1RM calculation here
      const weight = 135; // Default for now
      return {
        source: 'historical',
        weight,
        reps: targetReps
      };
    }

    // 4. Default
    return {
      source: 'default',
      weight: 135,
      reps: targetReps
    };
  }

  private getUserMaxFromStorage(exerciseId: string): number | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('iron_brain_user_maxes');
      if (!stored) return null;
      const maxes = JSON.parse(stored) as Array<{ exerciseId: string; weight: number }>;
      const match = maxes.find((max) => max.exerciseId === exerciseId);
      return match?.weight ?? null;
    } catch {
      return null;
    }
  }

  private getMuscleGroupsForExercise(exerciseId: string): string[] {
    // This is a simplified mapping - in production, you'd query the exercises table
    // For now, use common patterns
    const exerciseName = exerciseId.toLowerCase();

    if (exerciseName.includes('bench') || exerciseName.includes('chest')) return ['chest', 'triceps', 'shoulders'];
    if (exerciseName.includes('squat') || exerciseName.includes('leg press')) return ['quads', 'glutes', 'hamstrings'];
    if (exerciseName.includes('deadlift')) return ['back', 'hamstrings', 'glutes'];
    if (exerciseName.includes('row') || exerciseName.includes('pull')) return ['back', 'biceps'];
    if (exerciseName.includes('overhead') || exerciseName.includes('shoulder')) return ['shoulders', 'triceps'];
    if (exerciseName.includes('curl')) return ['biceps'];
    if (exerciseName.includes('tricep')) return ['triceps'];
    if (exerciseName.includes('leg extension')) return ['quads'];
    if (exerciseName.includes('leg curl')) return ['hamstrings'];

    return ['full_body'];
  }

  private calculateSessionFatigue(completedSets: SetLog[]): number {
    if (completedSets.length === 0) return 0;

    let fatigue = 0;

    // Factor 1: Volume accumulation
    const totalVolume = completedSets.reduce((sum, set) => {
      const reps = set.actualReps || 0;
      const weightLbs = set.actualWeight != null
        ? convertWeight(set.actualWeight, set.weightUnit ?? 'lbs', 'lbs')
        : 0;
      return sum + (weightLbs * reps);
    }, 0);
    fatigue += Math.min(40, totalVolume / 1000); // Up to 40 points from volume

    // Factor 2: RPE overshoot
    const rpeOvershoot = completedSets.filter(s => s.actualRPE && s.prescribedRPE).map(s =>
      (s.actualRPE || 0) - (s.prescribedRPE || 0)
    );
    if (rpeOvershoot.length > 0) {
      const avgOvershoot = rpeOvershoot.reduce((a, b) => a + b, 0) / rpeOvershoot.length;
      fatigue += Math.max(0, avgOvershoot * 10); // Up to 30 points for 3 RPE overshoot
    }

    // Factor 3: Form breakdown
    const formBreakdowns = completedSets.filter(s => s.formBreakdown).length;
    fatigue += formBreakdowns * 10; // 10 points per form breakdown

    // Factor 4: Unintentional failure
    const failures = completedSets.filter(s =>
      s.reachedFailure && (!s.actualRPE || s.actualRPE <= 7)
    ).length;
    fatigue += failures * 15; // 15 points per unintentional failure

    return Math.min(100, fatigue);
  }

  private buildRecommendationReasoning(
    baseline: SetRecommendation['baseline'],
    adjustments: SetRecommendation['adjustments']
  ): string {
    let reasoning = `Starting from ${baseline.source} weight of ${baseline.weight}`;

    if (adjustments.length > 0) {
      reasoning += '. Adjustments: ';
      reasoning += adjustments.map(adj =>
        `${adj.reason} (${adj.adjustment > 0 ? '+' : ''}${(adj.adjustment * 100).toFixed(1)}%)`
      ).join(', ');
    } else {
      reasoning += '. No adjustments needed - you\'re good to go!';
    }

    return reasoning;
  }

  private calculateRecommendationConfidence(
    source: 'historical' | 'prescribed' | 'default',
    adjustmentCount: number
  ): 'high' | 'medium' | 'low' {
    if (source === 'default') return 'low';
    if (source === 'historical' && adjustmentCount === 0) return 'high';
    if (adjustmentCount <= 2) return 'high';
    return 'medium';
  }

  private async checkFatigueAlert(
    completedSets: SetLog[],
    sessionFatigue: number
  ): Promise<SetRecommendation['fatigueAlert'] | undefined> {
    if (sessionFatigue < 60) return undefined; // No alert needed

    const severity = this.getFatigueSeverity(sessionFatigue, this.calculateFatigueIndicators(completedSets));
    const affectedMuscles = this.getAffectedMuscles(completedSets);

    let message = '';
    let suggestedReduction = 0;

    if (severity === 'critical') {
      message = 'Critical fatigue detected. Consider stopping this exercise.';
      suggestedReduction = 0.25;
    } else if (severity === 'high') {
      message = 'High fatigue accumulation. Reduce weight or take extra rest.';
      suggestedReduction = 0.15;
    } else if (severity === 'moderate') {
      message = 'Moderate fatigue building up. Monitor closely.';
      suggestedReduction = 0.10;
    } else {
      return undefined;
    }

    return {
      severity,
      message,
      suggestedReduction,
      affectedMuscles
    };
  }

  private calculateFatigueIndicators(completedSets: SetLog[]): SessionFatigueAssessment['indicators'] {
    const rpeDeviations = completedSets
      .filter(s => s.actualRPE && s.prescribedRPE)
      .map(s => (s.actualRPE || 0) - (s.prescribedRPE || 0));

    const rpeOvershoot = rpeDeviations.length > 0
      ? rpeDeviations.reduce((a, b) => a + b, 0) / rpeDeviations.length
      : 0;

    const formBreakdown = completedSets.filter(s => s.formBreakdown).length;

    const unintentionalFailure = completedSets.filter(s =>
      s.reachedFailure && (!s.actualRPE || s.actualRPE <= 7)
    ).length;

    const volumeAccumulation = completedSets.reduce((sum, set) => {
      const reps = set.actualReps || 0;
      const weightLbs = set.actualWeight != null
        ? convertWeight(set.actualWeight, set.weightUnit ?? 'lbs', 'lbs')
        : 0;
      return sum + (weightLbs * reps);
    }, 0);

    return {
      rpeOvershoot,
      formBreakdown,
      unintentionalFailure,
      volumeAccumulation
    };
  }

  private getFatigueSeverity(
    overallFatigue: number,
    indicators: SessionFatigueAssessment['indicators']
  ): 'mild' | 'moderate' | 'high' | 'critical' {
    if (overallFatigue >= 85 || indicators.formBreakdown >= 3 || indicators.unintentionalFailure >= 2) {
      return 'critical';
    }
    if (overallFatigue >= 70 || indicators.formBreakdown >= 2 || indicators.unintentionalFailure >= 1) {
      return 'high';
    }
    if (overallFatigue >= 55 || indicators.rpeOvershoot >= 2) {
      return 'moderate';
    }
    return 'mild';
  }

  private calculateReductionPercent(
    severity: SessionFatigueAssessment['severity']
  ): number {
    if (severity === 'critical') return 25;
    if (severity === 'high') return 15;
    if (severity === 'moderate') return 10;
    return 0;
  }

  private getAffectedMuscles(completedSets: SetLog[]): string[] {
    const muscles = new Set<string>();

    completedSets.forEach(set => {
      const exerciseMuscles = this.getMuscleGroupsForExercise(set.exerciseId);
      exerciseMuscles.forEach(m => muscles.add(m));
    });

    return Array.from(muscles);
  }

  private buildFatigueReasoning(
    indicators: SessionFatigueAssessment['indicators'],
    overallFatigue: number,
    severity: SessionFatigueAssessment['severity']
  ): string {
    const reasons: string[] = [];

    if (indicators.formBreakdown > 0) {
      reasons.push(`${indicators.formBreakdown} sets with form breakdown`);
    }
    if (indicators.unintentionalFailure > 0) {
      reasons.push(`${indicators.unintentionalFailure} unintentional failures`);
    }
    if (indicators.rpeOvershoot >= 1.5) {
      reasons.push(`Average RPE overshoot of ${indicators.rpeOvershoot.toFixed(1)} points`);
    }
    if (indicators.volumeAccumulation > 50000) {
      reasons.push(`High volume accumulation (${Math.round(indicators.volumeAccumulation / 1000)}K)`);
    }

    if (reasons.length === 0) {
      return `Fatigue score: ${overallFatigue.toFixed(0)}/100 (${severity})`;
    }

    return `${severity.charAt(0).toUpperCase() + severity.slice(1)} fatigue detected: ${reasons.join(', ')}`;
  }

  private getLastWeightForExercise(exerciseId: string, completedSets: SetLog[]): number | null {
    const sameExerciseSets = completedSets.filter(s => s.exerciseId === exerciseId);
    if (sameExerciseSets.length > 0) {
      const lastSet = sameExerciseSets[sameExerciseSets.length - 1];
      if (lastSet.actualWeight == null) return null;
      return convertWeight(lastSet.actualWeight, lastSet.weightUnit ?? 'lbs', 'lbs');
    }
    return null;
  }
}

// ============================================================
// SINGLETON FACTORY
// ============================================================

let instance: WorkoutIntelligenceService | null = null;

export function getWorkoutIntelligence(userId: string | null): WorkoutIntelligenceService {
  if (!instance || instance['userId'] !== userId) {
    instance = new WorkoutIntelligenceService(userId);
  }
  return instance;
}
