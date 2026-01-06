/**
 * Formatting Utilities
 *
 * Shared formatting functions for the storefront.
 */

/**
 * Format price from cents to dollars
 *
 * Uses Intl.NumberFormat for consistent currency formatting.
 *
 * @param cents - Price in cents (e.g., 9999 = $99.99)
 * @returns Formatted currency string (e.g., "$100")
 *
 * @example
 * formatPrice(9999)  // "$100"
 * formatPrice(15000) // "$150"
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Format price from cents to dollars with decimals
 *
 * Uses Intl.NumberFormat for consistent currency formatting.
 * Shows cents when non-zero (e.g., $99.50)
 *
 * @param cents - Price in cents (e.g., 9950 = $99.50)
 * @returns Formatted currency string (e.g., "$99.50")
 */
export function formatPriceWithCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format time from 24-hour format (HH:MM) to 12-hour format (h:MM AM/PM)
 *
 * @param time - Time in 24-hour format (e.g., "14:30")
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 *
 * @example
 * formatTime("09:00")  // "9:00 AM"
 * formatTime("14:30")  // "2:30 PM"
 * formatTime("00:00")  // "12:00 AM"
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format duration from minutes to human-readable string
 *
 * @param minutes - Duration in minutes
 * @returns Human-readable duration (e.g., "1h 30min")
 *
 * @example
 * formatDuration(30)   // "30min"
 * formatDuration(60)   // "1h"
 * formatDuration(90)   // "1h 30min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}
