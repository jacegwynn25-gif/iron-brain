import { NextRequest, NextResponse } from 'next/server';
import { generateProgram, UserProfile, analyzeProgramVolume } from '../../../lib/intelligence/builder';

/**
 * Evidence-Based Program Generation API
 *
 * Uses the scientific configuration from config.ts to generate programs that:
 * - Follow Volume Landmarks (MEV, MAV, MRV) per muscle group
 * - Prioritize S-Tier stretch-focused exercises
 * - Prevent junk volume (>10 sets/muscle/session)
 * - Apply experience-appropriate splits
 */

// Input interface matching IntelligentProgramBuilder
interface GuidedBuilderInput {
  primaryGoal: 'strength' | 'hypertrophy' | 'powerlifting' | 'general' | 'peaking' | null;
  secondaryGoals: string[];
  trainingAge: number | null;
  currentLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  daysPerWeek: 3 | 4 | 5 | 6 | null;
  sessionLengthMinutes: 45 | 60 | 75 | 90 | null;
  weekCount: 4 | 8 | 12 | 16 | null;
  intensityMethod: 'rpe' | 'rir' | 'percentage' | null;
  deloadFrequency: 3 | 4 | 6 | null;
  repRangePreference?: {
    compound?: { min?: number; max?: number };
    isolation?: { min?: number; max?: number };
  };
  rirPreference?: {
    compound?: { min?: number; max?: number };
    isolation?: { min?: number; max?: number };
  };
  previousSuccesses: string[];
  plateauAreas: string[];
  emphasisMuscles: string[];
  weakPoints: string[];
  injuries: string[];
  availableEquipment: ('barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight')[];
  mustIncludeExercises: string[];
  mustExcludeExercises: string[];
}

/**
 * Map frontend input to the UserProfile expected by builder.ts
 */
function mapInputToUserProfile(input: GuidedBuilderInput): UserProfile {
  // Map training age to years (input is in months buckets from UI)
  const trainingAgeYears = input.trainingAge
    ? input.trainingAge <= 12 ? 0.5 : input.trainingAge / 12
    : 1;

  // Map goal - builder now supports all goal types with proper periodization
  type BuilderGoal = 'hypertrophy' | 'strength' | 'powerlifting' | 'peaking' | 'general';
  const goalMap: Record<string, BuilderGoal> = {
    strength: 'strength',
    powerlifting: 'powerlifting',  // Block periodization: hypertrophy → strength → peaking
    hypertrophy: 'hypertrophy',
    general: 'general',
    peaking: 'peaking',            // Competition prep: 1-3 rep singles/doubles/triples
  };

  // Map muscle names from frontend to config.ts muscle keys
  const muscleNameMap: Record<string, string> = {
    'Chest': 'chest',
    'Back': 'back',
    'Shoulders': 'sideDelts',
    'Front Delts': 'frontDelts',
    'Side Delts': 'sideDelts',
    'Rear Delts': 'rearDelts',
    'Biceps': 'biceps',
    'Triceps': 'triceps',
    'Quads': 'quads',
    'Hamstrings': 'hamstrings',
    'Glutes': 'glutes',
    'Calves': 'calves',
    'Abs': 'abs',
    'Core': 'abs',
  };

  const mapMuscles = (muscles: string[]): string[] =>
    muscles.map(m => muscleNameMap[m] || m.toLowerCase()).filter(Boolean);

  return {
    experienceLevel: input.currentLevel || 'intermediate',
    trainingAgeYears,
    daysPerWeek: input.daysPerWeek || 4,
    sessionLengthMinutes: input.sessionLengthMinutes || 60,
    primaryGoal: goalMap[input.primaryGoal || 'general'] || 'general',
    availableEquipment: input.availableEquipment || ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
    emphasisMuscles: mapMuscles(input.emphasisMuscles || []),
    weakPoints: mapMuscles(input.weakPoints || []),
    excludeExercises: input.mustExcludeExercises || [],
    injuries: input.injuries || [],
    recoveryCapacity: 'average',
    weekCount: input.weekCount || 4,
    repRangePreference: input.repRangePreference,
    rirPreference: input.rirPreference,
  };
}

export async function POST(request: NextRequest) {
  try {
    const input: GuidedBuilderInput = await request.json();

    // Validate required fields
    if (!input.primaryGoal) {
      return NextResponse.json({ error: 'Primary goal is required' }, { status: 400 });
    }
    if (!input.currentLevel) {
      return NextResponse.json({ error: 'Experience level is required' }, { status: 400 });
    }
    if (!input.daysPerWeek) {
      return NextResponse.json({ error: 'Days per week is required' }, { status: 400 });
    }
    if (!input.availableEquipment || input.availableEquipment.length === 0) {
      return NextResponse.json({ error: 'At least one equipment type is required' }, { status: 400 });
    }

    // Convert input to UserProfile
    const userProfile = mapInputToUserProfile(input);

    // Generate program using evidence-based builder
    const program = generateProgram(userProfile);

    // Analyze for validation (optional - for debugging)
    const analysis = analyzeProgramVolume(program);
    if (analysis.warnings.length > 0) {
      console.log('Program generation warnings:', analysis.warnings);
    }

    // Log volume distribution for debugging
    console.log('Generated program:', program.name);
    console.log('Weekly volume by muscle:', Object.fromEntries(analysis.weeklyVolumeByMuscle));
    console.log('Total sets/week:', analysis.totalSetsPerWeek);

    return NextResponse.json({ program });
  } catch (error) {
    console.error('Error generating program:', error);
    return NextResponse.json(
      { error: 'Failed to generate program' },
      { status: 500 }
    );
  }
}
