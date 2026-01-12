// Placeholder database types for Supabase
// Generated from: supabase gen types typescript --project-id [id]

export type Database = {
  public: {
    Tables: {
      custom_exercises: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          equipment: string;
          exercise_type: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          movement_pattern: string | null;
          track_weight: boolean;
          track_reps: boolean;
          track_time: boolean;
          default_rest_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          equipment: string;
          exercise_type: string;
          primary_muscles: string[];
          secondary_muscles: string[];
          movement_pattern?: string | null;
          track_weight: boolean;
          track_reps: boolean;
          track_time: boolean;
          default_rest_seconds: number;
        };
        Update: {
          name?: string;
          slug?: string;
          equipment?: string;
          exercise_type?: string;
          primary_muscles?: string[];
          secondary_muscles?: string[];
          movement_pattern?: string | null;
          track_weight?: boolean;
          track_reps?: boolean;
          track_time?: boolean;
          default_rest_seconds?: number;
          updated_at?: string;
        };
      };
      user_maxes: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          exercise_name: string;
          weight: number;
          unit: string;
          tested_at: string;
          estimated_or_tested: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          exercise_id: string;
          exercise_name: string;
          weight: number;
          unit: string;
          tested_at: string;
          estimated_or_tested: string;
          notes?: string | null;
        };
        Update: {
          exercise_id?: string;
          exercise_name?: string;
          weight?: number;
          unit?: string;
          tested_at?: string;
          estimated_or_tested?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      user_fatigue_models: {
        Row: {
          id: string;
          user_id: string;
          fatigue_resistance: number;
          recovery_rate: number;
          total_workouts: number;
          total_sets: number;
          last_updated_at: string;
          model_version: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          fatigue_resistance: number;
          recovery_rate: number;
          total_workouts: number;
          total_sets: number;
          last_updated_at?: string;
          model_version?: number;
        };
        Update: {
          fatigue_resistance?: number;
          recovery_rate?: number;
          total_workouts?: number;
          total_sets?: number;
          last_updated_at?: string;
          model_version?: number;
        };
      };
      user_exercise_profiles: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          fatigue_rate_per_set: number;
          baseline_fatigue: number;
          total_sets_performed: number;
          confidence_score: number;
          last_performed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          exercise_id: string;
          fatigue_rate_per_set: number;
          baseline_fatigue: number;
          total_sets_performed: number;
          confidence_score: number;
          last_performed_at?: string;
        };
        Update: {
          fatigue_rate_per_set?: number;
          baseline_fatigue?: number;
          total_sets_performed?: number;
          confidence_score?: number;
          last_performed_at?: string;
          updated_at?: string;
        };
      };
      training_state_cache: {
        Row: {
          id: string;
          user_id: string;
          acute_load: number;
          chronic_load: number;
          acwr: number;
          acwr_status: 'undertraining' | 'optimal' | 'high_risk' | 'danger';
          training_monotony: number;
          training_strain: number;
          current_fitness: number;
          current_fatigue: number;
          net_performance: number;
          readiness: 'excellent' | 'good' | 'moderate' | 'poor';
          last_workout_date: string | null;
          calculated_at: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          acute_load: number;
          chronic_load: number;
          acwr: number;
          acwr_status: 'undertraining' | 'optimal' | 'high_risk' | 'danger';
          training_monotony: number;
          training_strain: number;
          current_fitness: number;
          current_fatigue: number;
          net_performance: number;
          readiness: 'excellent' | 'good' | 'moderate' | 'poor';
          last_workout_date?: string | null;
          calculated_at?: string;
        };
        Update: {
          acute_load?: number;
          chronic_load?: number;
          acwr?: number;
          acwr_status?: 'undertraining' | 'optimal' | 'high_risk' | 'danger';
          training_monotony?: number;
          training_strain?: number;
          current_fitness?: number;
          current_fatigue?: number;
          net_performance?: number;
          readiness?: 'excellent' | 'good' | 'moderate' | 'poor';
          last_workout_date?: string | null;
          calculated_at?: string;
          updated_at?: string;
        };
      };
      fatigue_prediction_history: {
        Row: {
          id: string;
          user_id: string;
          workout_session_id: string;
          exercise_id: string;
          set_number: number;
          predicted_fatigue: number;
          prediction_lower: number;
          prediction_upper: number;
          actual_fatigue: number | null;
          actual_rpe: number | null;
          absolute_error: number | null;
          used_hierarchical_model: boolean;
          predicted_at: string;
          actual_recorded_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          workout_session_id: string;
          exercise_id: string;
          set_number: number;
          predicted_fatigue: number;
          prediction_lower: number;
          prediction_upper: number;
          used_hierarchical_model: boolean;
          predicted_at?: string;
        };
        Update: {
          actual_fatigue?: number | null;
          actual_rpe?: number | null;
          absolute_error?: number | null;
          actual_recorded_at?: string | null;
        };
      };
      causal_insights_cache: {
        Row: {
          id: string;
          user_id: string;
          insight_type: string;
          computed_value: number;
          confidence_level: number;
          sample_size: number;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          insight_type: string;
          computed_value: number;
          confidence_level: number;
          sample_size: number;
          expires_at: string;
        };
        Update: {
          computed_value?: number;
          confidence_level?: number;
          sample_size?: number;
          expires_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      increment_user_model_stats: {
        Args: {
          p_user_id: string;
          p_workout_sets: number;
        };
        Returns: void;
      };
      get_model_performance_metrics: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          total_predictions: number;
          avg_absolute_error: number;
          prediction_accuracy_percentage: number;
          within_ci_percentage: number;
          last_7_days_rmse: number;
        };
      };
    };
  };
};
