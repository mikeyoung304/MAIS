/**
 * Prisma Webhook Repository Adapter
 * Handles webhook event deduplication and tracking
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type { WebhookRepository } from '../../lib/ports';
import { logger } from '../../lib/core/logger';

export class PrismaWebhookRepository implements WebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Checks if a webhook event has already been processed
   *
   * Implements idempotency protection by tracking webhook event IDs.
   * Uses atomic operations to prevent race conditions when checking duplicates.
   * If the event exists but isn't marked as DUPLICATE or PROCESSED,
   * updates its status to DUPLICATE and increments attempt counter.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param eventId - Stripe event ID (e.g., "evt_1234...")
   *
   * @returns True if event is a duplicate, false if new
   *
   * @example
   * ```typescript
   * const isDupe = await webhookRepo.isDuplicate('tenant_123', 'evt_abc123');
   * if (isDupe) {
   *   console.log('Already processed - returning 200 OK to Stripe');
   *   return;
   * }
   * ```
   */
  async isDuplicate(tenantId: string, eventId: string): Promise<boolean> {
    // Use atomic findFirst with composite key for tenant isolation
    const existing = await this.prisma.webhookEvent.findFirst({
      where: {
        tenantId,
        eventId,
      },
    });

    if (existing) {
      // Webhook exists for this tenant - check if already processed

      // If webhook already exists, mark as duplicate (unless it's already processed)
      // Use atomic update with composite key to prevent race conditions
      if (existing.status !== 'DUPLICATE' && existing.status !== 'PROCESSED') {
        await this.prisma.webhookEvent.update({
          where: {
            tenantId_eventId: {
              tenantId,
              eventId,
            },
          },
          data: {
            status: 'DUPLICATE',
            attempts: { increment: 1 },
          },
        });
      }
      return true;
    }

    return false;
  }

  /**
   * Records a new webhook event for processing
   *
   * Creates a database record with PENDING status to track webhook lifecycle.
   * Gracefully handles duplicate eventId via unique constraint (P2002 error).
   *
   * @param input - Webhook event metadata
   * @param input.eventId - Stripe event ID
   * @param input.eventType - Event type (e.g., "checkout.session.completed")
   * @param input.rawPayload - Raw JSON payload from Stripe
   *
   * @returns true if new record created, false if duplicate detected
   *
   * @example
   * ```typescript
   * const isNew = await webhookRepo.recordWebhook({
   *   eventId: 'evt_abc123',
   *   eventType: 'checkout.session.completed',
   *   rawPayload: JSON.stringify(event)
   * });
   * if (!isNew) {
   *   // Duplicate detected, return early
   *   return;
   * }
   * ```
   */
  async recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          tenantId: input.tenantId,
          eventId: input.eventId,
          eventType: input.eventType,
          rawPayload: input.rawPayload,
          status: 'PENDING',
          attempts: 1,
        },
      });

      logger.info(
        { tenantId: input.tenantId, eventId: input.eventId, eventType: input.eventType },
        'Webhook event recorded'
      );
      return true; // New record created
    } catch (error) {
      // Only ignore unique constraint violations (duplicate eventId)
      // Use duck typing instead of instanceof due to module resolution issues
      const errorCode = (error as any)?.code;
      const errorName = (error as any)?.constructor?.name;

      // Check for P2002 (unique constraint) via error code and name
      if (errorCode === 'P2002' && errorName === 'PrismaClientKnownRequestError') {
        logger.info(
          { tenantId: input.tenantId, eventId: input.eventId },
          'Webhook already recorded (duplicate eventId)'
        );
        return false; // Duplicate detected
      }

      // Log and re-throw other errors
      logger.error(
        {
          error,
          tenantId: input.tenantId,
          eventId: input.eventId,
          eventType: input.eventType,
        },
        'Failed to record webhook event'
      );

      // Re-throw unexpected errors
      throw error;
    }
  }

  /**
   * Marks a webhook event as successfully processed
   *
   * Updates status to PROCESSED and sets processedAt timestamp.
   * Called after successful booking creation and event emission.
   *
   * @param eventId - Stripe event ID
   *
   * @returns Promise that resolves when updated
   *
   * @example
   * ```typescript
   * await webhookRepo.markProcessed('evt_abc123');
   * // Event now marked as PROCESSED with timestamp
   * ```
   */
  async markProcessed(tenantId: string, eventId: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: {
        tenantId_eventId: {
          tenantId,
          eventId,
        },
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    logger.info({ tenantId, eventId }, 'Webhook marked as processed');
  }

  /**
   * Marks a webhook event as failed with error details
   *
   * Updates status to FAILED, stores error message, and increments attempt counter.
   * Used for retry logic and debugging webhook processing failures.
   *
   * @param eventId - Stripe event ID
   * @param errorMessage - Error description for troubleshooting
   *
   * @returns Promise that resolves when updated
   *
   * @example
   * ```typescript
   * try {
   *   await processWebhook(event);
   * } catch (error) {
   *   await webhookRepo.markFailed('evt_abc123', error.message);
   *   // Event marked as FAILED with error logged
   * }
   * ```
   */
  async markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: {
        tenantId_eventId: {
          tenantId,
          eventId,
        },
      },
      data: {
        status: 'FAILED',
        lastError: errorMessage,
        attempts: { increment: 1 },
      },
    });

    logger.error({ tenantId, eventId, error: errorMessage }, 'Webhook marked as failed');
  }
}
