# Free Trial + Onboarding Flow (Simplified)

**Created:** 2025-12-26
**Status:** Ready for Implementation
**Estimated Effort:** 1.5 days
**Revised after:** DHH, Kieran, Simplicity reviews

## Overview

Minimal viable trial system following product-led growth:

1. **Free signup** → Full access immediately (already works)
2. **Create first package** → "Start your 14-day trial" button appears
3. **Trial countdown** → Banner on dashboard
4. **Upgrade** → Single Stripe Checkout button ($99/month)

## Key Decisions (Post-Review)

| Original                    | Simplified                                   |
| --------------------------- | -------------------------------------------- |
| 6 subscription statuses     | 4 statuses (NONE, TRIALING, ACTIVE, EXPIRED) |
| 3 pricing tiers             | 1 tier: $99/month                            |
| 4-step onboarding checklist | "Has package?" check only                    |
| TrialService class          | Inline utility functions                     |
| Stripe Subscriptions API    | Stripe Checkout (simpler)                    |
| 6 days                      | 1.5 days                                     |

---

## Schema Changes

**Add to `server/prisma/schema.prisma`:**

```prisma
model Tenant {
  // ... existing fields ...

  // Trial & Billing (add these 3 fields)
  trialEndsAt        DateTime?
  subscriptionStatus SubscriptionStatus @default(NONE)
  stripeCustomerId   String?            @unique
}

enum SubscriptionStatus {
  NONE      // Signed up, no trial started
  TRIALING  // In 14-day trial
  ACTIVE    // Paid customer
  EXPIRED   // Trial ended, didn't pay (soft lock)
}
```

**Why this is enough:**

- `trialEndsAt` - When trial expires (null = no trial yet)
- `subscriptionStatus` - Current state
- `stripeCustomerId` - For Checkout sessions
- No tiers (everyone gets full access)
- No subscription ID (using Checkout, not Subscriptions API)

---

## API Endpoints

### 1. Start Trial

```
POST /v1/tenant-admin/trial/start
```

Called when user clicks "Start Trial" after creating first package.

```typescript
// Response
{
  trialEndsAt: "2025-01-09T...",
  daysRemaining: 14
}
```

**Logic:**

```typescript
// Idempotent - safe to call multiple times
if (tenant.trialEndsAt) {
  return existing trial status; // Already started
}
const trialEndsAt = addDays(new Date(), 14);
await prisma.tenant.update({
  where: { id: tenantId },
  data: { trialEndsAt, subscriptionStatus: 'TRIALING' }
});
```

### 2. Get Trial Status

```
GET /v1/tenant-admin/trial/status
```

For dashboard to show trial banner.

```typescript
// Response
{
  status: "TRIALING" | "ACTIVE" | "EXPIRED" | "NONE",
  daysRemaining: 12,        // null if not trialing
  canStartTrial: true,      // has package but no trial yet
  hasPackages: true
}
```

### 3. Create Checkout Session

```
POST /v1/tenant-admin/billing/checkout
```

Creates Stripe Checkout session for $99/month.

```typescript
// Response
{
  checkoutUrl: 'https://checkout.stripe.com/...';
}
```

**Webhook:** `checkout.session.completed`

- Sets `subscriptionStatus = 'ACTIVE'`
- Stores `stripeCustomerId`

---

## Frontend Components

### 1. StartTrialCard

Shows when: `hasPackages && status === 'NONE'`

```tsx
// apps/web/src/components/trial/StartTrialCard.tsx
<Card className="border-2 border-sage/30 bg-sage/5">
  <CardContent>
    <h3>Ready to go live?</h3>
    <p>You've created your first package. Start your 14-day free trial.</p>
    <Button onClick={startTrial}>Start Free Trial</Button>
  </CardContent>
</Card>
```

### 2. TrialBanner

Shows when: `status === 'TRIALING'`

```tsx
// apps/web/src/components/trial/TrialBanner.tsx
<Alert className="bg-sage/10 border-sage/30">
  <Clock className="h-4 w-4" />
  <AlertDescription>
    {daysRemaining} days left in your trial.
    <Link href="/tenant/billing">Upgrade now</Link>
  </AlertDescription>
</Alert>
```

### 3. ExpiredBanner

Shows when: `status === 'EXPIRED'`

```tsx
<Alert variant="destructive">
  Your trial has ended.
  <Link href="/tenant/billing">Subscribe to continue</Link>
</Alert>
```

### 4. BillingPage

Simple page with checkout button.

```tsx
// apps/web/src/app/(protected)/tenant/billing/page.tsx
<Card>
  <CardHeader>
    <CardTitle>Subscribe to MAIS</CardTitle>
    <CardDescription>$99/month - Full access to all features</CardDescription>
  </CardHeader>
  <CardContent>
    <Button onClick={goToCheckout}>Subscribe Now</Button>
  </CardContent>
</Card>
```

