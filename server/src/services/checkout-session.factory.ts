/**
 * Checkout Session Factory
 *
 * Shared Stripe checkout session creation logic for wedding bookings,
 * balance payments, and appointment bookings.
 *
 * Extracted from BookingService as part of P0-1 BookingService decomposition.
 *
 * @module checkout-session.factory
 */

import type { PaymentProvider } from '../lib/ports';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { IdempotencyService } from './idempotency.service';
import { NotFoundError } from '../lib/errors';
import { logger } from '../lib/core/logger';

/**
 * Input for creating a checkout session
 */
export interface CreateCheckoutSessionInput {
  tenantId: string;
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
  applicationFeeAmount: number;
  idempotencyKeyParts: [string, string, string, string, number];
}

/**
 * Result of checkout session creation
 */
export interface CheckoutSessionResult {
  checkoutUrl: string;
}

/**
 * Factory for creating Stripe checkout sessions
 *
 * Handles:
 * - Idempotency key generation and deduplication
 * - Race condition handling with retry logic
 * - Stripe Connect vs Standard checkout routing
 * - Response caching for duplicate requests
 */
export class CheckoutSessionFactory {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  /**
   * Create a Stripe checkout session with idempotency protection
   *
   * @param params - Checkout session parameters
   * @returns Object containing the Stripe checkout URL
   * @throws {NotFoundError} If tenant doesn't exist
   */
  async createCheckoutSession(params: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const { tenantId, amountCents, email, metadata, applicationFeeAmount, idempotencyKeyParts } =
      params;

    // Fetch tenant to get Stripe account ID
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      logger.warn({ tenantId }, 'Tenant not found in checkout flow');
      throw new NotFoundError('The requested resource was not found');
    }

    // Generate idempotency key for checkout session
    const idempotencyKey = this.idempotencyService.generateCheckoutKey(...idempotencyKeyParts);

    // Check if this request has already been processed
    const cachedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
    if (cachedResponse) {
      const data = cachedResponse.data as { url: string };
      return { checkoutUrl: data.url };
    }

    // Store idempotency key before making Stripe call
    const isNew = await this.idempotencyService.checkAndStore(idempotencyKey);
    if (!isNew) {
      // Race condition: another request stored the key while we were checking
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
      if (retryResponse) {
        const retryData = retryResponse.data as { url: string };
        return { checkoutUrl: retryData.url };
      }
      // If still no response, proceed anyway (edge case)
    }

    // Create Stripe checkout session
    let session;

    if (tenant.stripeAccountId && tenant.stripeOnboarded) {
      // Stripe Connect checkout - payment goes to tenant's account
      session = await this.paymentProvider.createConnectCheckoutSession({
        amountCents,
        email,
        metadata,
        stripeAccountId: tenant.stripeAccountId,
        applicationFeeAmount,
        idempotencyKey,
      });
    } else {
      // Standard Stripe checkout - payment goes to platform account
      session = await this.paymentProvider.createCheckoutSession({
        amountCents,
        email,
        metadata,
        applicationFeeAmount,
        idempotencyKey,
      });
    }

    // Cache the response for future duplicate requests
    await this.idempotencyService.updateResponse(idempotencyKey, {
      data: session,
      timestamp: new Date().toISOString(),
    });

    return { checkoutUrl: session.url };
  }
}
