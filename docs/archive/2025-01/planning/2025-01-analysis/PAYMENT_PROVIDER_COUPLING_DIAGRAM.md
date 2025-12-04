# Payment Provider Coupling - Visual Diagrams

## 1. Current Architecture (Stripe-Centric)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                   │
│  PackagePage.tsx ──→ api.createCheckout() ──→ Checkout URL ────┐│
│                                                                  ││
│  Success.tsx ──────→ Parses session_id from URL (Stripe) ────┐ ││
└──────────────────────────────────────────────────────────────┼──┘
                                                                │  │
                      ┌─────────────────────────────────────────┘  │
                      │                                              │
┌─────────────────────▼──────────────────────────────────────────┐  │
│                    SERVER ROUTES                                │  │
│                                                                  │  │
│  POST /v1/bookings/checkout                                    │  │
│  ├─→ BookingsController.createCheckout()                       │  │
│  └─→ BookingService.createCheckout()                          │  │
│                                                                  │  │
│  POST /v1/webhooks/stripe (raw body)                          │  │
│  ├─→ WebhooksController.handleStripeWebhook()                 │  │
│  └─→ TIGHTLY COUPLED TO STRIPE                                 │  │
└──────────────────────┬───────────────────────────────────────┘  │
                       │                                            │
                       │ ┌────────────────────────────────────────┘
                       │ │
