import { supabase } from '../supabase/client';
import {
  confidenceFromDataSufficiency,
  dataSufficiencyFromSampleCount,
  type MetricConfidence,
  type MetricDataSufficiency,
  type MetricExplanation,
} from './explanations';

type Quality = 'poor' | 'fair' | 'good' | 'excellent';

export interface TrainingReadiness {
  score: number; // 0-100
  modifier: number; // 0.90 to 1.05
  recommendation: string;
  focus_adjustments: {
    upper_body_modifier: number;
    lower_body_modifier: number;
  };
  reason: string;
  source: 'manual' | 'training' | 'baseline';
  hasRecoveryInput: boolean;
  confidence: MetricConfidence;
  dataSufficiency: MetricDataSufficiency;
  explanation: MetricExplanation;
}

interface UserContext {
  date?: string;
  sleep_hours?: number | null;
  sleep_quality?: Quality | null;
  calorie_balance?: 'surplus' | 'deficit' | 'maintenance' | null;
  hydration_level?: Quality | null;
  work_stress?: number | null;
  life_stress?: number | null;
  perceived_stress?: number | null;
  resting_heart_rate?: number | null;
  heart_rate_variability?: number | null;
  subjective_readiness?: number | null;
  source?: string | null;
}

type ScoreComponent = {
  label: string;
  score: number;
  weight: number;
};

type TrainingLoadSignal = {
  score: number;
  upperModifier: number;
  lowerModifier: number;
  reason: string;
  hasWorkout: boolean;
};

type RecentWorkoutStats = {
  end_time: string | null;
  average_rpe: number | null;
  total_sets: number | null;
  total_volume_load: number | null;
  name: string | null;
};

const QUERY_TIMEOUT_MS = 7000;
const MANUAL_CONTEXT_FRESH_DAYS = 1;

export async function calculateTrainingReadiness(userId: string): Promise<TrainingReadiness> {
  const [contexts, recentWorkouts] = await Promise.all([
    fetchRecentManualContexts(userId),
    fetchRecentWorkoutStats(userId),
  ]);

  const context = contexts[0] ?? {};
  const contextIsFresh = isContextFresh(context.date);
  const hasManualRecoveryInput = contextIsFresh && hasMeaningfulContext(context);
  const training = calculateTrainingLoadSignal(recentWorkouts);

  const manualScore = hasManualRecoveryInput
    ? calculateManualRecoveryScore(context, contexts.slice(1))
    : null;

  const score = manualScore == null
    ? moderateTrainingOnlyScore(training.score)
    : clamp(Math.round(manualScore * 0.78 + training.score * 0.22), 35, 98);

  const modifier = getReadinessModifier(score);
  const source: TrainingReadiness['source'] = hasManualRecoveryInput
    ? 'manual'
    : training.hasWorkout
      ? 'training'
      : 'baseline';
  const completedWorkoutCount = recentWorkouts.filter((workout) => workout.end_time).length;
  const manualInputCount = hasManualRecoveryInput ? countMeaningfulContextInputs(context) : 0;
  const dataSufficiency = dataSufficiencyFromSampleCount(manualInputCount + completedWorkoutCount);
  const confidence = source === 'baseline' ? 'low' : confidenceFromDataSufficiency(dataSufficiency);
  const reason = buildReason({
    source,
    context,
    manualScore,
    training,
    hasManualRecoveryInput,
  });

  return {
    score,
    modifier,
    recommendation: getRecommendation(score, source),
    focus_adjustments: {
      upper_body_modifier: Number((modifier * training.upperModifier).toFixed(3)),
      lower_body_modifier: Number((modifier * training.lowerModifier).toFixed(3)),
    },
    reason,
    source,
    hasRecoveryInput: hasManualRecoveryInput,
    confidence,
    dataSufficiency,
    explanation: {
      metric: 'readiness',
      value: score,
      label: source === 'manual' ? 'Daily Check-In + training load' : source === 'training' ? 'Training load only' : 'Neutral baseline',
      confidence,
      dataSufficiency,
      inputs: buildReadinessInputs(context, training, hasManualRecoveryInput, completedWorkoutCount),
      reason,
      nextAction: getReadinessNextAction(score, source, dataSufficiency),
    },
  };
}

