/**
 * Central export point for all validation schemas
 * Import from here: import { validateSetInput, SetSchema } from '@/lib/schemas'
 */

// Workout schemas
export {
  SetSchema,
  BodyweightSchema,
  CompleteSetSchema,
  WorkoutSessionSchema,
  validateSetInput,
  validateWorkoutSession,
  type ValidSet,
  type ValidCompleteSet,
  type ValidWorkoutSession,
} from './workout.schema';

// Exercise schemas
export {
  ExerciseSchema,
  ExerciseSubstitutionSchema,
  validateExercise,
  validateExerciseSubstitution,
  type ValidExercise,
  type ValidExerciseSubstitution,
} from './exercise.schema';

// Program schemas
export {
  ProgramSchema,
  ProgramWeekSchema,
  ProgramDaySchema,
  ProgramExerciseSchema,
  SetPrescriptionSchema,
  PrescriptionMethodSchema,
  SetTypeSchema,
  validateProgram,
  validateProgramDay,
  validateProgramExercise,
  type ValidProgram,
  type ValidProgramWeek,
  type ValidProgramDay,
  type ValidProgramExercise,
  type ValidSetPrescription,
} from './program.schema';

// Import schemas
export {
  ImportedWorkoutRowSchema,
  ImportedDataSchema,
  FileUploadSchema,
  validateImportedWorkoutRow,
  validateImportedData,
  validateFileUpload,
  type ValidImportedWorkoutRow,
  type ValidImportedData,
  type ValidFileUpload,
} from './import.schema';
