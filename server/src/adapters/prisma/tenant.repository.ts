/**
 * Prisma repository for Tenant data access
 * Provides data layer for multi-tenant operations
 */

import type { PrismaClient, Tenant } from '../../generated/prisma/client';
import type { Prisma } from '../../generated/prisma/client';
import { TenantPublicDtoSchema } from '@macon/contracts';
import type { TenantPublicDto } from '@macon/contracts';
// NOTE: LandingPageConfigSchema, LenientLandingPageConfigSchema removed
// All storefront content now uses SectionContent table via SectionContentService
// See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
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
  // Trial & Subscription fields (Product-Led Growth)
  trialEndsAt?: Date;
  subscriptionStatus?: 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';
  stripeCustomerId?: string;
  // Tier and AI usage fields
  tier?: 'FREE' | 'STARTER' | 'PRO';
  aiMessagesUsed?: number;
  aiMessagesResetAt?: Date;
  // Onboarding state fields (Session Bootstrap Protocol)
  onboardingPhase?:
    | 'NOT_STARTED'
    | 'DISCOVERY'
    | 'MARKET_RESEARCH'
    | 'SERVICES'
    | 'MARKETING'
    | 'BUILDING'
    | 'COMPLETED'
    | 'SKIPPED';
  onboardingCompletedAt?: Date | null;
  // Reveal animation one-shot guard (Phase 3 — Dashboard Rebuild)
  revealCompletedAt?: Date | null;
}

/**
 * Tenant repository for CRUD operations
 * Handles multi-tenant isolation and API key lookups
 *
 * Note: ITenantRepository interface exists in ports.ts for test mocking,
 * but this class returns full Prisma Tenant for compatibility with existing code.
 */
