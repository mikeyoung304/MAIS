/**
 * Webhook Processor - Business logic for processing Stripe webhooks
 *
 * Extracted from WebhooksController for use by:
 * 1. BullMQ worker (async processing)
 * 2. Direct synchronous processing (fallback when Redis unavailable)
 *
 * This separation allows the webhook route to:
 * - Record the webhook event immediately
 * - Respond 200 to Stripe within 5 seconds
 * - Process the event in the background
 */

import type { Job } from 'bullmq';
import type Stripe from 'stripe';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import type { PaymentProvider, WebhookRepository } from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import { WebhookValidationError, WebhookProcessingError } from '../lib/errors';
import type { WebhookJobData } from './types';

// Zod schema for Stripe session (runtime validation)
const StripeSessionSchema = z.object({
  id: z.string(),
  amount_total: z.number().nullable(),
  metadata: z.object({
    tenantId: z.string(), // CRITICAL: Multi-tenant data isolation
    packageId: z.string(),
    eventDate: z.string(),
    email: z.string().email(),
    coupleName: z.string(),
    addOnIds: z.string().optional(),
    commissionAmount: z.string().optional(),
    commissionPercent: z.string().optional(),
  }),
});

// Zod schema for metadata validation
const MetadataSchema = z.object({
  tenantId: z.string(), // CRITICAL: Multi-tenant data isolation
  packageId: z.string().optional(), // Optional for balance payments
  eventDate: z.string().optional(), // Optional for balance payments
  email: z.string().email(),
  coupleName: z.string().optional(), // Optional for balance payments
  addOnIds: z.string().optional(),
  commissionAmount: z.string().optional(),
  commissionPercent: z.string().optional(),
  // Booking type field
  bookingType: z.enum(['DATE', 'TIMESLOT']).optional(), // DATE for weddings, TIMESLOT for appointments
  // Deposit fields
  isDeposit: z.string().optional(),
  totalCents: z.string().optional(), // Full total for deposit bookings
  depositPercent: z.string().optional(),
  // Balance payment fields
  isBalancePayment: z.string().optional(),
  bookingId: z.string().optional(),
  balanceAmountCents: z.string().optional(),
});

/**
 * WebhookProcessor - Handles the actual webhook business logic
 */
