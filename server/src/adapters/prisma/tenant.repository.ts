/**
 * Prisma repository for Tenant data access
 * Provides data layer for multi-tenant operations
 */

import { PrismaClient, Tenant } from '../../generated/prisma';
import {
  TenantPublicDtoSchema,
  ALLOWED_FONT_FAMILIES,
  SafeImageUrlSchema,
  LandingPageConfigSchema,
} from '@macon/contracts';
import type { TenantPublicDto, LandingPageConfig } from '@macon/contracts';
import { logger } from '../../lib/core/logger';
import { NotFoundError, ValidationError } from '../../lib/errors';

export interface CreateTenantInput {
  slug: string;
  name: string;
  apiKeyPublic: string;
  apiKeySecret: string;
  commissionPercent: number;
  branding?: any;
  // Optional fields for self-service signup
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
}

export interface UpdateTenantInput {
  name?: string;
  commissionPercent?: number;
  branding?: any;
  stripeAccountId?: string;
  stripeOnboarded?: boolean;
  secrets?: any;
  isActive?: boolean;
  // Password reset fields
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  // Landing page configuration
  landingPageConfig?: any;
}

/**
 * Tenant repository for CRUD operations
 * Handles multi-tenant isolation and API key lookups
 */
export class PrismaTenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find tenant by public API key
   * Used for API authentication and tenant identification
   *
   * @param apiKey - Public API key (pk_live_*)
   * @returns Tenant or null if not found
   */
  async findByApiKey(apiKey: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { apiKeyPublic: apiKey },
    });
  }

  /**
   * Find tenant by ID
   *
   * @param id - Tenant ID (CUID)
   * @returns Tenant or null if not found
   */
  async findById(id: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  /**
   * Find tenant by slug
   *
   * @param slug - URL-safe tenant identifier
   * @returns Tenant or null if not found
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  /**
   * Find tenant by email
   * Used for tenant admin authentication
   *
   * @param email - Tenant admin email
   * @returns Tenant or null if not found
   */
  async findByEmail(email: string): Promise<Tenant | null> {
    // Normalize email to lowercase for case-insensitive lookup
    return await this.prisma.tenant.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find tenant by password reset token
   * Used for password reset flow
   *
   * @param token - Password reset token
   * @returns Tenant or null if not found
   */
  async findByResetToken(token: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { passwordResetToken: token },
    });
  }

  /**
   * Create new tenant
   *
   * @param data - Tenant creation data
   * @returns Created tenant
   */
  async create(data: CreateTenantInput): Promise<Tenant> {
    return await this.prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        apiKeyPublic: data.apiKeyPublic,
        apiKeySecret: data.apiKeySecret,
        commissionPercent: data.commissionPercent,
        branding: data.branding || {},
        // Self-service signup fields
        // Normalize email to lowercase for case-insensitive uniqueness
        email: data.email?.toLowerCase(),
        passwordHash: data.passwordHash,
        emailVerified: data.emailVerified ?? false,
      },
    });
  }

  /**
   * Update tenant by ID
   *
   * @param id - Tenant ID
   * @param data - Partial tenant update data
   * @returns Updated tenant
   */
  async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  /**
   * List all tenants with optional filtering
   *
   * @param onlyActive - Filter to only active tenants
   * @returns Array of tenants
   */
  async list(onlyActive = false): Promise<Tenant[]> {
    return await this.prisma.tenant.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deactivate tenant (soft delete)
   *
   * @param id - Tenant ID
   * @returns Updated tenant
   */
  async deactivate(id: string): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get tenant statistics (booking count, package count)
   *
   * @param id - Tenant ID
   * @returns Object with counts
   */
  async getStats(id: string): Promise<{
    bookingCount: number;
    packageCount: number;
    addOnCount: number;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: true,
            packages: true,
            addOns: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${id}`);
    }

    return {
      bookingCount: tenant._count.bookings,
      packageCount: tenant._count.packages,
      addOnCount: tenant._count.addOns,
    };
  }

  /**
   * Find active tenant by slug with public fields only
   * Used for public storefront routing - returns only safe fields
   *
   * SECURITY: Only returns allowlisted fields:
   * - id, slug, name - Public identifiers
   * - apiKeyPublic - Read-only API key for X-Tenant-Key header
   * - branding - Visual customization (validated with Zod)
   *
   * @param slug - URL-safe tenant identifier
   * @returns TenantPublicDto or null if not found/inactive
   */
  async findBySlugPublic(slug: string): Promise<TenantPublicDto | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        slug,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        apiKeyPublic: true,
        branding: true,
      },
    });

    if (!tenant) {
      return null;
    }

    // Build candidate response object
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      branding: tenant.branding,
    };

    // Validate entire response with Zod schema (including branding)
    const validationResult = TenantPublicDtoSchema.safeParse(candidateDto);

    if (!validationResult.success) {
      // Log warning if validation fails (for debugging malformed database data)
      logger.warn(
        { tenantId: tenant.id, slug: tenant.slug, errorCount: validationResult.error.issues.length },
        'Invalid tenant data during public lookup'
      );

      // Return response with branding set to undefined (graceful degradation)
      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        apiKeyPublic: tenant.apiKeyPublic,
        branding: undefined,
      };
    }

    // Return validated data
    return validationResult.data;
  }

  /**
   * Get landing page configuration for tenant
   * Used by tenant admins to view current landing page setup
   *
   * @param tenantId - Tenant ID
   * @returns Landing page config or null if not set
   */
  async getLandingPageConfig(tenantId: string): Promise<any | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    return tenant?.landingPageConfig ?? null;
  }

  /**
   * Update landing page configuration for tenant
   * Used by tenant admins to configure their landing page
   *
   * @param tenantId - Tenant ID
   * @param config - Landing page configuration object
   * @returns Updated landing page config
   */
  async updateLandingPageConfig(tenantId: string, config: any): Promise<any> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: config },
      select: { landingPageConfig: true },
    });

    return tenant.landingPageConfig;
  }

  /**
   * Toggle a specific section in landing page configuration
   * Partial update - only affects the specified section's enabled state
   *
   * @param tenantId - Tenant ID
   * @param section - Section name to toggle
   * @param enabled - Whether section should be enabled
   * @returns Updated landing page config
   */
  async toggleLandingPageSection(
    tenantId: string,
    section: string,
    enabled: boolean
  ): Promise<any> {
    // Get current config
    const currentConfig = await this.getLandingPageConfig(tenantId);

    // Initialize config if it doesn't exist
    const config = currentConfig || {
      sections: {
        hero: false,
        socialProofBar: false,
        segmentSelector: true,
        about: false,
        testimonials: false,
        accommodation: false,
        gallery: false,
        faq: false,
        finalCta: false,
      },
    };

    // Update the specific section
    if (!config.sections) {
      config.sections = {};
    }
    config.sections[section] = enabled;

    // Save updated config
    return await this.updateLandingPageConfig(tenantId, config);
  }

  // ============================================================================
  // Draft System Methods
  // ============================================================================

  /**
   * Landing page config wrapper type for draft system
   */
  private getLandingPageWrapper(config: any): LandingPageDraftWrapper {
    if (!config || typeof config !== 'object') {
      return {
        draft: null,
        published: null,
        draftUpdatedAt: null,
        publishedAt: null,
      };
    }

    return {
      draft: config.draft ?? null,
      published: config.published ?? null,
      draftUpdatedAt: config.draftUpdatedAt ?? null,
      publishedAt: config.publishedAt ?? null,
    };
  }

  /**
   * Validate all image URLs in a landing page config
   * Defense-in-depth against XSS via data: or javascript: URLs
   *
   * SECURITY: Re-validates URLs even after Zod schema validation
   * to catch browser-modified payloads that bypass initial validation.
   *
   * @param config - Landing page configuration to validate
   * @throws ValidationError if any URL uses a dangerous protocol
   */
  private validateImageUrls(config: LandingPageConfig): void {
    const urlsToValidate: { path: string; url: string }[] = [];

    // Collect all image URLs from config
    if (config.hero?.backgroundImageUrl) {
      urlsToValidate.push({
        path: 'hero.backgroundImageUrl',
        url: config.hero.backgroundImageUrl,
      });
    }

    if (config.about?.imageUrl) {
      urlsToValidate.push({
        path: 'about.imageUrl',
        url: config.about.imageUrl,
      });
    }

    if (config.accommodation?.imageUrl) {
      urlsToValidate.push({
        path: 'accommodation.imageUrl',
        url: config.accommodation.imageUrl,
      });
    }

    if (config.gallery?.images) {
      config.gallery.images.forEach((img, idx) => {
        if (img.url) {
          urlsToValidate.push({
            path: `gallery.images[${idx}].url`,
            url: img.url,
          });
        }
      });
    }

    if (config.testimonials?.items) {
      config.testimonials.items.forEach((item, idx) => {
        if (item.imageUrl) {
          urlsToValidate.push({
            path: `testimonials.items[${idx}].imageUrl`,
            url: item.imageUrl,
          });
        }
      });
    }

    // Validate each URL
    for (const { path, url } of urlsToValidate) {
      const result = SafeImageUrlSchema.safeParse(url);
      if (!result.success) {
        logger.warn({ path, url: url.substring(0, 100) }, 'Invalid image URL rejected');
        throw new ValidationError(`Invalid image URL at ${path}: ${result.error.issues[0]?.message}`);
      }
    }
  }

  /**
   * Get draft and published landing page configuration
   *
   * SECURITY: Tenant isolation enforced via tenantId parameter
   *
   * @param tenantId - Tenant ID (REQUIRED for tenant isolation)
   * @returns Draft wrapper with draft/published configs
   */
  async getLandingPageDraft(tenantId: string): Promise<LandingPageDraftWrapper> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return this.getLandingPageWrapper(tenant.landingPageConfig);
  }

  /**
   * Save draft landing page configuration
   *
   * SECURITY:
   * - Tenant isolation enforced via tenantId parameter
   * - Image URLs re-validated before storage (defense-in-depth)
   *
   * DATA INTEGRITY:
   * - Uses Prisma transaction to prevent TOCTOU race conditions
   * - Concurrent saves from multiple tabs will serialize correctly
   * - On failure, no partial state is written
   *
   * @param tenantId - Tenant ID (REQUIRED for tenant isolation)
   * @param config - Draft configuration to save
   * @returns Save result with timestamp
   */
  async saveLandingPageDraft(
    tenantId: string,
    config: LandingPageConfig
  ): Promise<{ success: boolean; draftUpdatedAt: string }> {
    // Re-validate all image URLs (defense-in-depth) - outside transaction for fast failure
    this.validateImageUrls(config);

    return await this.prisma.$transaction(async (tx) => {
      const now = new Date().toISOString();

      // Get current wrapper to preserve published config - inside transaction for consistency
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfig: true },
      });

      if (!tenant) {
        throw new NotFoundError('Tenant not found');
      }

      const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

      // Update only draft, preserve published
      const newWrapper: LandingPageDraftWrapper = {
        ...currentWrapper,
        draft: config,
        draftUpdatedAt: now,
      };

      await tx.tenant.update({
        where: { id: tenantId },
        data: { landingPageConfig: newWrapper as any },
      });

      logger.info({ tenantId }, 'Landing page draft saved');

      return { success: true, draftUpdatedAt: now };
    });
  }

  /**
   * Publish draft to live landing page
   *
   * SECURITY:
   * - Tenant isolation enforced via tenantId parameter
   * - Atomic transaction ensures no partial failures
   *
   * DATA INTEGRITY:
   * - Uses Prisma transaction wrapper for atomicity
   * - Draft→Published copy is all-or-nothing
   * - On failure, both draft and published remain unchanged
   *
   * @param tenantId - Tenant ID (REQUIRED for tenant isolation)
   * @returns Publish result with timestamp
   * @throws NotFoundError if no draft exists to publish
   */
  async publishLandingPageDraft(
    tenantId: string
  ): Promise<{ success: boolean; publishedAt: string }> {
    return await this.prisma.$transaction(async (tx) => {
      // Fetch current config within transaction
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfig: true },
      });

      if (!tenant) {
        throw new NotFoundError('Tenant not found');
      }

      const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

      if (!currentWrapper.draft) {
        throw new ValidationError('No draft to publish');
      }

      const now = new Date().toISOString();

      // Atomically copy draft to published, clear draft
      const newWrapper: LandingPageDraftWrapper = {
        draft: null,
        draftUpdatedAt: null,
        published: currentWrapper.draft,
        publishedAt: now,
      };

      await tx.tenant.update({
        where: { id: tenantId },
        data: { landingPageConfig: newWrapper as any },
      });

      logger.info({ tenantId }, 'Landing page draft published');

      return { success: true, publishedAt: now };
    });
  }

  /**
   * Discard draft and revert to published configuration
   *
   * SECURITY: Tenant isolation enforced via tenantId parameter
   *
   * @param tenantId - Tenant ID (REQUIRED for tenant isolation)
   * @returns Discard result
   */
  async discardLandingPageDraft(tenantId: string): Promise<{ success: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

    // Clear draft, keep published
    const newWrapper: LandingPageDraftWrapper = {
      draft: null,
      draftUpdatedAt: null,
      published: currentWrapper.published,
      publishedAt: currentWrapper.publishedAt,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: newWrapper as any },
    });

    logger.info({ tenantId }, 'Landing page draft discarded');

    return { success: true };
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Landing page draft wrapper type
 * Stores both draft and published configs in JSON field
 */
export interface LandingPageDraftWrapper {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}
