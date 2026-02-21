/**
 * Tenant Onboarding Service
 *
 * Handles initial setup for new tenants after signup.
 * Creates default segment and tiers in a transaction to ensure
 * data consistency (no partial failures).
 */

import type { PrismaClient, Segment, Tier, BlockType } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { DEFAULT_SEGMENT, DEFAULT_TIERS } from '../lib/tenant-defaults';
import {
  type SetupProgress,
  type OnboardingStatus,
  VALID_ONBOARDING_TRANSITIONS,
  parseOnboardingStatus,
} from '@macon/contracts';

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
   * Guard: Only allows skip from post-payment states (PENDING_BUILD and later).
   * Skipping from PENDING_PAYMENT is rejected — tenant must pay first.
   *
   * @returns result with previousStatus
   * @throws InvalidTransitionError if status is PENDING_PAYMENT or already COMPLETE
   */
  async skipOnboarding(tenantId: string): Promise<SkipOnboardingResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingStatus: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentStatus = parseOnboardingStatus(tenant.onboardingStatus);

    // Guard: cannot skip from PENDING_PAYMENT (must pay first)
    if (currentStatus === 'PENDING_PAYMENT') {
      throw new InvalidTransitionError(currentStatus, 'COMPLETE');
    }

    if (currentStatus === 'COMPLETE') {
      const error = new Error('Onboarding already finished') as Error & { status: string };
      error.status = currentStatus;
      throw error;
    }

    // Use the validated transition helper
    const result = await this.transitionOnboardingStatus(tenantId, currentStatus, 'COMPLETE');

    return { previousStatus: result.previousStatus, status: 'COMPLETE' };
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

  // ==========================================================================
  // State Machine Transition Helper
  // ==========================================================================

  /**
   * Validated state transition with optimistic locking.
   *
   * 1. Reads current status + onboardingVersion
   * 2. Validates transition is in VALID_ONBOARDING_TRANSITIONS
   * 3. Updates with WHERE version = currentVersion (optimistic lock)
   * 4. Increments onboardingVersion on success
   *
   * All status mutations across the codebase should route through this method.
   *
   * @throws InvalidTransitionError if transition is not allowed
   * @throws ConcurrentModificationError if version changed between read and write
   * @throws Error if tenant not found
   */
  async transitionOnboardingStatus(
    tenantId: string,
    expectedFrom: OnboardingStatus,
    to: OnboardingStatus
  ): Promise<{ previousStatus: OnboardingStatus; newStatus: OnboardingStatus; version: number }> {
    // Validate transition is allowed
    const allowedTargets = VALID_ONBOARDING_TRANSITIONS[expectedFrom];
    if (!allowedTargets.includes(to)) {
      throw new InvalidTransitionError(expectedFrom, to);
    }

    // Read current state
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingStatus: true, onboardingVersion: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentStatus = parseOnboardingStatus(tenant.onboardingStatus);

    // Verify current status matches expected
    if (currentStatus !== expectedFrom) {
      throw new InvalidTransitionError(currentStatus, to);
    }

    // Optimistic locking: update only if version hasn't changed
    const updated = await this.prisma.tenant.updateMany({
      where: {
        id: tenantId,
        onboardingVersion: tenant.onboardingVersion,
      },
      data: {
        onboardingStatus: to,
        onboardingVersion: tenant.onboardingVersion + 1,
        ...(to === 'COMPLETE' ? { onboardingCompletedAt: new Date() } : {}),
      },
    });

    if (updated.count === 0) {
      throw new ConcurrentModificationError(tenant.onboardingVersion);
    }

    const newVersion = tenant.onboardingVersion + 1;

    logger.info(
      { tenantId, from: expectedFrom, to, version: newVersion },
      '[Onboarding] Status transitioned'
    );

    return { previousStatus: expectedFrom, newStatus: to, version: newVersion };
  }

  // ==========================================================================
  // Setup Progress (Phase 6 — Checklist)
  // ==========================================================================

  /**
   * Derive setup progress from actual data state (no redundant storage).
   *
   * 8 checklist items, each with a weight. Percentage = completedWeight / totalActiveWeight * 100.
   * Dismissed items are excluded from both numerator and denominator.
   */
  async deriveSetupProgress(tenantId: string): Promise<SetupProgress> {
    // Load tenant + related data in parallel
    const [tenant, draftSections, publishedSections] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeOnboarded: true,
          googleCalendarConnected: true,
          dismissedChecklistItems: true,
        },
      }),
      // Check draft sections (built by background pipeline)
      this.prisma.sectionContent.findMany({
        where: { tenantId, isDraft: true },
        select: { blockType: true },
        take: 100,
      }),
      // Check published sections
      this.prisma.sectionContent.findMany({
        where: { tenantId, isDraft: false },
        select: { blockType: true },
        take: 100,
      }),
    ]);

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const dismissed = tenant.dismissedChecklistItems || [];
    const draftTypes = new Set<BlockType>(draftSections.map((s) => s.blockType));
    const publishedTypes = new Set<BlockType>(publishedSections.map((s) => s.blockType));

    // Check if MVP sections (HERO, ABOUT, SERVICES) have content
    const mvpBlockTypes: BlockType[] = ['HERO', 'ABOUT', 'SERVICES'];
    const hasMvpSections = mvpBlockTypes.every((t) => draftTypes.has(t));

    const items: Array<{
      id: string;
      label: string;
      completed: boolean;
      weight: number;
      action:
        | { type: 'agent_prompt'; prompt: string }
        | { type: 'navigate'; path: string }
        | { type: 'modal'; modal: string };
    }> = [
      {
        id: 'review_sections',
        label: 'Review your website sections',
        completed: hasMvpSections,
        weight: 15,
        action: { type: 'navigate', path: '/tenant/dashboard?showPreview=true' },
      },
      {
        id: 'upload_photos',
        label: 'Upload your photos',
        completed: false, // TODO: implement photo upload tracking
        weight: 15,
        action: { type: 'modal', modal: 'photo-upload' },
      },
      {
        id: 'add_testimonials',
        label: 'Add testimonials',
        completed: draftTypes.has('TESTIMONIALS'),
        weight: 15,
        action: {
          type: 'agent_prompt',
          prompt: "Let's add a testimonials section. Do you have any client quotes I can use?",
        },
      },
      {
        id: 'add_faq',
        label: 'Add FAQ section',
        completed: draftTypes.has('FAQ'),
        weight: 10,
        action: {
          type: 'agent_prompt',
          prompt: "Let's create an FAQ section. What questions do your clients ask most?",
        },
      },
      {
        id: 'add_gallery',
        label: 'Add a gallery',
        completed: draftTypes.has('GALLERY'),
        weight: 10,
        action: {
          type: 'agent_prompt',
          prompt: "Let's set up your portfolio gallery. Do you have photos to showcase?",
        },
      },
      {
        id: 'connect_stripe',
        label: 'Connect Stripe for payments',
        completed: tenant.stripeOnboarded === true,
        weight: 15,
        action: { type: 'navigate', path: '/tenant/payments' },
      },
      {
        id: 'set_availability',
        label: 'Set your availability',
        completed: tenant.googleCalendarConnected === true,
        weight: 10,
        action: { type: 'navigate', path: '/tenant/calendar' },
      },
      {
        id: 'publish_website',
        label: 'Publish your website',
        completed: publishedTypes.size > 0,
        weight: 10,
        action: {
          type: 'agent_prompt',
          prompt: "Ready to publish? I'll walk you through it.",
        },
      },
    ];

    // Build final items with dismissed flag
    const setupItems = items.map((item) => ({
      ...item,
      dismissed: dismissed.includes(item.id),
    }));

    // Calculate percentage excluding dismissed items
    const activeItems = setupItems.filter((i) => !i.dismissed);
    const totalWeight = activeItems.reduce((sum, i) => sum + i.weight, 0);
    const completedWeight = activeItems
      .filter((i) => i.completed)
      .reduce((sum, i) => sum + i.weight, 0);
    const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    return { percentage, items: setupItems };
  }

  /**
   * Dismiss a checklist item (add to dismissedChecklistItems array).
   * Uses Prisma's atomic push to avoid read-then-write race conditions.
   * Idempotent: checks for duplicates before pushing.
   */
  async dismissChecklistItem(tenantId: string, itemId: string): Promise<void> {
    // Check for duplicates first (idempotency)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dismissedChecklistItems: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const dismissed = tenant.dismissedChecklistItems || [];
    if (dismissed.includes(itemId)) {
      return; // Already dismissed, no-op
    }

    // Atomic push — no read-modify-write race
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        dismissedChecklistItems: { push: itemId },
      },
    });

    logger.info({ tenantId, itemId }, '[Onboarding] Dismissed checklist item');
  }
}

// =============================================================================
// Error Classes
// =============================================================================

export class InvalidTransitionError extends Error {
  public readonly from: string;
  public readonly to: string;

  constructor(from: string, to: string) {
    super(`Invalid onboarding transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class ConcurrentModificationError extends Error {
  public readonly currentVersion: number;

  constructor(currentVersion: number) {
    super(`Concurrent modification detected (version: ${currentVersion})`);
    this.name = 'ConcurrentModificationError';
    this.currentVersion = currentVersion;
  }
}
