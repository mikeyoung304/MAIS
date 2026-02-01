/**
 * Landing Page Service - Unified Landing Page Operations
 *
 * This service is the SINGLE SOURCE OF TRUTH for all landing page operations.
 * It handles both draft systems:
 *
 * 1. **Build Mode (AI Tools)**: Uses separate `landingPageConfigDraft` column
 * 2. **Visual Editor (REST API)**: Uses wrapper format in `landingPageConfig`
 *
 * Key Concepts:
 * - Autosave: Changes save to draft field (2s debounce on client)
 * - Publish: Copies draft to published, clears draft
 * - Discard: Clears draft, keeps published
 *
 * ARCHITECTURE NOTE (TODO-704):
 * This service was extended to consolidate ALL landing page access patterns.
 * Previously, there were 4 different access paths with incompatible formats.
 * Now all AI tools, REST API, and executors use this service.
 *
 * Business logic includes:
 * - Input sanitization (XSS prevention)
 * - Image URL validation (protocol validation)
 * - Audit logging
 * - Format translation between systems
 *
 * The repository handles data persistence and transaction management.
 */

import type { LandingPageConfig } from '@macon/contracts';
import { LandingPageConfigSchema } from '@macon/contracts';
import type {
  PrismaTenantRepository,
  LandingPageDraftWrapper,
} from '../adapters/prisma/tenant.repository';
import { sanitizeObject } from '../lib/sanitization';
import { logger } from '../lib/core/logger';
import { NotFoundError } from '../lib/errors';
import { createPublishedWrapper, countSectionsInConfig } from '../lib/landing-page-utils';

/**
 * Service result types
 *
 * API RESPONSE DESIGN (TODO-244):
 * Mutation endpoints return minimal "operation result" objects rather than
 * the full LandingPageDraftWrapper. This is intentional:
 *
 * - GET /draft → Full wrapper (for initial load)
 * - PUT /draft → { success, draftUpdatedAt } (just confirmation)
 * - POST /publish → { success, publishedAt } (just confirmation)
 * - DELETE /draft → { success } (just confirmation)
 *
 * Rationale:
 * 1. Auto-save happens every 2 seconds - clients already have local state
 * 2. Smaller payloads = faster response times for frequent saves
 * 3. Client refetches full state on page load, not after each save
 *
 * If clients need full state after mutation, they can call GET /draft.
 */
export interface SaveDraftResult {
  success: boolean;
  draftUpdatedAt: string;
}

export interface PublishResult {
  success: boolean;
  publishedAt: string;
}

export interface DiscardResult {
  success: boolean;
}

/**
 * Result from publishBuildModeDraft
 */
export interface BuildModePublishResult {
  action: 'published';
  previewUrl?: string;
  note: string;
  pageCount: number;
  totalSections: number;
}

/**
 * Result from discardBuildModeDraft
 */
export interface BuildModeDiscardResult {
  action: 'discarded';
  note: string;
}

/**
 * Landing Page Service
 *
 * Provides business logic layer between routes and repository.
 * Handles sanitization, validation, and audit logging.
 */
export class LandingPageService {
  constructor(private readonly tenantRepo: PrismaTenantRepository) {}

  /**
   * Get draft and published landing page configuration
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Draft wrapper with draft/published configs
   */
  async getDraft(tenantId: string): Promise<LandingPageDraftWrapper> {
    return this.tenantRepo.getLandingPageDraft(tenantId);
  }

  // NOTE: saveDraft() method deleted - Visual Editor autosave is deprecated.
  // All storefront editing now happens through AI agent chatbot (Build Mode).
  // See: 2026-02-01 realtime preview plan.

  /**
   * Publish draft to live landing page
   *
   * Atomically copies draft to published, clears draft.
   * Uses transaction for all-or-nothing behavior.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Publish result with timestamp
   */
  async publish(tenantId: string): Promise<PublishResult> {
    const result = await this.tenantRepo.publishLandingPageDraft(tenantId);

    logger.info(
      {
        action: 'landing_page_published',
        tenantId,
      },
      'Landing page published'
    );

    return result;
  }

  /**
   * Discard draft and revert to published configuration
   *
   * Clears draft field, preserves published configuration.
   * Used when tenant wants to abandon changes.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Discard result
   */
  async discardDraft(tenantId: string): Promise<DiscardResult> {
    const result = await this.tenantRepo.discardLandingPageDraft(tenantId);

    logger.info(
      {
        action: 'landing_page_draft_discarded',
        tenantId,
      },
      'Landing page draft discarded'
    );

    return result;
  }

  /**
   * Get current landing page configuration (legacy method)
   *
   * Used by non-draft endpoints that need the full config.
   * Consider migrating to getDraft() for new code.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Landing page config or null if not set
   */
  async getConfig(tenantId: string): Promise<any | null> {
    return this.tenantRepo.getLandingPageConfig(tenantId);
  }

  // NOTE: updateConfig() and toggleSection() methods deleted - Visual Editor is deprecated.
  // All storefront editing now happens through AI agent chatbot (Build Mode).
  // See: 2026-02-01 realtime preview plan.

