/**
 * Webhooks HTTP controller
 * NOTE: This route requires raw body parsing (not JSON)
 * P0/P1: Uses Zod for payload validation, no JSON.parse()
 */

import type { PaymentProvider, WebhookRepository } from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import { logger } from '../lib/core/logger';
import {
  WebhookValidationError,
  WebhookProcessingError,
} from '../lib/errors';
import { z } from 'zod';
import type Stripe from 'stripe';

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

interface StripeCheckoutSession {
  id: string;
  metadata: {
    tenantId: string;
    packageId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string;
    commissionAmount?: string;
    commissionPercent?: string;
  };
  amount_total: number | null;
}

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
  // Deposit fields
  isDeposit: z.string().optional(),
  totalCents: z.string().optional(), // Full total for deposit bookings
  depositPercent: z.string().optional(),
  // Balance payment fields
  isBalancePayment: z.string().optional(),
  bookingId: z.string().optional(),
  balanceAmountCents: z.string().optional(),
});

export class WebhooksController {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly bookingService: BookingService,
    private readonly webhookRepo: WebhookRepository
  ) {}

  /**
   * Handles incoming Stripe webhook events with comprehensive validation and error handling
   *
   * Implements critical security and reliability features:
   * - Cryptographic signature verification to prevent spoofing
   * - Idempotency protection using event ID deduplication
   * - Zod-based payload validation (no unsafe JSON.parse)
   * - Error tracking with webhook repository
   * - Race condition protection for booking creation
   *
   * Process flow:
   * 1. Verify webhook signature with Stripe secret
   * 2. Check for duplicate event ID (idempotency)
   * 3. Record webhook event in database
   * 4. Validate payload structure with Zod
   * 5. Process checkout.session.completed events
   * 6. Mark as processed or failed for retry logic
   *
   * @param rawBody - Raw webhook payload string (required for signature verification)
   * @param signature - Stripe signature header (stripe-signature)
   *
   * @returns Promise that resolves when webhook is processed (or identified as duplicate)
   *
   * @throws {WebhookValidationError} If signature verification fails or payload is invalid
   * @throws {WebhookProcessingError} If booking creation or database operations fail
   *
   * @example
   * ```typescript
   * // Express route handler
   * app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
   *   try {
   *     await webhooksController.handleStripeWebhook(
   *       req.body.toString(),
   *       req.headers['stripe-signature']
   *     );
   *     res.status(200).send('OK');
   *   } catch (error) {
   *     if (error instanceof WebhookValidationError) {
   *       res.status(400).json({ error: error.message });
   *     } else {
   *       res.status(500).json({ error: 'Internal error' });
   *     }
   *   }
   * });
   * ```
   */
  async handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
    let event: Stripe.Event;

    // Verify webhook signature
    try {
      event = await this.paymentProvider.verifyWebhook(rawBody, signature);
    } catch (error) {
      logger.error({ error }, 'Webhook signature verification failed');
      throw new WebhookValidationError('Invalid webhook signature');
    }

    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook received');

    // CRITICAL: Stripe event IDs are globally unique across all Stripe accounts
    // Use event.id FIRST for idempotency to prevent race conditions
    // This prevents the "unknown tenant bucket" issue where failed extractions
    // would share idempotency checks

    // Step 1: Check global idempotency BEFORE tenant extraction
    // This uses a temporary "global" namespace just for the duplicate check
    const isGlobalDupe = await this.webhookRepo.isDuplicate('_global', event.id);
    if (isGlobalDupe) {
      logger.info({ eventId: event.id }, 'Duplicate webhook (global check) - returning 200 OK to Stripe');
      return;
    }

    // Step 2: Extract tenantId from metadata (for recording and processing)
    // For checkout.session.completed, tenantId is REQUIRED - fail fast if missing
    let tenantId: string | undefined;
    try {
      // Type-safe extraction using Stripe's event data structure
      const tempSession = event.data.object as Stripe.Checkout.Session;
      tenantId = tempSession?.metadata?.tenantId;
    } catch (err) {
      logger.warn({ eventId: event.id, error: err }, 'Could not extract tenantId from webhook metadata');
    }

    // For checkout.session.completed, tenantId is CRITICAL - fail fast
    // Stripe will retry the webhook, giving us time to fix the metadata bug
    if (!tenantId && event.type === 'checkout.session.completed') {
      logger.error(
        { eventId: event.id, type: event.type },
        'CRITICAL: checkout.session.completed webhook missing tenantId in metadata. ' +
        'Rejecting webhook - Stripe will retry. Fix checkout session creation to include tenantId in metadata.'
      );
      throw new WebhookValidationError('Webhook missing required tenantId in metadata');
    }

    // For non-critical events (payment_intent.created, etc.), use '_global' namespace
    // This is only for audit trail - idempotency is already handled above
    const effectiveTenantId = tenantId || '_global';
    if (!tenantId) {
      logger.warn(
        { eventId: event.id, type: event.type },
        'Webhook event missing tenantId - recording under _global namespace (non-critical for this event type)'
      );
    }

    // Record webhook event (with tenant or _global namespace for audit)
    // Note: We already checked for duplicates using _global namespace above
    // recordWebhook returns false if duplicate detected (P2002 unique constraint)
    const isNewRecord = await this.webhookRepo.recordWebhook({
      tenantId: effectiveTenantId,
      eventId: event.id,
      eventType: event.type,
      rawPayload: rawBody,
    });

    // RACE CONDITION FIX: If recordWebhook detected a duplicate (another concurrent
    // call already recorded this event), return early to avoid double-processing.
    // This handles the case where two concurrent calls both passed the initial
    // isDuplicate check before either recorded.
    if (!isNewRecord) {
      logger.info({ eventId: event.id }, 'Webhook duplicate detected during recording - returning 200 OK');
      return;
    }

    // Process webhook with error handling
    try {
      // Process checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        // Validate and parse session data
        const sessionResult = StripeSessionSchema.safeParse(event.data.object);
        if (!sessionResult.success) {
          // Log full error details for debugging (server logs only)
          logger.error({ errors: sessionResult.error.flatten() }, 'Invalid session structure from Stripe');
          // Store only error type in DB - no sensitive data (P0 security fix)
          await this.webhookRepo.markFailed(
            effectiveTenantId,
            event.id,
            'Invalid session structure - validation failed'
          );
          throw new WebhookValidationError('Invalid Stripe session structure');
        }
        const session = sessionResult.data;

        // Validate metadata with Zod (replaces JSON.parse)
        const metadataResult = MetadataSchema.safeParse(session.metadata);
        if (!metadataResult.success) {
          // Log full error details for debugging (server logs only)
          logger.error({ errors: metadataResult.error.flatten() }, 'Invalid webhook metadata');
          // Store only error type in DB - no sensitive data (P0 security fix)
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
          isDeposit,
          totalCents: metadataTotalCents,
          depositPercent,
          isBalancePayment,
          bookingId,
          balanceAmountCents,
        } = metadataResult.data;

        // Check if this is a balance payment
        if (isBalancePayment === 'true' && bookingId) {
          // This is a balance payment - update existing booking
          const balanceAmount = balanceAmountCents ? parseInt(balanceAmountCents, 10) : session.amount_total ?? 0;

          logger.info(
            {
              eventId: event.id,
              sessionId: session.id,
              tenantId: validatedTenantId,
              bookingId,
              balanceAmount,
            },
            'Processing balance payment completion'
          );

          await this.bookingService.onBalancePaymentCompleted(
            validatedTenantId,
            bookingId,
            balanceAmount
          );

          logger.info({ eventId: event.id, sessionId: session.id, tenantId: validatedTenantId, bookingId }, 'Balance payment processed successfully');
        } else {
          // This is a regular booking (deposit or full payment)
          // Parse add-on IDs with Zod validation
          let parsedAddOnIds: string[] = [];
          if (addOnIds) {
            try {
              const parsed = JSON.parse(addOnIds);

              // Validate it's an array
              if (!Array.isArray(parsed)) {
                logger.warn({ addOnIds, parsed }, 'addOnIds is not an array, ignoring');
              } else {
                // Validate all elements are strings
                const arrayResult = z.array(z.string()).safeParse(parsed);
                if (arrayResult.success) {
                  parsedAddOnIds = arrayResult.data;
                } else {
                  logger.warn({
                    addOnIds,
                    errors: arrayResult.error.flatten()
                  }, 'addOnIds array contains non-string values, ignoring');
                }
              }
            } catch (error) {
              logger.warn({
                addOnIds,
                error: error instanceof Error ? error.message : String(error)
              }, 'Invalid JSON in addOnIds, ignoring');
            }
          }

          // Calculate total from Stripe session (in cents)
          // For deposits, use the original totalCents from metadata
          const totalCents = isDeposit === 'true' && metadataTotalCents
            ? parseInt(metadataTotalCents, 10)
            : session.amount_total ?? 0;

          logger.info(
            {
              eventId: event.id,
              sessionId: session.id,
              tenantId: validatedTenantId,
              packageId,
              eventDate,
              email,
              isDeposit: isDeposit === 'true',
            },
            'Processing checkout completion'
          );

          // Parse commission data from metadata
          const commissionAmountNum = commissionAmount ? parseInt(commissionAmount, 10) : undefined;
          const commissionPercentNum = commissionPercent ? parseFloat(commissionPercent) : undefined;

          // Create booking in database (tenant-scoped)
          // BookingConflictError is handled below as idempotent success
          await this.bookingService.onPaymentCompleted(validatedTenantId, {
            sessionId: session.id,
            packageId: packageId!,
            eventDate: eventDate!,
            email,
            coupleName: coupleName!,
            addOnIds: parsedAddOnIds,
            totalCents,
            commissionAmount: commissionAmountNum,
            commissionPercent: commissionPercentNum,
            isDeposit: isDeposit === 'true',
            depositPercent: depositPercent ? parseFloat(depositPercent) : undefined,
          });

          logger.info({ eventId: event.id, sessionId: session.id, tenantId: validatedTenantId }, 'Booking created successfully');
        }
      } else {
        logger.info({ eventId: event.id, type: event.type }, 'Ignoring unhandled webhook event type');
      }

      // Mark webhook as successfully processed (tenant-scoped)
      await this.webhookRepo.markProcessed(effectiveTenantId, event.id);
    } catch (error) {
      // Don't mark as failed if it's a validation error (already handled)
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

      // Re-throw validation error for proper HTTP response handling
      throw error;
    }
  }
}
