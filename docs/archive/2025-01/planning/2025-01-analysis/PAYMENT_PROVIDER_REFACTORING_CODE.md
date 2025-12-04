# Payment Provider Refactoring - Code Examples

## 1. Create Provider-Agnostic Payment Event Type

### File: server/src/lib/payment-events.ts (NEW)

```typescript
/**
 * Provider-agnostic payment event types
 * Normalizes events from different payment providers
 */

export type PaymentProviderType = 'stripe' | 'paypal' | 'square';

export type PaymentEventType =
  | 'checkout_completed'
  | 'checkout_expired'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'refund_completed'
  | 'refund_failed'
  | 'charge_refunded';

/**
 * Standardized payment event that works across all providers
 */
export interface PaymentEvent {
  /** Unique event ID from provider */
  id: string;

  /** Event type (normalized across providers) */
  type: PaymentEventType;

  /** Which provider sent this event */
  provider: PaymentProviderType;

  /** Raw metadata (contains tenantId, packageId, etc) */
  metadata: Record<string, string>;

  /** Provider-specific data (raw event data) */
  data: Record<string, unknown>;

  /** Unix timestamp of event */
  timestamp: number;

  /** Whether event represents a successful payment */
  isSuccess: boolean;

  /** Amount in cents if applicable */
  amountCents?: number;

  /** Error message if failed */
  error?: string;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}
```

---

## 2. Update PaymentProvider Interface

### File: server/src/lib/ports.ts (MODIFIED)

```typescript
// OLD
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
  }): Promise<CheckoutSession>;

  createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
  }): Promise<CheckoutSession>;

  verifyWebhook(payload: string, signature: string): Promise<Stripe.Event>;
}

// NEW
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
  }): Promise<CheckoutSession>;

  createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId?: string; // Made optional for non-Stripe providers
    applicationFeeAmount: number;
  }): Promise<CheckoutSession>;

  /**
   * Verify webhook signature and normalize to PaymentEvent
   * Returns provider-agnostic PaymentEvent instead of Stripe.Event
   */
  verifyWebhook(payload: string, signature: string): Promise<PaymentEvent>;
}

// NEW: Abstract interface for provider-specific onboarding
export interface PaymentProviderService {
  /** Create connected account for tenant */
  createConnectedAccount(
    tenantId: string,
    config: PaymentProviderConfig
  ): Promise<{ accountId: string }>;

  /** Generate onboarding link for tenant */
  createOnboardingLink(
    tenantId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<{ url: string }>;

  /** Check if tenant completed onboarding */
  checkOnboardingStatus(tenantId: string): Promise<{ isOnboarded: boolean }>;
}

export interface PaymentProviderConfig {
  provider: PaymentProviderType;
  // Stripe-specific
  stripeAccountId?: string;
  stripeRestrictedKey?: string;
  // PayPal-specific
  paypalMerchantId?: string;
  paypalAccessToken?: string;
  // Square-specific
  squareAccountId?: string;
  squareAccessToken?: string;
  // Generic fields
  [key: string]: unknown;
}
```

---

## 3. Refactor StripePaymentAdapter

### File: server/src/adapters/stripe.adapter.ts (REFACTORED)