  // ============================================================================
  // Build Mode Methods (AI Tools / Separate Column System)
  // ============================================================================
  // These methods use the landingPageConfigDraft column for AI tool operations.
  // The publish method writes to the wrapper format in landingPageConfig for
  // compatibility with the public API.
  //
  // NOTE: getDraftConfig() and getDraftConfigWithSlug() in agent/tools/utils.ts
  // are the canonical implementations for reading draft state. They accept
  // PrismaClient directly to support transaction patterns (TOCTOU prevention).
  // Do NOT duplicate those methods here.

  /**
   * Save draft for Build Mode (AI tools)
   *
   * Writes to the separate landingPageConfigDraft column.
   * Used by AI tools during storefront editing.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param config - Landing page configuration to save as draft
   * @throws NotFoundError if tenant not found
   */
  async saveBuildModeDraft(tenantId: string, config: LandingPageConfig): Promise<void> {
    // Sanitize all text fields (XSS prevention)
    const sanitizedConfig = sanitizeObject(config, { allowHtml: [] });

    await this.tenantRepo.update(tenantId, {
      landingPageConfigDraft: sanitizedConfig,
    });

    logger.info(
      {
        action: 'build_mode_draft_saved',
        tenantId,
      },
      'Build Mode draft saved to landingPageConfigDraft'
    );
  }

  /**
   * Publish Build Mode draft to live
   *
   * Copies from landingPageConfigDraft to landingPageConfig wrapper format.
   * This ensures compatibility with the public API's extractPublishedLandingPage.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Publish result with metadata
   * @throws NotFoundError if tenant not found
   * @throws Error if no draft to publish
   */
  async publishBuildModeDraft(tenantId: string): Promise<BuildModePublishResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (!tenant.landingPageConfigDraft) {
      throw new Error('No draft changes to publish.');
    }

    // Count sections for audit log (shared utility from lib/landing-page-utils.ts)
    const { totalSections, pageCount } = countSectionsInConfig(tenant.landingPageConfigDraft);

    // Create wrapper format (shared utility from lib/landing-page-utils.ts)
    // The public API's extractPublishedLandingPage() looks for landingPageConfig.published
    // See: #697 - Dual draft system publish mismatch fix
    const publishedWrapper = createPublishedWrapper(tenant.landingPageConfigDraft);

    // Update both fields atomically
    await this.tenantRepo.update(tenantId, {
      landingPageConfig: publishedWrapper,
      landingPageConfigDraft: null, // Clear the draft
    });

    logger.info(
      {
        tenantId,
        action: 'build_mode_publish',
        pageCount,
        totalSections,
      },
      'Build Mode draft published to live storefront'
    );

    return {
      action: 'published',
      previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
      note: 'Changes are now live.',
      pageCount,
      totalSections,
    };
  }

  /**
   * Discard Build Mode draft
   *
   * Clears the landingPageConfigDraft column without affecting live config.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Discard result
   * @throws NotFoundError if tenant not found
   * @throws Error if no draft to discard
   */
  async discardBuildModeDraft(tenantId: string): Promise<BuildModeDiscardResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (!tenant.landingPageConfigDraft) {
      throw new Error('No draft changes to discard.');
    }

    // Clear the draft
    await this.tenantRepo.update(tenantId, {
      landingPageConfigDraft: null,
    });

    logger.info(
      {
        tenantId,
        action: 'build_mode_discard',
      },
      'Build Mode draft discarded'
    );

    return {
      action: 'discarded',
      note: 'Draft changes discarded. Reverting to published content.',
    };
  }

  /**
   * Get published landing page configuration
   *
   * Returns the published/live configuration that visitors see.
   * Extracts from the wrapper format in landingPageConfig.
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Published landing page config or null if not published
   */
  async getPublished(tenantId: string): Promise<LandingPageConfig | null> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    if (!tenant.landingPageConfig) {
      return null;
    }

    // Handle both wrapper format and direct config format for backward compatibility
    const config = tenant.landingPageConfig as unknown as
      | LandingPageConfig
      | { published?: LandingPageConfig };

    // Check if it's wrapper format (has published property)
    if ('published' in config && config.published) {
      const result = LandingPageConfigSchema.safeParse(config.published);
      if (result.success) {
        return result.data;
      }
      logger.warn({ tenantId }, 'Invalid published config in wrapper format');
      return null;
    }

    // Direct config format (legacy)
    const result = LandingPageConfigSchema.safeParse(config);
    if (result.success) {
      return result.data;
    }

    logger.warn({ tenantId }, 'Invalid landing page config format');
    return null;
  }

  /**
   * Get tenant slug
   *
   * Helper method for preview URL generation.
   *
   * @param tenantId - Tenant ID
   * @returns Tenant slug or null if not found
   */
  async getTenantSlug(tenantId: string): Promise<string | null> {
    const tenant = await this.tenantRepo.findById(tenantId);
    return tenant?.slug ?? null;
  }
}