const DEFAULT_PAGE_SIZE = 50;
const MAX_ADMIN_PAGE_SIZE = 500;
const MAX_STATS_PAGE_SIZE = 100;

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
   * By default, excludes test tenants to prevent data leakage in production.
   * Use includeTestTenants: true only for admin/debugging purposes.
   *
   * @param options - Filtering options
   * @param options.onlyActive - Filter to only active tenants (default: false)
   * @param options.includeTestTenants - Include test tenants in results (default: false)
   * @returns Array of tenants
   */
  async list(
    options: { onlyActive?: boolean; includeTestTenants?: boolean; take?: number } = {}
  ): Promise<Tenant[]> {
    const { onlyActive = false, includeTestTenants = false } = options;

    const where: Prisma.TenantWhereInput = {};
    if (onlyActive) where.isActive = true;
    if (!includeTestTenants) where.isTestTenant = false;

    return await this.prisma.tenant.findMany({
      where: Object.keys(where).length ? where : undefined,
      take: Math.min(options.take ?? DEFAULT_PAGE_SIZE, MAX_ADMIN_PAGE_SIZE),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List all tenants with stats for admin dashboard
   *
   * @param includeTestTenants - Whether to include test tenants (default: false)
   * @returns Array of tenants with booking/package/addon counts
   */
  async listWithStats(
    includeTestTenants = false,
    options?: { take?: number }
  ): Promise<TenantWithStats[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: includeTestTenants ? undefined : { isTestTenant: false },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_STATS_PAGE_SIZE),
      select: {
        id: true,
        slug: true,
        name: true,
        email: true,
        apiKeyPublic: true,
        commissionPercent: true,
        stripeOnboarded: true,
        stripeAccountId: true,
        isActive: true,
        isTestTenant: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            bookings: true,
            tiers: true,
            addOns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      email: t.email,
      apiKeyPublic: t.apiKeyPublic,
      commissionPercent: Number(t.commissionPercent),
      stripeOnboarded: t.stripeOnboarded,
      stripeAccountId: t.stripeAccountId,
      isActive: t.isActive,
      isTestTenant: t.isTestTenant,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      stats: {
        bookings: t._count.bookings,
        tiers: t._count.tiers,
        addOns: t._count.addOns,
      },
    }));
  }

  /**
   * Find tenant by ID with full stats for admin detail view
   *
   * @param id - Tenant ID
   * @returns Tenant with stats or null
   */
  async findByIdWithStats(id: string): Promise<TenantWithDetailStats | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: true,
            tiers: true,
            addOns: true,
            blackoutDates: true,
          },
        },
      },
    });

    if (!tenant) {
      return null;
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      email: tenant.email,
      apiKeyPublic: tenant.apiKeyPublic,
      commissionPercent: Number(tenant.commissionPercent),
      branding: tenant.branding,
      stripeOnboarded: tenant.stripeOnboarded,
      stripeAccountId: tenant.stripeAccountId,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      stats: {
        bookings: tenant._count.bookings,
        tiers: tenant._count.tiers,
        addOns: tenant._count.addOns,
        blackoutDates: tenant._count.blackoutDates,
      },
    };
  }

  /**
   * Find tenant by Stripe account ID
   * Used for Stripe Connect webhook processing
   *
   * @param stripeAccountId - Stripe Connect account ID (acct_*)
   * @returns Tenant or null
   */
  async findByStripeAccountId(stripeAccountId: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { stripeAccountId },
    });
  }

  /**
   * List active tenant slugs for sitemap generation
   *
   * Returns minimal data needed for sitemap: slug and updatedAt.
   * Only returns active tenants to avoid exposing inactive/deleted tenants.
   *
   * @returns Array of { slug, updatedAt } for active tenants
   */
  async listActive(options?: { take?: number }): Promise<{ slug: string; updatedAt: Date }[]> {
    return await this.prisma.tenant.findMany({
      where: {
        isActive: true,
        isTestTenant: false,
      },
      select: { slug: true, updatedAt: true },
      take: Math.min(options?.take ?? DEFAULT_PAGE_SIZE, MAX_ADMIN_PAGE_SIZE),
      orderBy: { updatedAt: 'desc' },
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
    tierCount: number;
    addOnCount: number;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bookings: true,
            tiers: true,
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
      tierCount: tenant._count.tiers,
      addOnCount: tenant._count.addOns,
    };
  }

  /**
   * Find tenant by custom domain
   * Used for custom domain routing (e.g., janephotography.com)
   *
   * @param domain - Custom domain (e.g., "janephotography.com")
   * @returns TenantPublicDto or null if no verified domain found
   */
  async findByDomainPublic(domain: string): Promise<TenantPublicDto | null> {
    // Look up verified domain and get tenant
    const tenantDomain = await this.prisma.tenantDomain.findUnique({
      where: { domain: domain.toLowerCase() },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            apiKeyPublic: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            backgroundColor: true,
            fontPreset: true,
            chatEnabled: true,
            branding: true,
            tierDisplayNames: true,
            // NOTE: landingPageConfig removed - frontend fetches sections from /sections API
            // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
            isActive: true,
          },
        },
      },
    });

    // Domain must exist, be verified, and tenant must be active
    if (!tenantDomain || !tenantDomain.verified || !tenantDomain.tenant.isActive) {
      return null;
    }

    const tenant = tenantDomain.tenant;

    // Build and validate response (no landingPage merge needed - frontend uses sections API)
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      fontPreset: tenant.fontPreset,
      chatEnabled: tenant.chatEnabled,
      branding: tenant.branding as Record<string, unknown> | undefined,
      tierDisplayNames: tenant.tierDisplayNames as
        | { tier_1?: string; tier_2?: string; tier_3?: string }
        | undefined,
    };

    const validationResult = TenantPublicDtoSchema.safeParse(candidateDto);

    if (!validationResult.success) {
      logger.warn(
        {
          tenantId: tenant.id,
          domain,
          errorCount: validationResult.error.issues.length,
        },
        'Invalid tenant data during domain lookup'
      );

      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        apiKeyPublic: tenant.apiKeyPublic,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
        fontPreset: tenant.fontPreset,
        chatEnabled: tenant.chatEnabled,
        branding: undefined,
        tierDisplayNames: undefined,
      };
    }

    return validationResult.data;
  }

  /**
   * Find active tenant by slug for preview mode
   *
   * NOTE: Draft detection now uses SectionContent table via SectionContentService.hasDraft()
   * at the calling site (frontend page.tsx). This method returns basic tenant data only.
   *
   * SECURITY: Only returns allowlisted fields (same as findBySlugPublic)
   *
   * @param slug - URL-safe tenant identifier
   * @returns TenantPreviewDto or null if not found/inactive
   */
  async findBySlugForPreview(slug: string): Promise<TenantPreviewDto | null> {
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
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        fontPreset: true,
        chatEnabled: true,
        branding: true,
        tierDisplayNames: true,
        // NOTE: landingPageConfig removed - frontend fetches sections from /sections API
        // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
      },
    });

    if (!tenant) {
      return null;
    }

    // Build candidate response object (no landingPage merge needed - frontend uses sections API)
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      fontPreset: tenant.fontPreset,
      chatEnabled: tenant.chatEnabled,
      branding: tenant.branding as Record<string, unknown> | undefined,
      tierDisplayNames: tenant.tierDisplayNames as
        | { tier_1?: string; tier_2?: string; tier_3?: string }
        | undefined,
    };

    // Validate entire response with Zod schema
    const validationResult = TenantPublicDtoSchema.safeParse(candidateDto);

    if (!validationResult.success) {
      logger.warn(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          errorCount: validationResult.error.issues.length,
        },
        'Invalid tenant data during preview lookup'
      );

      // Return response with branding/tierDisplayNames set to undefined (graceful degradation)
      return {
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          apiKeyPublic: tenant.apiKeyPublic,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          accentColor: tenant.accentColor,
          backgroundColor: tenant.backgroundColor,
          fontPreset: tenant.fontPreset,
          chatEnabled: tenant.chatEnabled,
          branding: undefined,
          tierDisplayNames: undefined,
        },
        hasDraft: false, // Cannot determine here - caller uses SectionContentService
      };
    }

    return {
      tenant: validationResult.data,
      hasDraft: false, // Cannot determine here - caller uses SectionContentService
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
   * - tierDisplayNames - Tier display customization (validated with Zod)
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
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        fontPreset: true,
        chatEnabled: true,
        branding: true,
        tierDisplayNames: true,
        // NOTE: landingPageConfig removed - frontend fetches sections from /sections API
        // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
      },
    });

    if (!tenant) {
      return null;
    }

    // Build candidate response object (no landingPage merge needed - frontend uses sections API)
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      fontPreset: tenant.fontPreset,
      chatEnabled: tenant.chatEnabled,
      branding: tenant.branding as Record<string, unknown> | undefined,
      tierDisplayNames: tenant.tierDisplayNames as
        | { tier_1?: string; tier_2?: string; tier_3?: string }
        | undefined,
    };

    // Validate entire response with Zod schema (including branding)
    const validationResult = TenantPublicDtoSchema.safeParse(candidateDto);

    if (!validationResult.success) {
      // Log warning if validation fails (for debugging malformed database data)
      logger.warn(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          errorCount: validationResult.error.issues.length,
        },
        'Invalid tenant data during public lookup'
      );

      // Return response with branding/tierDisplayNames set to undefined (graceful degradation)
      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        apiKeyPublic: tenant.apiKeyPublic,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        accentColor: tenant.accentColor,
        backgroundColor: tenant.backgroundColor,
        fontPreset: tenant.fontPreset,
        chatEnabled: tenant.chatEnabled,
        branding: undefined,
        tierDisplayNames: undefined,
      };
    }

    // Return validated data
    return validationResult.data;
  }

  // DELETED (Phase 5.2 Section Content Migration): getLandingPageConfig()
  // Image browser now uses SectionContentService.getPublishedSections() via tenant-admin.routes.ts
  // All storefront editing now uses agent tools via internal-agent.routes.ts
  // See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md

  // ============================================================================
  // Draft System Methods - DELETED (Phase 5.2 Section Content Migration)
  // ============================================================================
  //
  // All draft/publish functionality has been moved to SectionContentService
  // which uses the SectionContent table instead of JSON columns.
  //
  // DELETED METHODS:
  // - extractPublishedLandingPage() - no longer needed
  // - getLandingPageWrapper() - no longer needed
  // - getLandingPageDraft() - migrated to SectionContentService
  // - publishLandingPageDraft() - migrated to SectionContentService.publishAll()
  // - discardLandingPageDraft() - migrated to SectionContentService.discardAll()
  //
  // See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md
}

// ============================================================================
// Types
// ============================================================================

// NOTE: LandingPageDraftWrapper type DELETED (Phase 5.2 Section Content Migration)
// All draft/publish functionality has been moved to SectionContent table
// See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md

/**
 * Tenant preview DTO for preview endpoint
 * Combines public tenant data with draft indicator for logging
 *
 * NOTE: hasDraft now determined via SectionContentService.hasDraft() at calling site
 */
export interface TenantPreviewDto {
  tenant: TenantPublicDto;
  hasDraft: boolean;
}

/**
 * Tenant with stats for admin list view
 */
export interface TenantWithStats {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  apiKeyPublic: string;
  commissionPercent: number;
  stripeOnboarded: boolean;
  stripeAccountId: string | null;
  isActive: boolean;
  isTestTenant: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    bookings: number;
    tiers: number;
    addOns: number;
  };
}

/**
 * Tenant with detailed stats for admin detail view
 */
export interface TenantWithDetailStats {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  apiKeyPublic: string;
  commissionPercent: number;
  branding: any;
  stripeOnboarded: boolean;
  stripeAccountId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    bookings: number;
    tiers: number;
    addOns: number;
    blackoutDates: number;
  };
}
