/* eslint-disable @typescript-eslint/no-explicit-any */
import Papa from 'papaparse';
import type {
  Parser,
  ParsedFileResult,
  WorkoutSection,
  ParsedRow,
  FieldMapping,
  ImportError,
  ImportWarning,
} from '../types';

const SECTION_HEADER_REGEX = /Week\s+(\d+)\s*[-–]\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;
/**
 * Detect if a row is a section header (e.g., "Week 2 - Monday")
 */
function isSectionHeader(row: any): { isHeader: boolean; weekNumber?: number; dayName?: string } {
  // Check if first column contains section header pattern
  const firstValue = Object.values(row)[0];
  if (typeof firstValue === 'string') {
    const match = firstValue.match(SECTION_HEADER_REGEX);
    if (match) {
      return {
        isHeader: true,
        weekNumber: parseInt(match[1], 10),
        dayName: match[2],
      };
    }
  }

  return { isHeader: false };
}

/**
 * Detect field mapping from CSV headers
 */
function detectFieldMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {
    exerciseField: '',
  };

  for (const header of headers) {
    const lower = header.toLowerCase();

    // Exercise field (required)
    if (/exercise|movement|lift|name/i.test(lower) && !mapping.exerciseField) {
      mapping.exerciseField = header;
    }

    // Weight field (prefer "used" or "actual")
    if (/weight.*used|actual.*weight|^weight$/i.test(lower) && !mapping.weightField) {
      mapping.weightField = header;
    }

    // Reps field (prefer "actual" over "plan")
    if (/^reps$|actual.*reps/i.test(lower) && !mapping.repsField) {
      mapping.repsField = header;
    }

    // RPE field (prefer "actual" over "target")
    if (/rpe.*actual|^rpe.*\(actual\)|^rpe$/i.test(lower) && !mapping.rpeField) {
      mapping.rpeField = header;
    }

    // E1RM field
    if (/e1rm|1rm|estimated/i.test(lower) && !mapping.e1rmField) {
      mapping.e1rmField = header;
    }

    // Order field
    if (/^order$|^#$|^num/i.test(lower) && !mapping.orderField) {
      mapping.orderField = header;
    }

    // Date field
    if (/date|day|when/i.test(lower) && !mapping.dateField) {
      mapping.dateField = header;
    }
  }

  return mapping;
}

/**
 * Parse a data row into ParsedRow
 */
function parseDataRow(
  row: any,
  rowIndex: number,
  fieldMapping: FieldMapping
): ParsedRow | null {
  const exerciseName = row[fieldMapping.exerciseField];

  // Skip empty rows or rows without exercise name
  if (!exerciseName || typeof exerciseName !== 'string' || !exerciseName.trim()) {
    return null;
  }

  const parsedRow: ParsedRow = {
    rowIndex,
    exercise: exerciseName.trim(),
  };

  // Parse optional fields
  if (fieldMapping.orderField && row[fieldMapping.orderField]) {
    parsedRow.order = parseInt(row[fieldMapping.orderField], 10);
  }

  if (fieldMapping.weightField && row[fieldMapping.weightField]) {
    const weight = parseFloat(row[fieldMapping.weightField]);
    if (!isNaN(weight)) {
      parsedRow.weightUsed = weight;
    }
  }

  if (fieldMapping.repsField && row[fieldMapping.repsField]) {
    const reps = parseInt(row[fieldMapping.repsField], 10);
    if (!isNaN(reps)) {
      parsedRow.reps = reps;
    }
  }

  if (fieldMapping.rpeField && row[fieldMapping.rpeField]) {
    const rpe = parseFloat(row[fieldMapping.rpeField]);
    if (!isNaN(rpe)) {
      parsedRow.rpeActual = rpe;
    }
  }

  if (fieldMapping.e1rmField && row[fieldMapping.e1rmField]) {
    const e1rm = parseFloat(row[fieldMapping.e1rmField]);
    if (!isNaN(e1rm)) {
      parsedRow.e1rm = e1rm;
    }
  }

  return parsedRow;
}

export class CSVParser implements Parser {
  async canParse(file: File): Promise<boolean> {
    return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  }

  async parse(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve, reject) => {
      const errors: ImportError[] = [];
      const warnings: ImportWarning[] = [];
      const sections: WorkoutSection[] = [];
      let currentSection: WorkoutSection | null = null;
      let fieldMapping: FieldMapping | null = null;
      let headers: string[] = [];
      let totalRows = 0;
      let validRows = 0;

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep as strings for better control
        complete: (results) => {
          // Get headers from first row
          if (results.meta.fields) {
            headers = results.meta.fields;
            fieldMapping = detectFieldMapping(headers);

            if (!fieldMapping.exerciseField) {
              errors.push({
                type: 'missing_field',
                message: 'Could not detect exercise name column. Expected headers like "Exercise", "Movement", or "Lift".',
              });
              return resolve({
                format: 'csv',
                sections: [],
                fieldMapping: fieldMapping!,
                errors,
                warnings,
                totalRows: 0,
                validRows: 0,
              });
            }
          }

          // Process rows
          results.data.forEach((row: any, index: number) => {
            totalRows++;

            // Check if this is a section header
            const sectionCheck = isSectionHeader(row);
            if (sectionCheck.isHeader) {
              // Save previous section
              if (currentSection && currentSection.rows.length > 0) {
                sections.push(currentSection);
              }

              // Start new section
              currentSection = {
                sectionHeader: Object.values(row)[0] as string,
                weekNumber: sectionCheck.weekNumber!,
                dayName: sectionCheck.dayName!,
                rows: [],
              };
              return;
            }

            // Parse data row
            if (fieldMapping) {
              const parsedRow = parseDataRow(row, index, fieldMapping);
              if (parsedRow) {
                if (currentSection) {
                  currentSection.rows.push(parsedRow);
                } else {
                  // Create default section if no header found
                  if (!currentSection) {
                    currentSection = {
                      sectionHeader: 'Workout',
                      weekNumber: 1,
                      dayName: 'Monday',
                      rows: [],
                    };
                    warnings.push({
                      type: 'assumed_value',
                      message: 'No week/day headers found. Assuming Week 1 - Monday.',
                    });
                  }
                  currentSection.rows.push(parsedRow);
                }
                validRows++;
              }
            }
          });

          // Add final section
          if (currentSection && currentSection.rows.length > 0) {
            sections.push(currentSection);
          }

          // Add warnings for missing data
          if (sections.length === 0) {
            errors.push({
              type: 'parse',
              message: 'No workout data found in CSV file.',
            });
          }

          resolve({
            format: 'csv',
            sections,
            fieldMapping: fieldMapping!,
            errors,
            warnings,
            totalRows,
            validRows,
          });
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }
}
