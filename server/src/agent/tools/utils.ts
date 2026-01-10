/**
 * Agent Tool Utilities
 *
 * Common helper functions for agent tools to reduce duplication.
 * DRY implementations of error handling, date formatting, price formatting,
 * and landing page draft operations.
 */

import type { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import {
  isSectionWithId,
  type PagesConfig,
  type LandingPageConfig,
  DEFAULT_PAGES_CONFIG,
  LandingPageConfigSchema,
} from '@macon/contracts';
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
 * Result from validateAndExtractPages
 * Used internally to reduce duplication in getDraftConfig and getDraftConfigWithSlug
 */
interface ValidatedPagesResult {
  pages: PagesConfig;
  isValid: boolean;
}

/**
 * Validate landing page config and extract pages, falling back to defaults on failure
 *
 * DRY helper to eliminate repeated validation + fallback pattern across:
 * - getDraftConfig (draft and live config validation)
 * - getDraftConfigWithSlug (draft and live config validation)
 *
 * @param config - Raw config from database (unknown type)
 * @param tenantId - Tenant ID for logging context
 * @param label - Label for log message ('draft' or 'live')
 * @returns Validated pages config and whether validation succeeded
 */
export function validateAndExtractPages(
  config: unknown,
  tenantId: string,
  label: 'draft' | 'live'
): ValidatedPagesResult {
  const result = LandingPageConfigSchema.safeParse(config);
  if (!result.success) {
    logger.warn(
      { tenantId, errors: result.error.issues },
      `Invalid ${label} config, falling back to defaults`
    );
    return { pages: structuredClone(DEFAULT_PAGES_CONFIG), isValid: false };
  }
  return {
    pages: result.data.pages || structuredClone(DEFAULT_PAGES_CONFIG),
    isValid: true,
  };
}

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
 *
 * Includes raw configs for discovery tools that need to compute:
 * - existsInDraft / existsInLive flags (list_section_ids)
 * - isShowingDefaults flag (all discovery tools)
 *
 * TODO #718 FIX: Added rawDraftConfig and rawLiveConfig to eliminate
 * the N+1 query pattern where discovery tools called getDraftConfigWithSlug
 * then made a second query to fetch the same raw configs.
 */
export interface DraftConfigWithSlugResult extends DraftConfigResult {
  slug: string | null;
  /** Raw draft config (null if no draft exists) - use for existsInDraft checks */
  rawDraftConfig: LandingPageConfig | null;
  /** Raw live config (null if no live config exists) - use for existsInLive checks */
  rawLiveConfig: LandingPageConfig | null;
}

/**
 * Get or initialize draft config from tenant
 * Uses existing draft if available, otherwise copies from live config
 *
 * PERFORMANCE NOTE (TODO #710): Zod validation runs on every call (~5-30ms).
 * This is ACCEPTED LATENCY because:
 * 1. Database query dominates total latency (50-200ms typically)
 * 2. Caching would require invalidation on every draft write operation
 * 3. No cache invalidation infrastructure exists for this yet (contextCache
 *    is for AgentSessionContext, not draft configs)
 * 4. Validation ensures data integrity before AI tools receive the config
 *
 * Future optimization: If profiling shows this as a bottleneck in high-frequency
 * tool pipelines, consider:
 * - Adding validated draft cache with write-through invalidation
 * - Moving validation to write time only (store pre-validated flag)
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

  // If draft exists, validate and use it
  if (tenant.landingPageConfigDraft) {
    const validated = validateAndExtractPages(tenant.landingPageConfigDraft, tenantId, 'draft');
    return {
      pages: validated.pages,
      hasDraft: validated.isValid,
    };
  }

  // Otherwise, validate and initialize from live config or defaults
  if (tenant.landingPageConfig) {
    const validated = validateAndExtractPages(tenant.landingPageConfig, tenantId, 'live');
    return {
      pages: validated.pages,
      hasDraft: false,
    };
  }

  return {
    pages: structuredClone(DEFAULT_PAGES_CONFIG),
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
 * Prisma transaction client type (subset of PrismaClient)
 * Used to allow both PrismaClient and transaction context to be passed
 */
type PrismaTransactionClient = Pick<PrismaClient, 'tenant'>;

/**
 * Get draft config AND slug in a single query
 * Use this when both config and slug are needed to avoid N+1 queries
 *
 * P1-659 FIX: Accepts either PrismaClient or transaction client to support
 * advisory lock patterns for TOCTOU prevention on JSON field updates.
 *
 * PERFORMANCE NOTE (TODO #710): Same as getDraftConfig - Zod validation
 * runs on every call. See getDraftConfig docstring for rationale on why
 * this is accepted latency rather than cached.
 *
 * @param prisma - Prisma client or transaction client
 * @param tenantId - Tenant ID
 * @returns Combined draft config result with slug
 * @throws Error if tenant not found
 */
export async function getDraftConfigWithSlug(
  prisma: PrismaClient | PrismaTransactionClient,
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

  // Cast raw configs for discovery tools (TODO #718 fix)
  // These are passed through unchanged so tools can compute existsInDraft/existsInLive
  const rawDraftConfig = tenant.landingPageConfigDraft as unknown as LandingPageConfig | null;
  const rawLiveConfig = tenant.landingPageConfig as unknown as LandingPageConfig | null;

  // If draft exists, validate and use it
  if (tenant.landingPageConfigDraft) {
    const validated = validateAndExtractPages(tenant.landingPageConfigDraft, tenantId, 'draft');
    return {
      pages: validated.pages,
      hasDraft: validated.isValid,
      slug: tenant.slug,
      rawDraftConfig,
      rawLiveConfig,
    };
  }

  // Otherwise, validate and initialize from live config or defaults
  if (tenant.landingPageConfig) {
    const validated = validateAndExtractPages(tenant.landingPageConfig, tenantId, 'live');
    return {
      pages: validated.pages,
      hasDraft: false,
      slug: tenant.slug,
      rawDraftConfig,
      rawLiveConfig,
    };
  }

  return {
    pages: structuredClone(DEFAULT_PAGES_CONFIG),
    hasDraft: false,
    slug: tenant.slug,
    rawDraftConfig,
    rawLiveConfig,
  };
}

// ============================================================================
// Legacy Section ID Helper (DRY - used by discovery tools)
// ============================================================================

/**
 * Suffix used for sections without explicit IDs
 * Extracted as constant to prevent magic string repetition (#666)
 */
export const LEGACY_ID_SUFFIX = 'legacy';

/**
 * Generate a legacy section ID for sections without explicit IDs
 * Format: {page}-{type}-legacy (e.g., "home-hero-legacy")
 *
 * @param page - Page name (home, about, services, etc.)
 * @param type - Section type (hero, text, gallery, etc.)
 * @returns Legacy section ID string
 */
export function getLegacySectionId(page: string, type: string): string {
  return `${page}-${type}-${LEGACY_ID_SUFFIX}`;
}

// ============================================================================
// Section ID Resolution Helper (DRY - used by update, remove, reorder tools)
// ============================================================================

/**
 * Result from resolveSectionIndex
 */
export type SectionResolutionResult =
  | { success: true; index: number }
  | { success: false; error: string };

/**
 * Resolve a sectionId to its index within a page's sections array.
 * Provides helpful error messages including:
 * - Available section IDs on the target page
 * - Hints when the section exists on a different page
 *
 * DRY implementation: Used by update_page_section, remove_page_section,
 * and reorder_page_sections tools for consistent behavior.
 *
 * @param sectionId - The section ID to resolve (e.g., "home-hero-main")
 * @param pageName - The page to search in
 * @param pages - All pages config
 * @returns Success with index, or failure with descriptive error
 *
 * @example
 * ```typescript
 * const result = resolveSectionIndex('home-hero-main', 'home', pages);
 * if (!result.success) {
 *   return { success: false, error: result.error };
 * }
 * const sectionIndex = result.index;
 * ```
 */
export function resolveSectionIndex(
  sectionId: string,
  pageName: string,
  pages: PagesConfig
): SectionResolutionResult {
  const page = pages[pageName as keyof PagesConfig];
  if (!page) {
    return { success: false, error: `Page "${pageName}" not found` };
  }

  // Find section by ID using type guard (#664)
  const foundIndex = page.sections.findIndex((s) => isSectionWithId(s) && s.id === sectionId);

  if (foundIndex !== -1) {
    return { success: true, index: foundIndex };
  }

  // Section not found - provide helpful error

  // Check other pages for the section ID (common mistake)
  for (const [otherPage, otherConfig] of Object.entries(pages)) {
    if (otherPage === pageName) continue;
    const idxInOther = otherConfig.sections.findIndex(
      (s) => isSectionWithId(s) && s.id === sectionId
    );
    if (idxInOther !== -1) {
      return {
        success: false,
        error: `Section "${sectionId}" exists on page "${otherPage}", not "${pageName}". Change pageName or use the correct sectionId.`,
      };
    }
  }

  // List available IDs on this page using type guard (#664)
  const availableIds = page.sections.filter(isSectionWithId).map((s) => s.id);

  return {
    success: false,
    error: `Section "${sectionId}" not found on page "${pageName}". Available IDs: ${availableIds.join(', ') || 'none (use list_section_ids to discover)'}`,
  };
}
