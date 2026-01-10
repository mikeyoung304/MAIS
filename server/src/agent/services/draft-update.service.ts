/**
 * Draft Update Service
 *
 * Shared service for updating tenant landing page draft configuration.
 * Consolidates logic used by both onboarding and storefront tools to prevent
 * divergence (DHH's "Convention over Configuration" principle).
 *
 * P0-FIX: All operations write to `landingPageConfigDraft` (NOT `landingPageConfig`).
 * The preview system reads from draft, so this ensures changes appear in preview.
 *
 * Concurrency: Uses PostgreSQL advisory locks for TOCTOU prevention.
 */

import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { hashTenantStorefront } from '../../lib/advisory-locks';
import { getDraftConfigWithSlug } from '../tools/utils';
import { ResourceNotFoundError } from '../errors';
import type { LandingPageConfig, PagesConfig, Section } from '@macon/contracts';
import { logger } from '../../lib/core/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction configuration for storefront operations
 * Shared across all draft update operations for consistency
 */
export const STOREFRONT_TRANSACTION_CONFIG = {
  timeout: 5000,
  isolationLevel: 'ReadCommitted' as const,
};

/**
 * Result from hero section update
 */
export interface DraftUpdateResult {
  action: 'created' | 'updated';
  updatedFields: string[];
  previewUrl?: string;
  hasDraft: true;
}

/**
 * Result from branding update (applies immediately, not part of draft)
 */
export interface BrandingUpdateResult {
  updatedFields: string[];
}

// ============================================================================
// Service Implementation
// ============================================================================

export class DraftUpdateService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Update hero section in draft config
   * Used by both onboarding and storefront tools
   *
   * P0-FIX: Writes to landingPageConfigDraft (NOT landingPageConfig)
   * P1-FIX: Uses advisory lock to prevent TOCTOU race conditions
   *
   * @param tenantId - Tenant ID
   * @param updates - Hero section updates (headline, tagline, heroImageUrl)
   * @returns Update result with preview URL and hasDraft flag
   */
  async updateHeroSection(
    tenantId: string,
    updates: {
      headline?: string;
      tagline?: string;
      heroImageUrl?: string;
    }
  ): Promise<DraftUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      // P1-FIX: Acquire advisory lock to prevent concurrent modifications
      const lockId = hashTenantStorefront(tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // P0-FIX: Get DRAFT config (not live) using shared utility
      const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);

      // Find or create home page
      const homePage = pages.home || { enabled: true, sections: [] };
      const sections = [...(homePage.sections || [])];

      // Find hero section
      const heroIndex = sections.findIndex((s) => s.type === 'hero');
      const updatedFields: string[] = [];

      if (heroIndex >= 0) {
        // Update existing hero section
        const currentHero = sections[heroIndex];
        sections[heroIndex] = {
          ...currentHero,
          ...(updates.headline && { headline: updates.headline }),
          ...(updates.tagline && { subheadline: updates.tagline }),
          ...(updates.heroImageUrl && { backgroundImageUrl: updates.heroImageUrl }),
        } as Section;
      } else {
        // Create hero section if it doesn't exist
        sections.unshift({
          id: 'home-hero-main',
          type: 'hero',
          headline: updates.headline || '[Hero Headline]',
          subheadline: updates.tagline || '[Hero Subheadline]',
          ctaText: '[CTA Button Text]',
          ...(updates.heroImageUrl && { backgroundImageUrl: updates.heroImageUrl }),
        } as Section);
      }

      // Track what was updated
      if (updates.headline) updatedFields.push('headline');
      if (updates.tagline) updatedFields.push('tagline');
      if (updates.heroImageUrl) updatedFields.push('heroImageUrl');

      // P0-FIX: Write to DRAFT config (not live)
      const updatedConfig: LandingPageConfig = {
        pages: {
          ...pages,
          home: { ...homePage, sections },
        } as PagesConfig,
      };

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          landingPageConfigDraft: updatedConfig as unknown as Prisma.JsonObject,
        },
      });

      logger.info(
        { tenantId, updatedFields, source: 'DraftUpdateService' },
        'Hero section updated in draft'
      );

      return {
        action: heroIndex >= 0 ? 'updated' : 'created',
        updatedFields,
        previewUrl: slug ? `/t/${slug}?preview=draft` : undefined,
        hasDraft: true,
      };
    }, STOREFRONT_TRANSACTION_CONFIG);
  }

  /**
   * Update branding fields (NOT part of draft system - applies immediately)
   *
   * Branding fields like primaryColor and brandVoice apply to the tenant directly,
   * not through the draft system. This is intentional - branding changes are
   * site-wide and not page-specific.
   *
   * @param tenantId - Tenant ID
   * @param updates - Branding updates (primaryColor, brandVoice)
   * @returns List of fields that were updated
   */
  async updateBranding(
    tenantId: string,
    updates: {
      primaryColor?: string;
      brandVoice?: string;
    }
  ): Promise<BrandingUpdateResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { branding: true },
    });

    if (!tenant) {
      throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
    }

    const brandingUpdates: Prisma.TenantUpdateInput = {};
    const updatedFields: string[] = [];

    if (updates.primaryColor) {
      brandingUpdates.primaryColor = updates.primaryColor;
      updatedFields.push('primaryColor');
    }

    if (updates.brandVoice) {
      const currentBranding = (tenant.branding as Record<string, unknown>) || {};
      brandingUpdates.branding = {
        ...currentBranding,
        voice: updates.brandVoice,
      } as Prisma.JsonObject;
      updatedFields.push('brandVoice');
    }

    if (Object.keys(brandingUpdates).length > 0) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: brandingUpdates,
      });

      logger.info({ tenantId, updatedFields, source: 'DraftUpdateService' }, 'Branding updated');
    }

    return { updatedFields };
  }
}

/**
 * Factory function for DI in tests
 */
export function createDraftUpdateService(prisma: PrismaClient): DraftUpdateService {
  return new DraftUpdateService(prisma);
}
