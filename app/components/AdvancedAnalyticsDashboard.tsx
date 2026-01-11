'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Zap,
  Battery,
  Target,
  Lightbulb,
  User,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth-context';
import { getWorkoutHistory, setUserNamespace } from '../lib/storage';
import { supabase } from '../lib/supabase/client';
import type { WorkoutSession } from '../lib/types';
import {
  calculateACWR,
  updateFitnessFatigueModel,
  calculateTrainingLoad,
  type FitnessFatigueModel
} from '../lib/stats/adaptive-recovery';
import {
  buildHierarchicalFatigueModel,
  type HierarchicalFatigueModel
} from '../lib/stats/hierarchical-models';
import { getRecoveryProfiles, type RecoveryProfile } from '../lib/fatigue/cross-session';
import { getExerciseEfficiencyLeaderboard } from '../lib/fatigue/sfr';
import RecoveryOverview from './RecoveryOverview';
import SFRInsightsTable from './SFRInsightsTable';
import CausalInsightsDashboard from './CausalInsightsDashboard';

interface AnalyticsData {
  // ACWR Metrics
  acwr?: {
    ratio: number;
    status: string;
    acuteLoad: number;
    chronicLoad: number;
    monotony: number;
    strain: number;
  };

  // Fitness-Fatigue
  fitnessFatigue?: {
    currentFitness: number;
    currentFatigue: number;
    performance: number;
    readiness: 'excellent' | 'good' | 'moderate' | 'poor';
  };

  // Hierarchical Model
  hierarchicalModel?: HierarchicalFatigueModel;

  // Personal Stats
  personalStats?: {
    fatigueResistance: number;
    recoveryRate: number;
    totalWorkouts: number;
    totalSets: number;
  };

  // Exercise-Specific Rates
  exerciseRates?: Array<{
    exerciseId: string;
    exerciseName?: string;
    fatigueRate: number;
    variance: number;
    sampleSize: number;
  }>;

  // Recovery profiles
  recoveryProfiles?: RecoveryProfile[];

  // SFR insights
  sfrInsights?: Array<{
    exerciseId: string;
    exerciseName: string;
    avgSFR: number;
    timesPerformed: number;
    bestSFR: number;
    worstSFR: number;
    interpretation: 'excellent' | 'good' | 'moderate' | 'poor' | 'excessive';
  }>;
}

type ViewType = 'overview' | 'training-load' | 'recovery' | 'efficiency' | 'causal' | 'personal';

