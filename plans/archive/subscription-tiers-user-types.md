# Subscription Tiers MVP (2-3 Days)

## Overview

Add tiered pricing ($49 STARTER / $150 PRO) with AI usage limits. Ship the simplest thing that lets us charge different prices and prevent chatbot abuse.

## What We're NOT Building (v2)

- ❌ Separate `Subscription` model (just add fields to Tenant)
- ❌ `UsageRecord` model (just use a counter)
- ❌ `Customer` model changes (already exists, leave it)
- ❌ `UserType` enum (already have `UserRole`)
- ❌ Feature gates for non-existent features (white_label, api_access, team_members)
- ❌ Trial feature gating with payment info
- ❌ Stripe Customer Portal (email us to cancel)
- ❌ Usage analytics/dashboards
- ❌ Pricing comparison page (link to Notion or simple static)

## The 3 User Groups (Simplified)

| Group            | How It Works                                       |
| ---------------- | -------------------------------------------------- |
| **Admin (Mike)** | Existing `PLATFORM_ADMIN` role — no changes needed |
| **Tenant Owner** | Existing `TENANT_ADMIN` role + new `tier` field    |
| **End Customer** | Existing `Customer` model — no changes needed      |

Paying tenants are differentiated by `tier`, not user type.

---

## Day 1: Schema + Config

### 1.1 Add Fields to Tenant Model

```prisma
// server/prisma/schema.prisma

enum SubscriptionTier {
  FREE      // Trial (14 days, 50 AI messages)
  STARTER   // $49/month (500 AI messages)
  PRO       // $150/month (5000 AI messages)
}

model Tenant {
  // ... existing fields ...

  // ADD these 3 fields:
  tier              SubscriptionTier @default(FREE)
  aiMessagesUsed    Int              @default(0)
  aiMessagesResetAt DateTime?
}
```

**Migration:**

```bash
cd server
npx prisma migrate dev --name add_subscription_tier
```

### 1.2 Tier Limits Config

```typescript
// server/src/config/tiers.ts

export const TIER_LIMITS = {
  FREE: { aiMessages: 50, price: 0 },
  STARTER: { aiMessages: 500, price: 4900 },
  PRO: { aiMessages: 5000, price: 15000 },
} as const;

export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID!,
  PRO: process.env.STRIPE_PRO_PRICE_ID!,
} as const;

export type TierName = keyof typeof TIER_LIMITS;
```

### 1.3 Stripe Product Setup

In Stripe Dashboard:

1. Create Product: "Handled Starter" → Price: $49/month recurring → Save Price ID
2. Create Product: "Handled Growth" → Price: $150/month recurring → Save Price ID
3. Add to `.env`:
   ```
   STRIPE_STARTER_PRICE_ID=price_xxx
   STRIPE_PRO_PRICE_ID=price_xxx
   ```

---

## Day 2: AI Quota + Checkout

### 2.1 AI Quota Check (In Orchestrator)

```typescript
// server/src/agent/customer/customer-orchestrator.ts

import { TIER_LIMITS } from '../../config/tiers';

async processMessage(tenantId: string, sessionId: string, message: string) {
  // 1. Get tenant with tier info
  const tenant = await this.tenantRepo.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  // 2. Check quota BEFORE processing
  const limit = TIER_LIMITS[tenant.tier].aiMessages;
  if (tenant.aiMessagesUsed >= limit) {
    return {
      type: 'quota_exceeded',
      content: `You've used all ${limit} AI messages this month. Upgrade your plan to continue.`,
      upgradeUrl: '/tenant/settings/billing',
      usage: { used: tenant.aiMessagesUsed, limit },
    };
  }

  // 3. Process message
  const response = await this.generateResponse(message);

  // 4. Increment counter AFTER success (atomic)
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { aiMessagesUsed: { increment: 1 } },
  });

  return {
    ...response,
    usage: {
      used: tenant.aiMessagesUsed + 1,
      limit,
      remaining: limit - tenant.aiMessagesUsed - 1,
    },
  };
}
```

### 2.2 Update Billing Routes

```typescript
// server/src/routes/tenant-admin-billing.routes.ts

import { TIER_LIMITS, STRIPE_PRICES, TierName } from '../config/tiers';

// GET /v1/tenant-admin/billing/subscription
// Returns current tier, usage, and limits
const getSubscription = async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: {
      tier: true,
      aiMessagesUsed: true,
      aiMessagesResetAt: true,
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });

  const limit = TIER_LIMITS[tenant.tier].aiMessages;

  return {
    status: 200,
    body: {
      tier: tenant.tier,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      usage: {
        aiMessages: {
          used: tenant.aiMessagesUsed,
          limit,
          remaining: Math.max(0, limit - tenant.aiMessagesUsed),
          resetAt: tenant.aiMessagesResetAt,
        },
      },
    },
  };
};

