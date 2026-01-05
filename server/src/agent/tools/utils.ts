/**
 * Agent Tool Utilities
 *
 * Common helper functions for agent tools to reduce duplication.
 * DRY implementations of error handling, date formatting, price formatting,
 * and landing page draft operations.
 */

import type { PrismaClient } from '../../generated/prisma';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { type PagesConfig, type LandingPageConfig, DEFAULT_PAGES_CONFIG } from '@macon/contracts';
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

// ============================================================================
// Landing Page Draft Helpers (used by storefront tools/executors)
// ============================================================================

/**
 * Result from getDraftConfig
 */
export interface DraftConfigResult {
  pages: PagesConfig;
  hasDraft: boolean;
}

/**
 * Result from getDraftConfigWithSlug
 * Combined result to avoid N+1 queries when both config and slug are needed
 */
export interface DraftConfigWithSlugResult extends DraftConfigResult {
  slug: string | null;
}

/**
 * Get or initialize draft config from tenant
 * Uses existing draft if available, otherwise copies from live config
 *
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID
 * @returns Current pages config and whether a draft exists
 * @throws Error if tenant not found
 */
export async function getDraftConfig(
  prisma: PrismaClient,
  tenantId: string
): Promise<DraftConfigResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { landingPageConfig: true, landingPageConfigDraft: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // If draft exists, use it
  if (tenant.landingPageConfigDraft) {
    const draft = tenant.landingPageConfigDraft as unknown as LandingPageConfig;
    return {
      pages: draft.pages || DEFAULT_PAGES_CONFIG,
      hasDraft: true,
    };
  }

  // Otherwise, initialize from live config or defaults
  const live = tenant.landingPageConfig as unknown as LandingPageConfig | null;
  return {
    pages: live?.pages || DEFAULT_PAGES_CONFIG,
    hasDraft: false,
  };
}

/**
 * Get tenant slug for preview URL
 *
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID
 * @returns Tenant slug or null if not found
 */
export async function getTenantSlug(
  prisma: PrismaClient,
  tenantId: string
): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  return tenant?.slug ?? null;
}

/**
 * Get draft config AND slug in a single query
 * Use this when both config and slug are needed to avoid N+1 queries
 *
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID
 * @returns Combined draft config result with slug
 * @throws Error if tenant not found
 */
export async function getDraftConfigWithSlug(
  prisma: PrismaClient,
  tenantId: string
): Promise<DraftConfigWithSlugResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      landingPageConfig: true,
      landingPageConfigDraft: true,
      slug: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // If draft exists, use it
  if (tenant.landingPageConfigDraft) {
    const draft = tenant.landingPageConfigDraft as unknown as LandingPageConfig;
    return {
      pages: draft.pages || DEFAULT_PAGES_CONFIG,
      hasDraft: true,
      slug: tenant.slug,
    };
  }

  // Otherwise, initialize from live config or defaults
  const live = tenant.landingPageConfig as unknown as LandingPageConfig | null;
  return {
    pages: live?.pages || DEFAULT_PAGES_CONFIG,
    hasDraft: false,
    slug: tenant.slug,
  };
}
