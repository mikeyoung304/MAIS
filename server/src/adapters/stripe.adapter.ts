/**
 * Stripe payment adapter
 */

import Stripe from 'stripe';
import type { PaymentProvider, CheckoutSession } from '../lib/ports';

export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
}

export class StripePaymentAdapter implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(options: StripeAdapterOptions) {
    this.stripe = new Stripe(options.secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
      maxNetworkRetries: 3, // Retry on transient network failures (safe with idempotency keys)
    });
    this.webhookSecret = options.webhookSecret;
  }

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number; // Unused for standard checkout, included for interface compatibility
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    // Create Stripe checkout session with idempotency key
    const options: Stripe.RequestOptions = {};
    if (input.idempotencyKey) {
      options.idempotencyKey = input.idempotencyKey;
    }

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: input.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: input.amountCents,
              product_data: {
                name: 'Service Booking',
                description: 'Service tier booking',
              },
            },
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      },
      options
    );

    if (!session.url) {
      throw new Error('Stripe session created but no URL returned');
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Create Stripe Connect checkout session with application fee
   *
   * Uses Stripe Connect's destination charges pattern:
   * - Payment goes directly to the connected account (tenant)
   * - Platform takes an application fee
   * - Connected account is responsible for refunds
   *
   * @see https://stripe.com/docs/connect/destination-charges
   */
  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    // Validate application fee (Stripe requires 0.5% - 50%)
    const minFee = Math.ceil(input.amountCents * 0.005); // 0.5%
    const maxFee = Math.floor(input.amountCents * 0.5); // 50%

    if (input.applicationFeeAmount < minFee) {
      throw new Error(
        `Application fee ${input.applicationFeeAmount} cents is below Stripe minimum (${minFee} cents, 0.5%)`
      );
    }

    if (input.applicationFeeAmount > maxFee) {
      throw new Error(
        `Application fee ${input.applicationFeeAmount} cents exceeds Stripe maximum (${maxFee} cents, 50%)`
      );
    }

    // Create Stripe Connect checkout session with idempotency key
    const options: Stripe.RequestOptions = {};
    if (input.idempotencyKey) {
      options.idempotencyKey = input.idempotencyKey;
    }

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: input.email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: input.amountCents,
              product_data: {
                name: 'Service Booking',
                description: 'Service tier booking',
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: input.applicationFeeAmount,
          transfer_data: {
            destination: input.stripeAccountId,
          },
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      },
      options
    );

    if (!session.url) {
      throw new Error('Stripe Connect session created but no URL returned');
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  async verifyWebhook(payload: string, signature: string): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return event;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Webhook signature verification failed: ${message}`);
    }
  }

  /**
   * Create Stripe Checkout session for subscription
   *
   * Uses Stripe Checkout in subscription mode for platform billing.
   * This is simpler than Stripe Subscriptions API - just a redirect.
   *
   * @param input - Subscription checkout parameters
   * @param input.tenantId - Tenant ID for metadata
   * @param input.email - Customer email
   * @param input.priceId - Stripe Price ID for the subscription
   * @returns Checkout session with URL
   */
  async createSubscriptionCheckout(input: {
    tenantId: string;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [
        {
          price: input.priceId,
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenantId: input.tenantId,
        checkoutType: 'subscription', // Distinguish from booking checkouts
        ...input.metadata, // Include additional metadata (e.g., tier)
      },
      // Also set metadata on the subscription for webhook access
      subscription_data: {
        metadata: {
          tenantId: input.tenantId,
          ...input.metadata,
        },
      },
    });

    if (!session.url) {
      throw new Error('Stripe subscription checkout session created but no URL returned');
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Refund a payment
   *
   * Supports both full and partial refunds. Works with both regular and
   * Stripe Connect payments (destination charges).
   *
   * @param input - Refund parameters
   * @param input.paymentIntentId - Stripe PaymentIntent ID to refund
   * @param input.amountCents - Optional: amount to refund in cents (omit for full refund)
   * @param input.reason - Optional: reason for refund ('duplicate', 'fraudulent', 'requested_by_customer')
   * @returns Refund details (ID, status, amount)
   *
   * @see https://stripe.com/docs/api/refunds/create
   */
  async refund(input: {
    paymentIntentId: string;
    amountCents?: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<{
    refundId: string;
    status: string;
    amountCents: number;
  }> {
    // Validate reason if provided
    const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
    if (input.reason && !validReasons.includes(input.reason)) {
      throw new Error(
        `Invalid refund reason: ${input.reason}. Must be one of: ${validReasons.join(', ')}`
      );
    }

    // Create refund via Stripe API with idempotency key
    const options: Stripe.RequestOptions = {};
    if (input.idempotencyKey) {
      options.idempotencyKey = input.idempotencyKey;
    }

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        amount: input.amountCents, // Omit for full refund, specify for partial
        reason: input.reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined,
      },
      options
    );

    return {
      refundId: refund.id,
      status: refund.status || 'pending', // 'pending', 'succeeded', 'failed', 'canceled'
      amountCents: refund.amount,
    };
  }
}