// POST /v1/tenant-admin/billing/checkout
// Body: { tier: 'STARTER' | 'PRO' }
const createCheckout = async (req, res) => {
  const { tier } = req.body as { tier: 'STARTER' | 'PRO' };

  if (!STRIPE_PRICES[tier]) {
    return { status: 400, body: { error: 'Invalid tier' } };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
  });

  // Create or get Stripe customer
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.businessName,
      metadata: { tenantId: tenant.id },
    });
    customerId = customer.id;
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: STRIPE_PRICES[tier], quantity: 1 }],
    subscription_data: {
      metadata: { tenantId: tenant.id, tier },
    },
    success_url: `${process.env.APP_URL}/tenant/settings/billing?success=true`,
    cancel_url: `${process.env.APP_URL}/tenant/settings/billing?canceled=true`,
  });

  return { status: 200, body: { checkoutUrl: session.url } };
};
```

### 2.3 Webhook Handler

```typescript
// server/src/routes/webhooks.routes.ts (add to existing)

// Handle checkout.session.completed
if (event.type === 'checkout.session.completed') {
  const session = event.data.object as Stripe.Checkout.Session;
  const tenantId = session.subscription_data?.metadata?.tenantId || session.metadata?.tenantId;
  const tier = session.subscription_data?.metadata?.tier || session.metadata?.tier;

  if (tenantId && tier) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        tier: tier as SubscriptionTier,
        subscriptionStatus: 'ACTIVE',
        stripeCustomerId: session.customer as string,
      },
    });
  }
}

// Handle customer.subscription.deleted (cancellation)
if (event.type === 'customer.subscription.deleted') {
  const subscription = event.data.object as Stripe.Subscription;
  const tenantId = subscription.metadata.tenantId;

  if (tenantId) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        tier: 'FREE',
        subscriptionStatus: 'EXPIRED',
      },
    });
    // TODO: Send "sorry to see you go" email
  }
}

// Handle invoice.payment_failed
if (event.type === 'invoice.payment_failed') {
  const invoice = event.data.object as Stripe.Invoice;
  const tenantId = invoice.subscription_details?.metadata?.tenantId;

  if (tenantId) {
    // Don't immediately downgrade - Stripe will retry
    // Just send notification email
    await emailService.send({
      to: invoice.customer_email,
      template: 'payment_failed',
      data: {
        updatePaymentUrl: `${process.env.APP_URL}/tenant/settings/billing`,
      },
    });
  }
}
```

### 2.4 Monthly Reset (Cron or Manual)

```typescript
// server/scripts/reset-monthly-usage.ts

import { prisma } from '../src/lib/prisma';

async function resetMonthlyUsage() {
  const result = await prisma.tenant.updateMany({
    where: {
      subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
    },
    data: {
      aiMessagesUsed: 0,
      aiMessagesResetAt: new Date(),
    },
  });

  console.log(`Reset AI usage for ${result.count} tenants`);
}

resetMonthlyUsage();
```

Run monthly via cron: `0 0 1 * * cd /app && npx ts-node scripts/reset-monthly-usage.ts`

---

## Day 3: Frontend

### 3.1 Subscription Hook

```typescript
// apps/web/src/hooks/useSubscription.ts

import useSWR from 'swr';

export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR('/api/billing/subscription');

  const isOverQuota = data?.usage?.aiMessages?.remaining === 0;
  const usagePercent = data?.usage?.aiMessages
    ? (data.usage.aiMessages.used / data.usage.aiMessages.limit) * 100
    : 0;

  return {
    tier: data?.tier || 'FREE',
    status: data?.subscriptionStatus,
    usage: data?.usage,
    isOverQuota,
    usagePercent,
    isLoading,
    error,
    refresh: mutate,
  };
}
```

### 3.2 Usage Display Component

```tsx
// apps/web/src/components/subscription/AIUsageDisplay.tsx

'use client';

import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';

export function AIUsageDisplay() {
  const { tier, usage, usagePercent, isOverQuota } = useSubscription();

  if (!usage?.aiMessages) return null;

  const { used, limit, remaining } = usage.aiMessages;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">AI Messages:</span>
        <span className={isOverQuota ? 'text-red-500 font-medium' : 'text-text-primary'}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>

      {usagePercent >= 80 && !isOverQuota && (
        <Link href="/tenant/settings/billing" className="text-sage hover:underline">
          Upgrade for more
        </Link>
      )}

      {isOverQuota && (
        <Link href="/tenant/settings/billing" className="text-red-500 hover:underline font-medium">
          Upgrade to continue
        </Link>
      )}
    </div>
  );
}
```

### 3.3 Billing Settings Page

```tsx
// apps/web/src/app/(protected)/tenant/settings/billing/page.tsx

