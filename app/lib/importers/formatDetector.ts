import type { FileFormat } from './types';

/**
 * Detect file format based on file extension and MIME type
 */
export function detectFileFormat(file: File): FileFormat {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  // Excel formats
  if (
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  ) {
    return 'excel';
  }

  // CSV format
  if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
    return 'csv';
  }

  // JSON format
  if (fileName.endsWith('.json') || mimeType === 'application/json') {
    return 'json';
  }

  // Try to detect from content if extension is ambiguous
  return 'unknown';
}

/**
 * Validate that the file is a supported format
 */
export function isSupportedFormat(format: FileFormat): boolean {
  return format === 'csv' || format === 'excel' || format === 'json';
}

/**
 * Get human-readable format name
 */
export function getFormatName(format: FileFormat): string {
  switch (format) {
    case 'csv':
      return 'CSV';
    case 'excel':
      return 'Excel';
    case 'json':
      return 'JSON';
    default:
      return 'Unknown';
  }
}

/**
 * Get supported file extensions for file input
 */
export function getSupportedExtensions(): string {
  return '.csv,.xlsx,.xls,.json';
}
