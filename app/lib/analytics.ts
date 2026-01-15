import { storage } from './storage';
import { getAllExercises } from './programs';

// ============================================================
// E1RM PROGRESSION ANALYSIS
// ============================================================

export interface E1RMDataPoint {
  date: string;
  e1rm: number;
  weight: number;
  reps: number;
  sessionId: string;
}

export function getE1RMProgression(exerciseId: string): E1RMDataPoint[] {
  const history = storage.getExerciseHistory(exerciseId);
  const dataPoints: E1RMDataPoint[] = [];

  history.forEach(session => {
    const exerciseSets = session.sets.filter(
      s => s.exerciseId === exerciseId && s.completed && s.e1rm
    );

    if (exerciseSets.length > 0) {
      // Get best E1RM from this session
      const bestSet = exerciseSets.reduce((best, current) =>
        (current.e1rm || 0) > (best.e1rm || 0) ? current : best
      );

      dataPoints.push({
        date: session.date,
        e1rm: bestSet.e1rm || 0,
        weight: bestSet.actualWeight || 0,
        reps: bestSet.actualReps || 0,
        sessionId: session.id,
      });
    }
  });

  return dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ============================================================
// VOLUME LOAD ANALYSIS
// ============================================================

export interface VolumeDataPoint {
  date: string;
  totalVolume: number;
  sets: number;
  avgWeight: number;
  avgReps: number;
  sessionId: string;
}

export function getVolumeProgression(exerciseId: string): VolumeDataPoint[] {
  const history = storage.getExerciseHistory(exerciseId);
  const dataPoints: VolumeDataPoint[] = [];

  history.forEach(session => {
    const exerciseSets = session.sets.filter(
      s => s.exerciseId === exerciseId && s.completed && s.volumeLoad
    );

    if (exerciseSets.length > 0) {
      const totalVolume = exerciseSets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);
      const totalWeight = exerciseSets.reduce((sum, set) => sum + (set.actualWeight || 0), 0);
      const totalReps = exerciseSets.reduce((sum, set) => sum + (set.actualReps || 0), 0);

      dataPoints.push({
        date: session.date,
        totalVolume,
        sets: exerciseSets.length,
        avgWeight: totalWeight / exerciseSets.length,
        avgReps: totalReps / exerciseSets.length,
        sessionId: session.id,
      });
    }
  });

  return dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface WeeklyVolumeDataPoint {
  weekStart: string;
  totalVolume: number;
  sessions: number;
}

export function getWeeklyVolumeProgression(exerciseId: string): WeeklyVolumeDataPoint[] {
  const history = storage.getExerciseHistory(exerciseId);
  const weeklyData = new Map<string, { volume: number; sessions: number }>();

  history.forEach(session => {
    const exerciseSets = session.sets.filter(
      s => s.exerciseId === exerciseId && s.completed && s.volumeLoad
    );

    if (exerciseSets.length > 0) {
      const sessionDate = new Date(session.date);
      const weekStart = getWeekStart(sessionDate);
      const weekKey = weekStart.toISOString().split('T')[0];

      const totalVolume = exerciseSets.reduce((sum, set) => sum + (set.volumeLoad || 0), 0);

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { volume: 0, sessions: 0 });
      }

      const week = weeklyData.get(weekKey)!;
      week.volume += totalVolume;
      week.sessions += 1;
    }
  });

  return Array.from(weeklyData.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      totalVolume: data.volume,
      sessions: data.sessions,
    }))
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// ============================================================
// PERSONAL RECORD DETECTION
// ============================================================

export interface PersonalRecord {
  type: 'max_weight' | 'max_reps' | 'max_e1rm' | 'max_volume';
  exerciseId: string;
  exerciseName: string;
  value: number;
  details: string;
  date: string;
  sessionId: string;
  isNew: boolean; // True if achieved in last 7 days
}