'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const TIERS = [
  {
    name: 'STARTER',
    label: 'Starter',
    price: '$49/mo',
    aiMessages: '500 AI messages/month',
  },
  {
    name: 'PRO',
    label: 'Growth',
    price: '$150/mo',
    aiMessages: '5,000 AI messages/month',
  },
];

export default function BillingPage() {
  const { tier, usage, status } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (targetTier: string) => {
    setLoading(targetTier);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier }),
      });
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Checkout failed:', err);
      setLoading(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl font-bold mb-6">Billing</h1>

      {/* Current Plan */}
      <div className="bg-surface-alt rounded-xl p-6 mb-8 border border-neutral-800">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-medium text-text-primary">Current Plan</h2>
            <p className="text-2xl font-bold text-sage">{tier}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              status === 'ACTIVE'
                ? 'bg-emerald-500/15 text-emerald-500'
                : status === 'TRIALING'
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'bg-red-500/15 text-red-500'
            }`}
          >
            {status}
          </span>
        </div>

        {usage?.aiMessages && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">AI Messages</span>
              <span>
                {usage.aiMessages.used} / {usage.aiMessages.limit}
              </span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage transition-all"
                style={{
                  width: `${Math.min(100, (usage.aiMessages.used / usage.aiMessages.limit) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {tier === 'FREE' && (
        <div className="space-y-4">
          <h2 className="font-medium text-text-primary">Upgrade Your Plan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {TIERS.map((t) => (
              <div key={t.name} className="bg-surface rounded-xl p-6 border border-neutral-800">
                <h3 className="font-semibold text-lg">{t.label}</h3>
                <p className="text-2xl font-bold text-sage my-2">{t.price}</p>
                <p className="text-sm text-text-muted mb-4">{t.aiMessages}</p>
                <Button
                  variant="sage"
                  className="w-full"
                  onClick={() => handleUpgrade(t.name)}
                  disabled={loading === t.name}
                >
                  {loading === t.name ? 'Loading...' : `Upgrade to ${t.label}`}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact to Cancel */}
      <p className="text-sm text-text-muted mt-8">
        Need to cancel?{' '}
        <a href="mailto:support@gethandled.ai" className="text-sage hover:underline">
          Contact us
        </a>
      </p>
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] New tenants start as `FREE` tier with 50 AI messages
- [ ] AI chatbot returns quota exceeded message when limit hit
- [ ] Upgrade to STARTER ($49) or PRO ($150) via Stripe Checkout
- [ ] Webhook updates tier on successful payment
- [ ] Webhook handles cancellation (downgrade to FREE)
- [ ] Frontend shows current usage and upgrade CTAs
- [ ] Monthly reset script works (run manually first, then cron)

## Files to Modify

| File                                                            | Changes                                             |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `server/prisma/schema.prisma`                                   | Add `SubscriptionTier` enum, add 3 fields to Tenant |
| `server/src/config/tiers.ts`                                    | NEW: tier limits and Stripe price IDs               |
| `server/src/agent/customer/customer-orchestrator.ts`            | Add quota check before/after AI call                |
| `server/src/routes/tenant-admin-billing.routes.ts`              | Add `/subscription` GET, update `/checkout`         |
| `server/src/routes/webhooks.routes.ts`                          | Handle subscription events                          |
| `server/scripts/reset-monthly-usage.ts`                         | NEW: monthly reset script                           |
| `apps/web/src/hooks/useSubscription.ts`                         | NEW: subscription data hook                         |
| `apps/web/src/components/subscription/AIUsageDisplay.tsx`       | NEW: usage display                                  |
| `apps/web/src/app/(protected)/tenant/settings/billing/page.tsx` | Upgrade UI                                          |

## What's Deferred to v2

- Detailed usage analytics (UsageRecord model)
- Feature-based entitlements (custom_domain, etc.)
- Stripe Customer Portal for self-service cancel
- Trial extension logic
- Pricing comparison landing page
- requiresPaymentInfo trial gating
- Team members / multi-seat billing

## Testing

**Unit tests:**

- [ ] Quota check logic (under limit, at limit, over limit)
- [ ] Tier limits config is complete

**Manual tests:**

- [ ] Sign up → see FREE tier, 50 message limit
- [ ] Use 50+ messages → see quota exceeded
- [ ] Click upgrade → Stripe Checkout → complete payment
- [ ] Return to app → see new tier
- [ ] Run reset script → usage back to 0

**Stripe test mode:**

- Use test cards: `4242424242424242`
- Test webhook locally: `stripe listen --forward-to localhost:3001/v1/webhooks/stripe`
