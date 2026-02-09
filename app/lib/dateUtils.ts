/**
 * Parse a date string in "yyyy-MM-dd" format as a local date
 * Avoids timezone issues when converting between Date objects and date strings
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}