```typescript
import Stripe from 'stripe';
import type { PaymentProvider, CheckoutSession } from '../lib/ports';
import { PaymentEvent, PaymentEventType } from '../lib/payment-events';
import { logger } from '../lib/core/logger';

export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
  // NEW: Configurable product details
  productName?: string;
  currency?: string;
}

export class StripePaymentAdapter implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;
  private readonly productName: string;
  private readonly currency: string;

  constructor(options: StripeAdapterOptions) {
    this.stripe = new Stripe(options.secretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
    this.webhookSecret = options.webhookSecret;
    this.successUrl = options.successUrl;
    this.cancelUrl = options.cancelUrl;
    this.productName = options.productName || 'Wedding Package';
    this.currency = options.currency || 'usd';
  }

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
  }): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [
        {
          price_data: {
            currency: this.currency,
            unit_amount: input.amountCents,
            product_data: {
              name: this.productName,
              description: 'Wedding/Elopement Package',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${this.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: this.cancelUrl,
      metadata: input.metadata,
    });

    if (!session.url) {
      throw new Error('Stripe session created but no URL returned');
    }

    return { url: session.url, sessionId: session.id };
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId?: string;
    applicationFeeAmount: number;
  }): Promise<CheckoutSession> {
    if (!input.stripeAccountId) {
      throw new Error('stripeAccountId required for Stripe Connect checkout');
    }

    // Validate application fee (Stripe requires 0.5% - 50%)
    const minFee = Math.ceil(input.amountCents * 0.005);
    const maxFee = Math.floor(input.amountCents * 0.5);

    if (input.applicationFeeAmount < minFee) {
      logger.warn(
        { amountCents: input.amountCents, fee: input.applicationFeeAmount },
        'Application fee below Stripe minimum, adjusting'
      );
      input.applicationFeeAmount = minFee;
    }

    if (input.applicationFeeAmount > maxFee) {
      logger.warn(
        { amountCents: input.amountCents, fee: input.applicationFeeAmount },
        'Application fee exceeds Stripe maximum, adjusting'
      );
      input.applicationFeeAmount = maxFee;
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: input.email,
      line_items: [
        {
          price_data: {
            currency: this.currency,
            unit_amount: input.amountCents,
            product_data: {
              name: this.productName,
              description: 'Wedding/Elopement Package',
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
    });

    if (!session.url) {
      throw new Error('Stripe Connect session created but no URL returned');
    }

    return { url: session.url, sessionId: session.id };
  }

  async verifyWebhook(payload: string, signature: string): Promise<PaymentEvent> {
    let stripeEvent: Stripe.Event;

    try {
      stripeEvent = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: message }, 'Stripe webhook verification failed');
      throw new Error(`Webhook verification failed: ${message}`);
    }

    // Normalize Stripe event to PaymentEvent
    return this.normalizeStripeEvent(stripeEvent);
  }

  /**
   * Convert Stripe event to provider-agnostic PaymentEvent
   */
  private normalizeStripeEvent(event: Stripe.Event): PaymentEvent {
    let type: PaymentEventType = 'checkout_completed'; // default
    let isSuccess = false;
    let amountCents: number | undefined;
    let metadata: Record<string, string> = {};
    const data = event.data.object || {};

    switch (event.type) {
      case 'checkout.session.completed': {
        type = 'checkout_completed';
        isSuccess = true;
        const session = event.data.object as Stripe.Checkout.Session;
        amountCents = session.amount_total || undefined;
        metadata = (session.metadata || {}) as Record<string, string>;
        break;
      }
      case 'charge.refunded': {
        type = 'refund_completed';
        isSuccess = true;
        const charge = event.data.object as Stripe.Charge;
        amountCents = charge.amount_refunded || undefined;
        break;
      }
      default:
        logger.warn({ eventType: event.type }, 'Unhandled Stripe event type');
    }

    return {
      id: event.id,
      type,
      provider: 'stripe',
      metadata,
      data,
      timestamp: event.created,
      isSuccess,
      amountCents,
    };
  }
}
```

---

## 4. Create PayPal Adapter (Example)

### File: server/src/adapters/paypal.adapter.ts (NEW)