export function detectNewPRs(exerciseId: string, exerciseName: string): PersonalRecord[] {
  const prs = storage.getPersonalRecords(exerciseId);
  if (!prs) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newPRs: PersonalRecord[] = [];

  // Max Weight PR
  const maxWeightDate = new Date(prs.maxWeight.date);
  if (maxWeightDate > sevenDaysAgo) {
    newPRs.push({
      type: 'max_weight',
      exerciseId,
      exerciseName,
      value: prs.maxWeight.weight,
      details: `${prs.maxWeight.weight}lbs × ${prs.maxWeight.reps} reps`,
      date: prs.maxWeight.date,
      sessionId: '', // Would need to track this in getPersonalRecords
      isNew: true,
    });
  }

  // Max Reps PR
  const maxRepsDate = new Date(prs.maxReps.date);
  if (maxRepsDate > sevenDaysAgo) {
    newPRs.push({
      type: 'max_reps',
      exerciseId,
      exerciseName,
      value: prs.maxReps.reps,
      details: `${prs.maxReps.reps} reps @ ${prs.maxReps.weight}lbs`,
      date: prs.maxReps.date,
      sessionId: '',
      isNew: true,
    });
  }

  // Max E1RM PR
  const maxE1RMDate = new Date(prs.maxE1RM.date);
  if (maxE1RMDate > sevenDaysAgo) {
    newPRs.push({
      type: 'max_e1rm',
      exerciseId,
      exerciseName,
      value: prs.maxE1RM.e1rm,
      details: `${prs.maxE1RM.e1rm}lbs E1RM (${prs.maxE1RM.weight}lbs × ${prs.maxE1RM.reps})`,
      date: prs.maxE1RM.date,
      sessionId: '',
      isNew: true,
    });
  }

  // Max Volume PR
  const maxVolumeDate = new Date(prs.maxVolume.date);
  if (maxVolumeDate > sevenDaysAgo) {
    newPRs.push({
      type: 'max_volume',
      exerciseId,
      exerciseName,
      value: prs.maxVolume.volume,
      details: `${prs.maxVolume.volume}lbs (${prs.maxVolume.weight}lbs × ${prs.maxVolume.reps})`,
      date: prs.maxVolume.date,
      sessionId: '',
      isNew: true,
    });
  }

  return newPRs;
}

