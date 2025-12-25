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
