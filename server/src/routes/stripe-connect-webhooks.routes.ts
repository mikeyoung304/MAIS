/**
 * Stripe Connect Account Webhooks Controller
 *
 * Handles Stripe Connect account events to keep tenant Stripe status in sync:
 * - account.updated: Track charges_enabled status changes
 * - account.application.deauthorized: Handle account disconnection
 *
 * NOTE: This route requires raw body parsing (not JSON) for signature verification
 * Uses a separate webhook secret (STRIPE_CONNECT_WEBHOOK_SECRET) from payment webhooks
 */

import Stripe from 'stripe';
import { logger } from '../lib/core/logger';
import { WebhookValidationError } from '../lib/errors/business';
import type { PrismaClient } from '../generated/prisma';
import { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';

interface _TenantSecrets {
  stripe?: unknown;
  [key: string]: unknown;
}

export class StripeConnectWebhooksController {
  private stripe: Stripe;
  private readonly tenantRepo: PrismaTenantRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly stripeSecretKey: string,
    private readonly connectWebhookSecret: string
  ) {
    this.tenantRepo = new PrismaTenantRepository(prisma);
    // Initialize Stripe client with the same API version as payment adapter
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
  }

  /**
   * Handles incoming Stripe Connect account webhook events
   *
   * Process flow:
   * 1. Verify webhook signature with Connect webhook secret
   * 2. Route to appropriate handler based on event type
   * 3. Update tenant database records based on account status
   *
   * @param rawBody - Raw webhook payload string (required for signature verification)
   * @param signature - Stripe signature header (stripe-signature)
   *
   * @returns Promise that resolves when webhook is processed
   *
   * @throws {WebhookValidationError} If signature verification fails
   */
  async handleConnectWebhook(rawBody: string, signature: string): Promise<void> {
    let event: Stripe.Event;

    // Verify webhook signature with Connect-specific secret
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.connectWebhookSecret);
    } catch (error) {
      logger.error({ error }, 'Connect webhook signature verification failed');
      throw new WebhookValidationError('Invalid webhook signature');
    }

    logger.info(
      { eventId: event.id, type: event.type, accountId: event.account as string },
      'Stripe Connect webhook received'
    );

    // Route to appropriate handler based on event type
    try {
      switch (event.type) {
        case 'account.updated':
          await this.handleAccountUpdated(event);
          break;

        case 'account.application.deauthorized':
          await this.handleAccountDeauthorized(event);
          break;

        default:
          logger.info(
            { eventId: event.id, type: event.type },
            'Ignoring unhandled Connect webhook event type'
          );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          eventId: event.id,
          eventType: event.type,
          error: errorMessage,
        },
        'Connect webhook processing failed'
      );
      throw error;
    }
  }

  /**
   * Handle account.updated event
   *
   * Updates tenant stripeOnboarded flag when charges_enabled status changes.
   * This ensures the platform knows when a tenant can accept payments.
   *
   * @param event - Stripe account.updated event
   */
  private async handleAccountUpdated(event: Stripe.Event): Promise<void> {
    const account = event.data.object as Stripe.Account;
    const stripeAccountId = account.id;

    logger.info(
      {
        eventId: event.id,
        stripeAccountId,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
      },
      'Processing account.updated event'
    );

    // Find tenant by Stripe account ID
    const tenant = await this.tenantRepo.findByStripeAccountId(stripeAccountId);

    if (!tenant) {
      logger.warn(
        { eventId: event.id, stripeAccountId },
        'Received account.updated for unknown Stripe account - ignoring'
      );
      return;
    }

    // Check if onboarding status changed
    const newOnboardedStatus = account.charges_enabled === true;

    if (tenant.stripeOnboarded !== newOnboardedStatus) {
      // Update tenant stripeOnboarded flag
      await this.tenantRepo.update(tenant.id, { stripeOnboarded: newOnboardedStatus });

      logger.info(
        {
          eventId: event.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          stripeAccountId,
          oldStatus: tenant.stripeOnboarded,
          newStatus: newOnboardedStatus,
        },
        'Updated tenant stripeOnboarded status'
      );
    } else {
      logger.debug(
        {
          eventId: event.id,
          tenantId: tenant.id,
          stripeAccountId,
          status: newOnboardedStatus,
        },
        'Stripe account status unchanged'
      );
    }
  }

  /**
   * Handle account.application.deauthorized event
   *
   * Clears tenant Stripe account data when they disconnect their account.
   * This happens when a user revokes platform access from the Stripe dashboard.
   *
   * @param event - Stripe account.application.deauthorized event
   */
  private async handleAccountDeauthorized(event: Stripe.Event): Promise<void> {
    const account = event.data.object as Stripe.Account;
    const stripeAccountId = account.id;

    logger.warn(
      { eventId: event.id, stripeAccountId },
      'Processing account.application.deauthorized event'
    );

    // Find tenant by Stripe account ID
    const tenant = await this.tenantRepo.findByStripeAccountId(stripeAccountId);

    if (!tenant) {
      logger.warn(
        { eventId: event.id, stripeAccountId },
        'Received deauthorization for unknown Stripe account - ignoring'
      );
      return;
    }

    // Clear Stripe account data and encrypted secrets
    await this.tenantRepo.update(tenant.id, {
      stripeAccountId: undefined, // Will be set to null by Prisma
      stripeOnboarded: false,
      secrets: {}, // Clear encrypted Stripe keys
    });

    logger.warn(
      {
        eventId: event.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        stripeAccountId,
      },
      'Cleared tenant Stripe account data after deauthorization'
    );
  }
}

/**
 * Factory function to create Stripe Connect webhook routes
 *
 * @param prisma - Prisma client instance
 * @param stripeSecretKey - Stripe secret key
 * @param connectWebhookSecret - Stripe Connect webhook secret
 * @returns Express router with Connect webhook endpoint
 */
export function createStripeConnectWebhookRoutes(
  prisma: PrismaClient,
  stripeSecretKey: string,
  connectWebhookSecret: string
): (req: any, res: any) => Promise<void> {
  const controller = new StripeConnectWebhooksController(
    prisma,
    stripeSecretKey,
    connectWebhookSecret
  );

  return async (req: any, res: any): Promise<void> => {
    try {
      // Extract raw body (Buffer) and Stripe signature header
      const rawBody = req.body ? req.body.toString('utf8') : '';
      const signatureHeader = req.headers['stripe-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || '';

      await controller.handleConnectWebhook(rawBody, signature);
      res.status(204).send();
    } catch (error) {
      if (error instanceof WebhookValidationError) {
        logger.warn({ error: error.message }, 'Connect webhook validation failed');
        res.status(400).json({ error: error.message });
      } else {
        logger.error({ error }, 'Connect webhook processing failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
