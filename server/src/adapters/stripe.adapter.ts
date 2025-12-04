/**
 * Stripe payment adapter
 */

import Stripe from 'stripe';
import type { PaymentProvider, CheckoutSession } from '../lib/ports';

export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
}

export class StripePaymentAdapter implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(options: StripeAdapterOptions) {
    this.stripe = new Stripe(options.secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
    this.webhookSecret = options.webhookSecret;
    this.successUrl = options.successUrl;
    this.cancelUrl = options.cancelUrl;
  }

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
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
                name: 'Wedding Package',
                description: 'Elopement/Micro-Wedding Package',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.cancelUrl,
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
                name: 'Wedding Package',
                description: 'Elopement/Micro-Wedding Package',
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
        success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.cancelUrl,
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