```typescript
import type { PaymentProvider, CheckoutSession } from '../lib/ports';
import { PaymentEvent } from '../lib/payment-events';
import { logger } from '../lib/core/logger';

export interface PayPalAdapterOptions {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  successUrl: string;
  cancelUrl: string;
}

export class PayPalPaymentAdapter implements PaymentProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly mode: 'sandbox' | 'live';
  private readonly apiBase: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(options: PayPalAdapterOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.mode = options.mode;
    this.successUrl = options.successUrl;
    this.cancelUrl = options.cancelUrl;
    this.apiBase =
      options.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
  }): Promise<CheckoutSession> {
    // PayPal specific implementation
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: (input.amountCents / 100).toFixed(2),
            },
            custom_id: JSON.stringify({
              ...input.metadata,
              applicationFeeAmount: input.applicationFeeAmount || 0,
            }),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${this.successUrl}?order_id={ORDER_ID}`,
              cancel_url: this.cancelUrl,
              brand_name: 'Wedding Booking',
            },
          },
        },
      }),
    });

    const data = await response.json();
    const paypalOrderId = data.id;

    // Find approve link
    const approveLink = data.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approveLink) {
      throw new Error('PayPal order created but no approve URL');
    }

    return {
      url: approveLink,
      sessionId: paypalOrderId,
    };
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId?: string;
    applicationFeeAmount: number;
  }): Promise<CheckoutSession> {
    // PayPal doesn't use Stripe account IDs
    // Implementation would handle PayPal's merchant accounts differently
    throw new Error('PayPal uses different onboarding model. Use PaymentProviderService instead.');
  }

  async verifyWebhook(payload: string, signature: string): Promise<PaymentEvent> {
    // PayPal webhook verification
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      throw new Error('PAYPAL_WEBHOOK_ID not configured');
    }

    const accessToken = await this.getAccessToken();

    // Verify signature with PayPal API
    const verifyResponse = await fetch(
      `${this.apiBase}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          webhook_id: webhookId,
          webhook_event: JSON.parse(payload),
          transmission_id: '', // From headers
          transmission_time: '', // From headers
          cert_url: '', // From headers
          auth_algo: '', // From headers
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    if (verifyData.verification_status !== 'SUCCESS') {
      throw new Error('PayPal webhook verification failed');
    }

    // Normalize PayPal event to PaymentEvent
    const event = JSON.parse(payload);
    return this.normalizePayPalEvent(event);
  }

  private normalizePayPalEvent(event: any): PaymentEvent {
    const metadata = event.resource?.custom_id ? JSON.parse(event.resource.custom_id) : {};

    return {
      id: event.id,
      type:
        event.event_type === 'CHECKOUT.ORDER.COMPLETED'
          ? 'checkout_completed'
          : 'payment_succeeded',
      provider: 'paypal',
      metadata,
      data: event.resource || {},
      timestamp: Math.floor(new Date(event.create_time).getTime() / 1000),
      isSuccess: event.event_type?.includes('COMPLETED'),
      amountCents: event.resource?.amount?.value
        ? Math.round(parseFloat(event.resource.amount.value) * 100)
        : undefined,
    };
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
          'base64'
        )}`,
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json();
    return data.access_token;
  }
}
```

---

## 5. Update WebhooksController

### File: server/src/routes/webhooks.routes.ts (REFACTORED)

```typescript
import type { PaymentProvider, WebhookRepository } from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import { logger } from '../lib/core/logger';
import { WebhookValidationError, WebhookProcessingError } from '../lib/errors';
import { z } from 'zod';
import { PaymentEvent } from '../lib/payment-events';

// Generic metadata schema (works for all providers)
const PaymentMetadataSchema = z.object({
  tenantId: z.string(),
  packageId: z.string(),
  eventDate: z.string(),
  email: z.string().email(),
  coupleName: z.string(),
  addOnIds: z.string().optional(),
  commissionAmount: z.string().optional(),
  commissionPercent: z.string().optional(),
});

export class WebhooksController {
  constructor(
    private readonly paymentProvider: PaymentProvider,
    private readonly bookingService: BookingService,
    private readonly webhookRepo: WebhookRepository
  ) {}

