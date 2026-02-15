/**
 * Stripe webhook event fixtures for integration tests
 *
 * These fixtures simulate real Stripe webhook payloads for testing
 * payment flows, refunds, and commission handling.
 */

import type Stripe from 'stripe';

/**
 * Create a checkout.session.completed event
 * Simulates successful payment with booking metadata
 */
export function createCheckoutSessionCompletedEvent(
  sessionId: string,
  metadata: {
    tenantId: string;
    tierId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
    commissionAmount?: number;
    commissionPercent?: number;
  },
  amountTotal: number,
  paymentIntentId?: string
): Stripe.Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        currency: 'usd',
        customer_email: metadata.email,
        payment_status: 'paid',
        status: 'complete',
        mode: 'payment',
        payment_intent: paymentIntentId || `pi_${Date.now()}`,
        metadata: {
          tenantId: metadata.tenantId,
          tierId: metadata.tierId,
          eventDate: metadata.eventDate,
          email: metadata.email,
          coupleName: metadata.coupleName,
          addOnIds: metadata.addOnIds ? JSON.stringify(metadata.addOnIds) : undefined,
          commissionAmount: metadata.commissionAmount?.toString(),
          commissionPercent: metadata.commissionPercent?.toString(),
        },
      } as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a payment_intent.payment_failed event
 * Simulates payment failure scenario
 */
export function createPaymentFailedEvent(
  paymentIntentId: string,
  metadata: {
    tenantId: string;
    tierId: string;
    eventDate: string;
    email: string;
    coupleName: string;
  },
  amountCents: number,
  errorCode: string = 'card_declined'
): Stripe.Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: amountCents,
        currency: 'usd',
        status: 'requires_payment_method',
        last_payment_error: {
          code: errorCode,
          message: `Your card was declined.`,
          type: 'card_error',
        },
        metadata: {
          tenantId: metadata.tenantId,
          tierId: metadata.tierId,
          eventDate: metadata.eventDate,
          email: metadata.email,
          coupleName: metadata.coupleName,
        },
      } as Stripe.PaymentIntent,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a charge.refunded event
 * Simulates full or partial refund
 */
export function createChargeRefundedEvent(
  chargeId: string,
  refundId: string,
  metadata: {
    tenantId: string;
    bookingId?: string;
  },
  amountRefunded: number,
  amountTotal: number,
  applicationFeeAmount?: number
): Stripe.Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refunded',
    data: {
      object: {
        id: chargeId,
        object: 'charge',
        amount: amountTotal,
        amount_refunded: amountRefunded,
        application_fee_amount: applicationFeeAmount,
        currency: 'usd',
        refunded: amountRefunded === amountTotal,
        refunds: {
          object: 'list',
          data: [
            {
              id: refundId,
              object: 'refund',
              amount: amountRefunded,
              charge: chargeId,
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              status: 'succeeded',
            },
          ],
        },
        metadata: {
          tenantId: metadata.tenantId,
          bookingId: metadata.bookingId,
        },
      } as Stripe.Charge,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a checkout session with Stripe Connect (application fee)
 * Used for testing commission flows with connected accounts
 */
export function createConnectCheckoutSessionCompletedEvent(
  sessionId: string,
  metadata: {
    tenantId: string;
    tierId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
    commissionAmount: number;
    commissionPercent: number;
  },
  amountTotal: number,
  stripeAccountId: string,
  paymentIntentId?: string
): Stripe.Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        currency: 'usd',
        customer_email: metadata.email,
        payment_status: 'paid',
        status: 'complete',
        mode: 'payment',
        payment_intent: paymentIntentId || `pi_${Date.now()}`,
        // Stripe Connect specific fields
        payment_intent_data: {
          application_fee_amount: metadata.commissionAmount,
          transfer_data: {
            destination: stripeAccountId,
          },
        },
        metadata: {
          tenantId: metadata.tenantId,
          tierId: metadata.tierId,
          eventDate: metadata.eventDate,
          email: metadata.email,
          coupleName: metadata.coupleName,
          addOnIds: metadata.addOnIds ? JSON.stringify(metadata.addOnIds) : undefined,
          commissionAmount: metadata.commissionAmount.toString(),
          commissionPercent: metadata.commissionPercent.toString(),
        },
      } as any, // Extended Stripe.Checkout.Session with Connect fields
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Create a refund with application fee reversal
 * Used for testing commission refunds on Stripe Connect
 */
export function createRefundWithFeeReversalEvent(
  refundId: string,
  paymentIntentId: string,
  metadata: {
    tenantId: string;
    bookingId?: string;
  },
  refundAmount: number,
  reversedApplicationFeeAmount: number
): Stripe.Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    type: 'charge.refund.updated',
    data: {
      object: {
        id: refundId,
        object: 'refund',
        amount: refundAmount,
        charge: `ch_${Date.now()}`,
        payment_intent: paymentIntentId,
        currency: 'usd',
        status: 'succeeded',
        // Application fee reversal
        application_fee_refund: `fr_${Date.now()}`,
        metadata: {
          tenantId: metadata.tenantId,
          bookingId: metadata.bookingId,
        },
      } as any, // Refund with fee reversal
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event;
}

/**
 * Helper to serialize event for webhook signature verification
 * In real tests, this would be used with Stripe's signature generation
 */
export function serializeEvent(event: Stripe.Event): string {
  return JSON.stringify(event);
}