function calculateManualRecoveryScore(context: UserContext, history: UserContext[]): number {
  const components: ScoreComponent[] = [];

  if (context.subjective_readiness != null) {
    components.push({
      label: 'self-readiness',
      score: clamp(context.subjective_readiness * 10, 20, 100),
      weight: 0.34,
    });
  }

  if (context.sleep_hours != null) {
    components.push({
      label: 'sleep duration',
      score: scoreSleepHours(context.sleep_hours),
      weight: 0.2,
    });
  }

  if (context.sleep_quality) {
    components.push({
      label: 'sleep quality',
      score: scoreQuality(context.sleep_quality),
      weight: 0.12,
    });
  }

  const stressValues = [
    context.perceived_stress,
    context.work_stress,
    context.life_stress,
  ].filter((value): value is number => typeof value === 'number');

  if (stressValues.length > 0) {
    const stressAverage = stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length;
    components.push({
      label: 'stress',
      score: clamp(105 - stressAverage * 8.5, 20, 100),
      weight: 0.16,
    });
  }

  if (context.hydration_level) {
    components.push({
      label: 'hydration',
      score: scoreQuality(context.hydration_level),
      weight: 0.08,
    });
  }

  if (context.calorie_balance) {
    components.push({
      label: 'fuel',
      score: context.calorie_balance === 'surplus'
        ? 88
        : context.calorie_balance === 'maintenance'
          ? 78
          : 58,
      weight: 0.06,
    });
  }

  const hrvBaseline = averagePositive(history.map((entry) => entry.heart_rate_variability));
  if (context.heart_rate_variability != null && hrvBaseline != null) {
    const ratio = context.heart_rate_variability / hrvBaseline;
    components.push({
      label: 'HRV trend',
      score: ratio >= 1.08 ? 88 : ratio >= 0.95 ? 76 : ratio >= 0.86 ? 58 : 42,
      weight: 0.06,
    });
  }

  const rhrBaseline = averagePositive(history.map((entry) => entry.resting_heart_rate));
  if (context.resting_heart_rate != null && rhrBaseline != null) {
    const delta = context.resting_heart_rate - rhrBaseline;
    components.push({
      label: 'resting heart rate',
      score: delta <= -3 ? 86 : delta <= 3 ? 76 : delta <= 7 ? 58 : 42,
      weight: 0.04,
    });
  }

  if (components.length === 0) return 70;

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weightedScore = components.reduce(
    (sum, component) => sum + component.score * component.weight,
    0
  ) / totalWeight;

  return clamp(Math.round(weightedScore), 25, 100);
}