---

## Implementation Phases

### Phase 1: Schema + Backend (4 hours)

**Tasks:**

- [ ] Add `trialEndsAt`, `subscriptionStatus`, `stripeCustomerId` to Tenant
- [ ] Add `SubscriptionStatus` enum
- [ ] Run migration
- [ ] Create `/v1/tenant-admin/trial/start` endpoint
- [ ] Create `/v1/tenant-admin/trial/status` endpoint
- [ ] Create `/v1/tenant-admin/billing/checkout` endpoint
- [ ] Add `checkout.session.completed` webhook handler

**Files:**
| File | Action |
|------|--------|
| `server/prisma/schema.prisma` | Add 3 fields + enum |
| `server/src/routes/tenant-admin.routes.ts` | Add trial endpoints |
| `server/src/routes/billing.routes.ts` | Create new file |
| `server/src/routes/webhooks.routes.ts` | Add checkout webhook |

### Phase 2: Frontend (4 hours)

**Tasks:**

- [ ] Create `StartTrialCard` component
- [ ] Create `TrialBanner` component
- [ ] Create `ExpiredBanner` component
- [ ] Add trial status fetch to dashboard
- [ ] Create `/tenant/billing` page
- [ ] Integrate Stripe Checkout redirect

**Files:**
| File | Action |
|------|--------|
| `apps/web/src/components/trial/StartTrialCard.tsx` | Create |
| `apps/web/src/components/trial/TrialBanner.tsx` | Create |
| `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` | Add trial UI |
| `apps/web/src/app/(protected)/tenant/billing/page.tsx` | Create |

### Phase 3: Stripe Setup + Testing (2 hours)

**Tasks:**

- [ ] Create Stripe Product + Price ($99/month)
- [ ] Test checkout flow end-to-end
- [ ] Test webhook locally with Stripe CLI
- [ ] Add basic E2E test for trial start

---

## Acceptance Criteria

### Must Have (MVP)

- [ ] User can sign up free (already works)
- [ ] After creating first package, "Start Trial" button appears
- [ ] Clicking starts 14-day trial
- [ ] Trial countdown shows on dashboard
- [ ] User can click "Upgrade" to go to Stripe Checkout
- [ ] After payment, status becomes ACTIVE
- [ ] After trial expires (no payment), banner changes to "expired"

### Deferred (Not in MVP)

- Multiple pricing tiers
- Feature gating by tier
- Stripe Subscriptions (auto-renewal)
- Customer portal
- Trial extension
- Hard lock on expired trials

---

## Edge Cases Addressed

| Edge Case                         | Solution                                         |
| --------------------------------- | ------------------------------------------------ |
| Double-click "Start Trial"        | Idempotent - check if `trialEndsAt` exists first |
| Timezone issues                   | Store as UTC, display in local timezone          |
| Email aliases for multiple trials | Normalize emails (strip `+alias`) on signup      |
| Webhook failure                   | Nightly reconciliation job (Phase 2 future work) |

---

## Files to Create

```
server/
  src/
    routes/
      billing.routes.ts          # NEW: checkout endpoint

apps/web/
  src/
    components/
      trial/
        StartTrialCard.tsx       # NEW
        TrialBanner.tsx          # NEW
        index.ts                 # NEW: exports
    app/
      (protected)/
        tenant/
          billing/
            page.tsx             # NEW: billing page
```

## Files to Modify

```
server/
  prisma/
    schema.prisma               # Add 3 fields + enum
  src/
    routes/
      tenant-admin.routes.ts    # Add trial status endpoint
      webhooks.routes.ts        # Add checkout.session.completed

apps/web/
  src/
    app/
      (protected)/
        tenant/
          dashboard/
            page.tsx            # Add trial UI integration
```

---

## Stripe Setup Checklist

- [ ] Create Product: "MAIS Subscription"
- [ ] Create Price: $99/month recurring
- [ ] Note Price ID: `price_xxx` for checkout session
- [ ] Configure webhook: `checkout.session.completed`
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3001/v1/webhooks/stripe`

---

## Success Metrics

| Metric                  | Target                |
| ----------------------- | --------------------- |
| Time to implement       | < 2 days              |
| Signup → Trial start    | < 10 minutes          |
| Trial → Paid conversion | Track (no target yet) |

---

## References

- Existing Stripe adapter: `server/src/adapters/stripe.adapter.ts`
- Existing webhook handling: `server/src/routes/webhooks.routes.ts`
- Dashboard: `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`
- Tenant schema: `server/prisma/schema.prisma:37-119`
