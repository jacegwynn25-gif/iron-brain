import * as XLSX from 'xlsx';
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
function isSectionHeader(row: any[]): { isHeader: boolean; weekNumber?: number; dayName?: string } {
  if (row.length > 0 && typeof row[0] === 'string') {
    const match = row[0].match(SECTION_HEADER_REGEX);
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
 * Detect field mapping from Excel headers
 */
function detectFieldMapping(headers: any[]): FieldMapping {
  const mapping: FieldMapping = {
    exerciseField: '',
  };

  headers.forEach((header, index) => {
    if (!header || typeof header !== 'string') return;
    const lower = header.toLowerCase();

    // Exercise field (required)
    if (/exercise|movement|lift|name/i.test(lower) && !mapping.exerciseField) {
      mapping.exerciseField = index.toString();
    }

    // Weight field (prefer "used" or "actual")
    if (/weight.*used|actual.*weight|^weight$/i.test(lower) && !mapping.weightField) {
      mapping.weightField = index.toString();
    }

    // Reps field (prefer "actual" over "plan")
    if (/^reps$|actual.*reps/i.test(lower) && !mapping.repsField) {
      mapping.repsField = index.toString();
    }

    // RPE field (prefer "actual" over "target")
    if (/rpe.*actual|^rpe.*\(actual\)|^rpe$/i.test(lower) && !mapping.rpeField) {
      mapping.rpeField = index.toString();
    }

    // E1RM field
    if (/e1rm|1rm|estimated/i.test(lower) && !mapping.e1rmField) {
      mapping.e1rmField = index.toString();
    }

    // Order field
    if (/^order$|^#$|^num/i.test(lower) && !mapping.orderField) {
      mapping.orderField = index.toString();
    }

    // Date field
    if (/date|day|when/i.test(lower) && !mapping.dateField) {
      mapping.dateField = index.toString();
    }
  });

  return mapping;
}

/**
 * Parse a data row into ParsedRow
 */
function parseDataRow(
  row: any[],
  rowIndex: number,
  fieldMapping: FieldMapping
): ParsedRow | null {
  const exerciseIndex = parseInt(fieldMapping.exerciseField, 10);
  const exerciseName = row[exerciseIndex];

  // Skip empty rows or rows without exercise name
  if (!exerciseName || typeof exerciseName !== 'string' || !exerciseName.trim()) {
    return null;
  }

  const parsedRow: ParsedRow = {
    rowIndex,
    exercise: exerciseName.trim(),
  };

  // Parse optional fields
  if (fieldMapping.orderField) {
    const orderIndex = parseInt(fieldMapping.orderField, 10);
    if (row[orderIndex] !== undefined) {
      const order = typeof row[orderIndex] === 'number' ? row[orderIndex] : parseInt(row[orderIndex], 10);
      if (!isNaN(order)) {
        parsedRow.order = order;
      }
    }
  }

  if (fieldMapping.weightField) {
    const weightIndex = parseInt(fieldMapping.weightField, 10);
    if (row[weightIndex] !== undefined) {
      const weight = typeof row[weightIndex] === 'number' ? row[weightIndex] : parseFloat(row[weightIndex]);
      if (!isNaN(weight)) {
        parsedRow.weightUsed = weight;
      }
    }
  }

  if (fieldMapping.repsField) {
    const repsIndex = parseInt(fieldMapping.repsField, 10);
    if (row[repsIndex] !== undefined) {
      const reps = typeof row[repsIndex] === 'number' ? row[repsIndex] : parseInt(row[repsIndex], 10);
      if (!isNaN(reps)) {
        parsedRow.reps = reps;
      }
    }
  }

  if (fieldMapping.rpeField) {
    const rpeIndex = parseInt(fieldMapping.rpeField, 10);
    if (row[rpeIndex] !== undefined) {
      const rpe = typeof row[rpeIndex] === 'number' ? row[rpeIndex] : parseFloat(row[rpeIndex]);
      if (!isNaN(rpe)) {
        parsedRow.rpeActual = rpe;
      }
    }
  }

  if (fieldMapping.e1rmField) {
    const e1rmIndex = parseInt(fieldMapping.e1rmField, 10);
    if (row[e1rmIndex] !== undefined) {
      const e1rm = typeof row[e1rmIndex] === 'number' ? row[e1rmIndex] : parseFloat(row[e1rmIndex]);
      if (!isNaN(e1rm)) {
        parsedRow.e1rm = e1rm;
      }
    }
  }

  return parsedRow;
}

export class ExcelParser implements Parser {
  async canParse(file: File): Promise<boolean> {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  }

  async parse(file: File): Promise<ParsedFileResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

          // Find the first sheet with data
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            return resolve({
              format: 'excel',
              sections: [],
              fieldMapping: { exerciseField: '' },
              errors: [{ type: 'parse', message: 'No sheets found in Excel file.' }],
              warnings: [],
              totalRows: 0,
              validRows: 0,
            });
          }

          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const errors: ImportError[] = [];
          const warnings: ImportWarning[] = [];
          const sections: WorkoutSection[] = [];
          let currentSection: WorkoutSection | null = null;
          let fieldMapping: FieldMapping | null = null;
          let headers: any[] = [];
          let totalRows = 0;
          let validRows = 0;
          let headerRowIndex = -1;

          // Find header row (first non-empty row that's not a section header)
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length > 0) {
              const sectionCheck = isSectionHeader(row);
              if (!sectionCheck.isHeader) {
                headers = row;
                headerRowIndex = i;
                fieldMapping = detectFieldMapping(headers);
                break;
              }
            }
          }

          if (!fieldMapping || !fieldMapping.exerciseField) {
            return resolve({
              format: 'excel',
              sections: [],
              fieldMapping: fieldMapping || { exerciseField: '' },
              errors: [
                {
                  type: 'missing_field',
                  message: 'Could not detect exercise name column. Expected headers like "Exercise", "Movement", or "Lift".',
                },
              ],
              warnings,
              totalRows: 0,
              validRows: 0,
            });
          }

          // Process rows starting after header
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

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
                sectionHeader: row[0] as string,
                weekNumber: sectionCheck.weekNumber!,
                dayName: sectionCheck.dayName!,
                rows: [],
              };
              continue;
            }

            // Parse data row
            const parsedRow = parseDataRow(row, i, fieldMapping);
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

          // Add final section
          if (currentSection && currentSection.rows.length > 0) {
            sections.push(currentSection);
          }

          // Add warnings for missing data
          if (sections.length === 0) {
            errors.push({
              type: 'parse',
              message: 'No workout data found in Excel file.',
            });
          }

          resolve({
            format: 'excel',
            sections,
            fieldMapping,
            errors,
            warnings,
            totalRows,
            validRows,
          });
        } catch (error: any) {
          reject(new Error(`Excel parsing failed: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read Excel file.'));
      };

      reader.readAsBinaryString(file);
    });
  }
}
