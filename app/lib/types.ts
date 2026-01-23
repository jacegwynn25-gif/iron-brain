// ============================================================
// EXERCISE LIBRARY TYPES
// ============================================================

export interface Exercise {
  id: string;
  name: string;
  type: 'compound' | 'accessory' | 'isolation';
  muscleGroups: string[];
  equipment?: string[];           // 'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string[];
  videoUrl?: string;
  alternativeExerciseIds?: string[];  // For substitutions
  defaultRestSeconds?: number;    // Suggested rest time
}

// Custom exercises created by users
export interface CustomExercise {
  id: string;
  userId: string;
  name: string;
  slug: string;

  // Equipment
  equipment: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

  // Type
  exerciseType: 'compound' | 'isolation';

  // Muscles
  primaryMuscles: string[];
  secondaryMuscles: string[];

  // Movement pattern
  movementPattern?: 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'rotation' | 'other';

  // Tracking
  trackWeight: boolean;
  trackReps: boolean;
  trackTime: boolean;

  // Defaults
  defaultRestSeconds: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// PROGRAM TEMPLATE TYPES (What the program prescribes)
// ============================================================

export type SetType = 'straight' | 'superset' | 'giant' | 'drop' | 'rest-pause' | 'cluster' | 'warmup' | 'amrap' | 'backoff';

// Prescription method options
export type PrescriptionMethod =
  | 'rpe'
  | 'rir'
  | 'percentage_1rm'
  | 'percentage_tm'
  | 'fixed_weight'
  | 'amrap'
  | 'time_based';

export interface SetTemplate {
  exerciseId: string;
  setIndex: number;

  // Reps (can be range or fixed)
  prescribedReps: string;        // '5', '4-6', '8-10', 'AMRAP'
  minReps?: number;              // For ranges
  maxReps?: number;              // For ranges

  // Prescription method (NEW!)
  prescriptionMethod?: PrescriptionMethod; // Defaults to 'rpe' if not set

  // Target values (use based on prescriptionMethod)
  targetRPE?: number | null;     // For 'rpe' - RPE 0-10
  targetRIR?: number | null;     // For 'rir' - RIR (reps in reserve)
  targetPercentage?: number | null;  // For 'percentage_1rm' or 'percentage_tm'
  fixedWeight?: number | null;   // For 'fixed_weight'
  targetSeconds?: number | null; // For 'time_based'

  tempo?: string;                // '3-0-1-0' (eccentric-pause-concentric-pause)
  restSeconds?: number;          // Override default rest for this set
  notes?: string;                // 'paused', 'deficits', 'close grip', etc.

  // Advanced set types
  setType?: SetType;             // Type of set (straight, superset, drop, etc.)
  supersetGroup?: string;        // Group ID for supersets (e.g., 'A', 'B') - exercises with same group are supersetted
  dropSetWeights?: number[];     // Array of weights for drop sets (descending)
  restPauseRounds?: number;      // Number of rest-pause rounds (typically 2-3)
  clusterReps?: number[];        // Reps per cluster (e.g., [2, 2, 2, 2] for 4 clusters of 2)
  clusterRestSeconds?: number;   // Rest between clusters (typically 10-30s)
}

export interface DayTemplate {
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  name: string;
  sets: SetTemplate[];
}

export interface WeekTemplate {
  weekNumber: number;            // Changed from union type to support any week count
  days: DayTemplate[];
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description?: string;
  author?: string;
  goal?: 'strength' | 'hypertrophy' | 'powerlifting' | 'general' | 'peaking';
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek?: number;
  weekCount?: number;
  intensityMethod?: 'rpe' | 'rir' | 'percentage' | 'amrap' | 'custom';
  isCustom?: boolean;
  weeks: WeekTemplate[];
}

// ============================================================
// WORKOUT LOGGING TYPES (What actually happened)
// ============================================================

export type WeightUnit = 'lbs' | 'kg';
export type LoadType = 'absolute' | 'bodyweight' | 'assisted' | 'percentage';

export interface SetLog {
  id?: string;
  // Reference to prescription
  exerciseId: string;
  exerciseName?: string;            // Optional cached name for analytics/UI
  setIndex: number;

  // What was prescribed
  prescribedReps: string;
  prescribedRPE?: number | null;
  prescribedRIR?: number | null;
  prescribedPercentage?: number | null;
  prescribedWeight?: number | null;  // Auto-calculated from percentage if applicable

  // What actually happened
  actualWeight?: number | null;
  weightUnit?: WeightUnit;
  loadType?: LoadType;              // 'absolute' (225lbs), 'bodyweight' (BW+20), etc.
  actualReps?: number | null;
  actualRPE?: number | null;
  actualRIR?: number | null;
  tempo?: string;

  // Set outcome
  completed: boolean;               // true if logged, false if skipped
  reachedFailure?: boolean;
  formBreakdown?: boolean;

  // Performance metrics (calculated)
  e1rm?: number | null;             // Estimated 1RM
  volumeLoad?: number | null;       // Weight × Reps

  // Timing
  restTakenSeconds?: number | null; // Actual rest before this set
  setDurationSeconds?: number | null;

  // Notes
  notes?: string;                   // Free-form notes for this set
  equipmentUsed?: string;           // If different from standard (e.g., 'SSB', 'chains')