export class WebhookProcessor {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly bookingService: BookingService,
    private readonly webhookRepo: WebhookRepository
  ) {}

  /**
   * Process a webhook job from the queue
   * Called by BullMQ worker
   */
  async processJob(job: Job<WebhookJobData>): Promise<void> {
    const { eventId, tenantId, rawPayload, signature } = job.data;

    logger.info(
      { jobId: job.id, eventId, tenantId, attempt: job.attemptsMade + 1 },
      'Processing webhook job'
    );

    try {
      await this.processWebhook(rawPayload, signature, eventId, tenantId);
    } catch (error) {
      // Update webhook status on failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.webhookRepo.markFailed(tenantId, eventId, errorMessage);
      throw error; // Re-throw for BullMQ retry logic
    }
  }

  /**
   * Process a webhook synchronously (fallback mode)
   * Called directly when Redis is unavailable
   */
  async processSynchronously(
    rawPayload: string,
    signature: string,
    eventId: string,
    tenantId: string
  ): Promise<void> {
    await this.processWebhook(rawPayload, signature, eventId, tenantId);
  }

  /**
   * Core webhook processing logic
   * Shared between async (BullMQ) and sync (fallback) modes
   */
  private async processWebhook(
    rawPayload: string,
    signature: string,
    eventId: string,
    effectiveTenantId: string
  ): Promise<void> {
    let event: Stripe.Event;

    // Verify webhook signature (already verified in route, but verify again for security)
    try {
      event = await this.paymentProvider.verifyWebhook(rawPayload, signature);
    } catch (error) {
      logger.error({ error, eventId }, 'Webhook signature verification failed in processor');
      throw new WebhookValidationError('Invalid webhook signature');
    }

    // Process based on event type
    try {
      if (event.type === 'checkout.session.completed') {
        await this.processCheckoutCompleted(event, effectiveTenantId);
      } else if (event.type === 'payment_intent.payment_failed') {
        await this.processPaymentFailed(event, effectiveTenantId);
      } else {
        logger.info(
          { eventId: event.id, type: event.type },
          'Ignoring unhandled webhook event type'
        );
      }

      // Mark webhook as successfully processed
      await this.webhookRepo.markProcessed(effectiveTenantId, event.id);
    } catch (error) {
      // Don't mark as failed for validation errors (already handled)
      if (!(error instanceof WebhookValidationError)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.webhookRepo.markFailed(effectiveTenantId, event.id, errorMessage);

        logger.error(
          {
            eventId: event.id,
            eventType: event.type,
            error: errorMessage,
          },
          'Webhook processing failed'
        );

        throw new WebhookProcessingError(errorMessage);
      }

      throw error;
    }
  }

  /**
   * Process checkout.session.completed event
   */
  private async processCheckoutCompleted(
    event: Stripe.Event,
    effectiveTenantId: string
  ): Promise<void> {
    // Validate and parse session data
    const sessionResult = StripeSessionSchema.safeParse(event.data.object);
    if (!sessionResult.success) {
      logger.error(
        { errors: sessionResult.error.flatten() },
        'Invalid session structure from Stripe'
      );
      await this.webhookRepo.markFailed(
        effectiveTenantId,
        event.id,
        'Invalid session structure - validation failed'
      );
      throw new WebhookValidationError('Invalid Stripe session structure');
    }
    const session = sessionResult.data;

    // Validate metadata with Zod
    const metadataResult = MetadataSchema.safeParse(session.metadata);
    if (!metadataResult.success) {
      logger.error({ errors: metadataResult.error.flatten() }, 'Invalid webhook metadata');
      await this.webhookRepo.markFailed(
        effectiveTenantId,
        event.id,
        'Invalid metadata - validation failed'
      );
      throw new WebhookValidationError('Invalid webhook metadata');
    }

    const {
      tenantId: validatedTenantId,
      packageId,
      eventDate,
      email,
      coupleName,
      addOnIds,
      commissionAmount,
      commissionPercent,
      bookingType,
      isDeposit,
      totalCents: metadataTotalCents,
      depositPercent,
      isBalancePayment,
      bookingId,
      balanceAmountCents,
    } = metadataResult.data;

    // Check if this is a balance payment
    if (isBalancePayment === 'true' && bookingId) {
      await this.processBalancePayment(
        event,
        session,
        validatedTenantId,
        bookingId,
        balanceAmountCents
      );
    } else {
      await this.processNewBooking(event, session, {
        validatedTenantId,
        packageId: packageId!,
        eventDate: eventDate!,
        email,
        coupleName: coupleName!,
        addOnIds,
        commissionAmount,
        commissionPercent,
        bookingType,
        isDeposit,
        metadataTotalCents,
        depositPercent,
      });
    }
  }

  /**
   * Process balance payment completion
   */
  private async processBalancePayment(
    event: Stripe.Event,
    session: z.infer<typeof StripeSessionSchema>,
    tenantId: string,
    bookingId: string,
    balanceAmountCents?: string
  ): Promise<void> {
    const balanceAmount = balanceAmountCents
      ? parseInt(balanceAmountCents, 10)
      : (session.amount_total ?? 0);

    logger.info(
      {
        eventId: event.id,
        sessionId: session.id,
        tenantId,
        bookingId,
        balanceAmount,
      },
      'Processing balance payment completion'
    );

    await this.bookingService.onBalancePaymentCompleted(tenantId, bookingId, balanceAmount);

    logger.info(
      { eventId: event.id, sessionId: session.id, tenantId, bookingId },
      'Balance payment processed successfully'
    );
  }

  /**
   * Process new booking (deposit or full payment)
   */
  private async processNewBooking(
    event: Stripe.Event,
    session: z.infer<typeof StripeSessionSchema>,
    data: {
      validatedTenantId: string;
      packageId: string;
      eventDate: string;
      email: string;
      coupleName: string;
      addOnIds?: string;
      commissionAmount?: string;
      commissionPercent?: string;
      bookingType?: 'DATE' | 'TIMESLOT';
      isDeposit?: string;
      metadataTotalCents?: string;
      depositPercent?: string;
    }
  ): Promise<void> {
    // Parse add-on IDs with Zod validation
    let parsedAddOnIds: string[] = [];
    if (data.addOnIds) {
      try {
        const parsed = JSON.parse(data.addOnIds);
        if (!Array.isArray(parsed)) {
          logger.warn({ addOnIds: data.addOnIds, parsed }, 'addOnIds is not an array, ignoring');
        } else {
          const arrayResult = z.array(z.string()).safeParse(parsed);
          if (arrayResult.success) {
            parsedAddOnIds = arrayResult.data;
          } else {
            logger.warn(
              { addOnIds: data.addOnIds, errors: arrayResult.error.flatten() },
              'addOnIds array contains non-string values, ignoring'
            );
          }
        }
      } catch (error) {
        logger.warn(
          {
            addOnIds: data.addOnIds,
            error: error instanceof Error ? error.message : String(error),
          },
          'Invalid JSON in addOnIds, ignoring'
        );
      }
    }

    // Calculate total from Stripe session (in cents)
    const totalCents =
      data.isDeposit === 'true' && data.metadataTotalCents
        ? parseInt(data.metadataTotalCents, 10)
        : (session.amount_total ?? 0);

    logger.info(
      {
        eventId: event.id,
        sessionId: session.id,
        tenantId: data.validatedTenantId,
        packageId: data.packageId,
        eventDate: data.eventDate,
        email: data.email,
        isDeposit: data.isDeposit === 'true',
      },
      'Processing checkout completion'
    );

    // Parse commission data
    const commissionAmountNum = data.commissionAmount
      ? parseInt(data.commissionAmount, 10)
      : undefined;
    const commissionPercentNum = data.commissionPercent
      ? parseFloat(data.commissionPercent)
      : undefined;

    // Create booking in database (tenant-scoped)
    await this.bookingService.onPaymentCompleted(data.validatedTenantId, {
      sessionId: session.id,
      packageId: data.packageId,
      eventDate: data.eventDate,
      email: data.email,
      coupleName: data.coupleName,
      addOnIds: parsedAddOnIds,
      totalCents,
      commissionAmount: commissionAmountNum,
      commissionPercent: commissionPercentNum,
      bookingType: data.bookingType || 'DATE',
      isDeposit: data.isDeposit === 'true',
      depositPercent: data.depositPercent ? parseFloat(data.depositPercent) : undefined,
    });

    logger.info(
      { eventId: event.id, sessionId: session.id, tenantId: data.validatedTenantId },
      'Booking created successfully'
    );
  }

  /**
   * Process payment_intent.payment_failed event
   */
  private async processPaymentFailed(
    event: Stripe.Event,
    effectiveTenantId: string
  ): Promise<void> {
    const failedIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = failedIntent.metadata;
    const bookingId = metadata?.bookingId;
    const tenantId = metadata?.tenantId || effectiveTenantId;

    if (bookingId && tenantId && tenantId !== '_global') {
      try {
        await this.bookingService.markPaymentFailed(tenantId, bookingId, {
          reason: failedIntent.last_payment_error?.message || 'Payment failed',
          code: failedIntent.last_payment_error?.code || 'unknown',
          paymentIntentId: failedIntent.id,
        });

        logger.warn(
          {
            bookingId,
            tenantId,
            paymentIntentId: failedIntent.id,
            errorCode: failedIntent.last_payment_error?.code,
            errorMessage: failedIntent.last_payment_error?.message,
          },
          'Payment failed for existing booking'
        );
      } catch (error) {
        logger.error(
          {
            bookingId,
            tenantId,
            paymentIntentId: failedIntent.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to mark booking payment as failed'
        );
      }
    } else {
      logger.info(
        {
          paymentIntentId: failedIntent.id,
          tenantId,
          email: metadata?.email,
          errorCode: failedIntent.last_payment_error?.code,
          errorMessage: failedIntent.last_payment_error?.message,
        },
        'Payment failed during checkout - no booking created'
      );
    }
  }
}
