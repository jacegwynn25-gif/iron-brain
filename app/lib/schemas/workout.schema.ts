import { z } from 'zod';

/**
 * Validation schemas for workout-related data
 * Ensures data integrity and prevents invalid inputs
 */

// Individual set validation
export const SetSchema = z.object({
  weight: z.number()
    .min(0, 'Weight cannot be negative')
    .max(2000, 'Weight seems unrealistic (max 2000 lbs/kg)')
    .finite('Weight must be a valid number'),

  reps: z.number()
    .int('Reps must be a whole number')
    .min(1, 'Must complete at least 1 rep')
    .max(100, 'Reps seem unrealistic (max 100)'),

  rpe: z.number()
    .min(6, 'RPE must be between 6-10')
    .max(10, 'RPE must be between 6-10')
    .optional(),

  rir: z.number()
    .int('RIR must be a whole number')
    .min(0, 'RIR cannot be negative')
    .max(5, 'RIR typically ranges from 0-5')
    .optional(),

  formQuality: z.enum(['good', 'breakdown', 'failure', 'tempo_slowdown'])
    .optional()
    .default('good'),

  e1rm: z.number()
    .min(0)
    .optional(), // Calculated automatically

  timestamp: z.string().datetime().optional(),

  notes: z.string().max(500, 'Notes too long (max 500 characters)').optional(),
});

// Bodyweight validation
export const BodyweightSchema = z.number()
  .min(50, 'Bodyweight seems too low (min 50 lbs/kg)')
  .max(500, 'Bodyweight seems too high (max 500 lbs/kg)')
  .optional();

// Complete set with exercise info
export const CompleteSetSchema = SetSchema.extend({
  exerciseId: z.string().uuid('Invalid exercise ID'),
  setNumber: z.number().int().min(1),
  targetReps: z.number().int().min(1).optional(),
  targetRPE: z.number().min(6).max(10).optional(),
  targetWeight: z.number().min(0).optional(),
});

// Workout session validation
export const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  programId: z.string().uuid().optional(),
  programName: z.string().optional(),
  week: z.number().int().min(1).optional(),
  day: z.number().int().min(1).optional(),
  date: z.string().datetime(),
  duration: z.number().min(0).optional(), // in seconds
  bodyweight: BodyweightSchema,
  notes: z.string().max(1000).optional(),
  sets: z.array(CompleteSetSchema).min(1, 'Workout must have at least 1 set'),
});

// Helper function to validate and sanitize set input
export function validateSetInput(input: unknown) {
  return SetSchema.safeParse(input);
}

// Helper function to validate workout session
export function validateWorkoutSession(input: unknown) {
  return WorkoutSessionSchema.safeParse(input);
}

// Type exports for TypeScript
export type ValidSet = z.infer<typeof SetSchema>;
export type ValidCompleteSet = z.infer<typeof CompleteSetSchema>;
export type ValidWorkoutSession = z.infer<typeof WorkoutSessionSchema>;
