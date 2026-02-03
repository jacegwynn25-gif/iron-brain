import { useEffect, useState } from 'react';
import { supabase } from './client';
import { useAuth } from './auth-context';
import type { Database } from './database.types';

// Strictly typed row types from the database schema
type WorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'];
type SetLogRow = Database['public']['Tables']['set_logs']['Row'];
type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
type ExerciseMuscleRow = Database['public']['Tables']['exercise_muscles']['Row'];
type MuscleGroupRow = Database['public']['Tables']['muscle_groups']['Row'];
type UserProgramRow = Database['public']['Tables']['user_programs']['Row'];
type ProgramTemplateRow = Database['public']['Tables']['program_templates']['Row'];
type ProgramWeekRow = Database['public']['Tables']['program_weeks']['Row'];
type ProgramDayRow = Database['public']['Tables']['program_days']['Row'];
type ProgramSetRow = Database['public']['Tables']['program_sets']['Row'];
type PersonalRecordRow = Database['public']['Tables']['personal_records']['Row'];
type ExerciseStatRow = Database['public']['Tables']['exercise_stats']['Row'];

// Extended types for queries with relations
type WorkoutSessionWithSets = WorkoutSessionRow & {
  set_logs: SetLogRow[];
};

type ExerciseMuscleWithGroup = ExerciseMuscleRow & {
  muscle_groups: Pick<MuscleGroupRow, 'name' | 'category'> | null;
};

type ExerciseWithMuscles = ExerciseRow & {
  exercise_muscles: ExerciseMuscleWithGroup[];
};

type ProgramSetWithExercise = ProgramSetRow & {
  exercises: ExerciseRow | null;
};

type ProgramDayWithSets = ProgramDayRow & {
  program_sets: ProgramSetWithExercise[];
};

type ProgramWeekWithDays = ProgramWeekRow & {
  program_days: ProgramDayWithSets[];
};

type ProgramTemplateWithWeeks = ProgramTemplateRow & {
  program_weeks: ProgramWeekWithDays[];
};

type UserProgramWithTemplate = UserProgramRow & {
  program_templates: ProgramTemplateWithWeeks | null;
};

type ExerciseStatWithExercise = ExerciseStatRow & {
  exercises: Pick<ExerciseRow, 'name' | 'slug'> | null;
};

// Hook to fetch user's workout sessions
export function useWorkoutSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSessionWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select(`
            *,
            set_logs (*)
          `)
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setSessions((data as WorkoutSessionWithSets[]) || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  return { sessions, loading, error };
}

// Hook to fetch exercises
export function useExercises() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseWithMuscles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select(`
            *,
            exercise_muscles (
              muscle_group_id,
              involvement,
              activation_percentage,
              muscle_groups (name, category)
            )
          `)
          .or(`is_system.eq.true,created_by.eq.${user?.id || 'null'}`)
          .order('name');

        if (error) throw error;
        setExercises((data as ExerciseWithMuscles[]) || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, [user]);

  return { exercises, loading, error };
}

// Hook to fetch user's active program
export function useActiveProgram() {
  const { user } = useAuth();
  const [program, setProgram] = useState<UserProgramWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProgram(null);
      setLoading(false);
      return;
    }

    const fetchProgram = async () => {
      try {
        const { data, error } = await supabase
          .from('user_programs')
          .select(`
            *,
            program_templates (
              *,
              program_weeks (
                *,
                program_days (
                  *,
                  program_sets (
                    *,
                    exercises (*)
                  )
                )
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        setProgram(data as UserProgramWithTemplate | null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, [user]);

  return { program, loading, error };
}

// Hook to fetch personal records
export function usePersonalRecords(exerciseId?: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<PersonalRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const fetchRecords = async () => {
      try {
        let query = supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_current', true);

        if (exerciseId) {
          query = query.eq('exercise_id', exerciseId);
        }

        const { data, error } = await query.order('achieved_at', { ascending: false });

        if (error) throw error;
        setRecords(data || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [user, exerciseId]);

  return { records, loading, error };
}

// Hook to fetch exercise stats
export function useExerciseStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExerciseStatWithExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setStats([]);
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_stats')
          .select(`
            *,
            exercises (name, slug)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        setStats((data as ExerciseStatWithExercise[]) || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  return { stats, loading, error };
}

// Re-export types for consumers
export type {
  WorkoutSessionRow,
  WorkoutSessionWithSets,
  SetLogRow,
  ExerciseRow,
  ExerciseWithMuscles,
  UserProgramRow,
  UserProgramWithTemplate,
  PersonalRecordRow,
  ExerciseStatRow,
  ExerciseStatWithExercise,
  ProgramTemplateRow,
  ProgramWeekRow,
  ProgramDayRow,
  ProgramSetRow,
};
