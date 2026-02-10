import { supabase } from '../supabase/client';

export interface TrainingReadiness {
  score: number; // 0-100
  modifier: number; // 0.90 to 1.05
  recommendation: string;
  focus_adjustments: {
    upper_body_modifier: number;
    lower_body_modifier: number;
  };
  reason: string;
}

interface UserContext {
  sleep_hours?: number;
  calorie_balance?: 'surplus' | 'deficit' | 'maintenance';
  subjective_readiness?: number;
  resting_heart_rate?: number;
  heart_rate_variability?: number;
  source?: string;
}

export async function calculateTrainingReadiness(userId: string): Promise<TrainingReadiness> {
  // 1. Fetch External Data (Sleep, Calories) & Internal Data (Last Workout)
  const [context, lastWorkout] = await Promise.all([
    fetchLatestContext(userId),
    fetchLastWorkoutStats(userId)
  ]);

  // --- STEP 1: SYSTEMIC RECOVERY (The Foundation) ---
  const ouraReadiness =
    context.source === 'oura' && context.subjective_readiness != null
      ? context.subjective_readiness
      : null;
  const usesOuraReadiness = ouraReadiness != null;
  let systemicScore = usesOuraReadiness ? Math.round(ouraReadiness * 10) : 100;
  const systemicReasons: string[] = [];

  // Sleep Logic
  if (!usesOuraReadiness && context.sleep_hours) {
    if (context.sleep_hours < 5) {
      systemicScore -= 25; 
      systemicReasons.push("Severe sleep debt");
    } else if (context.sleep_hours < 6.5) {
      systemicScore -= 10;
      systemicReasons.push("Poor sleep");
    }
  }

  if (usesOuraReadiness) {
    systemicReasons.push("Oura readiness score");
  } else if (context.subjective_readiness != null) {
    const subjectiveScore = Math.round(context.subjective_readiness * 10);
    systemicScore = Math.round((systemicScore + subjectiveScore) / 2);
    systemicReasons.push("Self-reported readiness");
  }

  // Nutrition Logic (Using 'calorie_balance' enum column)
  if (context.calorie_balance === 'deficit') {
    systemicScore -= 10;
    systemicReasons.push("Caloric deficit");
  } else if (context.calorie_balance === 'surplus') {
    systemicScore += 5;
  }

  // --- STEP 2: LOCAL MUSCLE FATIGUE (The Nuance) ---
  let upperMod = 1.0;
  let lowerMod = 1.0;
  let localReason = "";

  if (lastWorkout) {
    // Calculate hours since last session
    const endTime = lastWorkout.end_time ? new Date(lastWorkout.end_time).getTime() : Date.now();
    const hoursSince = (Date.now() - endTime) / (1000 * 60 * 60);
    
    const wasHighIntensity = (lastWorkout.average_rpe || 0) > 8; 
    const wasHighVolume = (lastWorkout.total_sets || 0) > 15;

    // "The overlap rule": If you trained < 24h ago, we must check overlap.
    if (hoursSince < 24) {
      if (wasHighIntensity) {
        if (isUpperBody(lastWorkout.name)) { 
           upperMod = 0.90; // -10% on Upper
           localReason = "Upper body is still recovering from yesterday.";
        } 
        else if (isLowerBody(lastWorkout.name)) {
           lowerMod = 0.90; // -10% on Lower
           localReason = "Legs are fried from yesterday.";
        }
      }
    } else if (hoursSince < 48 && wasHighIntensity && wasHighVolume) {
       // Deep fatigue lingers for 48h
       if (isUpperBody(lastWorkout.name)) upperMod = 0.97;
       if (isLowerBody(lastWorkout.name)) lowerMod = 0.97;
    }
  }

  // --- STEP 3: THE FINAL CALCULATION ---
  let baseMod = 1.0;
  if (systemicScore < 60) baseMod = 0.90; // Systemic crash
  else if (systemicScore < 80) baseMod = 0.95; // Systemic fatigue
  else if (systemicScore > 90) baseMod = 1.025; // Systemic peak

  const finalReason = systemicReasons.length > 0 
    ? `Systemic: ${systemicReasons.join(", ")}` 
    : localReason || "System optimal. Ready to push.";

  return {
    score: systemicScore,
    modifier: baseMod,
    recommendation: getRecommendation(systemicScore),
    focus_adjustments: {
      upper_body_modifier: Number((baseMod * upperMod).toFixed(3)),
      lower_body_modifier: Number((baseMod * lowerMod).toFixed(3))
    },
    reason: finalReason
  };
}

// --- HELPER FUNCTIONS ---

function isUpperBody(workoutName: string | null): boolean {
  if (!workoutName) return false;
  const lower = workoutName.toLowerCase();
  return lower.includes('upper') || lower.includes('push') || lower.includes('pull') || lower.includes('chest') || lower.includes('back') || lower.includes('arm');
}

function isLowerBody(workoutName: string | null): boolean {
  if (!workoutName) return false;
  const lower = workoutName.toLowerCase();
  return lower.includes('lower') || lower.includes('leg') || lower.includes('squat');
}

function getRecommendation(score: number): string {
  if (score < 50) return "Deload recommended. Drop weights 15-20%.";
  if (score < 75) return "Auto-regulation active. Weights reduced 5%.";
  return "Green light. Attempt progressive overload.";
}

// --- DATA FETCHERS ---

async function fetchLatestContext(userId: string): Promise<UserContext> {
  const { data } = await supabase
    .from('user_context_data')
    .select('sleep_hours, calorie_balance, subjective_readiness, resting_heart_rate, heart_rate_variability, source')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();
  return (data as UserContext) || {};
}

async function fetchLastWorkoutStats(userId: string) {
  const { data } = await supabase
    .from('workout_sessions')
    .select('end_time, average_rpe, total_sets, name')
    .eq('user_id', userId)
    .neq('status', 'in_progress')
    .not('end_time', 'is', null)
    .order('end_time', { ascending: false })
    .limit(1)
    .single();
  return data;
}