┌──────────────────────▼─▼──────────────────────────────────────┐
│                    SERVICE LAYER                               │
│                                                                │
│  CommissionService                                            │
│  ├─ calculateCommission() ✓ PROVIDER AGNOSTIC               │
│  ├─ Uses: Math.ceil(total * percent / 100)                 │
│  └─ Stripe limits enforced here ✗ SHOULD BE IN ADAPTER      │
│     • minCommission = 0.5% (Stripe limit)                   │
│     • maxCommission = 50% (Stripe limit)                    │
│                                                                │
│  BookingService                                              │
│  ├─ createCheckout(tenantId, input)                         │
│  ├─ Calls commissionService.calculateBookingTotal()         │
│  └─ Routes to provider based on tenant.stripeAccountId      │
│     • IF stripeAccountId: Use Connect checkout              │
│     • ELSE: Use standard checkout                            │
│     ✗ HARDCODED STRIPE FIELDS                                │
│                                                                │
│  StripeConnectService ✗ COMPLETELY STRIPE-SPECIFIC          │
│  ├─ createConnectedAccount()                                │
│  ├─ createOnboardingLink()                                  │
│  ├─ checkOnboardingStatus()                                 │
│  └─ NO ABSTRACT INTERFACE FOR OTHER PROVIDERS               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  ADAPTER LAYER                              │
│                                                              │
│  PaymentProvider Interface ✓ ABSTRACT                      │
│  ├─ createCheckoutSession()                               │
│  ├─ createConnectCheckoutSession()                         │
│  └─ verifyWebhook() ✗ RETURNS Stripe.Event               │
│                                                              │
│  StripePaymentAdapter ✓ CLEAN IMPLEMENTATION              │
│  ├─ Creates Stripe checkout sessions                      │
│  ├─ Verifies Stripe webhook signatures                    │
│  └─ Hardcodes:                                             │
│     • product_data.name = "Wedding Package"               │
│     • currency = "usd"                                     │
│     • mode = "payment"                                     │
│                                                              │
│  MockPaymentAdapter ✓ SHOWS CORRECT PATTERN              │
│  └─ Used in testing                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 WEBHOOK HANDLING                            │
│                                                              │
│  WebhooksController.handleStripeWebhook()                  │
│  ├─ Signature verification: paymentProvider.verifyWebhook()│
│  ├─ Event validation: StripeSessionSchema.safeParse() ✗   │
│  │  └─ Hardcoded to Stripe event structure                │
│  ├─ Event type check: event.type === 'checkout...' ✗     │
│  │  └─ Hardcoded to Stripe event type                    │
│  ├─ Metadata parsing: session.metadata                    │
│  │  └─ Stripe-specific structure assumed                 │
│  └─ Calls: bookingService.onPaymentCompleted()           │
│                                                              │
│  PrismaWebhookRepository                                   │
│  ├─ recordWebhook(tenantId, eventId, ...)                │
│  ├─ isDuplicate() - idempotency check ✓ GOOD             │
│  ├─ markProcessed()                                        │
│  └─ markFailed()                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  DATABASE LAYER                             │
│                                                              │
│  Booking {                                                  │
│    id, tenantId, sessionId (Stripe), status,              │
│    packageId, eventDate, email, coupleName,               │
│    addOnIds, totalCents,                                  │
│    commissionAmount, commissionPercent ✓ STORED          │
│  }                                                          │
│                                                              │
│  Tenant {                                                   │
│    id, stripeAccountId ✗ STRIPE-SPECIFIC                  │
│    stripeOnboarded ✗ STRIPE-SPECIFIC                      │
│    commissionPercent ✓ PROVIDER AGNOSTIC                 │
│  }                                                          │
│                                                              │
│  WebhookEvent {                                             │
│    eventId (provider-agnostic), eventType, rawPayload,    │
│    status, attempts, lastError                            │
│  }                                                          │
└──────────────────────────────────────────────────────────────┘
```

## 2. Proposed Architecture (Multi-Provider)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                   │
│  PackagePage.tsx ──→ api.createCheckout() ──→ Checkout URL ────┐│
│                                                                  ││
│  Success.tsx ──────→ Parses payment_session_id (generic) ────┐ ││
└──────────────────────────────────────────────────────────────┼──┘
                                                                │  │
                      ┌─────────────────────────────────────────┘  │
                      │                                              │
┌─────────────────────▼──────────────────────────────────────────┐  │
│                    SERVER ROUTES                                │  │
│                                                                  │  │
│  POST /v1/bookings/checkout                                    │  │
│  ├─→ BookingsController.createCheckout()                       │  │
│  └─→ BookingService.createCheckout()                          │  │
│                                                                  │  │
│  POST /v1/webhooks (generic endpoint)                          │  │
│  ├─→ WebhooksController.handleWebhook()                        │  │
│  ├─→ Detects provider type from event structure               │  │
│  └─→ PROVIDER-AGNOSTIC                                         │  │
└──────────────────────┬───────────────────────────────────────┘  │
                       │                                            │
                       │ ┌────────────────────────────────────────┘
                       │ │
┌──────────────────────▼─▼──────────────────────────────────────┐
│                    SERVICE LAYER                               │
│                                                                │
│  CommissionService                                            │
│  ├─ calculateCommission() ✓ PROVIDER AGNOSTIC               │
│  ├─ Uses: Math.ceil(total * percent / 100)                 │
│  └─ NO provider-specific limits here                        │
│                                                                │
│  BookingService                                              │
│  ├─ createCheckout(tenantId, input)                         │
│  ├─ Fetches paymentConfig from tenant                      │
│  ├─ Routes based on provider type (not Stripe fields)      │
│  └─ ✓ PROVIDER AGNOSTIC                                    │
│                                                                │
│  PaymentProviderService ✓ NEW ABSTRACT SERVICE             │
│  ├─ createConnectedAccount(provider, tenantId, ...)        │
│  ├─ createOnboardingLink(provider, tenantId, ...)          │
│  ├─ checkOnboardingStatus(provider, tenantId)              │
│  └─ Dispatches to provider-specific implementations        │
│                                                                │
│  ProviderFactory ✓ NEW PATTERN                             │
│  └─ Creates provider service based on config               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  ADAPTER LAYER                              │
│                                                              │
│  PaymentProvider Interface ✓ UPDATED                       │
│  ├─ createCheckoutSession(config)                         │
│  ├─ createConnectCheckoutSession(config)                  │
│  └─ verifyWebhook() → RETURNS PaymentEvent                │
│                                                              │
│  PaymentEvent Interface ✓ NEW                             │
│  ├─ id: string                                             │
│  ├─ type: 'checkout_completed' | 'refund_completed'       │
│  ├─ metadata: Record<string, string>                       │
│  ├─ provider: 'stripe' | 'paypal' | 'square'              │
│  └─ timestamp: number                                      │
│                                                              │
│  EventNormalizer ✓ NEW LAYER                             │
│  ├─ normalizeStripeEvent(event) → PaymentEvent            │
│  ├─ normalizePayPalEvent(event) → PaymentEvent            │
│  └─ normalizeSquareEvent(event) → PaymentEvent            │
│                                                              │
│  StripePaymentAdapter ✓ REFACTORED                        │
│  ├─ Calls normalizeStripeEvent()                          │
│  └─ Returns PaymentEvent                                   │
│                                                              │
│  PayPalPaymentAdapter ✓ NEW                               │
│  ├─ Implements PaymentProvider                             │
│  └─ Returns PaymentEvent                                   │
│                                                              │
│  SquarePaymentAdapter ✓ NEW                               │
│  ├─ Implements PaymentProvider                             │
│  └─ Returns PaymentEvent                                   │
│                                                              │
│  ProviderConnectService Interface ✓ NEW                  │
│  ├─ createConnectedAccount()                              │
│  ├─ createOnboardingLink()                                │
│  └─ checkOnboardingStatus()                               │
│                                                              │
│  StripeConnectAdapter ✓ REFACTORED                        │
│  ├─ Implements ProviderConnectService                     │
│  └─ Stripe-specific implementation                        │
│                                                              │
│  PayPalConnectAdapter ✓ NEW                               │
│  ├─ Implements ProviderConnectService                     │
│  └─ PayPal-specific implementation                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                WEBHOOK HANDLING                             │
│                                                              │
│  WebhooksController.handleWebhook()                         │
│  ├─ Receives raw payload + signature                       │
│  ├─ Detects provider from payload structure                │
│  ├─ Calls provider.verifyWebhook()                         │
│  │  └─ Returns PaymentEvent (normalized)                   │
│  ├─ Validates event structure ✓ GENERIC                    │
│  ├─ Routes by event.type (not provider-specific)           │
│  │  • 'checkout_completed' → create booking                │
│  │  • 'refund_completed' → update booking                  │
│  └─ Calls: bookingService.onPaymentCompleted()            │
│                                                              │
│  PaymentEventValidator ✓ NEW                              │
│  └─ Validates PaymentEvent structure                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  DATABASE LAYER                             │
│                                                              │
│  Booking {                                                  │
│    id, tenantId, paymentSessionId (generic),               │
│    paymentProvider: 'stripe' | 'paypal' | 'square',        │
│    status, packageId, eventDate, email, coupleName,        │
│    addOnIds, totalCents,                                   │
│    commissionAmount, commissionPercent ✓                  │
│  }                                                          │
│                                                              │
│  Tenant {                                                   │
│    id,                                                      │
│    paymentConfig: {                                         │
│      provider: 'stripe' | 'paypal' | 'square',            │
│      isOnboarded: boolean,                                 │
│      // Provider-specific fields                          │
│      stripeAccountId?: string,                            │
│      paypalMerchantId?: string,                           │
│      squareAccountId?: string,                            │
│      // Onboarding status                                 │
│      onboardingStatus: Record<string, unknown>            │
│    },                                                      │
│    commissionPercent ✓                                    │
│  }                                                          │
│                                                              │
│  WebhookEvent {                                             │
│    eventId (generic), provider, eventType (normalized),    │
│    rawPayload, status, attempts, lastError                │
│  }                                                          │
└──────────────────────────────────────────────────────────────┘
```

