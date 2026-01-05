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

import type { PrismaClient, Tenant, Segment, Package } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { apiKeyService } from '../lib/api-key.service';

/**
 * Default segment configuration for new tenants
 */
const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

/**
 * Default pricing tier configurations
 * Guides users toward a 3-tier pricing structure
 */
const DEFAULT_PACKAGE_TIERS = {
  BASIC: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Your starter option - perfect for budget-conscious clients',
    basePrice: 0,
    groupingOrder: 1,
  },
  STANDARD: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Our most popular option - great value for most clients',
    basePrice: 0,
    groupingOrder: 2,
  },
  PREMIUM: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'The full experience - for clients who want the best',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;

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
}

/**
 * Result of tenant provisioning operation
 */
export interface ProvisionedTenantResult {
  tenant: Tenant;
  segment: Segment;
  packages: Package[];
  /** Secret key - returned only once, must be shown to admin */
  secretKey?: string;
}

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
      // Create tenant
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

      // Create default segment
      const segment = await tx.segment.create({
        data: {
          tenantId: tenant.id,
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
            tenantId: tenant.id,
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

      const packages = await Promise.all(packagePromises);

      logger.info(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          segmentId: segment.id,
          packagesCreated: packages.length,
        },
        'Fully provisioned new tenant via admin API'
      );

      return { tenant, segment, packages };
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
   * @param input - Tenant configuration from signup form
   * @returns Provisioned tenant with all default data
   */
  async createFromSignup(input: SignupCreateTenantInput): Promise<ProvisionedTenantResult> {
    const { slug, businessName, email, passwordHash } = input;

    // Generate API keys (even though signup users don't typically need them)
    const publicKey = apiKeyService.generatePublicKey(slug);
    const secretKey = apiKeyService.generateSecretKey(slug);
    const secretKeyHash = apiKeyService.hashSecretKey(secretKey);

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
        },
      });

      // Create default segment
      const segment = await tx.segment.create({
        data: {
          tenantId: tenant.id,
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
            tenantId: tenant.id,
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

      const packages = await Promise.all(packagePromises);

      logger.info(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          email: tenant.email,
          segmentId: segment.id,
          packagesCreated: packages.length,
        },
        'Fully provisioned new tenant via signup'
      );

      return { tenant, segment, packages };
    });

    return result;
  }
}
