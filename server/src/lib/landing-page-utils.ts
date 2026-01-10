/**
 * Landing Page Utilities - Shared Functions for Draft/Publish Operations
 *
 * This module provides the SINGLE SOURCE OF TRUTH for landing page operations
 * that are shared between the service layer and agent executors.
 *
 * Key Functions:
 * - createPublishedWrapper: Creates the wrapper format for published config
 * - countSectionsInConfig: Counts sections across all pages for audit logging
 *
 * ARCHITECTURE NOTE (TODO-725):
 * These utilities prevent duplication between:
 * - LandingPageService.publishBuildModeDraft()
 * - storefront-executors.ts publish_draft executor
 *
 * Both now import from here to ensure consistent behavior.
 */

import type { LandingPageConfig } from '@macon/contracts';

/**
 * Published wrapper format for landingPageConfig field
 *
 * This format is expected by the public API's extractPublishedLandingPage().
 * The wrapper contains both draft and published configs, along with timestamps.
 *
 * See: #697 - Dual draft system publish mismatch fix
 */
export interface PublishedWrapper {
  /** Draft config - null when publishing (draft moves to published) */
  draft: null;
  /** Draft timestamp - null when publishing */
  draftUpdatedAt: null;
  /** The published landing page configuration */
  published: unknown;
  /** ISO timestamp when content was published */
  publishedAt: string;
}

/**
 * Result of counting sections in a config
 */
export interface SectionCountResult {
  /** Total number of sections across all pages */
  totalSections: number;
  /** Number of pages in the config */
  pageCount: number;
}

/**
 * Create the published wrapper format for storing in landingPageConfig
 *
 * The public API (findBySlugPublic) expects the wrapper format:
 * `{ draft, draftUpdatedAt, published, publishedAt }`
 *
 * When publishing, the draft config becomes published and draft is cleared.
 *
 * @param draftConfig - The draft configuration to publish
 * @returns Wrapper object ready for storing in landingPageConfig
 *
 * @example
 * ```typescript
 * const wrapper = createPublishedWrapper(tenant.landingPageConfigDraft);
 * await prisma.tenant.update({
 *   where: { id: tenantId },
 *   data: {
 *     landingPageConfig: wrapper,
 *     landingPageConfigDraft: null,
 *   },
 * });
 * ```
 */
export function createPublishedWrapper(draftConfig: unknown): PublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Count sections and pages in a landing page config
 *
 * Used for audit logging when publishing changes.
 * Handles the nested pages structure safely.
 *
 * @param config - The landing page config (typically from draft)
 * @returns Object with totalSections and pageCount
 *
 * @example
 * ```typescript
 * const { totalSections, pageCount } = countSectionsInConfig(draftConfig);
 * logger.info({ tenantId, pageCount, totalSections }, 'Draft published');
 * ```
 */
export function countSectionsInConfig(config: unknown): SectionCountResult {
  const typedConfig = config as
    | LandingPageConfig
    | { pages?: Record<string, { sections?: unknown[] }> }
    | null;

  if (!typedConfig || typeof typedConfig !== 'object') {
    return { totalSections: 0, pageCount: 0 };
  }

  // Check for pages structure
  const pages = 'pages' in typedConfig ? typedConfig.pages : null;

  if (!pages || typeof pages !== 'object') {
    return { totalSections: 0, pageCount: 0 };
  }

  const pageEntries = Object.values(pages);
  const pageCount = pageEntries.length;
  const totalSections = pageEntries.reduce(
    (sum, page) => sum + (Array.isArray(page?.sections) ? page.sections.length : 0),
    0
  );

  return { totalSections, pageCount };
}
