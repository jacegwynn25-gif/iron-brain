import { useEffect, useState } from 'react';
import { supabase } from './client';
import { useAuth } from './auth-context';

// Hook to fetch user's workout sessions
export function useWorkoutSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
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
        setSessions(data || []);
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
  const [exercises, setExercises] = useState<any[]>([]);
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
        setExercises(data || []);
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
  const [program, setProgram] = useState<any | null>(null);
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
        setProgram(data);
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
  const [records, setRecords] = useState<any[]>([]);
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
  const [stats, setStats] = useState<any[]>([]);
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
        setStats(data || []);
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