## 3. Dependency Graph: Current vs. Proposed

### Current (Problematic)

```
            ┌──────────────────────┐
            │   BookingService     │
            └──────────┬───────────┘
                       │
                ┌──────▼──────┐
                │  Stripe     │ ← HARDCODED TYPE
                │  Import     │
                └──────┬──────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌────────┐      ┌──────────┐      ┌──────────┐
│stripe  │      │stripe    │      │stripe    │
│adapter │      │.Event    │      │.Account  │
└────────┘      └──────────┘      └──────────┘

Result: Multiple hardcoded Stripe dependencies
```

### Proposed (Flexible)

```
            ┌──────────────────────┐
            │   BookingService     │
            └──────────┬───────────┘
                       │
            ┌──────────▼──────────┐
            │  PaymentProvider    │ ← ABSTRACT
            │  (interface)        │
            └──────────┬──────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌────────┐      ┌──────────┐      ┌──────────┐
│Stripe  │      │PayPal    │      │Square    │
│Adapter │      │Adapter   │      │Adapter   │
└────────┘      └──────────┘      └──────────┘

Result: Single provider interface, pluggable adapters
```

## 4. Type Dependency Evolution

### Current

```typescript
// Stripe types leak everywhere
import Stripe from 'stripe';

interface PaymentProvider {
  verifyWebhook(): Promise<Stripe.Event>; // ← Stripe type
}

// WebhooksController
const event: Stripe.Event = await provider.verifyWebhook();
```

