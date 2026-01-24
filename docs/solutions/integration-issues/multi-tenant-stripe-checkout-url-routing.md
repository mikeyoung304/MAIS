---
title: Multi-tenant Stripe checkout redirects to wrong URL
category: integration-issues
severity: P1
component: stripe
symptoms:
  - Customers redirected to global /success instead of /t/{slug}/book/success
  - Checkout success/cancel URLs ignore tenant context
  - Same redirect URL used for all tenants regardless of storefront
root_cause: Static URL configuration at startup cannot vary per-tenant in multi-tenant system
solution_type: refactor
prevention: Never use static environment variables for per-request values in multi-tenant systems; generate tenant-scoped URLs dynamically at request time
related_issues: []
date_resolved: 2026-01-24
---

# Multi-Tenant Stripe Checkout URL Routing

## Problem

After completing Stripe checkout, customers were redirected to a global `/success` page instead of their tenant-specific storefront at `/t/{slug}/book/success`. This broke the multi-tenant UX - customers lost context of which vendor they were booking with.

### Symptoms

- All tenants' customers redirected to same `/success` URL
- Success page had no tenant branding or context
- Cancel URL also lacked tenant routing
- Booking confirmation couldn't display properly without tenant context

### Error Example

```
Expected: /t/acme-photography/book/success?session_id=cs_xxx
Actual:   /success?session_id=cs_xxx
```

## Root Cause

The `StripePaymentAdapter` was configured with **static URLs** from environment variables, set once at application startup:

```typescript
// server/src/di.ts (BEFORE - wrong)
const paymentProvider = new StripePaymentAdapter({
  secretKey: config.STRIPE_SECRET_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
  successUrl: config.STRIPE_SUCCESS_URL, // Static! Same for all tenants
  cancelUrl: config.STRIPE_CANCEL_URL, // Static!
});
```

**Anti-pattern identified:** Using environment variables for values that must vary per-request in multi-tenant systems.

## Solution

Move URL generation from static configuration to **dynamic per-request generation** in the `CheckoutSessionFactory`.

### Step 1: Update PaymentProvider Interface

Add URL parameters to the interface so implementations accept them per-call:

```typescript
// server/src/lib/ports.ts
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    successUrl: string; // ← Now required per-call
    cancelUrl: string; // ← Now required per-call
    // ...other fields
  }): Promise<CheckoutSession>;
}
```

### Step 2: Update CheckoutSessionFactory

Build tenant-specific URLs at request time:

```typescript
// server/src/services/checkout-session.factory.ts
async createCheckoutSession(params: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
  const tenant = await this.tenantRepo.findById(params.tenantId);
  if (!tenant) throw new NotFoundError('Tenant not found');

  // Build tenant-specific URLs dynamically
  const encodedSlug = encodeURIComponent(tenant.slug);
  const successUrl = `${this.frontendBaseUrl}/t/${encodedSlug}/book/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${this.frontendBaseUrl}/t/${encodedSlug}/book`;

  // Add slug to metadata for webhook routing
  const enrichedMetadata = {
    ...params.metadata,
    tenantSlug: tenant.slug,
  };

  return this.paymentProvider.createCheckoutSession({
    ...params,
    metadata: enrichedMetadata,
    successUrl,
    cancelUrl,
  });
}
```

### Step 3: Remove Static Config from Adapter

```typescript
// server/src/adapters/stripe.adapter.ts (AFTER)
export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
  // Removed: successUrl, cancelUrl - now passed per-call
}

async createCheckoutSession(input: {
  // ...
  successUrl: string;  // Use from input
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const session = await this.stripe.checkout.sessions.create({
    // ...
    success_url: input.successUrl,  // From input, not constructor
    cancel_url: input.cancelUrl,
  });
}
```

### Step 4: Update DI Configuration

```typescript
// server/src/di.ts (AFTER)
const paymentProvider = new StripePaymentAdapter({
  secretKey: config.STRIPE_SECRET_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
  // No more URL config - passed per-request now
});
```

## Files Changed

| File                                              | Change                                  |
| ------------------------------------------------- | --------------------------------------- |
| `server/src/lib/ports.ts`                         | Added successUrl/cancelUrl to interface |
| `server/src/adapters/stripe.adapter.ts`           | Accept URLs in method, not constructor  |
| `server/src/services/checkout-session.factory.ts` | Build tenant URLs dynamically           |
| `server/src/services/booking.service.ts`          | Added config dependency                 |
| `server/src/di.ts`                                | Removed static URL config               |
| `server/src/adapters/mock/index.ts`               | Support dynamic URLs in mock mode       |
| `server/test/helpers/fakes.ts`                    | Added `buildMockConfig()` helper        |

## Prevention Strategies

### 1. Code Review Checklist

When reviewing multi-tenant code, ask:

- [ ] Does this URL/config need to vary per tenant?
- [ ] Is this set at startup (constructor) or request time?
- [ ] Are customer-facing URLs tenant-scoped?

### 2. Architectural Pattern

**Wrong (static):**

```typescript
class Service {
  constructor(private config: { url: string }) {}
  async process() {
    redirect(this.config.url); // Same for all tenants!
  }
}
```

**Correct (dynamic):**

```typescript
class Service {
  async process(tenantId: string) {
    const tenant = await this.tenantRepo.findById(tenantId);
    const url = `${baseUrl}/t/${tenant.slug}/...`;
    redirect(url); // Tenant-specific!
  }
}
```

### 3. Test Case

```typescript
it('should generate different URLs for different tenants', async () => {
  const result1 = await service.createCheckout('tenant-a', input);
  const result2 = await service.createCheckout('tenant-b', input);

  expect(result1.checkoutUrl).toContain('/t/tenant-a/');
  expect(result2.checkoutUrl).toContain('/t/tenant-b/');
  expect(result1.checkoutUrl).not.toBe(result2.checkoutUrl);
});
```

### 4. Detection

Find potentially problematic static URL config:

```bash
rg "config\.\w+_URL" server/src/services/
```

## Related Documentation

- [CLAUDE.md Pitfall #76](/Users/mikeyoung/CODING/MAIS/CLAUDE.md) - Static config for tenant-specific URLs
- [Public Tenant Route Validation](../security-issues/public-tenant-route-validation-and-di.md)
- [Webhook Idempotency](../test-failures/webhook-idempotency-race-condition.md)
- [P1 Security Prevention Strategies](../security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md)

## Lessons Learned

1. **Environment variables are for deployment config, not tenant config** - Things like API keys, ports, feature flags are fine. Tenant-specific URLs are not.

2. **Multi-agent review caught over-engineering** - Original plan was 280 lines/11 files. Review narrowed it to 100 lines/6 files.

3. **When adding required service dependencies, update all tests** - Adding `config` to `BookingServiceOptions` required updating 11 test files with `buildMockConfig()`.

---

_Commit:_ `be35d466` - `fix(booking): enable tenant-specific Stripe checkout redirect URLs`
_Date:_ 2026-01-24
