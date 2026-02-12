/**
 * Tenant Provisioning Service
 *
 * Creates fully provisioned tenants with all required data in a single atomic transaction.
 * This ensures data consistency - either the tenant is created with ALL required data,
 * or nothing is created.
 *
 * Used by:
 * - Admin API (POST /api/v1/admin/tenants)
 * - Auth signup (POST /v1/auth/signup)
 *
 * Guarantees:
 * - Tenant record created with API keys
 * - Default segment ("General") created
 * - Default packages (Basic/Standard/Premium) created and linked to segment
 * - All operations atomic (rollback on any failure)
 *
 * @see todos/630-pending-p1-admin-api-skips-tenant-onboarding.md
 */

import type {
  PrismaClient,
  Tenant,
  Segment,
  Package,
  Tier,
  SectionContent,
  Prisma,
  BlockType,
} from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { apiKeyService } from '../lib/api-key.service';
import {
  DEFAULT_SEGMENT,
  DEFAULT_PACKAGE_TIERS,
  DEFAULT_TIER_CONFIGS,
  DEFAULT_SECTION_CONTENT,
} from '../lib/tenant-defaults';
import { TenantProvisioningError } from '../lib/errors';
// Phase 5.2: DEFAULT_LANDING_PAGE_CONFIG removed - sections stored in SectionContent table

/**
 * Input for creating a new tenant via admin API
 */
export interface AdminCreateTenantInput {
  slug: string;
  name: string;
  commissionPercent?: number;
}

/**
 * Input for creating a new tenant via self-signup
 */
export interface SignupCreateTenantInput {
  slug: string;
  businessName: string;
  email: string;
  passwordHash: string;
  city?: string;
  state?: string;
  brainDump?: string;
}

/**
 * Result of tenant provisioning operation
 */
export interface ProvisionedTenantResult {
  tenant: Tenant;
  segment: Segment;
  packages: Package[];
  /** Pricing tiers (GOOD/BETTER/BEST) created for the segment */
  tiers: Tier[];
  /** Section content created for the tenant's storefront */
  sectionContent: SectionContent[];
  /** Secret key - returned only once, must be shown to admin */
  secretKey?: string;
}

/** Transaction client type for Prisma interactive transactions */
type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Service for atomic tenant provisioning
 *
 * Ensures all tenant data is created in a single transaction:
 * - Tenant record with API keys
 * - Default segment
 * - Default packages linked to segment
 */
