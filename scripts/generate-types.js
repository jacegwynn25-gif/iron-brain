#!/usr/bin/env node

/**
 * Generate TypeScript types from Supabase OpenAPI spec
 * Alternative to supabase CLI when authentication isn't available
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function generateTypes() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('📡 Fetching OpenAPI spec from Supabase...\n');

  try {
    // Fetch the OpenAPI spec
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${serviceRoleKey}`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    }

    const openApiSpec = await response.json();

    // For now, let's save the raw spec
    const specPath = path.join(__dirname, '..', 'supabase-openapi.json');
    fs.writeFileSync(specPath, JSON.stringify(openApiSpec, null, 2));

    console.log(`✅ OpenAPI spec saved to: ${specPath}`);
    console.log('\nℹ️  Next step: Convert OpenAPI spec to TypeScript types');
    console.log('   (This would require openapi-typescript package)\n');

    // For now, let's manually create the types based on our migration
    console.log('📝 Creating types manually from migration schema...\n');

    await createTypesFromMigration();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Falling back to manual type creation from migration...\n');
    await createTypesFromMigration();
  }
}

async function createTypesFromMigration() {
  const typesContent = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_latest_context_data: {
        Args: {
          p_user_id: string
        }
        Returns: Database['public']['Tables']['user_context_data']['Row']
      }
      get_workout_history_for_recovery: {
        Args: {
          p_user_id: string
          p_days_back?: number
        }
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
      calculate_acwr: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      decrement_lifetime_slots: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
`;

  const typesPath = path.join(__dirname, '..', 'app', 'lib', 'supabase', 'types.ts');
  fs.writeFileSync(typesPath, typesContent);

  console.log(`✅ Types created at: ${typesPath}`);
  console.log('   Based on migration 016 schema\n');
}

generateTypes();
