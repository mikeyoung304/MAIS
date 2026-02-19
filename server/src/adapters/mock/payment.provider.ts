/**
 * Mock Payment Provider
 *
 * In-memory implementation of PaymentProvider for testing and local development.
 */

import type { PaymentProvider, CheckoutSession } from '../../lib/ports';
import type Stripe from 'stripe';

export class MockPaymentProvider implements PaymentProvider {
  private idempotencyCache = new Map<string, CheckoutSession>();

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_session_${Date.now()}`;
    const checkoutUrl = input.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId);

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, session);
    }

    return session;
  }

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
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_connect_session_${Date.now()}`;
    const checkoutUrl = input.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId);

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, session);
    }

    return session;
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<Stripe.Event> {
    return {
      id: 'evt_mock_123',
      object: 'event',
      api_version: '2025-10-29.clover',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'mock_session_verified',
        } as Stripe.Checkout.Session,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as Stripe.Event;
  }

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
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'succeeded',
      amountCents: input.amountCents || 100000,
    };
  }
}
