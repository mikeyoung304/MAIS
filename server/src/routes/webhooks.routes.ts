/**
 * Webhooks HTTP controller
 * NOTE: This route requires raw body parsing (not JSON)
 * P0/P1: Uses Zod for payload validation, no JSON.parse()
 *
 * ASYNC PROCESSING:
 * - Webhooks are recorded and queued for background processing
 * - Returns 200 to Stripe immediately (within 5-second limit)
 * - Processing happens via BullMQ worker (or sync fallback if Redis unavailable)
 */

import type { PaymentProvider, WebhookRepository } from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import type { WebhookQueue } from '../jobs/webhook-queue';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { WebhookProcessor } from '../jobs/webhook-processor';
import { logger } from '../lib/core/logger';
import { WebhookValidationError } from '../lib/errors';
import type Stripe from 'stripe';

export class WebhooksController {
  private processor: WebhookProcessor;

  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly bookingService: BookingService,
    private readonly webhookRepo: WebhookRepository,
    private readonly webhookQueue?: WebhookQueue,
    private readonly tenantRepo?: PrismaTenantRepository
  ) {
    this.processor = new WebhookProcessor(paymentProvider, bookingService, webhookRepo, tenantRepo);
  }

  /**
   * Handles incoming Stripe webhook events with async processing
   *
   * Flow:
   * 1. Verify webhook signature with Stripe secret
   * 2. Check for duplicate event ID (idempotency)
   * 3. Record webhook event in database with PENDING status
   * 4. Enqueue for background processing (or process sync if Redis unavailable)
   * 5. Return 200 immediately to Stripe
   *
   * The actual business logic (booking creation, etc.) happens in the background
   * via the WebhookProcessor, allowing us to respond to Stripe within the 5-second limit.
   *
   * @param rawBody - Raw webhook payload string (required for signature verification)
   * @param signature - Stripe signature header (stripe-signature)
   *
   * @returns Promise that resolves when webhook is recorded (processing continues async)
   *
   * @throws {WebhookValidationError} If signature verification fails
   */
  async handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
    let event: Stripe.Event;

    // Step 1: Verify webhook signature (fast - must pass before anything else)
    try {
      event = await this.paymentProvider.verifyWebhook(rawBody, signature);
    } catch (error) {
      logger.error({ error }, 'Webhook signature verification failed');
      throw new WebhookValidationError('Invalid webhook signature');
    }

    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook received');

    // Step 2: Check global idempotency BEFORE tenant extraction
    // Stripe event IDs are globally unique - use them for deduplication
    const isGlobalDupe = await this.webhookRepo.isDuplicate('_global', event.id);
    if (isGlobalDupe) {
      logger.info(
        { eventId: event.id },
        'Duplicate webhook (global check) - returning 200 OK to Stripe'
      );
      return;
    }

    // Step 3: Extract tenantId from metadata
    let tenantId: string | undefined;
    try {
      const tempSession = event.data.object as Stripe.Checkout.Session;
      tenantId = tempSession?.metadata?.tenantId;
    } catch (err) {
      logger.warn(
        { eventId: event.id, error: err },
        'Could not extract tenantId from webhook metadata'
      );
    }

    // For checkout.session.completed, tenantId is CRITICAL - fail fast
    if (!tenantId && event.type === 'checkout.session.completed') {
      logger.error(
        { eventId: event.id, type: event.type },
        'CRITICAL: checkout.session.completed webhook missing tenantId in metadata. ' +
          'Rejecting webhook - Stripe will retry. Fix checkout session creation to include tenantId in metadata.'
      );
      throw new WebhookValidationError('Webhook missing required tenantId in metadata');
    }

    const effectiveTenantId = tenantId || '_global';
    if (!tenantId) {
      logger.warn(
        { eventId: event.id, type: event.type },
        'Webhook event missing tenantId - recording under _global namespace'
      );
    }

    // Step 4: Record webhook event in database
    const isNewRecord = await this.webhookRepo.recordWebhook({
      tenantId: effectiveTenantId,
      eventId: event.id,
      eventType: event.type,
      rawPayload: rawBody,
    });

    // Race condition fix: if another concurrent call already recorded this event
    if (!isNewRecord) {
      logger.info(
        { eventId: event.id },
        'Webhook duplicate detected during recording - returning 200 OK'
      );
      return;
    }

    // Step 5: Enqueue for async processing OR process synchronously
    if (this.webhookQueue?.isAsyncAvailable()) {
      // Async mode: enqueue and return immediately
      const result = await this.webhookQueue.add({
        eventId: event.id,
        tenantId: effectiveTenantId,
        rawPayload: rawBody,
        signature,
      });

      if (result.queued) {
        logger.info(
          { eventId: event.id, jobId: result.jobId },
          'Webhook enqueued for async processing'
        );
        return; // Return 200 to Stripe immediately
      }
      // If queueing failed, fall through to sync processing
    }

    // Sync mode: process immediately (Redis unavailable or queue add failed)
    logger.info({ eventId: event.id }, 'Processing webhook synchronously (no queue available)');

    // Process synchronously - validation errors are still thrown
    // to maintain proper error behavior and security test compatibility
    await this.processor.processSynchronously(rawBody, signature, event.id, effectiveTenantId);
  }

  /**
   * Get the webhook processor for use by the BullMQ worker
   * Called during DI container initialization
   */
  getProcessor(): WebhookProcessor {
    return this.processor;
  }
}
