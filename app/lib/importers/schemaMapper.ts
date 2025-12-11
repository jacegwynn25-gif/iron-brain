import { format, addWeeks, addDays, parseISO } from 'date-fns';
import type { WorkoutSession, SetLog } from '../types';
import type {
  ParsedFileResult,
  WorkoutSection,
  ParsedRow,
  ExerciseMatch,
  ImportConfig,
  ImportWarning,
} from './types';

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

/**
 * Calculate E1RM using Epley formula
 */
function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Calculate date for a workout based on week number and day name
 */
function calculateWorkoutDate(
  weekNumber: number,
  dayName: string,
  startDate?: Date
): Date {
  const baseDate = startDate || new Date();

  // Calculate weeks offset
  const weeksOffset = weekNumber - 1;
  const dateWithWeeks = addWeeks(baseDate, weeksOffset);

  // Get target day index
  const targetDayIndex = DAY_NAME_TO_INDEX[dayName];
  const currentDayIndex = dateWithWeeks.getDay();

  // Calculate days offset to get to target day
  let daysOffset = targetDayIndex - currentDayIndex;
  if (daysOffset < 0) {
    daysOffset += 7;
  }

  return addDays(dateWithWeeks, daysOffset);
}

/**
 * Group parsed rows by exercise (for multi-set exercises)
 */
function groupRowsByExercise(rows: ParsedRow[]): Map<string, ParsedRow[]> {
  const groups = new Map<string, ParsedRow[]>();

  rows.forEach((row) => {
    const exerciseName = row.exercise;
    if (!groups.has(exerciseName)) {
      groups.set(exerciseName, []);
    }
    groups.get(exerciseName)!.push(row);
  });

  return groups;
}

/**
 * Transform a single workout section into a WorkoutSession
 */
function transformSection(
  section: WorkoutSection,
  exerciseMatches: ExerciseMatch[],
  config: ImportConfig,
  warnings: ImportWarning[]
): WorkoutSession | null {
  // Calculate workout date
  const workoutDate = calculateWorkoutDate(
    section.weekNumber,
    section.dayName,
    config.startDate
  );

  // Group rows by exercise
  const exerciseGroups = groupRowsByExercise(section.rows);

  // Transform to SetLog[]
  const sets: SetLog[] = [];
  let setIndex = 0;

  exerciseGroups.forEach((rows, exerciseName) => {
    // Find exercise match
    const match = exerciseMatches.find((m) => m.originalName === exerciseName);

    if (!match || !match.matchedExerciseId || match.matchedExerciseId === '__SKIP__') {
      // Silently skip if user marked it as skip, otherwise warn
      if (match?.matchedExerciseId !== '__SKIP__') {
        warnings.push({
          type: 'missing_data',
          message: `Skipping exercise "${exerciseName}" - no match found`,
        });
      }
      return;
    }

    // Create a SetLog for each row (each set)
    rows.forEach((row, index) => {
      const hasData = row.weightUsed !== undefined && row.reps !== undefined;

      // Calculate E1RM if not provided
      let e1rm = row.e1rm;
      if (!e1rm && hasData) {
        e1rm = calculateE1RM(row.weightUsed!, row.reps!);
      }

      // Calculate volume load
      const volumeLoad = hasData ? row.weightUsed! * row.reps! : 0;

      const setLog: SetLog = {
        exerciseId: match.matchedExerciseId!,
        setIndex: setIndex++,
        prescribedReps: row.reps ? row.reps.toString() : '0', // Use actual as prescribed if no plan
        completed: hasData,
        actualReps: row.reps || null,
        actualWeight: row.weightUsed || null,
        actualRPE: row.rpeActual || null,
        volumeLoad,
        e1rm: e1rm || null,
        timestamp: workoutDate.toISOString(),
      };

      sets.push(setLog);
    });
  });

  // Don't create session if no valid sets
  if (sets.length === 0) {
    warnings.push({
      type: 'missing_data',
      message: `Skipping ${section.sectionHeader} - no valid sets`,
    });
    return null;
  }

  // Generate session ID
  const sessionId = `imported_${format(workoutDate, 'yyyyMMdd')}_${section.weekNumber}_${section.dayName.toLowerCase()}`;

  // Create WorkoutSession
  const session: WorkoutSession = {
    id: sessionId,
    programId: config.programId || 'imported_program',
    programName: config.programName || 'Imported Workout',
    cycleNumber: 1,
    weekNumber: section.weekNumber,
    dayOfWeek: section.dayName,
    dayName: section.dayName,
    date: format(workoutDate, 'yyyy-MM-dd'),
    sets,
    createdAt: workoutDate.toISOString(),
    updatedAt: workoutDate.toISOString(),
  };

  return session;
}

/**
 * Transform parsed file result into WorkoutSession array
 */
export function mapToWorkoutSessions(
  parsedResult: ParsedFileResult,
  exerciseMatches: ExerciseMatch[],
  config: ImportConfig
): { sessions: WorkoutSession[]; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [...parsedResult.warnings];
  const sessions: WorkoutSession[] = [];

  // Transform each section
  parsedResult.sections.forEach((section) => {
    const session = transformSection(section, exerciseMatches, config, warnings);
    if (session) {
      sessions.push(session);
    }
  });

  return { sessions, warnings };
}

/**
 * Detect the last completed workout from imported sessions
 */
export function detectLastWorkout(
  sessions: WorkoutSession[]
): { weekNumber: number; dayName: string } | null {
  if (sessions.length === 0) return null;

  // Sort sessions by date (descending)
  const sorted = [...sessions].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const lastSession = sorted[0];

  return {
    weekNumber: lastSession.weekNumber,
    dayName: lastSession.dayName,
  };
}

/**
 * Determine the next workout day in a program
 */
export function calculateNextWorkoutDay(
  lastWorkout: { weekNumber: number; dayName: string },
  programDays: string[]
): { weekNumber: number; dayName: string } | null {
  // Find current day index in program
  const currentDayIndex = programDays.indexOf(lastWorkout.dayName);

  if (currentDayIndex === -1) {
    // Day not in program, return first day of next week
    return {
      weekNumber: lastWorkout.weekNumber + 1,
      dayName: programDays[0],
    };
  }

  // Check if there's a next day in the same week
  if (currentDayIndex < programDays.length - 1) {
    return {
      weekNumber: lastWorkout.weekNumber,
      dayName: programDays[currentDayIndex + 1],
    };
  }

  // Wrap to next week
  return {
    weekNumber: lastWorkout.weekNumber + 1,
    dayName: programDays[0],
  };
}
