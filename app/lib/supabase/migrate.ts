import { supabase } from './client';
import { createWorkoutSession, createSetLog } from './workouts';

type LegacyExerciseSet = {
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  e1rm?: number;
  type?: string;
  restSeconds?: number;
  notes?: string;
};

type LegacyExercise = {
  name?: string;
  slug?: string;
  description?: string;
  type?: string;
  difficulty?: string;
  trackWeight?: boolean;
  trackReps?: boolean;
  trackTime?: boolean;
  trackDistance?: boolean;
  isSystem?: boolean;
  sets?: LegacyExerciseSet[];
};

type LegacyWorkout = {
  name?: string;
  date?: string;
  bodyweight?: number;
  notes?: string;
  endTime?: string;
  durationMinutes?: number;
  exercises?: LegacyExercise[];
};

type LegacySettings = {
  weightUnit?: string;
  theme?: string;
  restTimerSound?: boolean;
  restTimerVibration?: boolean;
  defaultRestSeconds?: number;
  autoStartRestTimer?: boolean;
};

interface LocalStorageData {
  workouts?: LegacyWorkout[];
  exercises?: LegacyExercise[];
  programs?: unknown[];
  settings?: LegacySettings;
}

export async function migrateLocalStorageToSupabase(): Promise<{
  success: boolean;
  message: string;
  migrated: {
    workouts: number;
    exercises: number;
    programs: number;
  };
}> {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (!userId) {
    return {
      success: false,
      message: 'You must be logged in to migrate data',
      migrated: { workouts: 0, exercises: 0, programs: 0 },
    };
  }

  try {
    const data = getLocalStorageData();
    const migrated = { workouts: 0, exercises: 0, programs: 0 };

    // Migrate custom exercises
    if (data.exercises && data.exercises.length > 0) {
      for (const exercise of data.exercises) {
        // Skip system exercises
        if (exercise.isSystem) continue;
        if (!exercise.name) continue;

        const { error } = await supabase.from('exercises').insert({
          name: exercise.name,
          slug: exercise.slug || exercise.name.toLowerCase().replace(/\s+/g, '-'),
          description: exercise.description,
          exercise_type: exercise.type || 'compound',
          difficulty: exercise.difficulty || 'intermediate',
          track_weight: exercise.trackWeight !== false,
          track_reps: exercise.trackReps !== false,
          track_time: exercise.trackTime || false,
          track_distance: exercise.trackDistance || false,
          created_by: userId,
          is_system: false,
        });

        if (!error) migrated.exercises++;
      }
    }

    // Migrate workout sessions
    if (data.workouts && data.workouts.length > 0) {
      for (const workout of data.workouts) {
        try {
          // Create workout session
          const session = await createWorkoutSession({
            name: workout.name || 'Workout',
            date: workout.date || new Date().toISOString().split('T')[0],
            bodyweight: workout.bodyweight,
            notes: workout.notes,
          });

          // Migrate sets
          if (workout.exercises && Array.isArray(workout.exercises)) {
            let orderIndex = 0;
            for (const exercise of workout.exercises) {
              // Find exercise ID
              const { data: exerciseData } = await supabase
                .from('exercises')
                .select('id')
                .or(`slug.eq.${exercise.slug},name.eq.${exercise.name}`)
                .single();

              const exerciseRow = exerciseData as { id: string } | null;
              if (!exerciseRow?.id) continue;

              if (exercise.sets && Array.isArray(exercise.sets)) {
                for (let i = 0; i < exercise.sets.length; i++) {
                  const set = exercise.sets[i];

                  await createSetLog({
                    workout_session_id: session.id,
                    exercise_id: exerciseRow.id,
                    order_index: orderIndex,
                    set_index: i + 1,
                    actual_weight: set.weight,
                    actual_reps: set.reps,
                    actual_rpe: set.rpe,
                    actual_rir: set.rir,
                    e1rm: set.e1rm,
                    volume_load: set.weight && set.reps ? set.weight * set.reps : undefined,
                    set_type: set.type || 'straight',
                    rest_seconds: set.restSeconds,
                    notes: set.notes,
                    completed: true,
                  });
                }
              }
              orderIndex++;
            }
          }

          // Complete the workout
          const endTime = workout.endTime || workout.date;
          await supabase
            .from('workout_sessions')
            .update({
              status: 'completed',
              end_time: endTime,
              duration_minutes: workout.durationMinutes,
            })
            .eq('id', session.id);

          migrated.workouts++;
        } catch (err) {
          console.error('Error migrating workout:', err);
        }
      }
    }

    // Migrate settings
    if (data.settings) {
      await supabase
        .from('user_settings')
        .update({
          weight_unit: data.settings.weightUnit || 'lbs',
          theme: data.settings.theme || 'system',
          rest_timer_sound: data.settings.restTimerSound !== false,
          rest_timer_vibration: data.settings.restTimerVibration !== false,
          default_rest_seconds: data.settings.defaultRestSeconds || 120,
          auto_start_rest_timer: data.settings.autoStartRestTimer !== false,
        })
        .eq('user_id', userId);
    }

    // Clear localStorage after successful migration
    clearLocalStorageData();

    return {
      success: true,
      message: `Successfully migrated ${migrated.workouts} workouts, ${migrated.exercises} exercises`,
      migrated,
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      migrated: { workouts: 0, exercises: 0, programs: 0 },
    };
  }
}

function getLocalStorageData(): LocalStorageData {
  if (typeof window === 'undefined') return {};

  try {
    return {
      workouts: JSON.parse(localStorage.getItem('workouts') || '[]'),
      exercises: JSON.parse(localStorage.getItem('exercises') || '[]'),
      programs: JSON.parse(localStorage.getItem('programs') || '[]'),
      settings: JSON.parse(localStorage.getItem('settings') || '{}'),
    };
  } catch {
    return {};
  }
}

function clearLocalStorageData() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('workouts');
  localStorage.removeItem('exercises');
  localStorage.removeItem('programs');
  localStorage.removeItem('settings');
}

export function hasLocalStorageData(): boolean {
  if (typeof window === 'undefined') return false;

  const data = getLocalStorageData();
  return !!(
    (data.workouts && data.workouts.length > 0) ||
    (data.exercises && data.exercises.length > 0) ||
    (data.programs && data.programs.length > 0)
  );
}
