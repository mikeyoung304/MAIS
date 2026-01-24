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
import type { Config } from '../lib/core/config';
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
 * - Tenant-specific success/cancel URL generation
 */
export class CheckoutSessionFactory {
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly idempotencyService: IdempotencyService,
    config: Config
  ) {
    // Use CORS_ORIGIN as frontend base URL (e.g., https://gethandled.ai in production)
    this.frontendBaseUrl = config.CORS_ORIGIN;
  }

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

    // Generate idempotency key first (synchronous operation)
    const idempotencyKey = this.idempotencyService.generateCheckoutKey(...idempotencyKeyParts);

    // Parallelize independent database calls:
    // - Fetch tenant to get Stripe account ID
    // - Check if this request has already been processed
    const [tenant, cachedResponse] = await Promise.all([
      this.tenantRepo.findById(tenantId),
      this.idempotencyService.getStoredResponse(idempotencyKey),
    ]);

    // Return cached response if available (check before tenant validation for efficiency)
    if (cachedResponse) {
      const data = cachedResponse.data as { url: string };
      return { checkoutUrl: data.url };
    }

    // Validate tenant exists
    if (!tenant) {
      logger.warn({ tenantId }, 'Tenant not found in checkout flow');
      throw new NotFoundError('The requested resource was not found');
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

    // Build tenant-specific success/cancel URLs
    // URL pattern: /t/{slug}/book/success?session_id={CHECKOUT_SESSION_ID}
    const encodedSlug = encodeURIComponent(tenant.slug);
    const successUrl = `${this.frontendBaseUrl}/t/${encodedSlug}/book/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${this.frontendBaseUrl}/t/${encodedSlug}/book`;

    // Add tenant slug to metadata for webhook routing
    const enrichedMetadata = {
      ...metadata,
      tenantSlug: tenant.slug,
    };

    // Create Stripe checkout session
    let session;

    if (tenant.stripeAccountId && tenant.stripeOnboarded) {
      // Stripe Connect checkout - payment goes to tenant's account
      session = await this.paymentProvider.createConnectCheckoutSession({
        amountCents,
        email,
        metadata: enrichedMetadata,
        stripeAccountId: tenant.stripeAccountId,
        applicationFeeAmount,
        idempotencyKey,
        successUrl,
        cancelUrl,
      });
    } else {
      // Standard Stripe checkout - payment goes to platform account
      session = await this.paymentProvider.createCheckoutSession({
        amountCents,
        email,
        metadata: enrichedMetadata,
        applicationFeeAmount,
        idempotencyKey,
        successUrl,
        cancelUrl,
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