  // Advanced set type tracking
  setType?: SetType;
  supersetGroup?: string;

  // Drop set tracking
  dropSetRounds?: Array<{
    weight: number;
    reps: number;
    rpe?: number;
  }>;

  // Rest-pause tracking
  restPauseRounds?: Array<{
    reps: number;
    restSeconds: number;
  }>;

  // Cluster set tracking
  clusterRounds?: Array<{
    reps: number;
    restSeconds: number;
  }>;

  // Metadata
  timestamp?: string;               // When this set was logged (ISO)
}

export interface ExerciseSwap {
  originalExerciseId: string;
  swappedToExerciseId: string;
  reason?: string;                  // 'equipment unavailable', 'injury', 'preference'
}

export interface WorkoutSession {
  id: string;

  // Program reference
  programId: string;
  programName: string;              // Cached for display
  cycleNumber: number;              // Which run-through of the program (1, 2, 3...)
  weekNumber: number;
  dayOfWeek: string;
  dayName: string;                  // Cached from template

  // Session timing
  date: string;                     // ISO date
  startTime?: string;               // ISO timestamp
  endTime?: string;                 // ISO timestamp
  durationMinutes?: number;

  // Performance data
  sets: SetLog[];
  exerciseSwaps?: ExerciseSwap[];   // Track any substitutions made

  // Session metrics
  totalVolumeLoad?: number;         // Sum of all volume
  averageRPE?: number;
  sessionRPE?: number;              // Overall session difficulty (1-10)

  // Context
  location?: string;                // 'home', 'gym A', etc.
  bodyweight?: number;              // Morning weigh-in
  bodyweightUnit?: WeightUnit;
  sleepQuality?: number;            // 1-10
  readiness?: number;               // 1-10 or HRV if integrated

  // Notes
  notes?: string;                   // Free-form workout notes

  // Metadata
  metadata?: {
    dayIndex?: number;              // Index of day within week (for program_set_id mapping)
    [key: string]: unknown;         // Extensible for future metadata
  };
  createdAt: string;                // ISO
  updatedAt: string;                // ISO
}

// ============================================================
// USER PREFERENCES & SETTINGS
// ============================================================

export interface UserSettings {
  // Units
  defaultWeightUnit: WeightUnit;

  // Tracking preferences
  trackRPE: boolean;
  trackRIR: boolean;
  trackPercentage: boolean;
  trackTempo: boolean;
  trackRestTime: boolean;
  trackBodyweight: boolean;

  // Rest timer
  restTimerEnabled: boolean;
  restTimerSound: boolean;
  restTimerVibrate: boolean;
  autoStartRestTimer: boolean;

  // Default rest times by exercise type
  defaultRestCompound: number;      // seconds
  defaultRestAccessory: number;
  defaultRestIsolation: number;

  // Display
  showE1RM: boolean;
  showVolumeLoad: boolean;
  showProgressComparison: boolean;

  // Integrations
  ouraRingConnected?: boolean;
  appleHealthConnected?: boolean;
  appleWatchConnected?: boolean;
}

// ============================================================
// USER MAX (1RM) TYPES
// ============================================================

export interface UserMax {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  unit: 'lbs' | 'kg';
  testedAt: string; // ISO date
  estimatedOrTested: 'tested' | 'estimated';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// ANALYTICS & HISTORY TYPES
// ============================================================

export interface ExerciseHistory {
  exerciseId: string;
  sessions: {
    date: string;
    bestSet: SetLog;                // Best set from that session
    totalVolume: number;
    averageRPE: number;
  }[];
  personalRecords: {
    maxWeight: { weight: number; reps: number; date: string };
    maxReps: { weight: number; reps: number; date: string };
    maxE1RM: { e1rm: number; date: string };
    maxVolume: { volume: number; date: string };
  };
}

export interface ProgressData {
  exerciseId: string;
  metric: 'weight' | 'reps' | 'e1rm' | 'volume';
  dataPoints: {
    date: string;
    value: number;
  }[];
}

// ============================================================
// SHARED APP TYPES (Previously duplicated across pages)
// ============================================================

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  rememberUntil?: number | null;
};

export type SessionMetadata = {
  programName?: string;
  programId?: string;
  cycleNumber?: number;
  weekNumber?: number;
  dayOfWeek?: number;
  dayName?: string;
};

// ============================================================
// SUPABASE ROW TYPES (for type-safe database queries)
// ============================================================

import type { Database } from './supabase/database.types';

export type SupabaseSetLogRow = Pick<
  Database['public']['Tables']['set_logs']['Row'],
  | 'id'
  | 'exercise_slug'
  | 'exercise_id'
  | 'set_index'
  | 'prescribed_reps'
  | 'prescribed_rpe'
  | 'prescribed_rir'
  | 'prescribed_percentage'
  | 'actual_weight'
  | 'actual_reps'
  | 'actual_rpe'
  | 'actual_rir'
  | 'e1rm'
  | 'volume_load'
  | 'rest_seconds'
  | 'actual_seconds'
  | 'notes'
  | 'completed'
>;

export type SupabaseWorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'] & {
  set_logs?: SupabaseSetLogRow[] | null;
};
