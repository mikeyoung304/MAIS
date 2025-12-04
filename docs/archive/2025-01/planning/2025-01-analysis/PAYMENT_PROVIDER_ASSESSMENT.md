# Payment Provider Abstraction & Extensibility Assessment

## Executive Summary

The system has **moderate abstraction** of payment providers with some critical gaps that would need addressing before supporting multiple providers. While there is a `PaymentProvider` interface, significant hardcoding of Stripe-specific concepts throughout the codebase creates tight coupling that would require substantial refactoring to support alternatives (PayPal, Square, etc.).

**Overall Coupling Level: MODERATE (6/10 - where 10 is heavily coupled)**

---

## 1. ABSTRACTION LAYER QUALITY

### Current State: GOOD Interface, WEAK Implementation

#### PaymentProvider Interface (server/src/lib/ports.ts)

```typescript
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
```

**Assessment:**

- Interface is abstract and provider-agnostic
- Uses standardized types (amountCents, email, metadata)
- Returns standard CheckoutSession type
- **PROBLEM**: Returns Stripe.Event from webhook, hardcoding Stripe types

### Stripe Adapter Implementation (server/src/adapters/stripe.adapter.ts)

**Strengths:**

- Clean implementation of PaymentProvider interface
- Encapsulates Stripe-specific API calls
- Handles application fee validation (0.5%-50% limits)
- Implements both standard and Connect checkout patterns

**Weaknesses:**

- Hardcodes "Wedding Package" product name
- Hardcodes "USD" currency
- Hardcodes "payment" mode (vs. subscription, setup, etc.)

---

## 2. STRIPE COUPLING ANALYSIS

### Direct Stripe Dependencies

**High-Risk Areas (Hardcoded Stripe References):**

| File                                        | Hardcoding                                       | Severity |
| ------------------------------------------- | ------------------------------------------------ | -------- |
| server/src/adapters/stripe.adapter.ts:46-48 | `"Wedding Package"` product name                 | Medium   |
| server/src/adapters/stripe.adapter.ts:43-44 | `mode: 'payment'`                                | Medium   |
| server/src/adapters/stripe.adapter.ts:45    | `currency: 'usd'`                                | Low      |
| server/src/lib/ports.ts:104                 | Return type `Stripe.Event`                       | High     |
| server/src/routes/webhooks.routes.ts:18-31  | `StripeSessionSchema` hardcoded                  | High     |
| server/src/routes/webhooks.routes.ts:155    | Event type string `'checkout.session.completed'` | Medium   |
| server/src/app.ts:68-70                     | Route path `/v1/webhooks/stripe`                 | Low      |

**Client-Side Coupling (Minor):**

| File                                              | Issue                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| client/src/features/catalog/PackagePage.tsx:74-77 | Redirects to Stripe checkout URL (provider-agnostic)     |
| client/src/pages/Success.tsx                      | Looks for `session_id` in query params (Stripe-specific) |

### Stripe Service Imports

```
File                                          Count
stripe.adapter.ts                             1
di.ts                                         12
commission.service.ts                         1
ports.ts                                      3
adapters/stripe.adapter.ts                    1
routes/webhooks.routes.ts                     2
More than 269 occurrences across 19 files
```

---

## 3. COMMISSION CALCULATION ABSTRACTION

### Quality: EXCELLENT (Highly Provider-Agnostic)

**Key Strengths:**

- Commission logic is in `CommissionService` (separate from PaymentProvider)
- Calculates commission independently: `Math.ceil(bookingTotal * (commissionPercent / 100))`
- Validates against Stripe Connect limits as guardrails (0.5%-50%)
- But these limits are comment-documented, not hardcoded as validation

**Location:** server/src/services/commission.service.ts

```typescript
// Commission calculation is provider-independent
const commissionCents = Math.ceil(bookingTotal * (commissionPercent / 100));

// Stripe-specific validation (should be moved to adapter)
const minCommission = Math.ceil(bookingTotal * 0.005);
const maxCommission = Math.floor(bookingTotal * 0.5);
```

**Critical Insight:**

- Commission is stored in Booking with both amount and percent
- Commission is passed as `applicationFeeAmount` to provider's checkout method
- This design allows different providers to handle fees differently

**Issue:** Stripe Connect limits (0.5%-50%) are enforced in CommissionService, which should be provider-specific validation.

---

## 4. WEBHOOK HANDLING ABSTRACTION

### Quality: MODERATE (Partial Abstraction)

