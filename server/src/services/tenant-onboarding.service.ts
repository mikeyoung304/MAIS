/**
 * Tenant Onboarding Service
 *
 * Handles initial setup for new tenants after signup.
 * Creates default segment and tiers in a transaction to ensure
 * data consistency (no partial failures).
 */

import type { PrismaClient, Segment, Tier } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { DEFAULT_SEGMENT, DEFAULT_TIERS } from '../lib/tenant-defaults';

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
  tiers: Tier[];
}

/**
 * Tenant chat info for health checks
 */
export interface TenantChatInfo {
  chatEnabled: boolean;
  name: string | null;
}

/**
 * Result of skipOnboarding operation
 */
export interface SkipOnboardingResult {
  previousStatus: string;
  status: 'COMPLETE';
}

/**
 * Result of completeReveal operation
 */
export interface CompleteRevealResult {
  alreadyCompleted: boolean;
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
   * Create default segment and tiers for a new tenant
   *
   * Uses a database transaction to ensure atomicity:
   * - Either all default data is created successfully
   * - Or nothing is created (rollback on failure)
   *
   * Tier creation is parallelized within the transaction for performance.
   *
   * @param options - Tenant ID and optional configuration
   * @returns Created segment and tiers
   * @throws If transaction fails (caller should handle gracefully)
   */
  async createDefaultData(options: CreateDefaultDataOptions): Promise<DefaultDataResult> {
    const { tenantId } = options;

    return this.prisma.$transaction(async (tx) => {
      // Create default segment first (tiers depend on it)
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

      // Create all 3 default tiers in parallel within the transaction
      const tierPromises = Object.values(DEFAULT_TIERS).map((tier) =>
        tx.tier.create({
          data: {
            tenantId,
            segmentId: segment.id,
            slug: tier.slug,
            name: tier.name,
            description: tier.description,
            priceCents: tier.basePrice,
            sortOrder: tier.groupingOrder,
            features: [],
            bookingType: 'DATE',
            active: true,
          },
        })
      );

      const tiers = await Promise.all(tierPromises);

      logger.info(
        {
          tenantId,
          segmentId: segment.id,
          tiersCreated: tiers.length,
        },
        'Created default segment and tiers for new tenant'
      );

      return { segment, tiers };
    });
  }

  // ==========================================================================
  // Chat Feature Flag
  // ==========================================================================

  /**
   * Check if chat is enabled for a tenant.
   * Used by public customer chat middleware.
   */
  async isChatEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { chatEnabled: true },
    });
    return tenant?.chatEnabled ?? false;
  }

  /**
   * Get tenant chat info (chatEnabled + name).
   * Used by health check and session creation.
   *
   * @returns null if tenant not found
   */
  async getTenantChatInfo(tenantId: string): Promise<TenantChatInfo | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { chatEnabled: true, name: true },
    });
    if (!tenant) return null;
    return { chatEnabled: tenant.chatEnabled, name: tenant.name };
  }

  /**
   * Get tenant display name.
   * Returns null if tenant not found.
   */
  async getTenantName(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return tenant?.name ?? null;
  }

  // ==========================================================================
  // Onboarding State Operations
  // ==========================================================================

  /**
   * Skip the onboarding flow for a tenant.
   *
   * @returns result with previousPhase, or null if tenant not found
   * @throws Error if onboarding already completed or skipped (409 conflict)
   */
  async skipOnboarding(tenantId: string): Promise<SkipOnboardingResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingStatus: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentStatus = tenant.onboardingStatus || 'PENDING_PAYMENT';

    if (currentStatus === 'COMPLETE') {
      const error = new Error('Onboarding already finished') as Error & { status: string };
      error.status = currentStatus;
      throw error;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingStatus: 'COMPLETE',
        onboardingCompletedAt: new Date(),
      },
    });

    return { previousStatus: currentStatus, status: 'COMPLETE' };
  }

  /**
   * Mark the reveal animation as completed (idempotent).
   *
   * @returns whether it was already completed
   * @throws Error if tenant not found
   */
  async completeReveal(tenantId: string): Promise<CompleteRevealResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { revealCompletedAt: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    if (tenant.revealCompletedAt) {
      return { alreadyCompleted: true };
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { revealCompletedAt: new Date() },
    });

    return { alreadyCompleted: false };
  }
}