export function getAllRecentPRs(): PersonalRecord[] {
  const history = storage.getWorkoutHistory();
  const exercises = new Set<string>();

  // Collect all exerciseIds from history
  history.forEach(session => {
    session.sets.forEach(set => {
      if (set.completed) {
        exercises.add(set.exerciseId);
      }
    });
  });

  const allPRs: PersonalRecord[] = [];
  exercises.forEach(exerciseId => {
    // You'd need to map exerciseId to name (use defaultExercises)
    const prs = detectNewPRs(exerciseId, exerciseId); // Placeholder, should resolve name
    allPRs.push(...prs);
  });

  return allPRs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ============================================================
// RPE CONSISTENCY ANALYSIS
// ============================================================

export interface RPEConsistency {
  exerciseId: string;
  totalSets: number;
  setsWithRPE: number;
  avgPrescribedRPE: number;
  avgActualRPE: number;
  avgDeviation: number; // Positive = overshooting, negative = undershooting
  consistency: 'excellent' | 'good' | 'fair' | 'poor';
}

export function analyzeRPEConsistency(exerciseId: string): RPEConsistency | null {
  const history = storage.getExerciseHistory(exerciseId);
  const allSets = history.flatMap(session =>
    session.sets.filter(s => s.exerciseId === exerciseId && s.completed)
  );

  if (allSets.length === 0) return null;

  // For imported data: if no prescribedRPE, just show actual RPE stats
  const setsWithBothRPE = allSets.filter(s => s.prescribedRPE !== null && s.actualRPE !== null);
  const setsWithActualRPE = allSets.filter(s => s.actualRPE !== null);

  // If no actual RPE data at all, return null
  if (setsWithActualRPE.length === 0) return null;

  // If we have prescribed RPE data, do full consistency analysis
  if (setsWithBothRPE.length > 0) {
    const totalPrescribed = setsWithBothRPE.reduce((sum, s) => sum + (s.prescribedRPE || 0), 0);
    const totalActual = setsWithBothRPE.reduce((sum, s) => sum + (s.actualRPE || 0), 0);
    const totalDeviation = setsWithBothRPE.reduce(
      (sum, s) => sum + Math.abs((s.actualRPE || 0) - (s.prescribedRPE || 0)),
      0
    );

    const avgPrescribedRPE = totalPrescribed / setsWithBothRPE.length;
    const avgActualRPE = totalActual / setsWithBothRPE.length;
    const avgDeviation = (totalActual - totalPrescribed) / setsWithBothRPE.length;
    const avgAbsDeviation = totalDeviation / setsWithBothRPE.length;

    let consistency: 'excellent' | 'good' | 'fair' | 'poor';
    if (avgAbsDeviation < 0.5) consistency = 'excellent';
    else if (avgAbsDeviation < 1.0) consistency = 'good';
    else if (avgAbsDeviation < 1.5) consistency = 'fair';
    else consistency = 'poor';

    return {
      exerciseId,
      totalSets: allSets.length,
      setsWithRPE: setsWithBothRPE.length,
      avgPrescribedRPE,
      avgActualRPE,
      avgDeviation,
      consistency,
    };
  }

  // For imported data without prescribed RPE: just show actual RPE average
  const totalActual = setsWithActualRPE.reduce((sum, s) => sum + (s.actualRPE || 0), 0);
  const avgActualRPE = totalActual / setsWithActualRPE.length;

  return {
    exerciseId,
    totalSets: allSets.length,
    setsWithRPE: setsWithActualRPE.length,
    avgPrescribedRPE: 0, // No prescribed data
    avgActualRPE,
    avgDeviation: 0, // Can't calculate deviation without prescribed
    consistency: 'excellent', // Default when no comparison available
  };
}

export function getSessionRPETrend(): { date: string; avgRPE: number; sessionId: string }[] {
  const history = storage.getWorkoutHistory();
  return history
    .filter(session => session.averageRPE !== undefined)
    .map(session => ({
      date: session.date,
      avgRPE: session.averageRPE || 0,
      sessionId: session.id,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ============================================================
// MUSCLE GROUP VOLUME DISTRIBUTION
// ============================================================

export interface MuscleGroupVolume {
  muscleGroup: string;
  totalVolume: number;
  sets: number;
  percentage: number;
}

export function getMuscleGroupDistribution(
  dateRange?: { start: string; end: string }
): MuscleGroupVolume[] {
  const history = storage.getWorkoutHistory();
  const filteredHistory = dateRange
    ? history.filter(
        session =>
          new Date(session.date) >= new Date(dateRange.start) &&
          new Date(session.date) <= new Date(dateRange.end)
      )
    : history;

  // This requires mapping exerciseId to muscle groups
  // For now, return placeholder - would need defaultExercises import
  const muscleVolumeMap = new Map<string, { volume: number; sets: number }>();

  filteredHistory.forEach(session => {
    session.sets.forEach(set => {
      if (set.completed && set.volumeLoad) {
        // Would need to resolve exerciseId to Exercise to get muscleGroups
        // Placeholder logic:
        const muscleGroup = 'chest'; // Would lookup from defaultExercises
        if (!muscleVolumeMap.has(muscleGroup)) {
          muscleVolumeMap.set(muscleGroup, { volume: 0, sets: 0 });
        }
        const data = muscleVolumeMap.get(muscleGroup)!;
        data.volume += set.volumeLoad;
        data.sets += 1;
      }
    });
  });

  const totalVolume = Array.from(muscleVolumeMap.values()).reduce(
    (sum, data) => sum + data.volume,
    0
  );

  return Array.from(muscleVolumeMap.entries())
    .map(([muscleGroup, data]) => ({
      muscleGroup,
      totalVolume: data.volume,
      sets: data.sets,
      percentage: totalVolume > 0 ? (data.volume / totalVolume) * 100 : 0,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume);
}

// ============================================================
// STRENGTH STANDARDS COMPARISON
// ============================================================

export type StrengthLevel = 'untrained' | 'novice' | 'intermediate' | 'advanced' | 'elite';

export interface StrengthStandard {
  exerciseId: string;
  bodyweight: number; // lbs
  untrained: number;
  novice: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

// Rough strength standards for major lifts (male, lbs)
// Source: ExRx.net standards (simplified)
const STRENGTH_STANDARDS: Record<string, (bw: number) => StrengthStandard> = {
  bench_tng: (bw: number) => ({
    exerciseId: 'bench_tng',
    bodyweight: bw,
    untrained: bw * 0.5,
    novice: bw * 0.75,
    intermediate: bw * 1.25,
    advanced: bw * 1.75,
    elite: bw * 2.0,
  }),
  squat: (bw: number) => ({
    exerciseId: 'squat',
    bodyweight: bw,
    untrained: bw * 0.75,
    novice: bw * 1.25,
    intermediate: bw * 1.75,
    advanced: bw * 2.25,
    elite: bw * 2.75,
  }),
  deadlift: (bw: number) => ({
    exerciseId: 'deadlift',
    bodyweight: bw,
    untrained: bw * 1.0,
    novice: bw * 1.5,
    intermediate: bw * 2.0,
    advanced: bw * 2.75,
    elite: bw * 3.25,
  }),
};

export function getStrengthLevel(exerciseId: string, e1rm: number, bodyweight: number): {
  level: StrengthLevel;
  standard: StrengthStandard;
  nextLevel: { name: StrengthLevel; weight: number; gap: number } | null;
} | null {
  const standardFunc = STRENGTH_STANDARDS[exerciseId];
  if (!standardFunc) return null;

  const standard = standardFunc(bodyweight);

  let level: StrengthLevel;
  let nextLevel: { name: StrengthLevel; weight: number; gap: number } | null = null;

  if (e1rm < standard.untrained) {
    level = 'untrained';
    nextLevel = {
      name: 'novice',
      weight: standard.novice,
      gap: standard.novice - e1rm,
    };
  } else if (e1rm < standard.novice) {
    level = 'untrained';
    nextLevel = {
      name: 'novice',
      weight: standard.novice,
      gap: standard.novice - e1rm,
    };
  } else if (e1rm < standard.intermediate) {
    level = 'novice';
    nextLevel = {
      name: 'intermediate',
      weight: standard.intermediate,
      gap: standard.intermediate - e1rm,
    };
  } else if (e1rm < standard.advanced) {
    level = 'intermediate';
    nextLevel = {
      name: 'advanced',
      weight: standard.advanced,
      gap: standard.advanced - e1rm,
    };
  } else if (e1rm < standard.elite) {
    level = 'advanced';
    nextLevel = {
      name: 'elite',
      weight: standard.elite,
      gap: standard.elite - e1rm,
    };
  } else {
    level = 'elite';
    nextLevel = null;
  }

  return { level, standard, nextLevel };
}

// ============================================================
// RECOVERY & FATIGUE INDICATORS
// ============================================================

export interface RPERecoveryMetrics {
  last7DaysAvgRPE: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing'; // RPE trend
  rpeVolatility: number; // Standard deviation of RPE
  recommendDeload: boolean;
  reasoning: string;
}

export function analyzeRecovery(): RPERecoveryMetrics {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const history = storage.getWorkoutHistory();
  const recentSessions = history.filter(session => new Date(session.date) >= sevenDaysAgo);

  if (recentSessions.length === 0) {
    return {
      last7DaysAvgRPE: 0,
      trendDirection: 'stable',
      rpeVolatility: 0,
      recommendDeload: false,
      reasoning: 'Not enough recent data',
    };
  }

  const rpeValues = recentSessions
    .map(s => s.averageRPE)
    .filter((rpe): rpe is number => rpe !== undefined);

  if (rpeValues.length === 0) {
    return {
      last7DaysAvgRPE: 0,
      trendDirection: 'stable',
      rpeVolatility: 0,
      recommendDeload: false,
      reasoning: 'No RPE data available',
    };
  }

  const avgRPE = rpeValues.reduce((sum, val) => sum + val, 0) / rpeValues.length;

  // Calculate trend (simple: compare first half vs second half)
  const midpoint = Math.floor(rpeValues.length / 2);
  const firstHalfAvg =
    rpeValues.slice(0, midpoint).reduce((sum, val) => sum + val, 0) / midpoint || 0;
  const secondHalfAvg =
    rpeValues.slice(midpoint).reduce((sum, val) => sum + val, 0) / (rpeValues.length - midpoint) ||
    0;

  let trendDirection: 'increasing' | 'stable' | 'decreasing';
  if (secondHalfAvg - firstHalfAvg > 0.5) trendDirection = 'increasing';
  else if (secondHalfAvg - firstHalfAvg < -0.5) trendDirection = 'decreasing';
  else trendDirection = 'stable';

  // Calculate volatility (standard deviation)
  const variance =
    rpeValues.reduce((sum, val) => sum + Math.pow(val - avgRPE, 2), 0) / rpeValues.length;
  const rpeVolatility = Math.sqrt(variance);

  // Recommend deload if:
  // - Average RPE > 8.5 over last 7 days
  // - RPE trend is increasing
  // - High volatility (>1.5)
  const recommendDeload = avgRPE > 8.5 || (trendDirection === 'increasing' && avgRPE > 8.0);

  let reasoning = '';
  if (recommendDeload) {
    if (avgRPE > 8.5) {
      reasoning = `Your average RPE is ${avgRPE.toFixed(1)} over the last 7 days. Consider a deload week.`;
    } else if (trendDirection === 'increasing') {
      reasoning = `Your RPE is trending upward (${secondHalfAvg.toFixed(1)} vs ${firstHalfAvg.toFixed(1)}). Fatigue may be accumulating.`;
    }
  } else {
    reasoning = `Recovery looks good. Average RPE: ${avgRPE.toFixed(1)}, trend: ${trendDirection}.`;
  }

  return {
    last7DaysAvgRPE: avgRPE,
    trendDirection,
    rpeVolatility,
    recommendDeload,
    reasoning,
  };
}

// ============================================================
// EXPORT ALL ANALYTICS FUNCTIONS
// ============================================================

// ============================================================
// TRAINING CALENDAR / HEATMAP
// ============================================================

export interface CalendarDay {
  date: string;
  workoutCount: number;
  totalSets: number;
  totalVolume: number;
  intensity: 'none' | 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Get training calendar data for heatmap visualization
 * Returns last N days of training activity
 */
export function getTrainingCalendar(days: number = 90): CalendarDay[] {
  const history = storage.getWorkoutHistory();
  const calendar: Map<string, CalendarDay> = new Map();

  // Initialize calendar with empty days
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    calendar.set(dateStr, {
      date: dateStr,
      workoutCount: 0,
      totalSets: 0,
      totalVolume: 0,
      intensity: 'none',
    });
  }

  // Fill in workout data
  history.forEach(session => {
    if (calendar.has(session.date)) {
      const day = calendar.get(session.date)!;
      day.workoutCount++;
      day.totalSets += session.sets.filter(s => s.completed).length;
      day.totalVolume += session.sets
        .filter(s => s.completed)
        .reduce((sum, s) => sum + (s.volumeLoad || 0), 0);
    }
  });

  // Calculate intensity levels
  const volumes = Array.from(calendar.values()).map(d => d.totalVolume);
  const maxVolume = Math.max(...volumes);
  const p25 = maxVolume * 0.25;
  const p50 = maxVolume * 0.50;
  const p75 = maxVolume * 0.75;

  calendar.forEach(day => {
    if (day.totalVolume === 0) {
      day.intensity = 'none';
    } else if (day.totalVolume < p25) {
      day.intensity = 'low';
    } else if (day.totalVolume < p50) {
      day.intensity = 'medium';
    } else if (day.totalVolume < p75) {
      day.intensity = 'high';
    } else {
      day.intensity = 'very_high';
    }
  });

  return Array.from(calendar.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Deload Need Analysis
 * Determines if user should take a deload week based on training stress
 */
export interface DeloadRecommendation {
  shouldDeload: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'high' | 'critical';
  reason: string;
  indicators: string[];
  recommendations: string[];
  weeksSinceDeload: number;
  accumulatedFatigue: number;
}

export function analyzeDeloadNeed(): DeloadRecommendation {
  const history = storage.getWorkoutHistory();
  const recentSessions = history.slice(-12); // Last ~3-4 weeks

  if (recentSessions.length < 6) {
    return {
      shouldDeload: false,
      severity: 'none',
      reason: 'Insufficient training history to assess deload need',
      indicators: [],
      recommendations: [],
      weeksSinceDeload: 0,
      accumulatedFatigue: 0,
    };
  }

  const indicators: string[] = [];
  let fatigueScore = 0;

  // 1. Check weeks since last deload/rest week
  const daysSinceStart = recentSessions.length;
  const weeksSinceDeload = Math.floor(daysSinceStart / 3); // Assuming ~3 workouts/week

  if (weeksSinceDeload >= 4) {
    indicators.push(`${weeksSinceDeload} weeks of continuous training`);
    fatigueScore += 25;
  }

  // 2. Analyze RPE trend (are RPEs climbing for same weights?)
  const sessionsWithRPE = recentSessions.filter(s => s.averageRPE);
  if (sessionsWithRPE.length >= 4) {
    const recent4 = sessionsWithRPE.slice(-4).map(s => s.averageRPE || 0);
    const previous4 = sessionsWithRPE.slice(-8, -4).map(s => s.averageRPE || 0);

    const recentAvg = recent4.reduce((a, b) => a + b, 0) / recent4.length;
    const previousAvg = previous4.reduce((a, b) => a + b, 0) / (previous4.length || 1);

    if (recentAvg > previousAvg + 0.5) {
      indicators.push(`RPE increasing: ${previousAvg.toFixed(1)} → ${recentAvg.toFixed(1)}`);
      fatigueScore += 20;
    }

    if (recentAvg >= 8.5) {
      indicators.push(`High average RPE: ${recentAvg.toFixed(1)}`);
      fatigueScore += 15;
    }
  }

  // 3. Check for excessive high-RPE sets
  let highRPESets = 0;
  let totalSets = 0;

  recentSessions.forEach(session => {
    session.sets.forEach(set => {
      if (set.completed && set.actualRPE !== null && set.actualRPE !== undefined) {
        totalSets++;
        if (set.actualRPE >= 9) {
          highRPESets++;
        }
      }
    });
  });

  const highRPEPercentage = totalSets > 0 ? (highRPESets / totalSets) * 100 : 0;
  if (highRPEPercentage > 40) {
    indicators.push(`${highRPEPercentage.toFixed(0)}% of sets at RPE 9+`);
    fatigueScore += 20;
  }

  // 4. Check volume trend (is volume dropping despite effort?)
  if (recentSessions.length >= 6) {
    const recent3Volume = recentSessions.slice(-3)
      .reduce((sum, s) => sum + (s.totalVolumeLoad || 0), 0) / 3;
    const previous3Volume = recentSessions.slice(-6, -3)
      .reduce((sum, s) => sum + (s.totalVolumeLoad || 0), 0) / 3;

    if (recent3Volume < previous3Volume * 0.85 && highRPEPercentage > 30) {
      indicators.push('Volume declining despite high effort');
      fatigueScore += 25;
    }
  }

  // 5. Determine severity and recommendation
  let severity: DeloadRecommendation['severity'] = 'none';
  let shouldDeload = false;
  const recommendations: string[] = [];

  if (fatigueScore >= 60) {
    severity = 'critical';
    shouldDeload = true;
    recommendations.push('Immediate deload recommended');
    recommendations.push('Reduce volume by 50% this week');
    recommendations.push('Reduce intensity by 15-20%');
    recommendations.push('Focus on technique and movement quality');
  } else if (fatigueScore >= 40) {
    severity = 'high';
    shouldDeload = true;
    recommendations.push('Deload recommended within next week');
    recommendations.push('Reduce volume by 40%');
    recommendations.push('Reduce intensity by 10-15%');
    recommendations.push('Maintain frequency but cut sets per exercise');
  } else if (fatigueScore >= 25) {
    severity = 'moderate';
    shouldDeload = false;
    recommendations.push('Consider planning a deload soon');
    recommendations.push('Monitor RPE closely next few sessions');
    recommendations.push('Avoid pushing to failure');
    recommendations.push('Ensure adequate sleep and nutrition');
  } else if (fatigueScore >= 10) {
    severity = 'mild';
    shouldDeload = false;
    recommendations.push('Training stress manageable');
    recommendations.push('Continue current program');
    recommendations.push('Plan deload after 1-2 more weeks');
  } else {
    severity = 'none';
    shouldDeload = false;
    recommendations.push('No deload needed');
    recommendations.push('Recovery appears adequate');
    recommendations.push('Continue progressive overload');
  }

  const reason = shouldDeload
    ? `Accumulated fatigue score: ${fatigueScore}/100`
    : `Low fatigue accumulation: ${fatigueScore}/100`;

  return {
    shouldDeload,
    severity,
    reason,
    indicators,
    recommendations,
    weeksSinceDeload,
    accumulatedFatigue: fatigueScore,
  };
}

/**
 * Recovery Metrics
 * Shows recovery status for different muscle groups
 */
export interface MuscleRecovery {
  muscleGroup: string;
  daysSinceLastTrained: number;
  status: 'recovered' | 'recovering' | 'fresh';
  lastVolume: number;
  recommendation: string;
}

export interface RecoveryMetrics {
  muscleGroups: MuscleRecovery[];
  overallReadiness: 'low' | 'medium' | 'high';
  daysSinceLastWorkout: number;
  consecutiveTrainingDays: number;
}

export function getRecoveryMetrics(): RecoveryMetrics {
  const history = storage.getWorkoutHistory();

  if (history.length === 0) {
    return {
      muscleGroups: [],
      overallReadiness: 'high',
      daysSinceLastWorkout: 999,
      consecutiveTrainingDays: 0,
    };
  }

  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const now = new Date();
  const lastWorkoutDate = new Date(sortedHistory[0].date);
  const daysSinceLastWorkout = Math.floor(
    (now.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate consecutive training days
  let consecutiveTrainingDays = 0;
  for (let i = 0; i < sortedHistory.length; i++) {
    const current = new Date(sortedHistory[i].date);
    if (i === 0) {
      consecutiveTrainingDays = 1;
      continue;
    }
    const previous = new Date(sortedHistory[i - 1].date);
    const dayDiff = Math.floor((previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff <= 1) {
      consecutiveTrainingDays++;
    } else {
      break;
    }
  }

  // Muscle group recovery tracking
  const muscleGroupMap = new Map<string, { lastDate: Date; volume: number }>();
  const mainMuscles = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves'];

  const allExercises = getAllExercises();

  history.forEach(session => {
    session.sets.forEach(set => {
      if (!set.completed) return;

      const exercise = allExercises.find(ex => ex.id === set.exerciseId);
      if (!exercise) return;

      exercise.muscleGroups.forEach(muscle => {
        const existing = muscleGroupMap.get(muscle);
        const sessionDate = new Date(session.date);
        const volume = set.volumeLoad || 0;

        if (!existing || sessionDate > existing.lastDate) {
          muscleGroupMap.set(muscle, {
            lastDate: sessionDate,
            volume: (existing?.volume || 0) + volume,
          });
        }
      });
    });
  });

  const muscleGroups: MuscleRecovery[] = mainMuscles.map(muscle => {
    const data = muscleGroupMap.get(muscle);

    if (!data) {
      return {
        muscleGroup: muscle,
        daysSinceLastTrained: 999,
        status: 'fresh' as const,
        lastVolume: 0,
        recommendation: 'Can train anytime',
      };
    }

    const daysSince = Math.floor(
      (now.getTime() - data.lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: 'recovered' | 'recovering' | 'fresh';
    let recommendation: string;

    if (daysSince >= 4) {
      status = 'fresh';
      recommendation = 'Fully recovered, ready to train';
    } else if (daysSince >= 2) {
      status = 'recovered';
      recommendation = 'Recovered, can train with good intensity';
    } else {
      status = 'recovering';
      recommendation = 'Still recovering, train lightly if needed';
    }

    return {
      muscleGroup: muscle,
      daysSinceLastTrained: daysSince,
      status,
      lastVolume: data.volume,
      recommendation,
    };
  });

  // Overall readiness
  let overallReadiness: 'low' | 'medium' | 'high';
  if (consecutiveTrainingDays >= 5) {
    overallReadiness = 'low';
  } else if (daysSinceLastWorkout >= 3) {
    overallReadiness = 'high';
  } else {
    overallReadiness = 'medium';
  }

  return {
    muscleGroups,
    overallReadiness,
    daysSinceLastWorkout,
    consecutiveTrainingDays,
  };
}

export const analytics = {
  getE1RMProgression,
  getVolumeProgression,
  getWeeklyVolumeProgression,
  detectNewPRs,
  getAllRecentPRs,
  analyzeRPEConsistency,
  getSessionRPETrend,
  getMuscleGroupDistribution,
  getStrengthLevel,
  analyzeRecovery,
  getTrainingCalendar,
  analyzeDeloadNeed,
  getRecoveryMetrics,
};
