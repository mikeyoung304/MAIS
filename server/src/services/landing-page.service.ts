/**
 * Landing Page Service - Visual Editor Draft Management
 *
 * Manages draft state for landing page configuration in the visual editor.
 * Follows the same patterns as PackageDraftService for consistency.
 *
 * Key Concepts:
 * - Autosave: Changes save to draft field (2s debounce on client)
 * - Publish: Copies draft to published, clears draft
 * - Discard: Clears draft, keeps published
 *
 * ARCHITECTURE NOTE (TODO-241):
 * This service layer was added for consistency with other features
 * (booking, catalog, scheduling). Business logic includes:
 * - Input sanitization (XSS prevention)
 * - Image URL validation (protocol validation)
 * - Audit logging
 *
 * The repository handles data persistence and transaction management.
 */

import type { LandingPageConfig } from '@macon/contracts';
import type {
  PrismaTenantRepository,
  LandingPageDraftWrapper,
} from '../adapters/prisma/tenant.repository';
import { sanitizeObject } from '../lib/sanitization';
import { logger } from '../lib/core/logger';

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

  /**
   * Save draft landing page configuration (auto-save target)
   *
   * Called by the visual editor with 2s debounce.
   * Applies sanitization to prevent XSS attacks.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param config - Draft configuration to save
   * @returns Save result with timestamp
   */
  async saveDraft(tenantId: string, config: LandingPageConfig): Promise<SaveDraftResult> {
    // Sanitize all text fields (XSS prevention)
    // Note: URL fields are preserved as-is (validated by SafeUrlSchema in contracts)
    const sanitizedConfig = sanitizeObject(config, { allowHtml: [] });

    // Repository handles:
    // - Image URL validation (protocol check - defense in depth)
    // - Transaction management (ACID guarantees)
    const result = await this.tenantRepo.saveLandingPageDraft(tenantId, sanitizedConfig);

    logger.info(
      {
        action: 'landing_page_draft_saved',
        tenantId,
      },
      'Landing page draft saved'
    );

    return result;
  }

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

  /**
   * Update landing page configuration (legacy method)
   *
   * Full configuration update (replaces entire config).
   * Used by non-draft update endpoint.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param config - Landing page configuration
   * @returns Updated configuration
   */
  async updateConfig(tenantId: string, config: LandingPageConfig): Promise<any> {
    // Sanitize all text fields (XSS prevention)
    const sanitizedConfig = sanitizeObject(config, { allowHtml: [] });

    const result = await this.tenantRepo.updateLandingPageConfig(tenantId, sanitizedConfig);

    logger.info(
      {
        action: 'landing_page_config_updated',
        tenantId,
      },
      'Landing page configuration updated'
    );

    return result;
  }

  /**
   * Toggle a specific section in landing page configuration
   *
   * Partial update - only affects the specified section's enabled state.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param section - Section name to toggle
   * @param enabled - Whether section should be enabled
   * @returns Updated configuration
   */
  async toggleSection(tenantId: string, section: string, enabled: boolean): Promise<any> {
    const result = await this.tenantRepo.toggleLandingPageSection(tenantId, section, enabled);

    logger.info(
      {
        action: 'landing_page_section_toggled',
        tenantId,
        section,
        enabled,
      },
      `Landing page section ${section} toggled to ${enabled}`
    );

    return result;
  }
}
