import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';
import { generateProgram, UserProfile } from '../../../lib/intelligence/builder';

/**
 * Evidence-Based Program Generation API
 */

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

function mapInputToUserProfile(input: GuidedBuilderInput): UserProfile {
  const trainingAgeYears = input.trainingAge
    ? input.trainingAge <= 12 ? 0.5 : input.trainingAge / 12
    : 1;

  type BuilderGoal = 'hypertrophy' | 'strength' | 'powerlifting' | 'peaking' | 'general';
  const goalMap: Record<string, BuilderGoal> = {
    strength: 'strength',
    powerlifting: 'powerlifting',
    hypertrophy: 'hypertrophy',
    general: 'general',
    peaking: 'peaking',
  };

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
  // Authenticate
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const input: GuidedBuilderInput = await request.json();

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

    const userProfile = mapInputToUserProfile(input);
    const program = generateProgram(userProfile);

    return NextResponse.json({ program });
  } catch (error) {
    console.error('Error generating program:', error);
    return NextResponse.json(
      { error: 'Failed to generate program' },
      { status: 500 }
    );
  }
}
