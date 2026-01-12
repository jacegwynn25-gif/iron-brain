import { z } from 'zod';
import { WorkoutSessionSchema } from './workout.schema';
import { ExerciseSchema } from './exercise.schema';
import { ProgramSchema } from './program.schema';

/**
 * Validation schemas for data import operations
 * Extra strict to prevent malicious data injection
 */

// CSV/Excel row validation for workout imports
export const ImportedWorkoutRowSchema = z.object({
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  exercise: z.string().min(1).max(100),
  weight: z.number().min(0).max(2000),
  reps: z.number().int().min(1).max(100),
  sets: z.number().int().min(1).max(20).optional(),
  rpe: z.number().min(6).max(10).optional(),
  rir: z.number().int().min(0).max(5).optional(),
  bodyweight: z.number().min(50).max(500).optional(),
  notes: z.string().max(500).optional(),
});

// JSON import validation (full workout history)
export const ImportedDataSchema = z.object({
  version: z.string().optional(), // Schema version for migrations
  exportDate: z.string().datetime().optional(),
  workouts: z.array(WorkoutSessionSchema).max(10000, 'Too many workouts (max 10,000)'),
  exercises: z.array(ExerciseSchema).max(1000, 'Too many exercises (max 1,000)').optional(),
  programs: z.array(ProgramSchema).max(100, 'Too many programs (max 100)').optional(),
});

// File upload validation
export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  fileType: z.enum(['csv', 'json', 'xlsx']),
  fileSize: z.number().max(10 * 1024 * 1024, 'File too large (max 10MB)'),
});

// Helper functions
export function validateImportedWorkoutRow(input: unknown) {
  return ImportedWorkoutRowSchema.safeParse(input);
}

export function validateImportedData(input: unknown) {
  return ImportedDataSchema.safeParse(input);
}

export function validateFileUpload(input: unknown) {
  return FileUploadSchema.safeParse(input);
}

// Type exports
export type ValidImportedWorkoutRow = z.infer<typeof ImportedWorkoutRowSchema>;
export type ValidImportedData = z.infer<typeof ImportedDataSchema>;
export type ValidFileUpload = z.infer<typeof FileUploadSchema>;
