export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analytics_computation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          job_type: string
          result: Json | null
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_type: string
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_type?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      causal_insights_cache: {
        Row: {
          analysis_type: string
          computed_at: string | null
          confidence: number | null
          data_points_analyzed: number
          expires_at: string | null
          id: string
          result: Json
          significant: boolean
          user_id: string | null
        }
        Insert: {
          analysis_type: string
          computed_at?: string | null
          confidence?: number | null
          data_points_analyzed: number
          expires_at?: string | null
          id?: string
          result: Json
          significant: boolean
          user_id?: string | null
        }
        Update: {
          analysis_type?: string
          computed_at?: string | null
          confidence?: number | null
          data_points_analyzed?: number
          expires_at?: string | null
          id?: string
          result?: Json
          significant?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      custom_exercises: {
        Row: {
          created_at: string
          default_rest_seconds: number
          equipment: string
          exercise_type: string
          id: string
          movement_pattern: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[]
          slug: string
          track_reps: boolean
          track_time: boolean
          track_weight: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_rest_seconds?: number
          equipment: string
          exercise_type: string
          id: string
          movement_pattern?: string | null
          name: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          slug: string
          track_reps?: boolean
          track_time?: boolean
          track_weight?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_rest_seconds?: number
          equipment?: string
          exercise_type?: string
          id?: string
          movement_pattern?: string | null
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
          slug?: string
          track_reps?: boolean
          track_time?: boolean
          track_weight?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_programs: {
        Row: {
          created_at: string | null
          id: string
          is_custom: boolean | null
          name: string
          program_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id: string
          is_custom?: boolean | null
          name: string
          program_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          name?: string
          program_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          equipment_type: string | null
          id: string
          name: string
        }
        Insert: {
          equipment_type?: string | null
          id?: string
          name: string
        }
        Update: {
          equipment_type?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      exercise_muscles: {
        Row: {
          activation_percentage: number | null
          exercise_id: string
          involvement: string | null
          muscle_group_id: string
        }
        Insert: {
          activation_percentage?: number | null
          exercise_id: string
          involvement?: string | null
          muscle_group_id: string
        }
        Update: {
          activation_percentage?: number | null
          exercise_id?: string
          involvement?: string | null
          muscle_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscles_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_stats: {
        Row: {
          avg_reps: number | null
          avg_rpe: number | null
          avg_weight: number | null
          best_e1rm: number | null
          best_reps: number | null
          best_weight: number | null
          e1rm_trend: number | null
          exercise_id: string | null
          id: string
          last_performed_at: string | null
          times_performed: number | null
          total_reps: number | null
          total_sets: number | null
          total_volume: number | null
          updated_at: string | null
          user_id: string | null
          weight_trend: number | null
        }
        Insert: {
          avg_reps?: number | null
          avg_rpe?: number | null
          avg_weight?: number | null
          best_e1rm?: number | null
          best_reps?: number | null
          best_weight?: number | null
          e1rm_trend?: number | null
          exercise_id?: string | null
          id?: string
          last_performed_at?: string | null
          times_performed?: number | null
          total_reps?: number | null
          total_sets?: number | null
          total_volume?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight_trend?: number | null
        }
        Update: {
          avg_reps?: number | null
          avg_rpe?: number | null
          avg_weight?: number | null
          best_e1rm?: number | null
          best_reps?: number | null
          best_weight?: number | null
          e1rm_trend?: number | null
          exercise_id?: string | null
          id?: string
          last_performed_at?: string | null
          times_performed?: number | null
          total_reps?: number | null
          total_sets?: number | null
          total_volume?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight_trend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_stats_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_rest_seconds: number | null
          description: string | null
          difficulty: string | null
          exercise_type: string | null
          force_type: string | null
          id: string
          instructions: string | null
          is_system: boolean | null
          mechanics: string | null
          name: string
          primary_equipment_id: string | null
          slug: string | null
          thumbnail_url: string | null
          track_distance: boolean | null
          track_reps: boolean | null
          track_time: boolean | null
          track_weight: boolean | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_rest_seconds?: number | null
          description?: string | null
          difficulty?: string | null
          exercise_type?: string | null
          force_type?: string | null
          id?: string
          instructions?: string | null
          is_system?: boolean | null
          mechanics?: string | null
          name: string
          primary_equipment_id?: string | null
          slug?: string | null
          thumbnail_url?: string | null
          track_distance?: boolean | null
          track_reps?: boolean | null
          track_time?: boolean | null
          track_weight?: boolean | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_rest_seconds?: number | null
          description?: string | null
          difficulty?: string | null
          exercise_type?: string | null
          force_type?: string | null
          id?: string
          instructions?: string | null
          is_system?: boolean | null
          mechanics?: string | null
          name?: string
          primary_equipment_id?: string | null
          slug?: string | null
          thumbnail_url?: string | null
          track_distance?: boolean | null
          track_reps?: boolean | null
          track_time?: boolean | null
          track_weight?: boolean | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_primary_equipment_id_fkey"
            columns: ["primary_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_history: {
        Row: {
          created_at: string | null
          failure_count: number | null
          fatigue_score: number
          form_breakdown_count: number | null
          id: string
          muscle_group: string
          recorded_at: string | null
          rpe_overshoot_avg: number | null
          user_id: string | null
          volume_load: number | null
          workout_session_id: string | null
        }
        Insert: {
          created_at?: string | null
          failure_count?: number | null
          fatigue_score: number
          form_breakdown_count?: number | null
          id?: string
          muscle_group: string
          recorded_at?: string | null
          rpe_overshoot_avg?: number | null
          user_id?: string | null
          volume_load?: number | null
          workout_session_id?: string | null
        }
        Update: {
          created_at?: string | null
          failure_count?: number | null
          fatigue_score?: number
          form_breakdown_count?: number | null
          id?: string
          muscle_group?: string
          recorded_at?: string | null
          rpe_overshoot_avg?: number | null
          user_id?: string | null
          volume_load?: number | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_history_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_prediction_history: {
        Row: {
          absolute_error: number | null
          actual_fatigue: number | null
          actual_recorded_at: string | null
          actual_rpe: number | null
          exercise_id: string
          id: string
          model_version: number | null
          predicted_at: string | null
          predicted_fatigue: number
          prediction_lower: number | null
          prediction_upper: number | null
          set_number: number
          used_hierarchical_model: boolean | null
          user_id: string | null
          within_confidence_interval: boolean | null
          workout_session_id: string | null
        }
        Insert: {
          absolute_error?: number | null
          actual_fatigue?: number | null
          actual_recorded_at?: string | null
          actual_rpe?: number | null
          exercise_id: string
          id?: string
          model_version?: number | null
          predicted_at?: string | null
          predicted_fatigue: number
          prediction_lower?: number | null
          prediction_upper?: number | null
          set_number: number
          used_hierarchical_model?: boolean | null
          user_id?: string | null
          within_confidence_interval?: boolean | null
          workout_session_id?: string | null
        }
        Update: {
          absolute_error?: number | null
          actual_fatigue?: number | null
          actual_recorded_at?: string | null
          actual_rpe?: number | null
          exercise_id?: string
          id?: string
          model_version?: number | null
          predicted_at?: string | null
          predicted_fatigue?: number
          prediction_lower?: number | null
          prediction_upper?: number | null
          set_number?: number
          used_hierarchical_model?: boolean | null
          user_id?: string | null
          within_confidence_interval?: boolean | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_prediction_history_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          category: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          e1rm: number | null
          exercise_id: string | null
          id: string
          is_current: boolean | null
          record_type: string | null
          reps: number | null
          set_log_id: string | null
          user_id: string | null
          volume: number | null
          weight: number | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          e1rm?: number | null
          exercise_id?: string | null
          id?: string
          is_current?: boolean | null
          record_type?: string | null
          reps?: number | null
          set_log_id?: string | null
          user_id?: string | null
          volume?: number | null
          weight?: number | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          e1rm?: number | null
          exercise_id?: string | null
          id?: string
          is_current?: boolean | null
          record_type?: string | null
          reps?: number | null
          set_log_id?: string | null
          user_id?: string | null
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_set_log_id_fkey"
            columns: ["set_log_id"]
            isOneToOne: false
            referencedRelation: "set_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_days: {
        Row: {
          created_at: string | null
          day_index: number
          day_of_week: string | null
          description: string | null
          estimated_duration_minutes: number | null
          focus: string | null
          id: string
          name: string
          week_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_index: number
          day_of_week?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          focus?: string | null
          id?: string
          name: string
          week_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_index?: number
          day_of_week?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          focus?: string | null
          id?: string
          name?: string
          week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_days_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sets: {
        Row: {
          created_at: string | null
          day_id: string | null
          exercise_id: string | null
          fixed_weight: number | null
          id: string
          max_reps: number | null
          min_reps: number | null
          notes: string | null
          order_index: number
          prescribed_reps: string | null
          prescription_type: string | null
          rest_seconds: number | null
          set_index: number
          set_type: string | null
          superset_group: string | null
          target_percentage: number | null
          target_rir: number | null
          target_rpe: number | null
          target_seconds: number | null
          tempo: string | null
        }
        Insert: {
          created_at?: string | null
          day_id?: string | null
          exercise_id?: string | null
          fixed_weight?: number | null
          id?: string
          max_reps?: number | null
          min_reps?: number | null
          notes?: string | null
          order_index: number
          prescribed_reps?: string | null
          prescription_type?: string | null
          rest_seconds?: number | null
          set_index: number
          set_type?: string | null
          superset_group?: string | null
          target_percentage?: number | null
          target_rir?: number | null
          target_rpe?: number | null
          target_seconds?: number | null
          tempo?: string | null
        }
        Update: {
          created_at?: string | null
          day_id?: string | null
          exercise_id?: string | null
          fixed_weight?: number | null
          id?: string
          max_reps?: number | null
          min_reps?: number | null
          notes?: string | null
          order_index?: number
          prescribed_reps?: string | null
          prescription_type?: string | null
          rest_seconds?: number | null
          set_index?: number
          set_type?: string | null
          superset_group?: string | null
          target_percentage?: number | null
          target_rir?: number | null
          target_rpe?: number | null
          target_seconds?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_sets_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          app_program_id: string | null
          average_rating: number | null
          created_at: string | null
          created_by: string | null
          days_per_week: number | null
          description: string | null
          difficulty: string | null
          duration_weeks: number | null
          goal: string | null
          id: string
          is_public: boolean | null
          is_system: boolean | null
          name: string
          periodization_type: string | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          app_program_id?: string | null
          average_rating?: number | null
          created_at?: string | null
          created_by?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name: string
          periodization_type?: string | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          app_program_id?: string | null
          average_rating?: number | null
          created_at?: string | null
          created_by?: string | null
          days_per_week?: number | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_public?: boolean | null
          is_system?: boolean | null
          name?: string
          periodization_type?: string | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_weeks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          intensity_modifier: number | null
          name: string | null
          program_id: string | null
          volume_modifier: number | null
          week_number: number
          week_type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          intensity_modifier?: number | null
          name?: string | null
          program_id?: string | null
          volume_modifier?: number | null
          week_number: number
          week_type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          intensity_modifier?: number | null
          name?: string | null
          program_id?: string | null
          volume_modifier?: number | null
          week_number?: number
          week_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_estimates: {
        Row: {
          current_recovery_percentage: number | null
          estimated_recovery_at: string
          id: string
          last_fatigue_score: number | null
          last_trained_at: string
          muscle_group: string
          rest_days: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          current_recovery_percentage?: number | null
          estimated_recovery_at: string
          id?: string
          last_fatigue_score?: number | null
          last_trained_at: string
          muscle_group: string
          rest_days?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          current_recovery_percentage?: number | null
          estimated_recovery_at?: string
          id?: string
          last_fatigue_score?: number | null
          last_trained_at?: string
          muscle_group?: string
          rest_days?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          actual_reps: number | null
          actual_rir: number | null
          actual_rpe: number | null
          actual_seconds: number | null
          actual_weight: number | null
          cluster_rounds: Json | null
          completed: boolean | null
          created_at: string | null
          drop_set_rounds: Json | null
          e1rm: number | null
          exercise_id: string | null
          exercise_slug: string | null
          id: string
          notes: string | null
          order_index: number
          performed_at: string | null
          prescribed_percentage: number | null
          prescribed_reps: string | null
          prescribed_rir: number | null
          prescribed_rpe: number | null
          program_set_id: string | null
          rest_pause_rounds: Json | null
          rest_seconds: number | null
          set_index: number
          set_type: string | null
          skipped: boolean | null
          tempo: string | null
          volume_load: number | null
          workout_session_id: string | null
        }
        Insert: {
          actual_reps?: number | null
          actual_rir?: number | null
          actual_rpe?: number | null
          actual_seconds?: number | null
          actual_weight?: number | null
          cluster_rounds?: Json | null
          completed?: boolean | null
          created_at?: string | null
          drop_set_rounds?: Json | null
          e1rm?: number | null
          exercise_id?: string | null
          exercise_slug?: string | null
          id?: string
          notes?: string | null
          order_index: number
          performed_at?: string | null
          prescribed_percentage?: number | null
          prescribed_reps?: string | null
          prescribed_rir?: number | null
          prescribed_rpe?: number | null
          program_set_id?: string | null
          rest_pause_rounds?: Json | null
          rest_seconds?: number | null
          set_index: number
          set_type?: string | null
          skipped?: boolean | null
          tempo?: string | null
          volume_load?: number | null
          workout_session_id?: string | null
        }
        Update: {
          actual_reps?: number | null
          actual_rir?: number | null
          actual_rpe?: number | null
          actual_seconds?: number | null
          actual_weight?: number | null
          cluster_rounds?: Json | null
          completed?: boolean | null
          created_at?: string | null
          drop_set_rounds?: Json | null
          e1rm?: number | null
          exercise_id?: string | null
          exercise_slug?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          performed_at?: string | null
          prescribed_percentage?: number | null
          prescribed_reps?: string | null
          prescribed_rir?: number | null
          prescribed_rpe?: number | null
          program_set_id?: string | null
          rest_pause_rounds?: Json | null
          rest_seconds?: number | null
          set_index?: number
          set_type?: string | null
          skipped?: boolean | null
          tempo?: string | null
          volume_load?: number | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_program_set_id_fkey"
            columns: ["program_set_id"]
            isOneToOne: false
            referencedRelation: "program_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sfr_analyses: {
        Row: {
          avg_rpe: number | null
          created_at: string | null
          effective_volume: number
          exercise_id: string
          exercise_name: string
          fatigue_per_set: number | null
          id: string
          interpretation: string
          recommendation: string | null
          recorded_at: string | null
          sfr: number
          total_fatigue: number
          total_sets: number
          total_volume_load: number
          user_id: string | null
          workout_session_id: string | null
        }
        Insert: {
          avg_rpe?: number | null
          created_at?: string | null
          effective_volume: number
          exercise_id: string
          exercise_name: string
          fatigue_per_set?: number | null
          id?: string
          interpretation: string
          recommendation?: string | null
          recorded_at?: string | null
          sfr: number
          total_fatigue: number
          total_sets: number
          total_volume_load: number
          user_id?: string | null
          workout_session_id?: string | null
        }
        Update: {
          avg_rpe?: number | null
          created_at?: string | null
          effective_volume?: number
          exercise_id?: string
          exercise_name?: string
          fatigue_per_set?: number | null
          id?: string
          interpretation?: string
          recommendation?: string | null
          recorded_at?: string | null
          sfr?: number
          total_fatigue?: number
          total_sets?: number
          total_volume_load?: number
          user_id?: string | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sfr_analyses_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_state_cache: {
        Row: {
          acute_load: number
          acwr: number
          acwr_status: string | null
          calculated_at: string | null
          chronic_load: number
          current_fatigue: number
          current_fitness: number
          daily_loads: Json | null
          last_workout_date: string | null
          model_version: number | null
          net_performance: number
          readiness: string | null
          training_monotony: number | null
          training_strain: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acute_load?: number
          acwr?: number
          acwr_status?: string | null
          calculated_at?: string | null
          chronic_load?: number
          current_fatigue?: number
          current_fitness?: number
          daily_loads?: Json | null
          last_workout_date?: string | null
          model_version?: number | null
          net_performance?: number
          readiness?: string | null
          training_monotony?: number | null
          training_strain?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acute_load?: number
          acwr?: number
          acwr_status?: string | null
          calculated_at?: string | null
          chronic_load?: number
          current_fatigue?: number
          current_fitness?: number
          daily_loads?: Json | null
          last_workout_date?: string | null
          model_version?: number | null
          net_performance?: number
          readiness?: string | null
          training_monotony?: number | null
          training_strain?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_exercise_profiles: {
        Row: {
          avg_intensity: number | null
          baseline_fatigue: number
          best_estimated_1rm: number | null
          confidence_score: number | null
          exercise_id: string
          fatigue_rate_per_set: number
          first_performed_at: string | null
          id: string
          last_performed_at: string | null
          prediction_rmse: number | null
          total_sets_performed: number
          total_volume_load: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_intensity?: number | null
          baseline_fatigue?: number
          best_estimated_1rm?: number | null
          confidence_score?: number | null
          exercise_id: string
          fatigue_rate_per_set?: number
          first_performed_at?: string | null
          id?: string
          last_performed_at?: string | null
          prediction_rmse?: number | null
          total_sets_performed?: number
          total_volume_load?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_intensity?: number | null
          baseline_fatigue?: number
          best_estimated_1rm?: number | null
          confidence_score?: number | null
          exercise_id?: string
          fatigue_rate_per_set?: number
          first_performed_at?: string | null
          id?: string
          last_performed_at?: string | null
          prediction_rmse?: number | null
          total_sets_performed?: number
          total_volume_load?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_fatigue_models: {
        Row: {
          created_at: string | null
          fatigue_resistance: number
          last_updated_at: string | null
          last_workout_id: string | null
          model_version: number
          recovery_rate: number
          total_sets: number
          total_workouts: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fatigue_resistance?: number
          last_updated_at?: string | null
          last_workout_id?: string | null
          model_version?: number
          recovery_rate?: number
          total_sets?: number
          total_workouts?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          fatigue_resistance?: number
          last_updated_at?: string | null
          last_workout_id?: string | null
          model_version?: number
          recovery_rate?: number
          total_sets?: number
          total_workouts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fatigue_models_last_workout_id_fkey"
            columns: ["last_workout_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_maxes: {
        Row: {
          created_at: string
          estimated_or_tested: string
          exercise_id: string
          exercise_name: string
          id: string
          notes: string | null
          tested_at: string
          unit: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          estimated_or_tested?: string
          exercise_id: string
          exercise_name: string
          id: string
          notes?: string | null
          tested_at: string
          unit?: string
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          estimated_or_tested?: string
          exercise_id?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          tested_at?: string
          unit?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          experience_level: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_program_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          program_day_id: string | null
          program_week_id: string | null
          scheduled_date: string | null
          status: string | null
          user_program_id: string | null
          workout_session_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          program_day_id?: string | null
          program_week_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          user_program_id?: string | null
          workout_session_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          program_day_id?: string | null
          program_week_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          user_program_id?: string | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_program_progress_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_progress_program_week_id_fkey"
            columns: ["program_week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_progress_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_cycle: number | null
          current_week: number | null
          custom_settings: Json | null
          id: string
          program_template_id: string | null
          started_at: string | null
          starting_maxes: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_cycle?: number | null
          current_week?: number | null
          custom_settings?: Json | null
          id?: string
          program_template_id?: string | null
          started_at?: string | null
          starting_maxes?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_cycle?: number | null
          current_week?: number | null
          custom_settings?: Json | null
          id?: string
          program_template_id?: string | null
          started_at?: string | null
          starting_maxes?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          auto_start_rest_timer: boolean | null
          default_rest_seconds: number | null
          distance_unit: string | null
          rest_timer_sound: boolean | null
          rest_timer_vibration: boolean | null
          show_warmup_sets: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
          weight_unit: string | null
        }
        Insert: {
          auto_start_rest_timer?: boolean | null
          default_rest_seconds?: number | null
          distance_unit?: string | null
          rest_timer_sound?: boolean | null
          rest_timer_vibration?: boolean | null
          show_warmup_sets?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
          weight_unit?: string | null
        }
        Update: {
          auto_start_rest_timer?: boolean | null
          default_rest_seconds?: number | null
          distance_unit?: string | null
          rest_timer_sound?: boolean | null
          rest_timer_vibration?: boolean | null
          show_warmup_sets?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
          weight_unit?: string | null
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          average_rpe: number | null
          bodyweight: number | null
          created_at: string | null
          date: string
          deleted_at: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          metadata: Json | null
          name: string | null
          notes: string | null
          program_day_id: string | null
          start_time: string | null
          status: string | null
          total_reps: number | null
          total_sets: number | null
          total_volume_load: number | null
          updated_at: string | null
          user_id: string | null
          user_program_id: string | null
        }
        Insert: {
          average_rpe?: number | null
          bodyweight?: number | null
          created_at?: string | null
          date: string
          deleted_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          program_day_id?: string | null
          start_time?: string | null
          status?: string | null
          total_reps?: number | null
          total_sets?: number | null
          total_volume_load?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_program_id?: string | null
        }
        Update: {
          average_rpe?: number | null
          bodyweight?: number | null
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          program_day_id?: string | null
          start_time?: string | null
          status?: string | null
          total_reps?: number | null
          total_sets?: number | null
          total_volume_load?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sfr_summaries: {
        Row: {
          created_at: string | null
          excellent_count: number | null
          excessive_count: number | null
          good_count: number | null
          id: string
          insights: Json | null
          moderate_count: number | null
          overall_interpretation: string
          overall_sfr: number
          poor_count: number | null
          recorded_at: string | null
          total_exercises: number
          user_id: string | null
          workout_session_id: string | null
        }
        Insert: {
          created_at?: string | null
          excellent_count?: number | null
          excessive_count?: number | null
          good_count?: number | null
          id?: string
          insights?: Json | null
          moderate_count?: number | null
          overall_interpretation: string
          overall_sfr: number
          poor_count?: number | null
          recorded_at?: string | null
          total_exercises: number
          user_id?: string | null
          workout_session_id?: string | null
        }
        Update: {
          created_at?: string | null
          excellent_count?: number | null
          excessive_count?: number | null
          good_count?: number | null
          id?: string
          insights?: Json | null
          moderate_count?: number | null
          overall_interpretation?: string
          overall_sfr?: number
          poor_count?: number | null
          recorded_at?: string | null
          total_exercises?: number
          user_id?: string | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sfr_summaries_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: true
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_events: {
        Row: {
          id: string
          user_id: string
          timestamp: string
          exercise_name: string
          sets: number
          reps: number
          weight: number
          rpe: number
          volume: number
          effective_volume: number
          initial_fatigue: number
          set_duration: number | null
          rest_interval: number | null
          is_eccentric: boolean
          is_ballistic: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          timestamp: string
          exercise_name: string
          sets: number
          reps: number
          weight: number
          rpe: number
          volume: number
          effective_volume: number
          initial_fatigue: number
          set_duration?: number | null
          rest_interval?: number | null
          is_eccentric?: boolean
          is_ballistic?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          timestamp?: string
          exercise_name?: string
          sets?: number
          reps?: number
          weight?: number
          rpe?: number
          volume?: number
          effective_volume?: number
          initial_fatigue?: number
          set_duration?: number | null
          rest_interval?: number | null
          is_eccentric?: boolean
          is_ballistic?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_recovery_parameters: {
        Row: {
          id: string
          user_id: string
          parameter_name: string
          population_mean: number
          population_std_dev: number
          user_mean: number
          user_std_dev: number
          observation_count: number
          confidence_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          parameter_name: string
          population_mean: number
          population_std_dev: number
          user_mean: number
          user_std_dev: number
          observation_count?: number
          confidence_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          parameter_name?: string
          population_mean?: number
          population_std_dev?: number
          user_mean?: number
          user_std_dev?: number
          observation_count?: number
          confidence_level?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
          last_updated?: string
          created_at?: string
        }
        Relationships: []
      }
      user_context_data: {
        Row: {
          id: string
          user_id: string
          date: string
          sleep_hours: number | null
          sleep_quality: 'poor' | 'fair' | 'good' | 'excellent' | null
          sleep_interruptions: number | null
          protein_intake: number | null
          carb_intake: number | null
          calorie_balance: 'deficit' | 'maintenance' | 'surplus' | null
          hydration_level: 'poor' | 'fair' | 'good' | 'excellent' | null
          meal_timing: 'poor' | 'fair' | 'good' | null
          work_stress: number | null
          life_stress: number | null
          perceived_stress: number | null
          resting_heart_rate: number | null
          heart_rate_variability: number | null
          subjective_readiness: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          sleep_hours?: number | null
          sleep_quality?: 'poor' | 'fair' | 'good' | 'excellent' | null
          sleep_interruptions?: number | null
          protein_intake?: number | null
          carb_intake?: number | null
          calorie_balance?: 'deficit' | 'maintenance' | 'surplus' | null
          hydration_level?: 'poor' | 'fair' | 'good' | 'excellent' | null
          meal_timing?: 'poor' | 'fair' | 'good' | null
          work_stress?: number | null
          life_stress?: number | null
          perceived_stress?: number | null
          resting_heart_rate?: number | null
          heart_rate_variability?: number | null
          subjective_readiness?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          sleep_hours?: number | null
          sleep_quality?: 'poor' | 'fair' | 'good' | 'excellent' | null
          sleep_interruptions?: number | null
          protein_intake?: number | null
          carb_intake?: number | null
          calorie_balance?: 'deficit' | 'maintenance' | 'surplus' | null
          hydration_level?: 'poor' | 'fair' | 'good' | 'excellent' | null
          meal_timing?: 'poor' | 'fair' | 'good' | null
          work_stress?: number | null
          life_stress?: number | null
          perceived_stress?: number | null
          resting_heart_rate?: number | null
          heart_rate_variability?: number | null
          subjective_readiness?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_demographics: {
        Row: {
          user_id: string
          age: number | null
          sex: 'male' | 'female' | 'other' | null
          training_age: number | null
          athletic_background: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null
          bodyweight: number | null
          height: number | null
          current_injuries: string[] | null
          chronic_conditions: string[] | null
          updated_at: string
          created_at: string
        }
        Insert: {
          user_id: string
          age?: number | null
          sex?: 'male' | 'female' | 'other' | null
          training_age?: number | null
          athletic_background?: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null
          bodyweight?: number | null
          height?: number | null
          current_injuries?: string[] | null
          chronic_conditions?: string[] | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          age?: number | null
          sex?: 'male' | 'female' | 'other' | null
          training_age?: number | null
          athletic_background?: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null
          bodyweight?: number | null
          height?: number | null
          current_injuries?: string[] | null
          chronic_conditions?: string[] | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      menstrual_cycle_data: {
        Row: {
          id: string
          user_id: string
          date: string
          phase: 'follicular' | 'ovulation' | 'luteal' | 'menstruation' | 'unknown'
          day_in_cycle: number | null
          symptoms: string[] | null
          symptom_severity: 'none' | 'mild' | 'moderate' | 'severe' | null
          hormonal_contraception: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          phase: 'follicular' | 'ovulation' | 'luteal' | 'menstruation' | 'unknown'
          day_in_cycle?: number | null
          symptoms?: string[] | null
          symptom_severity?: 'none' | 'mild' | 'moderate' | 'severe' | null
          hormonal_contraception?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          phase?: 'follicular' | 'ovulation' | 'luteal' | 'menstruation' | 'unknown'
          day_in_cycle?: number | null
          symptoms?: string[] | null
          symptom_severity?: 'none' | 'mild' | 'moderate' | 'severe' | null
          hormonal_contraception?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fitness_tracker_connections: {
        Row: {
          id: string
          user_id: string
          provider: 'oura' | 'whoop' | 'apple_health' | 'google_fit' | 'garmin' | 'fitbit'
          access_token: string
          refresh_token: string | null
          token_expires_at: string | null
          scope: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          sync_error: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'oura' | 'whoop' | 'apple_health' | 'google_fit' | 'garmin' | 'fitbit'
          access_token: string
          refresh_token?: string | null
          token_expires_at?: string | null
          scope?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          sync_error?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'oura' | 'whoop' | 'apple_health' | 'google_fit' | 'garmin' | 'fitbit'
          access_token?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          scope?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          sync_error?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recovery_snapshots: {
        Row: {
          id: string
          user_id: string
          snapshot_timestamp: string
          overall_recovery_score: number
          global_fatigue: number
          acwr: number | null
          injury_risk_score: number | null
          injury_risk_level: 'low' | 'moderate' | 'high' | 'very_high' | 'critical' | null
          muscle_states: Json
          exercise_states: Json | null
          energy_states: Json | null
          connective_tissue_states: Json | null
          warnings: string[] | null
          recommendations: string[] | null
          computation_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          snapshot_timestamp: string
          overall_recovery_score: number
          global_fatigue: number
          acwr?: number | null
          injury_risk_score?: number | null
          injury_risk_level?: 'low' | 'moderate' | 'high' | 'very_high' | 'critical' | null
          muscle_states: Json
          exercise_states?: Json | null
          energy_states?: Json | null
          connective_tissue_states?: Json | null
          warnings?: string[] | null
          recommendations?: string[] | null
          computation_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          snapshot_timestamp?: string
          overall_recovery_score?: number
          global_fatigue?: number
          acwr?: number | null
          injury_risk_score?: number | null
          injury_risk_level?: 'low' | 'moderate' | 'high' | 'very_high' | 'critical' | null
          muscle_states?: Json
          exercise_states?: Json | null
          energy_states?: Json | null
          connective_tissue_states?: Json | null
          warnings?: string[] | null
          recommendations?: string[] | null
          computation_time_ms?: number | null
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          lifetime_slots_total: number
          lifetime_slots_remaining: number
          updated_at: string
        }
        Insert: {
          id?: string
          lifetime_slots_total?: number
          lifetime_slots_remaining?: number
          updated_at?: string
        }
        Update: {
          id?: string
          lifetime_slots_total?: number
          lifetime_slots_remaining?: number
          updated_at?: string
        }
        Relationships: []
      }
      ui_events: {
        Row: {
          id: string
          user_id: string | null
          event_name: string
          event_source: string
          session_id: string | null
          path: string | null
          properties: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_name: string
          event_source?: string
          session_id?: string | null
          path?: string | null
          properties?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_name?: string
          event_source?: string
          session_id?: string | null
          path?: string | null
          properties?: Json
          created_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          old_tier: string | null
          new_tier: string | null
          stripe_event_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          old_tier?: string | null
          new_tier?: string | null
          stripe_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          old_tier?: string | null
          new_tier?: string | null
          stripe_event_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      exercise_efficiency_leaderboard: {
        Row: {
          avg_sfr: number | null
          best_sfr: number | null
          exercise_id: string | null
          exercise_name: string | null
          times_performed: number | null
          user_id: string | null
          worst_sfr: number | null
        }
        Relationships: []
      }
      recent_sfr_trends: {
        Row: {
          avg_sfr: number | null
          exercise_id: string | null
          exercise_name: string | null
          last_performed: string | null
          session_count: number | null
          sfr_variance: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_acwr: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_hours_since_training: {
        Args: { last_trained: string }
        Returns: number
      }
      cleanup_expired_caches: { Args: never; Returns: number }
      decrement_lifetime_slots: {
        Args: never
        Returns: undefined
      }
      get_exercise_avg_sfr: {
        Args: { p_days_back?: number; p_exercise_id: string; p_user_id: string }
        Returns: number
      }
      get_latest_context_data: {
        Args: { p_user_id: string }
        Returns: Record<string, Json>
      }
      get_model_performance_metrics: {
        Args: { p_user_id: string }
        Returns: {
          avg_absolute_error: number
          last_7_days_rmse: number
          prediction_accuracy_percentage: number
          total_predictions: number
          within_ci_percentage: number
        }[]
      }
      get_or_build_hierarchical_model: {
        Args: { p_user_id: string }
        Returns: {
          cache_age_minutes: number
          fatigue_resistance: number
          needs_rebuild: boolean
          recovery_rate: number
          total_workouts: number
        }[]
      }
      get_workout_history_for_recovery: {
        Args: { p_user_id: string; p_days_back?: number }
        Returns: {
          event_timestamp: string
          exercise_name: string
          sets: number
          reps: number
          weight: number
          rpe: number
          volume: number
          effective_volume: number
          initial_fatigue: number
          set_duration: number | null
          rest_interval: number | null
          is_eccentric: boolean
          is_ballistic: boolean
        }[]
      }
      identify_junk_volume_exercises: {
        Args: { p_min_sessions?: number; p_user_id: string }
        Returns: {
          avg_sfr: number
          exercise_id: string
          exercise_name: string
          recommendation: string
          session_count: number
        }[]
      }
      increment_user_model_stats: {
        Args: { p_user_id: string; p_workout_sets: number }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
