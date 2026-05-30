/**
 * Timezone-safe date utilities for YYYY-MM-DD strings.
 *
 * All trade dates in this app originate from Zerodha (NSE/BSE, IST).
 * new Date('YYYY-MM-DD') parses as UTC midnight per ECMAScript spec,
 * which shifts to the previous day in timezones behind UTC.
 * Appending 'T00:00:00' forces local-time interpretation.
 */

/**
 * Parse a YYYY-MM-DD date string as local midnight.
 * Avoids the UTC-midnight interpretation of new Date('YYYY-MM-DD').
 */
export function parseLocalDate(isoDate: string): Date {
  return new Date(isoDate + 'T00:00:00')
}

/**
 * Calculate the number of calendar days between two ISO date strings.
 * Uses local-time parsing to avoid timezone shift.
 */
export function dateDiffDays(from: string, to: string): number {
  const d1 = parseLocalDate(from)
  const d2 = parseLocalDate(to)
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}