export class TenantProvisioningService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create default segment, packages, tiers, and section content for a tenant
   *
   * This is the single source of truth for the semantic storefront setup:
   * - 1 "General" segment
   * - 3 packages (Basic, Standard, Premium) linked to that segment
   * - 3 tiers (GOOD, BETTER, BEST) linked to that segment
   * - Default section content for all block types
   *
   * @param tx - Prisma transaction client
   * @param tenantId - ID of the tenant to create defaults for
   * @returns Created segment, packages, tiers, and section content
   */
  private async createDefaultSegmentAndPackages(
    tx: PrismaTransactionClient,
    tenantId: string
  ): Promise<{
    segment: Segment;
    packages: Package[];
    tiers: Tier[];
    sectionContent: SectionContent[];
  }> {
    // Create default segment
    const segment = await tx.segment.create({
      data: {
        tenantId,
        slug: DEFAULT_SEGMENT.slug,
        name: DEFAULT_SEGMENT.name,
        heroTitle: DEFAULT_SEGMENT.heroTitle,
        description: DEFAULT_SEGMENT.description,
        sortOrder: 0,
        active: true,
      },
    });

    // Create default packages in parallel
    const packagePromises = Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
      tx.package.create({
        data: {
          tenantId,
          segmentId: segment.id,
          slug: tier.slug,
          name: tier.name,
          description: tier.description,
          basePrice: tier.basePrice,
          groupingOrder: tier.groupingOrder,
          active: true,
        },
      })
    );

    // Create default tiers (sortOrder 1, 2, 3) for the segment
    const sortOrders = [1, 2, 3];
    const tierPromises = sortOrders.map((sortOrder) => {
      const config = DEFAULT_TIER_CONFIGS[sortOrder];
      return tx.tier.create({
        data: {
          tenantId,
          segmentId: segment.id,
          sortOrder,
          slug: config.slug,
          name: config.name,
          description: config.description,
          priceCents: config.priceCents,
          currency: 'USD',
          features: config.features as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // Create default section content for tenant-level sections (segmentId = null)
    const blockTypes = Object.keys(DEFAULT_SECTION_CONTENT) as BlockType[];
    const sectionPromises = blockTypes.map((blockType) => {
      const config = DEFAULT_SECTION_CONTENT[blockType];
      return tx.sectionContent.create({
        data: {
          tenantId,
          segmentId: null, // Tenant-level (shared across segments)
          blockType,
          content: config.content as unknown as Prisma.InputJsonValue,
          order: config.order,
          isDraft: false, // Start as published
          publishedAt: new Date(),
        },
      });
    });

    // Execute all creates in parallel
    const [packages, tiers, sectionContent] = await Promise.all([
      Promise.all(packagePromises),
      Promise.all(tierPromises),
      Promise.all(sectionPromises),
    ]);

    return { segment, packages, tiers, sectionContent };
  }

  /**
   * Create a fully provisioned tenant (admin API)
   *
   * Creates tenant, segment, and packages atomically.
   * Returns the secret key which must be shown to the admin once.
   *
   * @param input - Tenant configuration from admin
   * @returns Provisioned tenant with all default data and secret key
   */
  async createFullyProvisioned(input: AdminCreateTenantInput): Promise<ProvisionedTenantResult> {
    const { slug, name, commissionPercent = 10.0 } = input;

    // Generate API key pair before transaction
    const keys = apiKeyService.generateKeyPair(slug);

    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant with default landing page config
      // P4-FIX: Seed DEFAULT_PAGES_CONFIG on tenant provisioning
      // This ensures new tenants have a complete landing page structure with placeholders
      // Phase 5.2: landingPageConfig removed - sections stored in SectionContent table
      // Default sections are created via createDefaultSections() in createDefaultSegmentAndPackages()
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          apiKeyPublic: keys.publicKey,
          apiKeySecret: keys.secretKeyHash,
          commissionPercent,
          branding: {},
        },
      });

      // Create default segment, packages, tiers, and section content
      const { segment, packages, tiers, sectionContent } =
        await this.createDefaultSegmentAndPackages(tx, tenant.id);

      logger.info(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          segmentId: segment.id,
          packagesCreated: packages.length,
          tiersCreated: tiers.length,
          sectionsCreated: sectionContent.length,
        },
        'Fully provisioned new tenant via admin API'
      );

      return { tenant, segment, packages, tiers, sectionContent };
    });

    // Return secret key outside transaction (not stored in DB)
    return {
      ...result,
      secretKey: keys.secretKey,
    };
  }

  /**
   * Create a fully provisioned tenant (self-signup)
   *
   * Creates tenant with auth credentials, segment, and packages atomically.
   * No secret key is returned as signup users authenticate via password.
   *
   * If any part of the provisioning fails, the entire transaction rolls back
   * and a TenantProvisioningError is thrown. This ensures no orphaned tenants
   * exist without their required segment and packages.
   *
   * @param input - Tenant configuration from signup form
   * @returns Provisioned tenant with all default data
   * @throws TenantProvisioningError if provisioning fails (transaction rolled back)
   *
   * @see todos/632-pending-p2-stricter-signup-error-handling.md
   */
  async createFromSignup(input: SignupCreateTenantInput): Promise<ProvisionedTenantResult> {
    const { slug, businessName, email, passwordHash, city, state, brainDump } = input;

    // Generate API keys (even though signup users don't typically need them)
    const publicKey = apiKeyService.generatePublicKey(slug);
    const secretKey = apiKeyService.generateSecretKey(slug);
    const secretKeyHash = apiKeyService.hashSecretKey(secretKey);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Create tenant with auth credentials
        const tenant = await tx.tenant.create({
          data: {
            slug,
            name: businessName,
            email,
            passwordHash,
            apiKeyPublic: publicKey,
            apiKeySecret: secretKeyHash,
            commissionPercent: 10.0,
            emailVerified: false,
            city: city || null,
            state: state || null,
            brainDump: brainDump || null,
          },
        });

        // Create default segment, packages, tiers, and section content
        const { segment, packages, tiers, sectionContent } =
          await this.createDefaultSegmentAndPackages(tx, tenant.id);

        logger.info(
          {
            tenantId: tenant.id,
            slug: tenant.slug,
            email: tenant.email,
            segmentId: segment.id,
            packagesCreated: packages.length,
            tiersCreated: tiers.length,
            sectionsCreated: sectionContent.length,
          },
          'Fully provisioned new tenant via signup'
        );

        return { tenant, segment, packages, tiers, sectionContent };
      });

      return result;
    } catch (error) {
      // Log the detailed error for debugging
      logger.error(
        {
          slug,
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Tenant provisioning failed - transaction rolled back'
      );

      // Throw a user-friendly error (original error preserved as cause)
      throw new TenantProvisioningError(
        'Failed to complete signup. Please try again.',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