**Architecture:**

```
Provider Webhook → PaymentProvider.verifyWebhook() → WebhooksController
                                                    → BookingService
```

**Implementation Details:**

1. **Signature Verification:**
   - Delegated to provider: `paymentProvider.verifyWebhook(rawBody, signature)`
   - Clean abstraction, provider-specific

2. **Event Structure Validation:**

   ```typescript
   // TIGHTLY COUPLED TO STRIPE
   const StripeSessionSchema = z.object({
     id: z.string(),
     amount_total: z.number().nullable(),
     metadata: z.object({
       tenantId: z.string(),
       packageId: z.string(),
       eventDate: z.string(),
       email: z.string().email(),
       coupleName: z.string(),
       addOnIds: z.string().optional(),
       commissionAmount: z.string().optional(),
       commissionPercent: z.string().optional(),
     }),
   });
   ```

3. **Event Type Handling:**
   ```typescript
   if (event.type === 'checkout.session.completed') {
     // Process booking...
   } else {
     logger.info({ eventId: event.id, type: event.type }, 'Ignoring unhandled webhook event type');
   }
   ```

**Problems:**

- Schema validation is Stripe-specific (checkout.session.completed)
- Assumes flat metadata structure
- Event type strings are hardcoded
- No provider-agnostic event mapper

**What Would Be Needed:**

- Provider-specific WebhookHandler interfaces
- Event normalization layer
- Provider-agnostic webhook schema

---

## 5. MULTI-TENANT PAYMENT ROUTING

### Quality: GOOD

**Pattern:**

```typescript
// In booking.service.ts
if (tenant.stripeAccountId && tenant.stripeOnboarded) {
  session = await this.paymentProvider.createConnectCheckoutSession({
    stripeAccountId: tenant.stripeAccountId,
    applicationFeeAmount: calculation.commissionAmount,
  });
} else {
  session = await this.paymentProvider.createCheckoutSession({
    applicationFeeAmount: calculation.commissionAmount,
  });
}
```

**Assessment:**

- Clean routing based on tenant configuration
- Supports two Stripe modes (Connect and Standard)
- Could extend to support different providers per tenant

**Limitation:** Only checks for Stripe-specific fields (`stripeAccountId`, `stripeOnboarded`). To support multiple providers, would need:

```typescript
interface TenantPaymentConfig {
  provider: 'stripe' | 'paypal' | 'square';
  stripeAccountId?: string;
  paypalMerchantId?: string;
  squareAccountId?: string;
  // etc.
}
```

---

## 6. CONFIGURATION & DEPENDENCY INJECTION

### Quality: GOOD (Clear DI Pattern)

**Locations:**

- server/src/di.ts: All adapters initialized once
- server/src/app.ts: DI container injected into routes

**Code Example:**

```typescript
// di.ts - single place to swap implementations
const paymentProvider = new StripePaymentAdapter({
  secretKey: config.STRIPE_SECRET_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
  successUrl: config.STRIPE_SUCCESS_URL,
  cancelUrl: config.STRIPE_CANCEL_URL,
});

// Easy to swap: new PayPalAdapter({ ... }) or new SquareAdapter({ ... })
```

**Missing:**

- No configuration for selecting provider per environment
- ADAPTER_PRESET only supports 'mock' vs 'real'
- Should support: PAYMENT_PROVIDER env var

---

## 7. STRIPE CONNECT SPECIFIC COUPLING

### StripeConnectService (HIGH COUPLING)

**Location:** server/src/services/stripe-connect.service.ts

**Issues:**

- Entirely Stripe Connect specific
- Creates Express accounts
- Manages Stripe-specific onboarding flows
- No provider-agnostic interface

**What It Does:**

- `createConnectedAccount()` - Creates Stripe Express account
- `createOnboardingLink()` - Generates Stripe onboarding URL
- `checkOnboardingStatus()` - Checks Stripe-specific `charges_enabled`
- `storeRestrictedKey()` - Stores encrypted Stripe API keys
- `getRestrictedKey()` - Retrieves Stripe keys

**Impact:**

- Would need equivalent services for PayPal, Square, etc.
- Each provider has different onboarding mechanisms
- No abstract interface defined

**Example Problem:**

```typescript
// Stripe-specific
if (account.charges_enabled === true) {
  isOnboarded = true;
}

// PayPal would check different fields
// Square would have different requirements
```

---

## 8. HARDCODED STRIPE TYPES

