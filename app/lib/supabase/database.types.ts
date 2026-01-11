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
      [key: string]: any;
    };
  };
};
