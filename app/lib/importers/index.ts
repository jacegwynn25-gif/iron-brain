import { detectFileFormat, isSupportedFormat } from './formatDetector';
import { CSVParser } from './parsers/csvParser';
import { ExcelParser } from './parsers/excelParser';
import { JSONParser } from './parsers/jsonParser';
import { matchExercises, updateExerciseMatch } from './exerciseMatcher';
import { mapToWorkoutSessions } from './schemaMapper';
import { getAllExercises } from '../programs';
import { getWorkoutHistory, setWorkoutHistory } from '../storage';
import type {
  ImportSession,
  ImportConfig,
  Parser,
  ExerciseMatch,
  MergeStrategy,
} from './types';
import type { WorkoutSession } from '../types';

/**
 * Main WorkoutImporter class - orchestrates the import process
 */
export class WorkoutImporter {
  private parsers: Parser[];

  constructor() {
    this.parsers = [new CSVParser(), new ExcelParser(), new JSONParser()];
  }

  /**
   * Start a new import session
   */
  async startImport(
    file: File,
    config: Partial<ImportConfig> = {}
  ): Promise<ImportSession> {
    const sessionId = `import_${Date.now()}`;
    const format = detectFileFormat(file);

    // Create initial session
    const session: ImportSession = {
      id: sessionId,
      state: 'uploading',
      fileName: file.name,
      fileSize: file.size,
      format,
      config: {
        mergeStrategy: config.mergeStrategy || 'skip_duplicates',
        programId: config.programId,
        programName: config.programName,
        startDate: config.startDate,
        unitPreference: config.unitPreference || 'lbs',
      },
      errors: [],
      warnings: [],
      createdAt: new Date(),
    };

    // Validate format
    if (!isSupportedFormat(format)) {
      session.state = 'error';
      session.errors.push({
        type: 'parse',
        message: `Unsupported file format. Please upload a CSV, Excel (.xlsx), or JSON file.`,
      });
      return session;
    }

    // Parse file
    session.state = 'parsing';

    try {
      const parser = this.parsers.find((p) => p.canParse(file));
      if (!parser) {
        throw new Error('No parser available for this file format');
      }

      const parsedResult = await parser.parse(file);
      session.parsedResult = parsedResult;
      session.errors.push(...parsedResult.errors);
      session.warnings.push(...parsedResult.warnings);

      // Check for parse errors
      if (parsedResult.errors.length > 0) {
        session.state = 'error';
        return session;
      }

      // Match exercises
      session.state = 'matching';

      // Extract unique exercise names from parsed data
      const exerciseNames = new Set<string>();
      parsedResult.sections.forEach((section) => {
        section.rows.forEach((row) => {
          exerciseNames.add(row.exercise);
        });
      });

      const matcherResult = matchExercises(Array.from(exerciseNames));
      session.exerciseMatches = matcherResult.matches;

      // Add warnings for unmatched exercises
      if (matcherResult.unmatchedCount > 0) {
        session.warnings.push({
          type: 'low_confidence_match',
          message: `${matcherResult.unmatchedCount} exercise(s) could not be automatically matched. Please review.`,
        });
      }

      // Determine next state
      if (matcherResult.needsReviewCount > 0) {
        session.state = 'reviewing'; // User needs to review matches
      } else {
        // Auto-proceed to transformation
        session.state = 'reviewing'; // Always go to review for now
        await this.transformSessions(session);
      }

      return session;
    } catch (error: any) {
      session.state = 'error';
      session.errors.push({
        type: 'parse',
        message: error.message || 'Failed to parse file',
      });
      return session;
    }
  }

  /**
   * Update exercise matches (user overrides)
   */
  updateMatches(session: ImportSession, updatedMatches: ExerciseMatch[]): ImportSession {
    session.exerciseMatches = updatedMatches;
    return session;
  }

  /**
   * Transform parsed data into WorkoutSessions
   */
  async transformSessions(session: ImportSession): Promise<ImportSession> {
    if (!session.parsedResult || !session.exerciseMatches) {
      session.state = 'error';
      session.errors.push({
        type: 'mapping',
        message: 'Cannot transform sessions: missing parsed data or exercise matches',
      });
      return session;
    }

    const { sessions, warnings } = mapToWorkoutSessions(
      session.parsedResult,
      session.exerciseMatches,
      session.config
    );

    session.workoutSessions = sessions;
    session.warnings.push(...warnings);

    // Calculate summary stats
    session.totalSessions = sessions.length;
    session.totalSets = sessions.reduce((sum, s) => sum + s.sets.length, 0);

    if (sessions.length > 0) {
      const dates = sessions.map((s) => new Date(s.date));
      session.dateRange = {
        start: new Date(Math.min(...dates.map((d) => d.getTime()))),
        end: new Date(Math.max(...dates.map((d) => d.getTime()))),
      };
    }

    session.state = 'complete';
    return session;
  }

  /**
   * Complete the import and save to storage
   */
  async completeImport(session: ImportSession): Promise<ImportSession> {
    if (session.state !== 'complete' || !session.workoutSessions) {
      session.errors.push({
        type: 'validation',
        message: 'Cannot complete import: sessions not ready',
      });
      return session;
    }

    try {
      const existingHistory = getWorkoutHistory();
      let finalHistory: WorkoutSession[];

      switch (session.config.mergeStrategy) {
        case 'replace_all':
          finalHistory = session.workoutSessions;
          break;

        case 'skip_duplicates': {
          const existingIds = new Set(existingHistory.map((s) => s.id));
          const newSessions = session.workoutSessions.filter((s) => !existingIds.has(s.id));
          finalHistory = [...existingHistory, ...newSessions];
          session.skippedSessionCount = session.workoutSessions.length - newSessions.length;

          if (session.skippedSessionCount > 0) {
            session.warnings.push({
              type: 'duplicate',
              message: `Skipped ${session.skippedSessionCount} duplicate session(s)`,
            });
          }
          break;
        }

        case 'merge_by_date': {
          const dateMap = new Map<string, WorkoutSession>();

          // Add existing sessions
          existingHistory.forEach((s) => {
            dateMap.set(s.date, s);
          });

          // Overwrite with imported sessions (by date)
          session.workoutSessions.forEach((s) => {
            dateMap.set(s.date, s);
          });

          finalHistory = Array.from(dateMap.values());
          break;
        }

        default:
          finalHistory = [...existingHistory, ...session.workoutSessions];
      }

      // Save to storage
      setWorkoutHistory(finalHistory);

      session.importedSessionIds = session.workoutSessions.map((s) => s.id);
      session.completedAt = new Date();

      return session;
    } catch (error: any) {
      session.state = 'error';
      session.errors.push({
        type: 'validation',
        message: `Failed to save import: ${error.message}`,
      });
      return session;
    }
  }
}

// Export singleton instance
export const workoutImporter = new WorkoutImporter();
