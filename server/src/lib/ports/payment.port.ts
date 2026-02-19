/**
 * Payment Provider Port — Payment processing integration
 */

import type Stripe from 'stripe';

/**
 * Payment Provider - Payment processing integration
 */
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number; // Platform commission in cents
    idempotencyKey?: string; // Idempotency key to prevent duplicate charges
    successUrl: string; // Tenant-specific success URL
    cancelUrl: string; // Tenant-specific cancel URL
  }): Promise<CheckoutSession>;
  createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string; // Connected account ID
    applicationFeeAmount: number; // Platform commission in cents (required for Connect)
    idempotencyKey?: string; // Idempotency key to prevent duplicate charges
    successUrl: string; // Tenant-specific success URL
    cancelUrl: string; // Tenant-specific cancel URL
  }): Promise<CheckoutSession>;
  verifyWebhook(payload: string, signature: string): Promise<Stripe.Event>;
  refund(input: {
    paymentIntentId: string;
    amountCents?: number; // Optional: for partial refunds, omit for full refund
    reason?: string; // Optional: reason for refund
    idempotencyKey?: string; // Idempotency key to prevent duplicate refunds
  }): Promise<{
    refundId: string;
    status: string;
    amountCents: number;
  }>;
}

/**
 * Checkout session response from payment provider
 */
export interface CheckoutSession {
  url: string;
  sessionId: string;
}