function calculateTrainingLoadSignal(recentWorkouts: RecentWorkoutStats[]): TrainingLoadSignal {
  const completed = recentWorkouts
    .filter((workout) => workout.end_time)
    .sort((a, b) => new Date(b.end_time ?? 0).getTime() - new Date(a.end_time ?? 0).getTime());
  const lastWorkout = completed[0];

  if (!lastWorkout?.end_time) {
    return {
      score: 72,
      upperModifier: 1,
      lowerModifier: 1,
      reason: 'No recent completed workout found. Using a neutral training baseline.',
      hasWorkout: false,
    };
  }

  const hoursSince = Math.max(0, (Date.now() - new Date(lastWorkout.end_time).getTime()) / (1000 * 60 * 60));
  const now = Date.now();
  const workouts7d = completed.filter((workout) =>
    workout.end_time && now - new Date(workout.end_time).getTime() <= 7 * 24 * 60 * 60 * 1000
  );
  const workouts48h = completed.filter((workout) =>
    workout.end_time && now - new Date(workout.end_time).getTime() <= 48 * 60 * 60 * 1000
  );
  const lastAverageRpe = Number(lastWorkout.average_rpe ?? 7);
  const lastSets = Number(lastWorkout.total_sets ?? 0);
  const lastVolumeLoad = Number(lastWorkout.total_volume_load ?? 0);
  const lastIsHighIntensity = lastAverageRpe >= 8.5;
  const lastIsHighVolume = lastSets >= 18 || lastVolumeLoad >= 12000;
  const sets7d = workouts7d.reduce((sum, workout) => sum + Number(workout.total_sets ?? 0), 0);
  const volume7d = workouts7d.reduce((sum, workout) => sum + Number(workout.total_volume_load ?? 0), 0);
  const hardSessions7d = workouts7d.filter((workout) =>
    Number(workout.average_rpe ?? 7) >= 8.5 ||
    Number(workout.total_sets ?? 0) >= 18 ||
    Number(workout.total_volume_load ?? 0) >= 12000
  ).length;

  let score = 80;
  if (hoursSince < 12) score -= lastIsHighIntensity || lastIsHighVolume ? 28 : 18;
  else if (hoursSince < 24) score -= lastIsHighIntensity || lastIsHighVolume ? 20 : 10;
  else if (hoursSince < 36) score -= lastIsHighIntensity && lastIsHighVolume ? 12 : 5;
  else if (hoursSince > 72) score += Math.min(6, Math.floor((hoursSince - 72) / 24) + 4);

  if (workouts7d.length >= 6) score -= 10;
  else if (workouts7d.length >= 5) score -= 6;
  else if (workouts7d.length >= 4) score -= 3;

  if (sets7d >= 75) score -= 8;
  else if (sets7d >= 55) score -= 5;
  else if (sets7d >= 40) score -= 2;

  if (volume7d >= 60000) score -= 4;
  if (hardSessions7d >= 3) score -= 6;
  if (workouts7d.length === 0) score += 4;

  const upperStress = calculateBodyStress(workouts48h, isUpperBody);
  const lowerStress = calculateBodyStress(workouts48h, isLowerBody);
  const upperModifier = getLocalLoadModifier(upperStress);
  const lowerModifier = getLocalLoadModifier(lowerStress);

  return {
    score: clamp(Math.round(score), 40, 92),
    upperModifier,
    lowerModifier,
    reason: describeTrainingLoad({
      hoursSince,
      averageRpe: lastAverageRpe,
      totalSets: lastSets,
      sessions7d: workouts7d.length,
      hardSessions7d,
    }),
    hasWorkout: true,
  };
}

function moderateTrainingOnlyScore(score: number): number {
  return clamp(Math.round(72 + (score - 72) * 0.35), 70, 88);
}

function buildReason({
  source,
  context,
  manualScore,
  training,
  hasManualRecoveryInput,
}: {
  source: TrainingReadiness['source'];
  context: UserContext;
  manualScore: number | null;
  training: TrainingLoadSignal;
  hasManualRecoveryInput: boolean;
}) {
  if (!hasManualRecoveryInput) {
    return source === 'baseline'
      ? 'No Daily Check-In logged yet. Showing a neutral baseline until you add recovery context.'
      : `No fresh Daily Check-In. ${training.reason}`;
  }

  const notes: string[] = [];
  if (context.subjective_readiness != null) notes.push(`self-readiness ${context.subjective_readiness}/10`);
  if (context.sleep_hours != null) notes.push(`${context.sleep_hours}h sleep`);
  if (context.sleep_quality) notes.push(`${context.sleep_quality} sleep`);
  if (context.perceived_stress != null) notes.push(`stress ${context.perceived_stress}/10`);
  if (context.calorie_balance) notes.push(context.calorie_balance);

  const contextText = notes.length > 0 ? notes.slice(0, 3).join(', ') : `manual score ${manualScore ?? 70}`;
  return `Daily Check-In based: ${contextText}. ${training.reason}`;
}

