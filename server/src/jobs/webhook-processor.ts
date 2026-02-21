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
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { WebhookValidationError, WebhookProcessingError } from '../lib/errors';
import { parseOnboardingStatus } from '@macon/contracts';
import type { WebhookJobData } from './types';

// Zod schema for subscription checkout metadata (Product-Led Growth)
const SubscriptionMetadataSchema = z.object({
  tenantId: z.string(),
  checkoutType: z.literal('subscription'),
  tier: z.enum(['STARTER', 'PRO']).optional(), // Optional for backward compat
});

// Zod schema for membership checkout metadata (onboarding payment step)
const MembershipMetadataSchema = z.object({
  tenantId: z.string(),
  checkoutType: z.literal('membership'),
});

// Zod schema for Stripe session (runtime validation)
const StripeSessionSchema = z.object({
  id: z.string(),
  amount_total: z.number().nullable(),
  metadata: z.object({
    tenantId: z.string(), // CRITICAL: Multi-tenant data isolation
    tierId: z.string(),
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
  tierId: z.string().optional(), // Optional for balance payments
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
  // Per-person pricing fields
  guestCount: z.string().optional(), // Number of guests for per-person scaling
  // Chatbot booking fields
  source: z.string().optional(), // 'customer_chatbot' for chatbot-created bookings
  confirmationCode: z.string().optional(), // Confirmation code for chatbot bookings
});

/**
 * WebhookProcessor - Handles the actual webhook business logic
 */
export class WebhookProcessor {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly bookingService: BookingService,
    private readonly webhookRepo: WebhookRepository,
    private readonly tenantRepo?: PrismaTenantRepository
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
      } else if (event.type === 'customer.subscription.deleted') {
        await this.processSubscriptionCancelled(event);
      } else if (event.type === 'invoice.payment_failed') {
        await this.processInvoicePaymentFailed(event);
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
    // Get raw session object for initial type detection
    const rawSession = event.data.object as Stripe.Checkout.Session;
    const metadata = rawSession.metadata || {};

    // Check if this is a membership checkout (onboarding payment step)
    const membershipResult = MembershipMetadataSchema.safeParse(metadata);
    if (membershipResult.success) {
      await this.processMembershipCheckout(event, rawSession, membershipResult.data.tenantId);
      return;
    }

    // Check if this is a subscription checkout (Product-Led Growth)
    const subscriptionResult = SubscriptionMetadataSchema.safeParse(metadata);
    if (subscriptionResult.success) {
      await this.processSubscriptionCheckout(event, rawSession, subscriptionResult.data.tenantId);
      return;
    }

    // Validate and parse session data for booking checkouts
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
      tierId,
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
      guestCount,
      isBalancePayment,
      bookingId,
      balanceAmountCents,
      source,
    } = metadataResult.data;

    // Check if this is a chatbot booking payment (booking already exists, needs confirmation)
    if (source === 'customer_chatbot' && bookingId) {
      await this.processChatbotBookingPayment(event, session, validatedTenantId, bookingId);
    }
    // Check if this is a balance payment
    else if (isBalancePayment === 'true' && bookingId) {
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
        tierId: tierId!,
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
        guestCount,
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
   * Process chatbot booking payment completion
   *
   * Chatbot bookings are created FIRST in PENDING status, then customer
   * is redirected to Stripe checkout. When payment completes, this method
   * updates the booking to CONFIRMED and sets paidAt timestamp.
   */
  private async processChatbotBookingPayment(
    event: Stripe.Event,
    session: z.infer<typeof StripeSessionSchema>,
    tenantId: string,
    bookingId: string
  ): Promise<void> {
    const amountPaid = session.amount_total ?? 0;

    logger.info(
      {
        eventId: event.id,
        sessionId: session.id,
        tenantId,
        bookingId,
        amountPaid,
      },
      'Processing chatbot booking payment completion'
    );

    // Update booking status to CONFIRMED and set payment timestamp
    await this.bookingService.confirmChatbotBooking(tenantId, bookingId, amountPaid);

    logger.info(
      { eventId: event.id, sessionId: session.id, tenantId, bookingId },
      'Chatbot booking payment processed successfully'
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
      tierId: string;
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
      guestCount?: string;
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
        tierId: data.tierId,
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
      tierId: data.tierId,
      eventDate: data.eventDate,
      email: data.email,
      coupleName: data.coupleName,
      addOnIds: parsedAddOnIds,
      totalCents,
      guestCount: data.guestCount ? parseInt(data.guestCount, 10) : undefined,
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

  /**
   * Process membership checkout completion (onboarding payment step)
   *
   * When a new tenant completes the membership payment during onboarding:
   * 1. Transition onboardingStatus from PENDING_PAYMENT → PENDING_INTAKE
   * 2. Store stripeCustomerId for future billing
   *
   * This advances them to the intake form step in the onboarding flow.
   */
  private async processMembershipCheckout(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
    tenantId: string
  ): Promise<void> {
    if (!this.tenantRepo) {
      logger.error(
        { eventId: event.id, tenantId },
        'TenantRepository not available - cannot process membership checkout'
      );
      throw new WebhookProcessingError('TenantRepository not configured for membership processing');
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    logger.info(
      {
        eventId: event.id,
        sessionId: session.id,
        tenantId,
        customerId,
      },
      'Processing membership checkout completion'
    );

    // Status guard: only advance if tenant is still in PENDING_PAYMENT
    // Prevents webhook replays from regressing a tenant who already advanced
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new WebhookProcessingError(`Tenant not found: ${tenantId}`);
    }

    const currentStatus = parseOnboardingStatus(tenant.onboardingStatus);
    if (currentStatus !== 'PENDING_PAYMENT') {
      logger.warn(
        { tenantId, eventId: event.id, currentStatus },
        'Membership webhook received but tenant already past PENDING_PAYMENT — ignoring'
      );
      return;
    }

    // Transition onboarding status: PENDING_PAYMENT → PENDING_INTAKE
    await this.tenantRepo.update(tenantId, {
      onboardingStatus: 'PENDING_INTAKE',
      stripeCustomerId: customerId || undefined,
    });

    logger.info(
      { tenantId, eventId: event.id },
      'Membership payment completed - tenant advanced to PENDING_INTAKE'
    );
  }

  /**
   * Process subscription checkout completion (Product-Led Growth)
   *
   * When a tenant completes checkout for tiered subscription:
   * 1. Update subscriptionStatus to ACTIVE
   * 2. Set tier to STARTER or PRO based on metadata
   * 3. Reset AI message counter
   * 4. Store stripeCustomerId for future reference
   */
  private async processSubscriptionCheckout(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
    tenantId: string
  ): Promise<void> {
    if (!this.tenantRepo) {
      logger.error(
        { eventId: event.id, tenantId },
        'TenantRepository not available - cannot process subscription checkout'
      );
      throw new WebhookProcessingError(
        'TenantRepository not configured for subscription processing'
      );
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    // Extract tier from metadata (default to STARTER for backward compat)
    const tier = (session.metadata?.tier as 'STARTER' | 'PRO') || 'STARTER';

    logger.info(
      {
        eventId: event.id,
        sessionId: session.id,
        tenantId,
        customerId,
        tier,
        subscriptionId: session.subscription,
      },
      'Processing subscription checkout completion'
    );

    // Update tenant subscription status, tier, and reset usage
    await this.tenantRepo.update(tenantId, {
      subscriptionStatus: 'ACTIVE',
      tier,
      stripeCustomerId: customerId || undefined,
      aiMessagesUsed: 0, // Reset on new subscription
      aiMessagesResetAt: new Date(),
    });

    logger.info(
      { tenantId, tier, eventId: event.id },
      'Tenant subscription activated successfully'
    );
  }

  /**
   * Process subscription cancellation (customer.subscription.deleted)
   *
   * When a subscription is cancelled (either by admin or Stripe due to payment failure):
   * 1. Downgrade tier to FREE
   * 2. Update subscriptionStatus to EXPIRED
   *
   * Note: We don't reset AI usage - they keep the messages until month ends
   */
  private async processSubscriptionCancelled(event: Stripe.Event): Promise<void> {
    if (!this.tenantRepo) {
      logger.warn(
        { eventId: event.id },
        'TenantRepository not available - cannot process subscription cancellation'
      );
      return;
    }

    const subscription = event.data.object as Stripe.Subscription;
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      logger.warn(
        { eventId: event.id, subscriptionId: subscription.id },
        'Subscription cancellation missing tenantId in metadata'
      );
      return;
    }

    logger.info(
      { eventId: event.id, tenantId, subscriptionId: subscription.id },
      'Processing subscription cancellation'
    );

    await this.tenantRepo.update(tenantId, {
      tier: 'FREE',
      subscriptionStatus: 'EXPIRED',
    });

    logger.info(
      { tenantId, eventId: event.id },
      'Tenant subscription cancelled - downgraded to FREE'
    );
    // TODO: Send "sorry to see you go" email
  }

  /**
   * Process invoice payment failure (invoice.payment_failed)
   *
   * When a recurring payment fails, log the event but don't immediately downgrade.
   * Stripe will retry the payment according to its dunning settings.
   * Only cancel after subscription.deleted event.
   */
  private async processInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const tenantId = (invoice as { subscription_details?: { metadata?: { tenantId?: string } } })
      .subscription_details?.metadata?.tenantId;

    logger.warn(
      {
        eventId: event.id,
        invoiceId: invoice.id,
        tenantId: tenantId || 'unknown',
        customerEmail: invoice.customer_email,
        amountDue: invoice.amount_due,
      },
      'Invoice payment failed - Stripe will retry'
    );

    // Don't downgrade yet - Stripe will retry the payment
    // The subscription.deleted event will trigger if all retries fail
    // TODO: Send payment failed notification email
  }
}
