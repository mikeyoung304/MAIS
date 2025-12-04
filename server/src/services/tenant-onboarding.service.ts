/**
 * Tenant Onboarding Service
 *
 * Handles initial setup for new tenants after signup.
 * Creates default segment and packages in a transaction to ensure
 * data consistency (no partial failures).
 */

import type { PrismaClient, Segment, Package } from '../generated/prisma';
import { logger } from '../lib/core/logger';

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
 * Helps guide users toward a 3-tier pricing structure
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
 * Options for createDefaultData
 */
export interface CreateDefaultDataOptions {
  tenantId: string;
}

/**
 * Result of createDefaultData operation
 */
export interface DefaultDataResult {
  segment: Segment;
  packages: Package[];
}

/**
 * Service for tenant onboarding operations
 *
 * Handles initial setup tasks that should be performed atomically
 * when a new tenant signs up.
 */
export class TenantOnboardingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create default segment and packages for a new tenant
   *
   * Uses a database transaction to ensure atomicity:
   * - Either all default data is created successfully
   * - Or nothing is created (rollback on failure)
   *
   * Package creation is parallelized within the transaction for performance.
   *
   * @param options - Tenant ID and optional configuration
   * @returns Created segment and packages
   * @throws If transaction fails (caller should handle gracefully)
   */
  async createDefaultData(options: CreateDefaultDataOptions): Promise<DefaultDataResult> {
    const { tenantId } = options;

    return this.prisma.$transaction(async (tx) => {
      // Create default segment first (packages depend on it)
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

      // Create all 3 default packages in parallel within the transaction
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

      const packages = await Promise.all(packagePromises);

      logger.info(
        {
          tenantId,
          segmentId: segment.id,
          packagesCreated: packages.length,
        },
        'Created default segment and packages for new tenant'
      );

      return { segment, packages };
    });
  }
}
