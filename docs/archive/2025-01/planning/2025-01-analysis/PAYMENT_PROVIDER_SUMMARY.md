# Payment Provider Coupling: Quick Summary

## Coupling Level: MODERATE (6/10)

### The Good ✓

- **PaymentProvider interface** is clean and provider-agnostic
- **Commission calculation** is completely provider-independent
- **DI pattern** makes swapping providers theoretically easy
- **Multi-tenant routing** supports different provider modes per tenant
- **Mock adapter** demonstrates proper interface implementation

### The Bad ✗

- **Stripe.Event type** hardcoded in PaymentProvider interface
- **Webhook schema** tightly coupled to Stripe's event structure
- **StripeConnectService** has no abstract interface
- **Stripe Connect limits** (0.5%-50%) enforced in business logic
- **Tenant model** assumes Stripe-specific fields

## Effort to Add New Provider (PayPal, Square)

**Time Required: 2-3 days**
**New Code: 700-1150 lines**
**Refactoring: 300-500 lines**

### Quick Wins (Do First)

1. Create `PaymentEvent` interface (removes Stripe.Event dependency)
2. Add `PAYMENT_PROVIDER` config variable
3. Extract Stripe limits to adapter validation

### Must Do Before Multiple Providers

1. Abstract `PaymentProviderService` for onboarding
2. Event normalizer pattern for webhook events
3. Update Tenant model for generic provider config

## Critical Files

| File                                          | Coupling | Refactor Needed |
| --------------------------------------------- | -------- | --------------- |
| server/src/adapters/stripe.adapter.ts         | 5/10     | Low             |
| server/src/lib/ports.ts                       | 4/10     | Medium          |
| server/src/routes/webhooks.routes.ts          | 8/10     | High            |
| server/src/services/stripe-connect.service.ts | 9/10     | High            |
| server/src/services/commission.service.ts     | 1/10     | None            |
| server/src/di.ts                              | 3/10     | Low             |

## Specific Hardcodings to Remove

```typescript
// 1. In ports.ts - Change this:
verifyWebhook(payload: string, signature: string): Promise<Stripe.Event>;
// To this:
verifyWebhook(payload: string, signature: string): Promise<PaymentEvent>;

// 2. In stripe.adapter.ts - Extract to config:
product_data: { name: 'Wedding Package' }  // → Config
currency: 'usd'  // → Config
mode: 'payment'  // → Config

// 3. In commission.service.ts - Move to adapter:
const minCommission = Math.ceil(bookingTotal * 0.005);  // Stripe-specific
const maxCommission = Math.floor(bookingTotal * 0.50);   // Stripe-specific

// 4. In webhooks.routes.ts - Replace hardcoded schema:
const StripeSessionSchema = z.object({...})  // Provider-specific
// With provider-specific validators

// 5. In webhooks.routes.ts - Generalize event type:
if (event.type === 'checkout.session.completed')  // Stripe-specific
// Use provider-agnostic event types
```

## Architecture Pattern to Adopt

```typescript
// Current (Stripe-centric)
Provider → Stripe.Event → WebhooksController → BookingService

// Target (Provider-agnostic)
Provider → PaymentEvent → EventNormalizer → WebhooksController → BookingService
```

## Data Model Changes Needed

### Current Tenant Schema

```typescript
tenant.stripeAccountId?: string;
tenant.stripeOnboarded?: boolean;
```

### Target Schema

```typescript
tenant.paymentConfig: {
  provider: 'stripe' | 'paypal' | 'square';
  stripeAccountId?: string;
  paypalMerchantId?: string;
  squareAccountId?: string;
  isOnboarded: boolean;
  onboardingStatus: Record<string, unknown>;
}
```

## Test Coverage Gaps

Missing tests for:

- [ ] Multiple payment provider scenarios
- [ ] Event normalization layer
- [ ] Provider-agnostic commission calculations
- [ ] Webhook handling for non-Stripe providers
- [ ] Provider selection per environment

## Recommendations Priority

### High (Do Now)

1. Create PaymentEvent interface
2. Add PAYMENT_PROVIDER config

### Medium (Before Adding Providers)

1. Abstract PaymentProviderService
2. Event normalizer pattern
3. Remove Stripe type dependencies

### Low (Future Enhancement)

1. Provider factory pattern
2. Feature detection
3. Runtime provider switching

## Risk Assessment for PayPal

**Technical Risk: LOW** - Interface pattern is sound
**Implementation Risk: MODERATE** - Requires refactoring first
**Timeline Risk: LOW** - Clear refactoring roadmap exists

## Verdict

The system is **ready for multi-provider support with refactoring**. The foundation is solid, but Stripe types need to be abstracted before adding competitors. Estimated 3-5 days to reach "multi-provider ready" state.