### Critical Type Dependencies

| Type                      | Usage                                           | Risk |
| ------------------------- | ----------------------------------------------- | ---- |
| `Stripe.Event`            | PaymentProvider.verifyWebhook() return type     | HIGH |
| `Stripe.Account`          | StripeConnectService.getAccountDetails() return | HIGH |
| `Stripe.Checkout.Session` | WebhooksController payload assumption           | HIGH |

**Problem Example:**

```typescript
// In lib/ports.ts - return type is Stripe-specific
verifyWebhook(payload: string, signature: string): Promise<Stripe.Event>;

// This forces all providers to return Stripe events or cast them
```

---

## 9. EXTENSIBILITY ASSESSMENT

### To Add PayPal Support (Estimated Effort)

**Required Changes:**

1. **Create PayPal Adapter** (150-250 lines)
   - Implement PaymentProvider interface
   - Handle PayPal checkout creation
   - Implement webhook verification

2. **Provider-Agnostic Event Interface** (50-100 lines)

   ```typescript
   export interface PaymentEvent {
     id: string;
     type: 'checkout_completed' | 'payment_refunded' | ...;
     metadata: Record<string, string>;
     timestamp: number;
   }
   ```

3. **Update PaymentProvider Interface** (20-50 lines)
   - Change webhook return type from Stripe.Event to PaymentEvent

4. **Update WebhooksController** (100-200 lines)
   - Remove Stripe-specific schema validation
   - Add provider-specific validators
   - Normalize events to PaymentEvent

5. **Update StripeConnectService** (150-200 lines)
   - Create abstract PaymentProviderService interface
   - Implement PayPalProviderService for merchant onboarding
   - Update DI to select based on PAYMENT_PROVIDER env

6. **Update Configuration** (30-50 lines)
   - Add PAYMENT_PROVIDER env var
   - Add provider-specific config (API keys, etc.)

7. **Update Tests** (200-300 lines)
   - Mock PayPal adapter
   - Test event normalization
   - Test webhook handling

**Total Effort: 700-1150 lines of new code + 300-500 lines of refactoring**
**Estimated Time: 2-3 days for experienced developer**

### To Add Square Support (Estimated Effort)

**Same process as PayPal, similar effort (2-3 days)**

---

## 10. KEY FINDINGS

### Strengths ✓

1. **Interface-Based Design**: PaymentProvider interface is clean and extensible
2. **Separation of Concerns**:
   - Payment creation separate from commission calculation
   - Webhook handling separated from domain logic
3. **DI Container**: Single place to swap implementations
4. **Multi-Tenant Ready**: Commission logic is provider-agnostic
5. **Mock Adapter**: MockPaymentProvider shows how to implement interface
6. **Error Handling**: Zod validation for webhook payloads

### Weaknesses ✗

1. **Stripe Type Leakage**:
   - `Stripe.Event` in PaymentProvider interface
   - `Stripe.Account` return types
   - Hardcoded Stripe schema validation

2. **Webhook Coupling**:
   - Event type strings hardcoded ('checkout.session.completed')
   - Stripe-specific metadata assumptions
   - No event normalization layer

3. **StripeConnectService**:
   - No abstract interface for provider-specific onboarding
   - Tenant model assumes Stripe fields (stripeAccountId, stripeOnboarded)
   - Tenant secrets stored with 'stripe' key

4. **Commission Validation**:
   - Stripe Connect limits (0.5%-50%) enforced in business logic
   - Should be in provider adapter

5. **Configuration**:
   - No environment variable for selecting payment provider
   - Provider selection hardcoded in DI

6. **Client Assumptions**:
   - Success page assumes `session_id` query param (Stripe)
   - Would need to generalize to `payment_session_id` or `checkout_id`

---

## 11. RECOMMENDED REFACTORING ROADMAP

### Phase 1: Foundation (1-2 days)

- [ ] Create PaymentEvent interface (provider-agnostic)
- [ ] Update PaymentProvider.verifyWebhook() return type
- [ ] Create WebhookEventNormalizer for converting provider events
- [ ] Add PAYMENT_PROVIDER environment variable

### Phase 2: Provider Abstraction (1-2 days)

- [ ] Create PaymentProviderService interface for onboarding
- [ ] Extract Stripe limits to StripeAdapter config
- [ ] Create StripeConnectProviderService implementing PaymentProviderService
- [ ] Update Tenant schema to support multiple provider fields generically

### Phase 3: Event Handling (1 day)

