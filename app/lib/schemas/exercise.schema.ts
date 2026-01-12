import { z } from 'zod';

/**
 * Validation schemas for exercise-related data
 */

// Exercise creation/update validation
export const ExerciseSchema = z.object({
  id: z.string().uuid().optional(), // Optional for creation, required for updates
  name: z.string()
    .min(1, 'Exercise name is required')
    .max(100, 'Exercise name too long (max 100 characters)')
    .trim(),

  slug: z.string()
    .min(1, 'Exercise slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only')
    .optional(),

  equipment: z.enum([
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'bodyweight',
    'band',
    'kettlebell',
    'other'
  ]),

  muscleGroups: z.array(
    z.enum([
      'chest',
      'back',
      'shoulders',
      'arms',
      'legs',
      'glutes',
      'core',
      'calves',
      'forearms',
      'traps',
      'neck'
    ])
  ).min(1, 'Must select at least one muscle group'),

  movementPattern: z.enum([
    'squat',
    'hinge',
    'lunge',
    'push',
    'pull',
    'carry',
    'rotation',
    'isolation',
    'other'
  ]),

  isCompound: z.boolean().default(true),

  isCustom: z.boolean().default(false),

  userId: z.string().optional(), // Required for custom exercises

  notes: z.string().max(500, 'Notes too long (max 500 characters)').optional(),

  videoUrl: z.string().url('Invalid video URL').optional().or(z.literal('')),
});

// Exercise substitution schema
export const ExerciseSubstitutionSchema = z.object({
  originalExerciseId: z.string().uuid(),
  substituteExerciseId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

// Helper functions
export function validateExercise(input: unknown) {
  return ExerciseSchema.safeParse(input);
}

export function validateExerciseSubstitution(input: unknown) {
  return ExerciseSubstitutionSchema.safeParse(input);
}

// Type exports
export type ValidExercise = z.infer<typeof ExerciseSchema>;
export type ValidExerciseSubstitution = z.infer<typeof ExerciseSubstitutionSchema>;