export default function AdvancedAnalyticsDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<ViewType>('overview');
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  async function loadAnalytics() {
    try {
      // Set namespace based on auth state
      setUserNamespace(user?.id || null);

      console.log('📊 Loading analytics for user:', user?.id || 'guest');

      // Load from BOTH localStorage AND Supabase
      let allWorkouts: WorkoutSession[] = [];

      // 1. Get from localStorage (current namespace)
      const localWorkouts = getWorkoutHistory();
      console.log('💾 localStorage workouts:', localWorkouts.length);

      // 2. Get from Supabase if logged in
      if (user) {
        try {
          console.log('🔍 Fetching from Supabase...');

          const { data: supabaseWorkouts, error } = await supabase
            .from('workout_sessions')
            .select(`
              id,
              date,
              start_time,
              end_time,
              duration_minutes,
              total_volume_load,
              notes,
              set_logs (
                id,
                exercise_id,
                exercise_slug,
                order_index,
                actual_weight,
                actual_reps,
                actual_rpe,
                completed,
                set_type
              )
            `)
            .eq('user_id', user.id)
            .order('start_time', { ascending: false });

          if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
          }

          console.log('📦 Got Supabase data:', supabaseWorkouts?.length || 0, 'workouts');

          if (supabaseWorkouts && supabaseWorkouts.length > 0) {
            // Load exercise name mappings
            console.log('🔍 Loading exercise names...');
            const { data: exercises, error: exerciseError } = await supabase
              .from('exercises')
              .select('id, name, slug');

            if (exerciseError) {
              console.error('❌ Exercise mapping error:', exerciseError);
            }

            const exerciseMap = new Map();
            exercises?.forEach((ex: any) => {
              exerciseMap.set(ex.id, ex.name);
              if (ex.slug) exerciseMap.set(ex.slug, ex.name);
            });

            console.log('✅ Loaded', exerciseMap.size, 'exercise names');

            // Convert Supabase format to WorkoutSession format
            const converted: WorkoutSession[] = supabaseWorkouts.map((sw: any) => ({
              id: sw.id,
              startTime: sw.start_time,
              endTime: sw.end_time,
              totalVolumeLoad: sw.total_volume_load,
              notes: sw.notes,
              programId: '',
              programName: '',
              cycleNumber: 0,
              weekNumber: 0,
              dayIndex: 0,
              dayName: '',
              dayOfWeek: '',
              date: sw.date || sw.start_time.split('T')[0],
              createdAt: sw.start_time,
              updatedAt: sw.end_time || sw.start_time,
              sets: (sw.set_logs || []).map((sl: any) => ({
                id: sl.id,
                exerciseId: sl.exercise_id || '',
                exerciseName: exerciseMap.get(sl.exercise_id) || exerciseMap.get(sl.exercise_slug) || 'Unknown Exercise',
                weight: sl.actual_weight,
                reps: sl.actual_reps,
                rpe: sl.actual_rpe,
                completed: sl.completed,
                setType: sl.set_type || 'normal',
                actualWeight: sl.actual_weight,
                actualReps: sl.actual_reps,
                prescribed: {},
                predictedFatigue: 0,
                timestamp: sw.start_time
              }))
            }));

            console.log('☁️ Supabase workouts:', converted.length);
            allWorkouts = converted;
          } else {
            console.log('ℹ️ No Supabase workouts found');
          }
        } catch (err) {
          console.error('❌ Failed to load from Supabase:', err);
          // Continue with localStorage data
        }
      } else {
        console.log('ℹ️ No user logged in, skipping Supabase');
      }

      // 3. Merge: Prefer Supabase data, fall back to localStorage
      if (allWorkouts.length === 0) {
        console.log('📦 Using localStorage data');
        allWorkouts = localWorkouts;
      } else if (localWorkouts.length > allWorkouts.length) {
        console.log('🔄 localStorage has more data, merging...');
        // Merge and deduplicate by ID
        const supabaseIds = new Set(allWorkouts.map(w => w.id));
        const uniqueLocal = localWorkouts.filter(w => !supabaseIds.has(w.id));
        allWorkouts = [...allWorkouts, ...uniqueLocal];
        console.log(`✅ Merged: ${allWorkouts.length} total (${uniqueLocal.length} from localStorage)`);
      }

      console.log('📚 Total workouts loaded:', allWorkouts.length);

      // DATA VALIDATION: Deduplicate workouts by ID
      const uniqueWorkouts = Array.from(
        new Map(allWorkouts.map(w => [w.id, w])).values()
      );
      console.log(`🔍 Deduplication: ${allWorkouts.length} -> ${uniqueWorkouts.length} workouts`);

      // Filter completed workouts with valid data
      const completedWorkouts = uniqueWorkouts.filter(w => {
        if (!w.endTime) return false;

        // Validate sets have proper data
        const hasValidSets = w.sets.some(set => {
          const weight = set.actualWeight || 0;
          const reps = set.actualReps || 0;
          return weight > 0 && reps > 0 && !isNaN(weight) && !isNaN(reps);
        });

        return hasValidSets;
      });

      console.log('✅ Completed workouts with valid data:', completedWorkouts.length);

      if (completedWorkouts.length < 3) {
        console.warn(`⚠️ Not enough workouts for analytics (have ${completedWorkouts.length}, need 3)`);
        // Don't have enough data - component will show "not enough data" message
        setLoading(false);
        return;
      }

      // Load recovery profiles and SFR insights if user is logged in
      let recoveryProfiles: RecoveryProfile[] = [];
      let sfrInsights: any[] = [];

      if (user) {
        try {
          const [profiles, leaderboard] = await Promise.all([
            getRecoveryProfiles(user.id),
            getExerciseEfficiencyLeaderboard(user.id, 20)
          ]);
          recoveryProfiles = profiles;
          sfrInsights = leaderboard;
        } catch (err) {
          console.error('Error loading recovery/SFR data:', err);
        }
      }

      // Calculate ACWR with validated volume calculation
      console.log('📈 Calculating ACWR...');
      const workoutsWithLoad = completedWorkouts.map(w => {
        // Calculate volume: weight * reps, with proper validation
        const calculatedLoad = w.sets.reduce((sum, set) => {
          const weight = set.actualWeight || 0;
          const reps = set.actualReps || 0;

          // Validate: positive numbers, not NaN, reasonable bounds
          if (weight > 0 && reps > 0 && !isNaN(weight) && !isNaN(reps) && weight < 2000 && reps < 200) {
            return sum + (weight * reps);
          }
          return sum;
        }, 0);

        return {
          date: new Date(w.endTime!),
          load: w.totalVolumeLoad && w.totalVolumeLoad > 0 ? w.totalVolumeLoad : calculatedLoad
        };
      });

      const acwrMetrics = calculateACWR(workoutsWithLoad);
      console.log('✅ ACWR calculated:', acwrMetrics.acwr);
      console.log('  Acute (7d):', acwrMetrics.acuteLoad);
      console.log('  Chronic (28d avg/week):', acwrMetrics.chronicLoad / 4);

      // Build hierarchical model with caching if available
      let hierarchicalModel: HierarchicalFatigueModel | undefined;
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

      if (historicalForModel.length >= 3) {
        console.log('🧠 Building hierarchical model...');
        // Try to use cached model
        if (user) {
          try {
            const { getOrBuildHierarchicalModel } = await import('../lib/supabase/model-cache');
            hierarchicalModel = await getOrBuildHierarchicalModel(user.id, historicalForModel);
          } catch (err) {
            console.error('Cache load failed, building from scratch:', err);
            hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
          }
        } else {
          hierarchicalModel = buildHierarchicalFatigueModel('default_user', historicalForModel);
        }
        console.log('✅ Hierarchical model built:', hierarchicalModel?.userFatigueResistance);
      } else {
        console.log('⚠️ Not enough workouts for hierarchical model (need 3, have', historicalForModel.length, ')');
      }

      // Calculate Fitness-Fatigue by sequencing through recent workouts
      const recentWorkouts = completedWorkouts.slice(-14); // Last 2 weeks
      let fitnessFatigueModel: FitnessFatigueModel | null = null;
      let lastWorkoutDate = new Date(recentWorkouts[0]?.endTime || Date.now());

      for (const workout of recentWorkouts) {
        const workoutDate = new Date(workout.endTime!);
        const daysSince = fitnessFatigueModel
          ? (workoutDate.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        const load = workout.totalVolumeLoad || calculateTrainingLoad(workout.sets);

        fitnessFatigueModel = updateFitnessFatigueModel(
          fitnessFatigueModel,
          'full_body',
          load,
          daysSince
        );

        lastWorkoutDate = workoutDate;
      }

      // Calculate readiness from performance
      let readiness: 'excellent' | 'good' | 'moderate' | 'poor' = 'moderate';
      if (fitnessFatigueModel) {
        const perf = fitnessFatigueModel.netPerformance;
        if (perf > 70) readiness = 'excellent';
        else if (perf > 50) readiness = 'good';
        else if (perf > 30) readiness = 'moderate';
        else readiness = 'poor';
      }

      const fitnessFatigue = fitnessFatigueModel
        ? {
            currentFitness: fitnessFatigueModel.currentFitness,
            currentFatigue: fitnessFatigueModel.currentFatigue,
            performance: fitnessFatigueModel.netPerformance,
            readiness
          }
        : undefined;

      // Personal stats
      const totalSets = completedWorkouts.reduce((sum, w) => sum + w.sets.length, 0);
      const personalStats = {
        fatigueResistance: hierarchicalModel?.userFatigueResistance || 50,
        recoveryRate: hierarchicalModel?.userRecoveryRate || 1.0,
        totalWorkouts: completedWorkouts.length,
        totalSets
      };

      // Exercise-specific rates with names
      const exerciseRates = hierarchicalModel
        ? Array.from(hierarchicalModel.exerciseSpecificFactors.entries()).map(([id, data]) => {
            // Find exercise name from completed workouts
            const set = completedWorkouts
              .flatMap(w => w.sets)
              .find(s => s.exerciseId === id);

            const exerciseName = (set as any)?.exerciseName || id;

            return {
              exerciseId: id,
              exerciseName: exerciseName,
              fatigueRate: data.baselineFatigueRate,
              variance: data.variance,
              sampleSize: data.sampleSize
            };
          })
        : [];

      // Store workouts for causal insights
      setAllWorkouts(completedWorkouts);

      // CLAMPING: Apply sanity checks to display values
      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

      setAnalytics({
        acwr: {
          ratio: clamp(acwrMetrics.acwr, 0, 5.0), // ACWR should never exceed 5.0
          status: acwrMetrics.status,
          acuteLoad: clamp(acwrMetrics.acuteLoad, 0, 1000000),
          chronicLoad: clamp(acwrMetrics.chronicLoad, 0, 1000000),
          monotony: clamp(acwrMetrics.trainingMonotony, 0, 10),
          strain: clamp(acwrMetrics.trainingStrain, 0, 10000000)
        },
        fitnessFatigue: fitnessFatigue ? {
          currentFitness: clamp(fitnessFatigue.currentFitness, 0, 200),
          currentFatigue: clamp(fitnessFatigue.currentFatigue, 0, 150),
          performance: clamp(fitnessFatigue.performance, -100, 200),
          readiness: fitnessFatigue.readiness
        } : undefined,
        hierarchicalModel,
        personalStats: {
          fatigueResistance: clamp(personalStats.fatigueResistance, 0, 100),
          recoveryRate: clamp(personalStats.recoveryRate, 0, 3),
          totalWorkouts: personalStats.totalWorkouts,
          totalSets: personalStats.totalSets
        },
        exerciseRates,
        recoveryProfiles,
        sfrInsights
      });

    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <div className="text-white text-lg font-semibold">Loading your insights...</div>
          <div className="text-gray-400 text-sm">Analyzing workouts and calculating metrics</div>
        </div>
      </div>
    );
  }

  if (!analytics.acwr && !analytics.hierarchicalModel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <BarChart3 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Start Your Journey</h2>
          <p className="text-gray-300 text-sm sm:text-base mb-6">
            Complete at least 3 workouts to unlock your personalized analytics dashboard.
          </p>
          <div className="bg-white/5 rounded-lg p-4 text-left space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>ACWR injury risk monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Fitness-Fatigue performance tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Exercise efficiency analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Recovery recommendations</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generate smart insights
  const getSmartInsights = () => {
    const insights: Array<{ type: 'good' | 'warning' | 'danger' | 'info'; message: string; action?: string }> = [];

    // ACWR-based insights
    if (analytics.acwr) {
      if (analytics.acwr.ratio > 2.0) {
        insights.push({
          type: 'danger',
          message: `High injury risk! Your training load is ${analytics.acwr.ratio.toFixed(1)}x higher than usual.`,
          action: 'Take a rest day or deload this week'
        });
      } else if (analytics.acwr.ratio > 1.5) {
        insights.push({
          type: 'warning',
          message: `You're pushing hard (ACWR: ${analytics.acwr.ratio.toFixed(2)}). Watch for fatigue.`,
          action: 'Plan recovery within 1-2 weeks'
        });
      } else if (analytics.acwr.ratio >= 0.8 && analytics.acwr.ratio <= 1.3) {
        insights.push({
          type: 'good',
          message: `Perfect training zone! ACWR ${analytics.acwr.ratio.toFixed(2)} is in the sweet spot.`,
          action: 'Keep this up for optimal gains'
        });
      } else if (analytics.acwr.ratio < 0.5) {
        insights.push({
          type: 'warning',
          message: 'Training load is too low. You may be losing fitness.',
          action: 'Gradually increase volume'
        });
      }

      if (analytics.acwr.monotony > 2.5) {
        insights.push({
          type: 'info',
          message: 'Your training lacks variety. Try mixing things up.',
          action: 'Add new exercises or rep ranges'
        });
      }
    }

    // Fitness-Fatigue insights
    if (analytics.fitnessFatigue) {
      if (analytics.fitnessFatigue.readiness === 'excellent') {
        insights.push({
          type: 'good',
          message: 'Your body is primed for a great workout!',
          action: 'Perfect day to push for PRs'
        });
      } else if (analytics.fitnessFatigue.readiness === 'poor') {
        insights.push({
          type: 'warning',
          message: 'Low readiness detected. Recovery is needed.',
          action: 'Light session or rest recommended'
        });
      }

      const fatigueRatio = analytics.fitnessFatigue.currentFatigue / analytics.fitnessFatigue.currentFitness;
      if (fatigueRatio > 1.2) {
        insights.push({
          type: 'warning',
          message: 'Fatigue is outpacing fitness gains.',
          action: 'Schedule a deload week'
        });
      }
    }

    // Recovery insights
    if (analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0) {
      const worstMuscle = analytics.recoveryProfiles.reduce((worst, curr) =>
        curr.readinessScore < worst.readinessScore ? curr : worst
      );

      if (worstMuscle.readinessScore < 6) {
        insights.push({
          type: 'warning',
          message: `${worstMuscle.muscleGroup.charAt(0).toUpperCase() + worstMuscle.muscleGroup.slice(1)} still recovering.`,
          action: 'Avoid heavy training for this muscle group'
        });
      }
    }

    return insights.slice(0, 3); // Show top 3
  };

  const smartInsights = getSmartInsights();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-3 sm:p-4 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">Analytics</h1>
          <p className="text-gray-400 text-xs sm:text-sm">Science-backed insights for smarter training</p>
        </div>

        {/* Smart Insights Banner */}
        {smartInsights.length > 0 && selectedView === 'overview' && (
          <div className="mb-4 sm:mb-6 space-y-2">
            {smartInsights.map((insight, idx) => {
              const Icon = insight.type === 'good' ? CheckCircle :
                          insight.type === 'danger' ? AlertCircle :
                          insight.type === 'warning' ? AlertTriangle : Info;

              return (
                <div
                  key={idx}
                  className={`rounded-xl p-3 sm:p-4 border ${
                    insight.type === 'good' ? 'bg-green-500/10 border-green-500/30' :
                    insight.type === 'danger' ? 'bg-red-500/10 border-red-500/30' :
                    insight.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 ${
                      insight.type === 'good' ? 'text-green-400' :
                      insight.type === 'danger' ? 'text-red-400' :
                      insight.type === 'warning' ? 'text-yellow-400' :
                      'text-blue-400'
                    }`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm sm:text-base font-medium mb-1 ${
                        insight.type === 'good' ? 'text-green-300' :
                        insight.type === 'danger' ? 'text-red-300' :
                        insight.type === 'warning' ? 'text-yellow-300' :
                        'text-blue-300'
                      }`}>
                        {insight.message}
                      </p>
                      {insight.action && (
                        <p className="text-xs sm:text-sm text-gray-400">
                          → {insight.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation Tabs - Mobile Optimized */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {([
            { id: 'overview' as ViewType, label: 'Overview', Icon: BarChart3 },
            { id: 'training-load' as ViewType, label: 'Load', Icon: Zap },
            { id: 'recovery' as ViewType, label: 'Recovery', Icon: Battery },
            { id: 'efficiency' as ViewType, label: 'Efficiency', Icon: Target },
            { id: 'causal' as ViewType, label: 'Insights', Icon: Lightbulb },
            { id: 'personal' as ViewType, label: 'Profile', Icon: User }
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedView(id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all text-sm sm:text-base touch-manipulation active:scale-95 ${
                selectedView === id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden xs:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Overview */}
        {selectedView === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* ACWR Card */}
            {analytics.acwr && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300">Injury Risk</h3>
                  <div className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded ${
                    analytics.acwr.status === 'optimal' ? 'bg-green-500/20 text-green-400' :
                    analytics.acwr.status === 'building' ? 'bg-blue-500/20 text-blue-400' :
                    analytics.acwr.status === 'danger' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {analytics.acwr.status}
                  </div>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-white mb-1">
                  {analytics.acwr.ratio.toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mb-3">
                  {analytics.acwr.ratio < 0.8 ? 'Too low - increase training' :
                   analytics.acwr.ratio <= 1.3 ? 'Perfect zone for gains' :
                   analytics.acwr.ratio <= 1.5 ? 'High but manageable' :
                   'Danger zone - rest needed!'}
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>7-day load</span>
                    <span className="text-white font-medium">{analytics.acwr.acuteLoad.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>28-day avg</span>
                    <span className="text-white font-medium">{analytics.acwr.chronicLoad.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fitness-Fatigue Card */}
            {analytics.fitnessFatigue && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300">Readiness</h3>
                  <div className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded ${
                    analytics.fitnessFatigue.readiness === 'excellent' ? 'bg-green-500/20 text-green-400' :
                    analytics.fitnessFatigue.readiness === 'good' ? 'bg-blue-500/20 text-blue-400' :
                    analytics.fitnessFatigue.readiness === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {analytics.fitnessFatigue.readiness}
                  </div>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-white mb-1">
                  {analytics.fitnessFatigue.performance.toFixed(0)}
                </div>
                <div className="text-xs sm:text-sm text-gray-400 mb-4">
                  Performance score
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-400">Fitness</span>
                      <span className="text-green-400 font-medium text-xs">{analytics.fitnessFatigue.currentFitness.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${Math.min(100, analytics.fitnessFatigue.currentFitness)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-400">Fatigue</span>
                      <span className="text-red-400 font-medium text-xs">{analytics.fitnessFatigue.currentFatigue.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${Math.min(100, analytics.fitnessFatigue.currentFatigue)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Stats Card */}
            {analytics.personalStats && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-4">Your Stats</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Workouts</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">
                      {analytics.personalStats.totalWorkouts}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Total Sets</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">
                      {analytics.personalStats.totalSets}
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5 pt-3 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-400">Fatigue Resistance</span>
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      {analytics.personalStats.fatigueResistance.toFixed(0)}/100
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-400">Recovery Speed</span>
                    <span className={`text-xs sm:text-sm font-semibold ${
                      analytics.personalStats.recoveryRate > 1.1 ? 'text-green-400' :
                      analytics.personalStats.recoveryRate > 0.9 ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {analytics.personalStats.recoveryRate > 1.1 ? 'Fast' :
                       analytics.personalStats.recoveryRate > 0.9 ? 'Normal' :
                       'Slow'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Recovery Status */}
            {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3 sm:mb-4">Muscle Recovery</h3>
                <div className="space-y-2">
                  {analytics.recoveryProfiles.slice(0, 3).map(profile => (
                    <div key={profile.muscleGroup} className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-300 capitalize">{profile.muscleGroup}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          profile.readinessScore >= 8 ? 'bg-green-400' :
                          profile.readinessScore >= 6 ? 'bg-yellow-400' :
                          'bg-orange-400'
                        }`}></div>
                        <span className={`text-xs sm:text-sm font-semibold ${
                          profile.readinessScore >= 8 ? 'text-green-400' :
                          profile.readinessScore >= 6 ? 'text-yellow-400' :
                          'text-orange-400'
                        }`}>
                          {profile.readinessScore.toFixed(1)}/10
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedView('recovery')}
                  className="mt-3 sm:mt-4 w-full text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
                  View All Muscles →
                </button>
              </div>
            )}

            {/* Quick Efficiency Status */}
            {analytics.sfrInsights && analytics.sfrInsights.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3 sm:mb-4">Best Exercises</h3>
                <div className="space-y-2">
                  {analytics.sfrInsights.slice(0, 3).map(insight => (
                    <div key={insight.exerciseId} className="flex justify-between items-center gap-2">
                      <span className="text-xs sm:text-sm text-gray-300 truncate">{insight.exerciseName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          insight.interpretation === 'excellent' ? 'bg-green-500/20 text-green-400' :
                          insight.interpretation === 'good' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {insight.interpretation}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedView('efficiency')}
                  className="mt-3 sm:mt-4 w-full text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
                  View All Exercises →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Training Load Detail View */}
        {selectedView === 'training-load' && analytics.acwr && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Training Load (ACWR)</h2>
              <div className="mb-6 sm:mb-8">
                <div className="flex items-baseline gap-3 mb-2">
                  <div className="text-5xl sm:text-6xl font-bold text-white">{analytics.acwr.ratio.toFixed(2)}</div>
                  <div className={`text-base sm:text-lg font-semibold px-3 py-1 rounded ${
                    analytics.acwr.status === 'optimal' ? 'bg-green-500/20 text-green-400' :
                    analytics.acwr.status === 'building' ? 'bg-blue-500/20 text-blue-400' :
                    analytics.acwr.status === 'danger' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {analytics.acwr.status}
                  </div>
                </div>
                <div className="h-3 sm:h-4 bg-gray-700 rounded-full overflow-hidden relative">
                  {/* Sweet spot indicator (0.8-1.3) */}
                  <div className="absolute left-[40%] right-[35%] h-full bg-green-500/30" />
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, (analytics.acwr.ratio / 2) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs sm:text-sm text-gray-400 mt-1.5">
                  <span>0.0</span>
                  <span className="text-green-400 text-xs">Sweet Spot</span>
                  <span>2.0+</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Metrics</h3>
                  <div className="space-y-3">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">7-day load</span>
                        <span className="text-base sm:text-lg text-white font-bold">{analytics.acwr.acuteLoad.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">28-day average</span>
                        <span className="text-base sm:text-lg text-white font-bold">{analytics.acwr.chronicLoad.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">Training strain</span>
                        <span className="text-base sm:text-lg text-white font-bold">{analytics.acwr.strain.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-gray-400">Monotony</span>
                        <span className={`text-base sm:text-lg font-bold ${
                          analytics.acwr.monotony > 2.5 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {analytics.acwr.monotony.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">What This Means</h3>
                  <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                    {analytics.acwr.ratio < 0.5 && (
                      <div className="bg-yellow-500/10 border-l-4 border-yellow-500 rounded-lg p-3">
                        <p className="font-semibold text-yellow-400 mb-1">Detraining Zone</p>
                        <p className="text-gray-400">Load too low to maintain fitness. Gradually increase volume.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio >= 0.5 && analytics.acwr.ratio < 0.8 && (
                      <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded-lg p-3">
                        <p className="font-semibold text-blue-400 mb-1">Maintenance Mode</p>
                        <p className="text-gray-400">Preserving fitness but not building. Consider progressive overload.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio >= 0.8 && analytics.acwr.ratio <= 1.3 && (
                      <div className="bg-green-500/10 border-l-4 border-green-500 rounded-lg p-3">
                        <p className="font-semibold text-green-400 mb-1">Optimal Zone</p>
                        <p className="text-gray-400">Perfect balance for gains with minimal injury risk. Keep it up!</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 1.3 && analytics.acwr.ratio <= 1.5 && (
                      <div className="bg-orange-500/10 border-l-4 border-orange-500 rounded-lg p-3">
                        <p className="font-semibold text-orange-400 mb-1">Building Phase</p>
                        <p className="text-gray-400">Progressive overload territory. Monitor fatigue closely.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 1.5 && analytics.acwr.ratio <= 2.0 && (
                      <div className="bg-red-500/10 border-l-4 border-red-500 rounded-lg p-3">
                        <p className="font-semibold text-red-400 mb-1">Overreaching</p>
                        <p className="text-gray-400">High load spike. Plan recovery within 1-2 weeks.</p>
                      </div>
                    )}
                    {analytics.acwr.ratio > 2.0 && (
                      <div className="bg-red-600/20 border-l-4 border-red-600 rounded-lg p-3">
                        <p className="font-semibold text-red-500 mb-1">DANGER ZONE</p>
                        <p className="text-gray-400">2-4× injury risk! Immediate deload recommended.</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-white/10 text-xs text-gray-500">
                      Based on research by Hulin et al. (2016)
                    </div>
                  </div>
                </div>
              </div>

            {/* Fitness-Fatigue Integration */}
            {analytics.fitnessFatigue && (
              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/10">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Performance Readiness</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-green-400 mb-1">Fitness</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.currentFitness.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Built-up adaptations</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-red-400 mb-1">Fatigue</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.currentFatigue.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Current stress level</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-purple-400 mb-1">Performance</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">{analytics.fitnessFatigue.performance.toFixed(0)}</div>
                    <div className="text-xs text-gray-400 mt-1">Readiness: {analytics.fitnessFatigue.readiness}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Recovery View */}
        {selectedView === 'recovery' && (
          <div className="space-y-4 sm:space-y-6">
            <RecoveryOverview
              profiles={analytics.recoveryProfiles || []}
              loading={loading}
            />

            {/* Info Card */}
            {analytics.recoveryProfiles && analytics.recoveryProfiles.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">How to Use This</h3>
                <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Readiness Score (1-10)</p>
                    <p className="text-gray-400">Below 7 = train light or rest. Above 8 = ready for heavy training.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Recovery Times</p>
                    <p className="text-gray-400">Based on research: Legs ~72h, Chest/Back ~48h, Arms ~36h. Adjusted for your fatigue.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">Smart Training</p>
                    <p className="text-gray-400">Train high-readiness muscles hard. Give low-readiness muscles more time.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Efficiency View */}
        {selectedView === 'efficiency' && (
          <div className="space-y-4 sm:space-y-6">
            <SFRInsightsTable
              insights={analytics.sfrInsights || []}
              loading={loading}
            />

            {/* Info Card */}
            {analytics.sfrInsights && analytics.sfrInsights.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Understanding Efficiency (SFR)</h3>
                <div className="text-xs sm:text-sm text-gray-300 space-y-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">What is SFR?</p>
                    <p className="text-gray-400">Stimulus-to-Fatigue Ratio. Higher = better gains per unit of fatigue.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">What Matters</p>
                    <p className="text-gray-400">Sets near failure (RPE 8-10) drive growth. SFR shows which exercises deliver best results.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="font-medium text-purple-400 mb-1">How to Use</p>
                    <p className="text-gray-400">Keep exercises with "excellent" SFR. Replace or reduce volume on "poor" SFR exercises.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Causal Insights View */}
        {selectedView === 'causal' && allWorkouts.length > 0 && (
          <div>
            <CausalInsightsDashboard workouts={allWorkouts} />
          </div>
        )}
        {selectedView === 'causal' && allWorkouts.length === 0 && (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700/50">
            <p className="text-gray-400">Loading workouts...</p>
          </div>
        )}

        {/* Personal Profile View */}
        {selectedView === 'personal' && analytics.hierarchicalModel && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Your Profile</h2>

              {/* Core Traits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3">Fatigue Resistance</h3>
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                    {analytics.personalStats?.fatigueResistance.toFixed(0)}/100
                  </div>
                  <div className={`text-xs sm:text-sm mb-3 font-medium ${
                    analytics.personalStats && analytics.personalStats.fatigueResistance > 70
                      ? 'text-green-400'
                      : analytics.personalStats && analytics.personalStats.fatigueResistance > 50
                      ? 'text-blue-400'
                      : 'text-yellow-400'
                  }`}>
                    {analytics.personalStats && analytics.personalStats.fatigueResistance > 70
                      ? 'Above Average - Handles volume well'
                      : analytics.personalStats && analytics.personalStats.fatigueResistance > 50
                      ? 'Average - Normal tolerance'
                      : 'Below Average - Fatigue-sensitive'}
                  </div>
                  <div className="h-2 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                      style={{ width: `${analytics.personalStats?.fatigueResistance || 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-3">Recovery Speed</h3>
                  <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                    {analytics.personalStats?.recoveryRate.toFixed(2)}×
                  </div>
                  <div className={`text-xs sm:text-sm mb-3 font-medium ${
                    analytics.personalStats && analytics.personalStats.recoveryRate > 1.1
                      ? 'text-green-400'
                      : analytics.personalStats && analytics.personalStats.recoveryRate > 0.9
                      ? 'text-blue-400'
                      : 'text-yellow-400'
                  }`}>
                    {analytics.personalStats && analytics.personalStats.recoveryRate > 1.1
                      ? 'Fast - Train more frequently'
                      : analytics.personalStats && analytics.personalStats.recoveryRate > 0.9
                      ? 'Normal - Standard rest needed'
                      : 'Slow - Extra rest helps'}
                  </div>
                  <div className="h-2 sm:h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                      style={{ width: `${Math.min(100, ((analytics.personalStats?.recoveryRate || 1) / 1.5) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Training Summary - Mobile First */}
              <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-white/10">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Training Volume</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.personalStats?.totalWorkouts || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Workouts</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.personalStats?.totalSets || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Total Sets</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {analytics.exerciseRates?.length || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Exercises</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                      {(analytics.hierarchicalModel.userConfidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">Confidence</div>
                  </div>
                </div>
              </div>

              {/* Exercise-Specific Rates */}
              {analytics.exerciseRates && analytics.exerciseRates.length > 0 && (
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Exercise Fatigue Rates</h3>
                  <div className="text-xs sm:text-sm text-gray-400 mb-3">Shows how much each exercise fatigues you per set</div>
                  <div className="space-y-2">
                    {analytics.exerciseRates
                      .sort((a, b) => b.fatigueRate - a.fatigueRate)
                      .slice(0, 10)
                      .map((exercise) => (
                        <div key={exercise.exerciseId} className="bg-gray-800/50 rounded-lg p-3">
                          <div className="flex justify-between items-start gap-2 mb-1.5">
                            <span className="text-xs sm:text-sm text-white font-medium flex-1 min-w-0 truncate">
                              {exercise.exerciseName || exercise.exerciseId}
                            </span>
                            <span className={`text-xs sm:text-sm font-bold flex-shrink-0 ${
                              exercise.fatigueRate > 0.2 ? 'text-red-400' :
                              exercise.fatigueRate > 0.15 ? 'text-orange-400' :
                              exercise.fatigueRate > 0.1 ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {(exercise.fatigueRate * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{exercise.sampleSize} sets</span>
                            <span>•</span>
                            <span>{(Math.max(0, 1 - exercise.variance) * 100).toFixed(0)}% confidence</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Research Citation */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
          <p>Research-backed analytics</p>
        </div>
      </div>
    </div>
  );
}
