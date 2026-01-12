import { z } from 'zod';

/**
 * Validation schemas for training programs
 */

// Prescription method validation
export const PrescriptionMethodSchema = z.enum([
  'rpe',
  'rir',
  'percentage',
  'fixed',
  'amrap',
  'timed'
]);

// Set type validation
export const SetTypeSchema = z.enum([
  'straight',
  'superset',
  'giant',
  'drop',
  'rest-pause',
  'cluster',
  'amrap',
  'timed'
]);

// Individual set prescription
export const SetPrescriptionSchema = z.object({
  reps: z.number().int().min(1).max(100).optional(),
  targetRPE: z.number().min(6).max(10).optional(),
  targetRIR: z.number().int().min(0).max(5).optional(),
  percentage: z.number().min(0).max(150).optional(), // Percentage of 1RM
  weight: z.number().min(0).optional(), // Fixed weight
  duration: z.number().min(0).optional(), // For timed sets (seconds)
  restSeconds: z.number().int().min(0).max(600).default(90),
  tempo: z.string().regex(/^\d{4}$/, 'Tempo must be 4 digits (e.g., 3010)').optional(),
  notes: z.string().max(200).optional(),
});

// Exercise in a program
export const ProgramExerciseSchema = z.object({
  id: z.string().uuid().optional(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string().optional(), // For display
  sets: z.number().int().min(1).max(20),
  setType: SetTypeSchema.default('straight'),
  prescriptionMethod: PrescriptionMethodSchema.default('rpe'),
  setPrescriptions: z.array(SetPrescriptionSchema).optional(),
  order: z.number().int().min(1),
  superset: z.number().int().optional(), // Group ID for supersets
});

// Workout day in a program
export const ProgramDaySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  dayNumber: z.number().int().min(1),
  exercises: z.array(ProgramExerciseSchema).min(1, 'Day must have at least one exercise'),
  notes: z.string().max(500).optional(),
});

// Program week
export const ProgramWeekSchema = z.object({
  weekNumber: z.number().int().min(1),
  days: z.array(ProgramDaySchema).min(1, 'Week must have at least one day'),
  deloadWeek: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

// Complete program
export const ProgramSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string()
    .min(1, 'Program name is required')
    .max(100, 'Program name too long (max 100 characters)'),

  description: z.string().max(1000).optional(),

  author: z.string().max(100).optional(),

  weeks: z.array(ProgramWeekSchema).min(1, 'Program must have at least one week'),

  daysPerWeek: z.number().int().min(1).max(7),

  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),

  focusArea: z.enum([
    'strength',
    'hypertrophy',
    'powerlifting',
    'bodybuilding',
    'general',
    'athletic'
  ]).optional(),

  isCustom: z.boolean().default(false),

  userId: z.string().optional(), // Required for custom programs

  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// Helper functions
export function validateProgram(input: unknown) {
  return ProgramSchema.safeParse(input);
}

export function validateProgramDay(input: unknown) {
  return ProgramDaySchema.safeParse(input);
}

export function validateProgramExercise(input: unknown) {
  return ProgramExerciseSchema.safeParse(input);
}

// Type exports
export type ValidProgram = z.infer<typeof ProgramSchema>;
export type ValidProgramWeek = z.infer<typeof ProgramWeekSchema>;
export type ValidProgramDay = z.infer<typeof ProgramDaySchema>;
export type ValidProgramExercise = z.infer<typeof ProgramExerciseSchema>;
export type ValidSetPrescription = z.infer<typeof SetPrescriptionSchema>;
