/**
 * Prisma repository for Tenant data access
 * Provides data layer for multi-tenant operations
 */

import type { PrismaClient, Tenant } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import {
  TenantPublicDtoSchema,
  LandingPageConfigSchema,
  LenientLandingPageConfigSchema,
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
  landingPageConfigDraft?: any | null; // Separate column for Build Mode (AI tools)
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
    | 'COMPLETED'
    | 'SKIPPED';
  onboardingCompletedAt?: Date | null;
}

/**
 * Tenant repository for CRUD operations
 * Handles multi-tenant isolation and API key lookups
 *
 * Note: ITenantRepository interface exists in ports.ts for test mocking,
 * but this class returns full Prisma Tenant for compatibility with existing code.
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
   * By default, excludes test tenants to prevent data leakage in production.
   * Use includeTestTenants: true only for admin/debugging purposes.
   *
   * @param options - Filtering options
   * @param options.onlyActive - Filter to only active tenants (default: false)
   * @param options.includeTestTenants - Include test tenants in results (default: false)
   * @returns Array of tenants
   */
  async list(
    options: { onlyActive?: boolean; includeTestTenants?: boolean } = {}
  ): Promise<Tenant[]> {
    const { onlyActive = false, includeTestTenants = false } = options;

    const where: Prisma.TenantWhereInput = {};
    if (onlyActive) where.isActive = true;
    if (!includeTestTenants) where.isTestTenant = false;

    return await this.prisma.tenant.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List all tenants with stats for admin dashboard
   *
   * @param includeTestTenants - Whether to include test tenants (default: false)
   * @returns Array of tenants with booking/package/addon counts
   */
  async listWithStats(includeTestTenants = false): Promise<TenantWithStats[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: includeTestTenants ? undefined : { isTestTenant: false },
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
            packages: true,
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
        packages: t._count.packages,
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
            packages: true,
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
        packages: tenant._count.packages,
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
  async listActive(): Promise<{ slug: string; updatedAt: Date }[]> {
    return await this.prisma.tenant.findMany({
      where: {
        isActive: true,
        isTestTenant: false,
      },
      select: { slug: true, updatedAt: true },
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
            chatEnabled: true,
            branding: true,
            tierDisplayNames: true,
            landingPageConfig: true, // Include for branding.landingPage
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

    // Extract published landing page config from the draft wrapper structure
    // The landingPageConfig column uses { draft, published, ... } wrapper
    // For public display, we use the published config (or direct config for legacy format)
    const landingPageConfig = this.extractPublishedLandingPage(tenant.landingPageConfig);

    // Build branding object with landingPage merged in
    const branding = tenant.branding as Record<string, unknown> | null;
    const mergedBranding = landingPageConfig
      ? { ...branding, landingPage: landingPageConfig }
      : branding;

    // Build and validate response (same as findBySlugPublic)
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      chatEnabled: tenant.chatEnabled,
      branding: mergedBranding,
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
        chatEnabled: tenant.chatEnabled,
        branding: undefined,
        tierDisplayNames: undefined,
      };
    }

    return validationResult.data;
  }

  /**
   * Find active tenant by slug with draft config for preview mode
   * Used by preview endpoint to serve draft landing page content
   *
   * PERFORMANCE: Single query fetches both published and draft configs,
   * eliminating the need for a second query to getLandingPageDraft.
   *
   * SECURITY: Only returns allowlisted fields (same as findBySlugPublic)
   * plus draft config for authenticated preview.
   *
   * @param slug - URL-safe tenant identifier
   * @returns TenantPreviewDto (with draft/published configs) or null if not found/inactive
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
        chatEnabled: true,
        branding: true,
        tierDisplayNames: true,
        landingPageConfig: true, // Published config
        landingPageConfigDraft: true, // Draft config (for preview)
      },
    });

    if (!tenant) {
      return null;
    }

    // Parse draft config from separate column
    // IMPORTANT: Use LENIENT validation for drafts - allows empty arrays
    // This fixes the P1 bug where empty pricing sections caused validation failure
    // and silent fallback to published content. See: 2026-02-01 realtime preview plan.
    let draft: LandingPageConfig | null = null;
    if (tenant.landingPageConfigDraft) {
      const draftResult = LenientLandingPageConfigSchema.safeParse(tenant.landingPageConfigDraft);
      if (draftResult.success) {
        draft = draftResult.data;
      } else {
        // Even lenient validation failed - this is a real corruption issue
        logger.error(
          { tenantId: tenant.id, slug, errors: draftResult.error.issues },
          'Draft failed even lenient validation in findBySlugForPreview'
        );
      }
    }

    // Parse published config from main column
    const published = this.extractPublishedLandingPage(tenant.landingPageConfig);

    // Build branding object - use draft if available, otherwise published
    const landingPageConfig = draft ?? published;
    const branding = tenant.branding as Record<string, unknown> | null;
    const mergedBranding = landingPageConfig
      ? { ...branding, landingPage: landingPageConfig }
      : branding;

    // Build candidate response object
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      chatEnabled: tenant.chatEnabled,
      branding: mergedBranding,
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
          chatEnabled: tenant.chatEnabled,
          branding: undefined,
          tierDisplayNames: undefined,
        },
        hasDraft: !!draft,
      };
    }

    return {
      tenant: validationResult.data,
      hasDraft: !!draft,
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
        chatEnabled: true,
        branding: true,
        tierDisplayNames: true,
        landingPageConfig: true, // Include for branding.landingPage
      },
    });

    if (!tenant) {
      return null;
    }

    // Extract published landing page config from the draft wrapper structure
    // The landingPageConfig column uses { draft, published, ... } wrapper
    // For public display, we use the published config (or direct config for legacy format)
    const landingPageConfig = this.extractPublishedLandingPage(tenant.landingPageConfig);

    // Build branding object with landingPage merged in
    const branding = tenant.branding as Record<string, unknown> | null;
    const mergedBranding = landingPageConfig
      ? { ...branding, landingPage: landingPageConfig }
      : branding;

    // Build candidate response object
    const candidateDto = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      apiKeyPublic: tenant.apiKeyPublic,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      chatEnabled: tenant.chatEnabled,
      branding: mergedBranding,
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
        chatEnabled: tenant.chatEnabled,
        branding: undefined,
        tierDisplayNames: undefined,
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
  async getLandingPageConfig(tenantId: string): Promise<LandingPageConfig | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant?.landingPageConfig) {
      return null;
    }

    // Validate stored config matches expected schema
    const result = LandingPageConfigSchema.safeParse(tenant.landingPageConfig);
    if (!result.success) {
      logger.warn(
        { tenantId, errors: result.error.issues.length },
        'Invalid landing page config in database, returning null'
      );
      return null;
    }

    return result.data;
  }

  // NOTE: updateLandingPageConfig() and toggleLandingPageSection() methods deleted.
  // Visual Editor is deprecated. All storefront editing now happens through AI agent chatbot.
  // See: 2026-02-01 realtime preview plan.

  // ============================================================================
  // Draft System Methods
  // ============================================================================

  /**
   * DESIGN DECISION: Single JSON column for draft/published (TODO-243)
   *
   * The landing page configuration uses a single JSON column (Tenant.landingPageConfig)
   * with a wrapper structure containing both draft and published states.
   *
   * PROS:
   * - Simple schema, no migrations needed for config field changes
   * - Atomic draft/publish operations in single row update
   * - No joins needed for common operations
   *
   * LIMITATIONS:
   * - No version history (cannot revert to previous published version)
   * - No diff view between historical versions
   * - JSON column has no database-level schema evolution protection
   *
   * FUTURE: If versioning is needed, consider migrating to a separate
   * LandingPageVersion table with proper version tracking.
   * See docs/solutions/ for schema design documentation.
   */

  /**
   * Extract the published landing page config for public display.
   *
   * The landingPageConfig column can contain either:
   * 1. Draft wrapper format: { draft, published, draftUpdatedAt, publishedAt }
   * 2. Legacy direct format: { pages: {...}, sections: {...}, ... }
   *
   * This method extracts the appropriate config for public storefront display.
   * Reuses getLandingPageWrapper for wrapper extraction, letting Zod schema
   * validation determine format validity.
   *
   * @param config - Raw JSON from database (may be null, undefined, or malformed)
   * @returns The published/live landing page config, or null if not set
   */
  private extractPublishedLandingPage(config: unknown): LandingPageConfig | null {
    const wrapper = this.getLandingPageWrapper(config);

    // Draft wrapper format with published content
    if (wrapper.published) {
      const result = LandingPageConfigSchema.safeParse(wrapper.published);
      return result.success ? result.data : null;
    }

    // Legacy direct format or empty - let schema validation decide
    const result = LandingPageConfigSchema.safeParse(config);
    return result.success ? result.data : null;
  }

  /**
   * Parse raw JSON config into strongly-typed wrapper structure.
   *
   * Handles missing or malformed config by returning null values
   * for all properties, ensuring consistent return type.
   *
   * @param config - Raw JSON from database (may be null, undefined, or malformed)
   * @returns Normalized wrapper with all properties set (null if not present)
   */
  private getLandingPageWrapper(config: any): LandingPageDraftWrapper {
    if (!config || typeof config !== 'object') {
      return {
        draft: null,
        published: null,
        draftUpdatedAt: null,
        publishedAt: null,
        version: 0,
      };
    }

    return {
      draft: config.draft ?? null,
      published: config.published ?? null,
      draftUpdatedAt: config.draftUpdatedAt ?? null,
      publishedAt: config.publishedAt ?? null,
      version: config.version ?? 0,
    };
  }

  /**
   * Get draft and published landing page configuration
   *
   * SECURITY: Tenant isolation enforced via tenantId parameter
   *
   * P2-FIX: Now reads from BOTH columns:
   * - `landingPageConfigDraft` for draft content (what AI tools write to)
   * - `landingPageConfig` for published content
   *
   * DELETED (Phase 5 Section Content Migration): getLandingPageDraft()
   * All storefront editing now uses SectionContentService via internal-agent.routes.ts.
   * See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md
   */

  // DELETED (Phase 5 Section Content Migration): publishLandingPageDraft()
  // All publishing now uses SectionContentService.publishAll() via internal-agent.routes.ts.
  // See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md

  // DELETED (Phase 5 Section Content Migration): discardLandingPageDraft()
  // All discard operations now use SectionContentService.discardAll() via internal-agent.routes.ts.
  // See: docs/plans/2026-02-02-refactor-section-content-migration-plan.md
}

// ============================================================================
// Types
// ============================================================================

/**
 * Landing page draft wrapper type
 *
 * Stores both draft and published configs in a single JSON column.
 * This is an intentional simplification for MVP - see TODO-243 for
 * future versioning considerations.
 *
 * @property draft - Work-in-progress configuration (auto-saved)
 * @property published - Live configuration visible to visitors
 * @property draftUpdatedAt - ISO timestamp of last draft save
 * @property publishedAt - ISO timestamp of last publish operation
 */
export interface LandingPageDraftWrapper {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  /** Optimistic locking version - increments on each draft write (#620) */
  version: number;
}

/**
 * Tenant preview DTO for preview endpoint
 * Combines public tenant data with draft indicator for logging
 *
 * PERFORMANCE: Single query return type for findBySlugForPreview
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
    packages: number;
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
    packages: number;
    addOns: number;
    blackoutDates: number;
  };
}
