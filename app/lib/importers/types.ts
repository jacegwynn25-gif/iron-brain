import { WorkoutSession } from '../types';

// File format types
export type FileFormat = 'csv' | 'excel' | 'json' | 'unknown';

// Import session states
export type ImportSessionState =
  | 'uploading'
  | 'parsing'
  | 'matching'
  | 'reviewing'
  | 'complete'
  | 'error';

// Exercise matching confidence levels
export type MatchConfidence = 'exact' | 'alias' | 'fuzzy' | 'none';

// Exercise match result
export interface ExerciseMatch {
  originalName: string;
  matchedExerciseId: string | null;
  matchedExerciseName: string | null;
  confidence: MatchConfidence;
  confidenceScore: number; // 0-100
  alternativeMatches?: Array<{
    exerciseId: string;
    exerciseName: string;
    score: number;
  }>;
  needsReview: boolean;
}

// Parsed row from CSV/Excel before transformation
export interface ParsedRow {
  rowIndex: number;
  order?: number;
  exercise: string;
  setsRepsPlanned?: string;
  percentTM?: string;
  targetRPE?: number;
  weightUsed?: number;
  reps?: number;
  rpeActual?: number;
  e1rm?: number;
  [key: string]: any; // Allow additional columns
}

// Detected section (e.g., "Week 2 - Monday")
export interface WorkoutSection {
  sectionHeader: string;
  weekNumber: number;
  dayName: string;
  rows: ParsedRow[];
}

// Field mapping configuration
export interface FieldMapping {
  exerciseField: string;
  weightField?: string;
  repsField?: string;
  rpeField?: string;
  e1rmField?: string;
  orderField?: string;
  dateField?: string;
}

// Parsed file result
export interface ParsedFileResult {
  format: FileFormat;
  sections: WorkoutSection[];
  fieldMapping: FieldMapping;
  errors: ImportError[];
  warnings: ImportWarning[];
  totalRows: number;
  validRows: number;
}

// Import error
export interface ImportError {
  type: 'parse' | 'validation' | 'mapping' | 'missing_field';
  message: string;
  rowIndex?: number;
  field?: string;
  value?: any;
}

// Import warning
export interface ImportWarning {
  type: 'missing_data' | 'assumed_value' | 'duplicate' | 'low_confidence_match' | 'info';
  message: string;
  rowIndex?: number;
  field?: string;
}

// Merge strategy for handling duplicates
export type MergeStrategy = 'replace_all' | 'skip_duplicates' | 'merge_by_date';

// Import configuration
export interface ImportConfig {
  startDate?: Date; // Start date for Week 1 if not in file
  programId?: string; // Default program ID if not detected
  programName?: string; // Default program name
  mergeStrategy: MergeStrategy;
  unitPreference?: 'lbs' | 'kg';
}

// Main import session
export interface ImportSession {
  id: string;
  state: ImportSessionState;
  fileName: string;
  fileSize: number;
  format: FileFormat;
  config: ImportConfig;

  // Parsing results
  parsedResult?: ParsedFileResult;

  // Exercise matching results
  exerciseMatches?: ExerciseMatch[];

  // Transformed workout sessions ready for import
  workoutSessions?: WorkoutSession[];

  // Summary stats
  totalSessions?: number;
  totalSets?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };

  // Import result
  importedSessionIds?: string[];
  skippedSessionCount?: number;

  // Errors and warnings
  errors: ImportError[];
  warnings: ImportWarning[];

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
}

// Parser interface
export interface Parser {
  canParse(file: File): Promise<boolean>;
  parse(file: File): Promise<ParsedFileResult>;
}

// Exercise matcher result
export interface ExerciseMatcherResult {
  matches: ExerciseMatch[];
  unmatchedCount: number;
  needsReviewCount: number;
}
