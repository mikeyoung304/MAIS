/**
 * Shared Constants
 *
 * Common constants used across the application.
 */

/**
 * Days of the week in order (Sunday = 0, following JavaScript Date convention)
 */
export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Type for day of week index (0-6)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
