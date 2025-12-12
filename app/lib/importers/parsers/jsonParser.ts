/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Parser, ParsedFileResult, ImportError } from '../types';
import { WorkoutSession } from '../../types';

/**
 * JSON Parser - handles both exact WorkoutSession schema and flexible schemas
 */
export class JSONParser implements Parser {
  async canParse(file: File): Promise<boolean> {
    return file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
  }

  async parse(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);

          // Check if it's already in WorkoutSession[] format
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];

            // Check if it matches WorkoutSession schema
            if (
              firstItem.id &&
              firstItem.date &&
              firstItem.sets &&
              Array.isArray(firstItem.sets)
            ) {
              // It's already in the correct format, just validate it
              const errors: ImportError[] = [];
              const validSessions: WorkoutSession[] = [];

              data.forEach((session: any, index: number) => {
                if (!session.id || !session.date || !session.sets) {
                  errors.push({
                    type: 'validation',
                    message: `Session at index ${index} is missing required fields (id, date, or sets)`,
                    rowIndex: index,
                  });
                } else {
                  validSessions.push(session as WorkoutSession);
                }
              });

              // For JSON, we don't parse into sections - we return the data as-is
              // The schema mapper will handle converting it if needed
              return resolve({
                format: 'json',
                sections: [], // JSON doesn't use sections
                fieldMapping: { exerciseField: 'exerciseId' }, // Placeholder
                errors,
                warnings: [],
                totalRows: data.length,
                validRows: validSessions.length,
              });
            }
          }

          // If not in WorkoutSession format, return error
          // In the future, we could add more flexible schema detection here
          resolve({
            format: 'json',
            sections: [],
            fieldMapping: { exerciseField: '' },
            errors: [
              {
                type: 'parse',
                message:
                  'JSON format not recognized. Expected an array of WorkoutSession objects with id, date, and sets fields.',
              },
            ],
            warnings: [],
            totalRows: 0,
            validRows: 0,
          });
        } catch (error: any) {
          reject(new Error(`JSON parsing failed: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read JSON file.'));
      };

      reader.readAsText(file);
    });
  }
}