function countMeaningfulContextInputs(context: UserContext): number {
  return [
    context.subjective_readiness,
    context.sleep_hours,
    context.sleep_quality,
    context.calorie_balance,
    context.hydration_level,
    context.perceived_stress,
    context.work_stress,
    context.life_stress,
    context.resting_heart_rate,
    context.heart_rate_variability,
  ].filter((value) => value != null).length;
}

function buildReadinessInputs(
  context: UserContext,
  training: TrainingLoadSignal,
  hasManualRecoveryInput: boolean,
  completedWorkoutCount: number
): string[] {
  const inputs: string[] = [];

  if (hasManualRecoveryInput) {
    if (context.subjective_readiness != null) inputs.push(`self-readiness ${context.subjective_readiness}/10`);
    if (context.sleep_hours != null) inputs.push(`${context.sleep_hours}h sleep`);
    if (context.sleep_quality) inputs.push(`${context.sleep_quality} sleep`);
    if (context.perceived_stress != null) inputs.push(`stress ${context.perceived_stress}/10`);
    if (context.hydration_level) inputs.push(`${context.hydration_level} hydration`);
    if (context.calorie_balance) inputs.push(`${context.calorie_balance} calories`);
    if (context.resting_heart_rate != null) inputs.push(`RHR ${context.resting_heart_rate}`);
    if (context.heart_rate_variability != null) inputs.push(`HRV ${context.heart_rate_variability}`);
  }

  if (training.hasWorkout) {
    inputs.push(`${completedWorkoutCount} recent workouts`);
  }

  return inputs.length > 0 ? inputs.slice(0, 6) : ['neutral baseline'];
}

function getReadinessNextAction(
  score: number,
  source: TrainingReadiness['source'],
  dataSufficiency: MetricDataSufficiency
): string {
  if (source === 'baseline' || dataSufficiency === 'baseline') {
    return 'Log a Daily Check-In or complete a workout to improve confidence.';
  }
  if (score < 50) return 'Run a lighter session or reduce load before adding volume.';
  if (score < 70) return 'Train normally but keep load jumps conservative.';
  if (score >= 88) return 'Progress only if warmups and first work sets move well.';
  return 'Use normal targets and let set RPE adjust the next recommendation.';
}

function calculateBodyStress(
  workouts: RecentWorkoutStats[],
  matcher: (name: string | null) => boolean
) {
  return workouts
    .filter((workout) => matcher(workout.name))
    .reduce((sum, workout) => {
      const averageRpe = Number(workout.average_rpe ?? 7);
      const sets = Number(workout.total_sets ?? 0);
      const volumeLoad = Number(workout.total_volume_load ?? 0);
      return sum + sets * Math.max(0.75, averageRpe / 8) + Math.min(10, volumeLoad / 5000);
    }, 0);
}

function getLocalLoadModifier(stress: number) {
  if (stress >= 35) return 0.9;
  if (stress >= 24) return 0.94;
  if (stress >= 14) return 0.97;
  return 1;
}

function describeTrainingLoad({
  hoursSince,
  averageRpe,
  totalSets,
  sessions7d,
  hardSessions7d,
}: {
  hoursSince: number;
  averageRpe: number;
  totalSets: number;
  sessions7d: number;
  hardSessions7d: number;
}) {
  const roundedHours = Math.round(hoursSince);
  const recentLoad = `${sessions7d} sessions in 7d${hardSessions7d > 0 ? `, ${hardSessions7d} hard` : ''}`;
  if (hoursSince < 24) {
    return `Last session was ${roundedHours}h ago at ${averageRpe.toFixed(1)} RPE across ${totalSets} sets; ${recentLoad}.`;
  }
  const roundedDays = Math.max(1, Math.round(hoursSince / 24));
  return `Last session was ${roundedDays}d ago at ${averageRpe.toFixed(1)} RPE across ${totalSets} sets; ${recentLoad}.`;
}