- [ ] Create provider-specific webhook validators
- [ ] Implement event normalizer pattern
- [ ] Remove Stripe-specific schema from WebhooksController
- [ ] Add provider detection logic

### Phase 4: Configuration (1 day)

- [ ] Add PAYMENT_PROVIDER to Config type
- [ ] Update DI to select provider from config
- [ ] Add provider config (keys, API endpoints)
- [ ] Update /ready endpoint to validate provider config

### Phase 5: Add First Alternative Provider (2-3 days)

- [ ] Create PayPalAdapter
- [ ] Create PayPalConnectProviderService
- [ ] Test webhook integration
- [ ] E2E tests for PayPal checkout

---

## 12. IMPLEMENTATION EXAMPLES

### Option A: Keep Stripe-Specific, Add PayPal

(Lower effort, lower flexibility)

```typescript
// payments/provider.ts
export type PaymentProviderType = 'stripe' | 'paypal';

export interface PaymentProvider {
  createCheckoutSession(...): Promise<CheckoutSession>;
  // ... other methods
}

// Then create separate PayPalAdapter
export class PayPalAdapter implements PaymentProvider { }
```

### Option B: Fully Abstract (Recommended)

(Higher effort, maximum flexibility)

```typescript
// payments/events.ts
export interface PaymentEvent {
  id: string;
  type: 'checkout_completed' | 'payment_refunded' | ...;
  data: Record<string, unknown>;
  provider: PaymentProviderType;
}

// payments/provider.ts
export interface PaymentProvider {
  createCheckoutSession(...): Promise<CheckoutSession>;
  normalizeWebhookEvent(raw: unknown): PaymentEvent;
}

// webhooks/handler.ts
const event = paymentProvider.normalizeWebhookEvent(rawPayload);
if (event.type === 'checkout_completed') {
  // Handle checkout
}
```

---

## 13. TESTING CONSIDERATIONS

**Current Test Coverage:**

- MockPaymentProvider exists for testing
- Shows how to implement interface

**Needed Tests:**

```typescript
// Multiple payment provider scenarios
test('PayPal checkout creates session', async () => {});
test('Stripe Connect checkout applies commission', async () => {});
test('Square webhook normalizes to standard event', async () => {});
test('Commission calculation is provider-agnostic', async () => {});
test('Tenant routing works with different providers', async () => {});
```

---

## 14. SUMMARY TABLE

| Aspect                | Current                   | Rating | Effort to Fix |
| --------------------- | ------------------------- | ------ | ------------- |
| Provider Interface    | Abstract interface exists | 7/10   | Low           |
| Stripe Coupling       | Moderate in adapter       | 6/10   | Medium        |
| Commission Logic      | Provider-agnostic         | 9/10   | None          |
| Webhook Handling      | Stripe-specific           | 4/10   | Medium-High   |
| DI & Config           | Good pattern              | 7/10   | Low           |
| StripeConnect         | No abstraction            | 3/10   | High          |
| Client Assumptions    | Some hardcoding           | 6/10   | Low           |
| Multi-tenant Support  | Good foundation           | 8/10   | None          |
| Type Safety           | Stripe types leak         | 5/10   | Medium        |
| Overall Extensibility | Moderate                  | 6/10   | Medium-High   |

---

## 15. RECOMMENDATIONS

### Do This First (Quick Wins)

1. **Create PaymentEvent interface** - Removes Stripe.Event dependency
2. **Add PAYMENT_PROVIDER config** - Enables provider selection
3. **Extract Stripe limits to adapter** - Removes provider bias from business logic

### Do This Before Multiple Providers

1. **Create PaymentProviderService interface** - Handle onboarding abstractly
2. **Event normalizer pattern** - Convert provider events to standard format
3. **Update Tenant model** - Support generic provider configuration

### Consider for Future

1. **Provider factory pattern** - Dynamic provider loading
2. **Feature detection** - Know provider capabilities at runtime
3. **Provider comparison layer** - Switch providers based on criteria

---

## Conclusion

The system has a **reasonable foundation** for multi-provider support, but would require **500-1000 lines of refactoring** before it's truly provider-agnostic. The PaymentProvider interface is good, but leaks Stripe types throughout. Commission calculation is excellent and provider-independent.

**Risk Level for Adding PayPal: MODERATE** (2-3 days effort, some refactoring needed first)

**To reach HIGH extensibility: Implement Phase 1-3 of roadmap (3-5 days work)**
