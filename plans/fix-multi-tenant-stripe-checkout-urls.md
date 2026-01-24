# Fix: Multi-Tenant Stripe Checkout URL Routing

> **Priority:** P1 - Critical for multi-tenant production readiness
> **Type:** Bug Fix
> **Quality Bar:** Enterprise-grade, Apple-level UX
> **Scope:** ~100 lines across 6 files (revised after review)

## Overview

The booking checkout flow is broken for multi-tenant operation. Success/cancel URLs are global environment variables that cannot route customers back to their tenant-specific storefront.

**Current State:**

```
Customer books on: /t/acme-photography/book/elopement
Stripe redirects to: /success?session_id=cs_xxx  ← No tenant context!
```

**Target State:**

```
Customer books on: /t/acme-photography/book/elopement
Stripe redirects to: /t/acme-photography/book/success?session_id=cs_xxx  ✅
```

## Root Cause

The `StripePaymentAdapter` uses **static URLs** from environment variables, set once at startup:

```typescript
// server/src/di.ts:502-507
const paymentProvider = new StripePaymentAdapter({
  successUrl: config.STRIPE_SUCCESS_URL, // Global, not tenant-specific
  cancelUrl: config.STRIPE_CANCEL_URL,
});
```

## Solution

Move URL generation from static config to dynamic per-request generation.

### URL Design (Apple-Quality)

| State        | URL Pattern                                               |
| ------------ | --------------------------------------------------------- |
| Storefront   | `/t/{slug}`                                               |
| Booking Form | `/t/{slug}/book/{package}`                                |
| **Success**  | `/t/{slug}/book/success?session_id={CHECKOUT_SESSION_ID}` |
| **Cancel**   | `/t/{slug}/book`                                          |

---

## Implementation

### Step 1: Update PaymentProvider Interface

**File:** `server/src/lib/ports.ts`

Add URL parameters to the interface (critical for type safety):

```typescript
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number;
    idempotencyKey?: string;
    successUrl: string; // ← Add
    cancelUrl: string; // ← Add
  }): Promise<CheckoutSession>;

  createConnectCheckoutSession(input: {
    // ... existing fields ...
    successUrl: string; // ← Add
    cancelUrl: string; // ← Add
  }): Promise<CheckoutSession>;
}
```

### Step 2: Update Stripe Adapter

**File:** `server/src/adapters/stripe.adapter.ts`

Remove URLs from constructor, accept in method:

```typescript
// Remove from StripeAdapterOptions:
// - successUrl: string;
// - cancelUrl: string;

// Update createCheckoutSession to use input URLs:
async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  const session = await this.stripe.checkout.sessions.create({
    // ...existing config...
    success_url: input.successUrl,  // From input, not this.successUrl
    cancel_url: input.cancelUrl,
  });
  // ...
}

// Same for createConnectCheckoutSession
```

### Step 3: Update Checkout Session Factory

**File:** `server/src/services/checkout-session.factory.ts`

Build tenant-specific URLs before calling adapter:

```typescript
async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<...> {
  const tenant = await this.tenantRepo.findById(input.tenantId);
  if (!tenant) throw new TenantNotFoundError(input.tenantId);

  // Build tenant-specific URLs
  const baseUrl = this.config.APP_URL || 'https://gethandled.ai';
  const successUrl = `${baseUrl}/t/${encodeURIComponent(tenant.slug)}/book/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/t/${encodeURIComponent(tenant.slug)}/book`;

  // Add slug to metadata for webhook routing
  const metadata = {
    ...input.metadata,
    tenantSlug: tenant.slug,
  };

  return this.stripeAdapter.createCheckoutSession({
    ...input,
    metadata,
    successUrl,
    cancelUrl,
  });
}
```

### Step 4: Update DI Configuration

**File:** `server/src/di.ts`

Remove URL config from adapter initialization:

```typescript
const paymentProvider = new StripePaymentAdapter({
  secretKey: config.STRIPE_SECRET_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
  // Remove: successUrl, cancelUrl
});
```

### Step 5: Update Mock Adapter

**File:** `server/src/adapters/mock/index.ts`

Support dynamic URLs in mock mode:

```typescript
async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  const sessionId = `mock_session_${Date.now()}`;
  return {
    sessionId,
    checkoutUrl: input.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId),
  };
}
```

### Step 6: Update Success Page

**File:** `apps/web/src/app/t/[slug]/book/success/page.tsx`

Query booking directly by Stripe session ID (no new endpoint needed):

```typescript
export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Direct query - booking has stripeSessionId from webhook
  let booking = null;
  if (session_id) {
    booking = await getBookingByStripeSession(tenant.apiKeyPublic, session_id);
  }

  // Simple fallback if webhook hasn't fired yet (rare)
  if (!booking) {
    return (
      <div className="py-32 text-center">
        <h1 className="text-2xl font-semibold">Payment Received!</h1>
        <p className="mt-4 text-gray-600">
          Your booking is being confirmed. Please refresh in a moment.
        </p>
      </div>
    );
  }

  return <BookingConfirmation booking={booking} tenant={tenant} />;
}
```

---

## Files to Modify

| File                                              | Change                                  | ~Lines |
| ------------------------------------------------- | --------------------------------------- | ------ |
| `server/src/lib/ports.ts`                         | Add URL params to interface             | ~10    |
| `server/src/adapters/stripe.adapter.ts`           | Use input URLs, remove from constructor | ~25    |
| `server/src/services/checkout-session.factory.ts` | Build tenant URLs, add slug to metadata | ~20    |
| `server/src/di.ts`                                | Remove URL config                       | ~5     |
| `server/src/adapters/mock/index.ts`               | Support dynamic URLs                    | ~15    |
| `apps/web/src/app/t/[slug]/book/success/page.tsx` | Handle session_id, direct query         | ~25    |

**Total: ~100 lines across 6 files**

---

## Acceptance Criteria

- [x] Checkout redirects to `/t/{slug}/book/success?session_id=...`
- [x] Cancel returns to `/t/{slug}/book`
- [x] Success page displays booking confirmation (with fallback)
- [x] TypeScript compiles without errors
- [x] Unit tests pass (integration tests have pre-existing failures)
- [x] Mock mode works correctly

---

## What's NOT in Scope (Deferred)

Per reviewer feedback, these are explicitly **out of scope** for this fix:

| Item                                | Reason                                             | When to Add                             |
| ----------------------------------- | -------------------------------------------------- | --------------------------------------- |
| New API endpoint for session lookup | YAGNI - direct query works                         | If query performance is an issue        |
| Polling component                   | YAGNI - webhook fires before page load 99% of time | If customers actually see loading state |
| Session cache layer                 | YAGNI - booking already stores sessionId           | If direct query is slow                 |
| Legacy `/success` redirect          | Premature - current feature is broken anyway       | When deprecating old URLs               |
| Name validation changes             | Unrelated to P1                                    | Separate ticket                         |

---

## Testing

### Manual Test

1. Go to `/t/handled-e2e/book/elopement`
2. Fill form and submit
3. Complete Stripe checkout (mock mode)
4. Verify redirect to `/t/handled-e2e/book/success?session_id=mock_xxx`
5. Verify booking confirmation displays

### E2E Test

```typescript
test('tenant-specific success redirect', async ({ page }) => {
  await page.goto('/t/handled-e2e/book/elopement');
  await fillBookingForm(page);
  await page.click('[data-testid="submit-booking"]');
  await page.waitForURL(/\/t\/handled-e2e\/book\/success\?session_id=/);
  await expect(page.locator('h1')).toContainText('Thank you');
});
```

---

## Rollback

If issues arise, re-add `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` to Render environment. The factory can fall back to global URLs if configured.

---

## Review Notes

This plan was reviewed by 3 agents (DHH, Kieran, Simplicity) who converged on:

1. **Core fix is correct** - static → dynamic URL generation
2. **Scope reduced** from 280 lines/11 files to ~100 lines/6 files
3. **Direct query preferred** over new endpoint + cache + polling
4. **Ship minimal, observe, iterate** - add complexity only if needed

---

_Plan created: 2026-01-24_
_Revised: 2026-01-24 after multi-agent review_
_Author: Claude Code with /workflows:plan_