### Proposed

```typescript
// Provider-agnostic types
export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  metadata: Record<string, string>;
  provider: PaymentProviderType;
}

interface PaymentProvider {
  verifyWebhook(): Promise<PaymentEvent>; // ← Generic type
}

// WebhooksController
const event: PaymentEvent = await provider.verifyWebhook();
```

## 5. Webhook Event Flow Comparison

### Current (Stripe-Specific)

```
Stripe Webhook
    ↓
Raw payload (JSON string)
    ↓
paymentProvider.verifyWebhook()
    ↓
Returns: Stripe.Event {
  id: 'evt_...',
  type: 'checkout.session.completed',
  data: { object: Stripe.Checkout.Session { ... } }
}
    ↓
StripeSessionSchema.safeParse() [hardcoded schema]
    ↓
Extract tenantId from metadata
    ↓
Create booking
```

### Proposed (Provider-Agnostic)

```
Provider Webhook (Stripe/PayPal/Square)
    ↓
Raw payload (JSON string)
    ↓
paymentProvider.verifyWebhook()
    ↓
Returns: PaymentEvent {
  id: 'evt_...' / 'pp_...' / 'sq_...',
  type: 'checkout_completed',
  provider: 'stripe' | 'paypal' | 'square',
  metadata: { tenantId, packageId, ... }
}
    ↓
PaymentEventValidator.validate() [generic schema]
    ↓
Route by event.type (not event.type === 'checkout.session.completed')
    ↓
Create booking
```

## 6. Configuration Flow

### Current

```
.env
  STRIPE_SECRET_KEY ─────┐
  STRIPE_WEBHOOK_SECRET ─┤
                         ├─→ di.ts:186 ─→ new StripePaymentAdapter()
  STRIPE_SUCCESS_URL ────┤
  STRIPE_CANCEL_URL ─────┘

Problem: Only Stripe supported
```

### Proposed

```
.env
  PAYMENT_PROVIDER = 'stripe' | 'paypal' | 'square'
      ↓
  IF stripe:
    STRIPE_SECRET_KEY ───────┬─→ di.ts ─→ new StripePaymentAdapter()
    STRIPE_WEBHOOK_SECRET ───┤
    STRIPE_SUCCESS_URL ──────┤
    STRIPE_CANCEL_URL ───────┘

  ELSE IF paypal:
    PAYPAL_CLIENT_ID ────┬─→ di.ts ─→ new PayPalPaymentAdapter()
    PAYPAL_CLIENT_SECRET ┤
    PAYPAL_MODE ────────┘

  ELSE IF square:
    SQUARE_ACCESS_TOKEN ┬─→ di.ts ─→ new SquarePaymentAdapter()
    SQUARE_ENVIRONMENT ─┘

Result: Dynamic provider selection
```

## Summary of Changes

| Aspect            | Current                 | Proposed                 | Impact                    |
| ----------------- | ----------------------- | ------------------------ | ------------------------- |
| Event Type        | `Stripe.Event`          | `PaymentEvent`           | Type safety + flexibility |
| Webhook Route     | `/v1/webhooks/stripe`   | `/v1/webhooks`           | Provider-agnostic         |
| Schema Validation | Hardcoded Stripe schema | Generic validator        | Extensible                |
| Connect Service   | `StripeConnectService`  | `ProviderConnectService` | Multi-provider support    |
| Configuration     | Hardcoded Stripe        | Dynamic selection        | Environment-based         |
| Adapter Selection | Hardcoded in DI         | Config-driven            | Flexible deployment       |