function hasMeaningfulContext(context: UserContext) {
  return Boolean(
    context.date &&
    (
      context.sleep_hours != null ||
      context.sleep_quality != null ||
      context.calorie_balance != null ||
      context.hydration_level != null ||
      context.subjective_readiness != null ||
      context.perceived_stress != null ||
      context.work_stress != null ||
      context.life_stress != null ||
      context.resting_heart_rate != null ||
      context.heart_rate_variability != null
    )
  );
}

function isContextFresh(date?: string) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contextDate = new Date(`${date}T00:00:00`);
  const ageDays = (today.getTime() - contextDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= MANUAL_CONTEXT_FRESH_DAYS;
}

function scoreSleepHours(hours: number) {
  if (hours < 4.5) return 35;
  if (hours < 5.5) return 50;
  if (hours < 6.5) return 64;
  if (hours <= 8.8) return 86;
  if (hours <= 9.6) return 78;
  return 68;
}

function scoreQuality(value: Quality) {
  if (value === 'excellent') return 92;
  if (value === 'good') return 80;
  if (value === 'fair') return 64;
  return 44;
}

function averagePositive(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && value > 0);
  if (valid.length < 3) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getReadinessModifier(score: number) {
  if (score < 50) return 0.9;
  if (score < 70) return 0.95;
  if (score >= 93) return 1.04;
  if (score >= 88) return 1.025;
  return 1;
}

function getRecommendation(score: number, source: TrainingReadiness['source']): string {
  if (score < 50) return 'Deload recommended. Drop weights 15-20%.';
  if (score < 70) return 'Auto-regulation active. Trim load 5-10%.';
  if (score >= 88) return 'Green light. Push progressive overload.';
  return source === 'baseline' ? 'Baseline session. Use normal loads.' : 'Ready for normal training.';
}

function isUpperBody(workoutName: string | null): boolean {
  if (!workoutName) return false;
  const lower = workoutName.toLowerCase();
  return lower.includes('upper') || lower.includes('push') || lower.includes('pull') || lower.includes('chest') || lower.includes('back') || lower.includes('arm');
}

function isLowerBody(workoutName: string | null): boolean {
  if (!workoutName) return false;
  const lower = workoutName.toLowerCase();
  return lower.includes('lower') || lower.includes('leg') || lower.includes('squat') || lower.includes('deadlift');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function withQueryTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function fetchRecentManualContexts(userId: string): Promise<UserContext[]> {
  try {
    const { data } = await withQueryTimeout(
      supabase
        .from('user_context_data')
        .select('date, sleep_hours, sleep_quality, calorie_balance, hydration_level, perceived_stress, work_stress, life_stress, subjective_readiness, resting_heart_rate, heart_rate_variability, source')
        .eq('user_id', userId)
        .or('source.is.null,source.neq.oura')
        .order('date', { ascending: false })
        .limit(14),
      QUERY_TIMEOUT_MS,
      'manual recovery context'
    );

    return ((data as UserContext[] | null) ?? []).filter(
      (entry) => entry.source?.toLowerCase() !== 'oura'
    );
  } catch {
    return [];
  }
}

async function fetchRecentWorkoutStats(userId: string): Promise<RecentWorkoutStats[]> {
  try {
    const { data } = await withQueryTimeout(
      supabase
        .from('workout_sessions')
        .select('end_time, average_rpe, total_sets, total_volume_load, name')
        .eq('user_id', userId)
        .neq('status', 'in_progress')
        .not('end_time', 'is', null)
        .order('end_time', { ascending: false })
        .limit(20),
      QUERY_TIMEOUT_MS,
      'recent workouts'
    );

    return (data ?? []) as RecentWorkoutStats[];
  } catch {
    return [];
  }
}
