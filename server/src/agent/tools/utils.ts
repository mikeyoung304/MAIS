/**
 * Agent Tool Utilities
 *
 * Common helper functions for agent tools to reduce duplication.
 * DRY implementations of error handling, date formatting, and price formatting.
 */

import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import type { ToolError } from './types';

/**
 * Handle tool errors consistently across all tools
 *
 * @param error - The error that occurred
 * @param toolName - Name of the tool (used for logging and error code)
 * @param tenantId - Tenant ID for logging context
 * @param helpText - User-friendly help message
 * @returns Standardized ToolError object
 */
export function handleToolError(
  error: unknown,
  toolName: string,
  tenantId: string,
  helpText: string
): ToolError {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error: sanitizeError(error), tenantId }, `Error in ${toolName} tool`);
  return {
    success: false,
    error: `${helpText}: ${errorMessage}`,
    code: `${toolName.toUpperCase().replace(/-/g, '_')}_ERROR`,
  };
}

/**
 * Build a date range filter for Prisma queries
 *
 * @param fromDate - Optional start date string (YYYY-MM-DD)
 * @param toDate - Optional end date string (YYYY-MM-DD)
 * @returns Prisma-compatible date filter object
 */
export function buildDateRangeFilter(
  fromDate?: string,
  toDate?: string
): { date?: { gte?: Date; lte?: Date } } {
  if (!fromDate && !toDate) return {};
  return {
    date: {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    },
  };
}

/**
 * Format price in cents to display string
 *
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "$29.99")
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD)
 *
 * @param date - Date object to format
 * @returns ISO date string
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format price with locale-aware formatting
 *
 * @param cents - Price in cents
 * @returns Formatted price string with proper thousands separators
 */
export function formatPriceLocale(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