  /**
   * Handle webhook from ANY payment provider
   * Provider-agnostic implementation
   */
  async handlePaymentWebhook(rawBody: string, signature: string): Promise<void> {
    let event: PaymentEvent;

    // Verify webhook signature (provider-specific)
    try {
      event = await this.paymentProvider.verifyWebhook(rawBody, signature);
    } catch (error) {
      logger.error({ error }, 'Webhook verification failed');
      throw new WebhookValidationError('Invalid webhook signature');
    }

    logger.info(
      { eventId: event.id, type: event.type, provider: event.provider },
      'Payment webhook received'
    );

    // Extract tenantId from metadata
    let tenantId = 'unknown';
    try {
      tenantId = event.metadata?.tenantId || 'unknown';
    } catch (err) {
      logger.warn({ eventId: event.id }, 'Could not extract tenantId');
    }

    // Idempotency check
    const isDupe = await this.webhookRepo.isDuplicate(tenantId, event.id);
    if (isDupe) {
      logger.info({ eventId: event.id, tenantId }, 'Duplicate webhook ignored');
      return;
    }

    // Record webhook event
    await this.webhookRepo.recordWebhook({
      tenantId,
      eventId: event.id,
      eventType: `${event.provider}:${event.type}`,
      rawPayload: rawBody,
    });

    try {
      // Route by event type (provider-agnostic)
      switch (event.type) {
        case 'checkout_completed':
        case 'payment_succeeded': {
          // Validate metadata
          const metadataResult = PaymentMetadataSchema.safeParse(event.metadata);
          if (!metadataResult.success) {
            logger.error({ errors: metadataResult.error.flatten() }, 'Invalid webhook metadata');
            await this.webhookRepo.markFailed(
              tenantId,
              event.id,
              `Invalid metadata: ${JSON.stringify(metadataResult.error.flatten())}`
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
          } = metadataResult.data;

          // Parse add-on IDs
          let parsedAddOnIds: string[] = [];
          if (addOnIds) {
            try {
              const parsed = JSON.parse(addOnIds);
              const arrayResult = z.array(z.string()).safeParse(parsed);
              if (arrayResult.success) {
                parsedAddOnIds = arrayResult.data;
              }
            } catch (error) {
              logger.warn({ addOnIds, error: String(error) }, 'Invalid addOnIds');
            }
          }

          // Create booking
          await this.bookingService.onPaymentCompleted(validatedTenantId, {
            sessionId: event.id,
            packageId,
            eventDate,
            email,
            coupleName,
            addOnIds: parsedAddOnIds,
            totalCents: event.amountCents || 0,
            commissionAmount: commissionAmount ? parseInt(commissionAmount, 10) : undefined,
            commissionPercent: commissionPercent ? parseFloat(commissionPercent) : undefined,
          });

          logger.info(
            { eventId: event.id, tenantId: validatedTenantId },
            'Payment processed successfully'
          );
          break;
        }

        case 'refund_completed': {
          // Handle refund
          logger.info({ eventId: event.id }, 'Processing refund');
          // Implement refund logic
          break;
        }

        default:
          logger.info(
            { eventId: event.id, type: event.type },
            'Ignoring unhandled webhook event type'
          );
      }

      // Mark as processed
      await this.webhookRepo.markProcessed(tenantId, event.id);
    } catch (error) {
      if (!(error instanceof WebhookValidationError)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.webhookRepo.markFailed(tenantId, event.id, errorMessage);

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
}
```

---

## 6. Update CommissionService

### File: server/src/services/commission.service.ts (REFACTORED)

```typescript
// Remove Stripe-specific limits from here
// Move them to adapter validation

export class CommissionService {
  constructor(private readonly prisma: PrismaClient) {}

  async calculateCommission(tenantId: string, bookingTotal: number): Promise<CommissionResult> {
    // ... existing validation code ...

    const commissionPercent = Number(tenant.commissionPercent);

    // Calculate commission (provider-independent)
    const commissionCents = Math.ceil(bookingTotal * (commissionPercent / 100));

    // REMOVED: Provider-specific validation
    // const minCommission = Math.ceil(bookingTotal * 0.005);
    // const maxCommission = Math.floor(bookingTotal * 0.50);
    // This should be in the payment provider adapter instead

    logger.debug(
      {
        tenantId,
        commissionPercent,
        bookingTotal,
        commissionCents,
      },
      'Commission calculated'
    );

    return {
      amount: commissionCents,
      percent: commissionPercent,
    };
  }

  // ... rest of methods unchanged ...
}
```

---

## 7. Update Tenant Model Schema

### Pseudocode for database schema migration

```typescript
// Current schema
model Tenant {
  id String @id
  stripeAccountId String?      // Stripe-specific
  stripeOnboarded Boolean?      // Stripe-specific
  commissionPercent Decimal
}

// Target schema
model Tenant {
  id String @id
  commissionPercent Decimal

  // NEW: Generic payment configuration
  paymentConfig PaymentProviderConfig?
}

model PaymentProviderConfig {
  id String @id
  tenantId String @unique
  provider String // 'stripe' | 'paypal' | 'square'
  isOnboarded Boolean @default(false)

  // Stripe-specific
  stripeAccountId String?
  stripeRestrictedKey String? // Encrypted

  // PayPal-specific
  paypalMerchantId String?
  paypalAccessToken String? // Encrypted

  // Square-specific
  squareAccountId String?
  squareAccessToken String? // Encrypted

  // Generic fields
  onboardingStatus Json // Flexible status tracking
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
}
```

---

## 8. Update DI Container

### File: server/src/di.ts (REFACTORED)

```typescript
export function buildContainer(config: Config): Container {
  // ... existing setup ...

  // Determine payment provider from config
  const paymentProvider = getPaymentProvider(config);

  // Build payment provider service
  const paymentProviderService = getPaymentProviderService(config);

  // ... rest of setup ...

  return { controllers, services };
}

function getPaymentProvider(config: Config): PaymentProvider {
  const provider = config.PAYMENT_PROVIDER || 'stripe';

  switch (provider) {
    case 'paypal':
      return new PayPalPaymentAdapter({
        clientId: config.PAYPAL_CLIENT_ID!,
        clientSecret: config.PAYPAL_CLIENT_SECRET!,
        mode: config.PAYPAL_MODE as 'sandbox' | 'live',
        successUrl: config.PAYPAL_SUCCESS_URL || 'http://localhost:5173/success',
        cancelUrl: config.PAYPAL_CANCEL_URL || 'http://localhost:5173',
      });

    case 'square':
      return new SquarePaymentAdapter({
        accessToken: config.SQUARE_ACCESS_TOKEN!,
        environment: config.SQUARE_ENVIRONMENT as 'sandbox' | 'production',
        successUrl: config.SQUARE_SUCCESS_URL || 'http://localhost:5173/success',
        cancelUrl: config.SQUARE_CANCEL_URL || 'http://localhost:5173',
      });

    case 'stripe':
    default:
      return new StripePaymentAdapter({
        secretKey: config.STRIPE_SECRET_KEY!,
        webhookSecret: config.STRIPE_WEBHOOK_SECRET!,
        successUrl: config.STRIPE_SUCCESS_URL || 'http://localhost:5173/success',
        cancelUrl: config.STRIPE_CANCEL_URL || 'http://localhost:5173',
        productName: config.PRODUCT_NAME || 'Wedding Package',
        currency: config.CURRENCY || 'usd',
      });
  }
}
```

---

## 9. Update Config Type

### File: server/src/lib/core/config.ts (PARTIAL)

```typescript
export interface Config {
  // ... existing config ...

  // Payment provider selection
  PAYMENT_PROVIDER?: 'stripe' | 'paypal' | 'square';

  // Stripe config
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;

  // PayPal config
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: 'sandbox' | 'live';
  PAYPAL_SUCCESS_URL?: string;
  PAYPAL_CANCEL_URL?: string;
  PAYPAL_WEBHOOK_ID?: string;

  // Square config
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_ENVIRONMENT?: 'sandbox' | 'production';
  SQUARE_SUCCESS_URL?: string;
  SQUARE_CANCEL_URL?: string;

  // Generic
  PRODUCT_NAME?: string;
  CURRENCY?: string;
}
```
