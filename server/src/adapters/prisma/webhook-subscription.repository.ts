/**
 * Prisma Webhook Subscription Repository Adapter
 * Handles tenant webhook subscription management and delivery tracking
 *
 * SECURITY: Webhook HMAC secrets are encrypted at rest using AES-256-GCM
 * via EncryptionService (same pattern as Stripe keys and Google Calendar tokens).
 * The DB column stores JSON-serialized EncryptedData; this repository handles
 * encrypt-on-write and decrypt-on-read transparently.
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type { WebhookSubscriptionRepository } from '../../lib/ports';
import { encryptionService, type EncryptedData } from '../../lib/encryption.service';
import { logger } from '../../lib/core/logger';
import { QueryLimits } from '../../lib/core/query-limits';
import { NotFoundError } from '../../lib/errors';

export class PrismaWebhookSubscriptionRepository implements WebhookSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================================
  // Secret Encryption Helpers
  // ============================================================================

  /**
   * Encrypt a plaintext HMAC secret for database storage.
   * Returns JSON-serialized EncryptedData string.
   */
  private encryptSecret(plaintext: string): string {
    const encrypted = encryptionService.encrypt(plaintext);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt a stored secret back to plaintext.
   * Handles backward compatibility: if the stored value is not valid
   * EncryptedData JSON (i.e., a legacy plaintext secret), returns it as-is
   * and logs a migration warning.
   */
  private decryptSecret(stored: string): string {
    try {
      const parsed: unknown = JSON.parse(stored);
      // Type guard: validate it has the EncryptedData shape
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'ciphertext' in parsed &&
        'iv' in parsed &&
        'authTag' in parsed &&
        typeof (parsed as EncryptedData).ciphertext === 'string' &&
        typeof (parsed as EncryptedData).iv === 'string' &&
        typeof (parsed as EncryptedData).authTag === 'string'
      ) {
        return encryptionService.decrypt(parsed as EncryptedData);
      }
      // Valid JSON but not EncryptedData shape — treat as legacy plaintext
      logger.warn(
        'Webhook secret is valid JSON but not EncryptedData — treating as legacy plaintext'
      );
      return stored;
    } catch {
      // Not valid JSON — legacy plaintext secret (pre-encryption migration)
      // TODO: Run data migration to encrypt existing plaintext secrets in WebhookSubscription rows.
      // Migration script should: SELECT all rows, encrypt each secret, UPDATE each row.
      logger.warn('Webhook secret stored as plaintext (legacy) — decrypt skipped');
      return stored;
    }
  }

  /**
   * Create a new webhook subscription for a tenant
   *
   * @param tenantId - Tenant ID for data isolation
   * @param data - Webhook subscription data
   * @returns Created webhook subscription
   */
  async create(
    tenantId: string,
    data: {
      url: string;
      events: string[];
      secret: string;
    }
  ): Promise<{
    id: string;
    tenantId: string;
    url: string;
    events: string[];
    secret: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // Encrypt the HMAC secret before storing (AES-256-GCM, same as Stripe/GCal secrets)
    const encryptedSecret = this.encryptSecret(data.secret);

    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        tenantId,
        url: data.url,
        events: data.events,
        secret: encryptedSecret,
        active: true,
      },
    });

    logger.info(
      { tenantId, subscriptionId: subscription.id, url: subscription.url },
      'Webhook subscription created'
    );

    // Return the plaintext secret to the caller (shown once on creation)
    return {
      ...subscription,
      secret: data.secret,
    };
  }

  /**
   * Find all webhook subscriptions for a tenant
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of webhook subscriptions
   */
  async findAll(tenantId: string): Promise<
    Array<{
      id: string;
      tenantId: string;
      url: string;
      events: string[];
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: QueryLimits.CATALOG_MAX,
      select: {
        id: true,
        tenantId: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        // Exclude secret from list view
      },
    });

    return subscriptions;
  }

  /**
   * Find webhook subscription by ID
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Subscription ID
   * @returns Webhook subscription or null
   */
  async findById(
    tenantId: string,
    id: string
  ): Promise<{
    id: string;
    tenantId: string;
    url: string;
    events: string[];
    secret: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const subscription = await this.prisma.webhookSubscription.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Tenant isolation
      },
    });

    if (!subscription) return null;

    // Decrypt the HMAC secret for the caller
    return {
      ...subscription,
      secret: this.decryptSecret(subscription.secret),
    };
  }

  /**
   * Find active webhook subscriptions for a specific event type
   *
   * @param tenantId - Tenant ID for data isolation
   * @param eventType - Event type to filter by
   * @returns Array of active subscriptions with secrets for delivery
   */
  async findActiveByEvent(
    tenantId: string,
    eventType: string
  ): Promise<
    Array<{
      id: string;
      url: string;
      secret: string;
    }>
  > {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        tenantId,
        active: true,
        events: {
          has: eventType, // Array contains check
        },
      },
      take: QueryLimits.CATALOG_MAX,
      select: {
        id: true,
        url: true,
        secret: true,
      },
    });

    // Decrypt each subscription's HMAC secret for delivery signing
    return subscriptions.map((sub) => ({
      ...sub,
      secret: this.decryptSecret(sub.secret),
    }));
  }

  /**
   * Update webhook subscription
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Subscription ID
   * @param data - Updated fields
   * @returns Updated subscription
   */
  async update(
    tenantId: string,
    id: string,
    data: {
      url?: string;
      events?: string[];
      active?: boolean;
    }
  ): Promise<{
    id: string;
    tenantId: string;
    url: string;
    events: string[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // Verify subscription exists and belongs to tenant
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Webhook subscription ${id} not found`);
    }

    const updated = await this.prisma.webhookSubscription.update({
      where: {
        id,
        tenantId, // CRITICAL: Tenant isolation
      },
      data: {
        url: data.url,
        events: data.events,
        active: data.active,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        tenantId: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({ tenantId, subscriptionId: id, url: updated.url }, 'Webhook subscription updated');

    return updated;
  }

  /**
   * Delete webhook subscription
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Subscription ID
   */
  async delete(tenantId: string, id: string): Promise<void> {
    // Verify subscription exists and belongs to tenant
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Webhook subscription ${id} not found`);
    }

    await this.prisma.webhookSubscription.delete({
      where: {
        id,
        tenantId, // CRITICAL: Tenant isolation
      },
    });

    logger.info({ tenantId, subscriptionId: id }, 'Webhook subscription deleted');
  }

  // ============================================================================
  // Webhook Delivery Management
  // ============================================================================

  /**
   * Create a webhook delivery record
   *
   * @param data - Delivery data
   * @returns Created delivery record
   */
  async createDelivery(data: {
    subscriptionId: string;
    event: string;
    payload: Record<string, any>;
  }): Promise<{
    id: string;
    subscriptionId: string;
    event: string;
    status: string;
  }> {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        subscriptionId: data.subscriptionId,
        event: data.event,
        payload: data.payload,
        status: 'pending',
        attempts: 0,
      },
      select: {
        id: true,
        subscriptionId: true,
        event: true,
        status: true,
      },
    });

    logger.info(
      { deliveryId: delivery.id, subscriptionId: data.subscriptionId, event: data.event },
      'Webhook delivery queued'
    );

    return delivery;
  }

  /**
   * Mark delivery as delivered
   *
   * @param deliveryId - Delivery ID
   */
  async markDelivered(deliveryId: string): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        lastAttemptAt: new Date(),
      },
    });

    logger.info({ deliveryId }, 'Webhook delivery marked as delivered');
  }

  /**
   * Mark delivery as failed
   *
   * @param deliveryId - Delivery ID
   * @param error - Error message
   */
  async markFailed(deliveryId: string, error: string): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        lastError: error,
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    logger.error({ deliveryId, error }, 'Webhook delivery failed');
  }

  /**
   * Find deliveries by subscription
   *
   * @param tenantId - Tenant ID for data isolation
   * @param subscriptionId - Subscription ID
   * @param limit - Maximum number of deliveries to return
   * @returns Array of deliveries
   */
  async findDeliveriesBySubscription(
    tenantId: string,
    subscriptionId: string,
    limit: number = 50
  ): Promise<
    Array<{
      id: string;
      event: string;
      status: string;
      attempts: number;
      createdAt: Date;
      deliveredAt: Date | null;
      lastError: string | null;
    }>
  > {
    // Verify subscription belongs to tenant
    const subscription = await this.findById(tenantId, subscriptionId);
    if (!subscription) {
      throw new NotFoundError(`Webhook subscription ${subscriptionId} not found`);
    }

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        subscriptionId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        createdAt: true,
        deliveredAt: true,
        lastError: true,
      },
    });

    return deliveries;
  }
}
