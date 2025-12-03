/**
 * Prisma repository for Tenant data access
 * Provides data layer for multi-tenant operations
 */

import { PrismaClient, Tenant } from '../../generated/prisma';
import { TenantPublicDtoSchema, ALLOWED_FONT_FAMILIES } from '@macon/contracts';
import type { TenantPublicDto } from '@macon/contracts';
import { logger } from '../../lib/core/logger';

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
}
