---
status: complete
priority: p1
issue_id: '267'
tags: [code-review, backend-audit, stripe, webhooks, stripe-connect]
dependencies: []
completed_at: 2025-12-06
---

# Missing Stripe Connect Account Webhooks

## Problem Statement

There is no webhook endpoint to handle Stripe Connect account events such as deauthorization or requirements changes. When a tenant's Stripe account is deauthorized or has issues, the platform has no visibility into these changes.

**Why it matters:**

- No notification when tenant disconnects Stripe account
- Platform can't detect when account has compliance issues
- `stripeOnboarded` flag may become stale
- Payments may fail silently when account is no longer valid

## Findings

### Agent: backend-audit

- **Location:** `server/src/routes/webhooks.routes.ts` (missing), `server/src/services/stripe-connect.service.ts`
- **Evidence:** No Connect-specific webhook endpoint or handlers
- **Impact:** HIGH - Platform loses sync with tenant Stripe account status

## Proposed Solutions

### Option A: Add Connect Account Webhook Endpoint (Recommended)

**Description:** Create separate webhook endpoint for Connect account events

```typescript
// POST /v1/webhooks/stripe/connect
router.post('/connect', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'account.updated':
      // Check if charges_enabled changed
      const account = event.data.object;
      await updateTenantStripeStatus(account);
      break;

    case 'account.application.deauthorized':
      // Tenant disconnected their Stripe account
      await handleAccountDeauthorization(account);
      break;

    case 'account.external_account.updated':
      // Bank account/card changed
      break;
  }
});
```

**Effort:** Medium (3-4 hours)
**Risk:** Low

### Option B: Periodic Account Status Check

**Description:** Cron job to periodically verify account status via API

**Pros:**

- Simpler implementation
- No additional webhook secret needed

**Cons:**

- Not real-time
- Uses more API calls

**Effort:** Small (1-2 hours)
**Risk:** Low

## Recommended Action

Implement Option A for real-time visibility into Connect account changes.

## Technical Details

**Affected Files:**

- `server/src/routes/webhooks.routes.ts` (add `/connect` endpoint)
- `server/src/routes/index.ts` (register new route)
- `server/src/services/stripe-connect.service.ts` (add status update methods)

**Environment Variables Needed:**

- `STRIPE_CONNECT_WEBHOOK_SECRET` - Separate webhook secret for Connect events

**Stripe Dashboard Config:**

- Create new webhook endpoint pointing to `/v1/webhooks/stripe/connect`
- Subscribe to: `account.updated`, `account.application.deauthorized`

## Acceptance Criteria

- [x] Connect webhook endpoint created and registered
- [x] `account.updated` handler updates `stripeOnboarded` flag
- [x] `account.application.deauthorized` clears Stripe account data
- [x] Webhook signature verification with separate secret
- [x] Test coverage for Connect events

## Work Log

| Date       | Action                               | Learnings                                                    |
| ---------- | ------------------------------------ | ------------------------------------------------------------ |
| 2025-12-05 | Created from backend audit           | Critical for multi-tenant payment reliability                |
| 2025-12-06 | Implemented Connect webhook endpoint | Created controller, routes, tests, and environment variables |

## Implementation Summary

**Files Created:**

- `/server/src/routes/stripe-connect-webhooks.routes.ts` - Controller with account.updated and account.application.deauthorized handlers
- `/server/test/integration/stripe-connect-webhooks.integration.spec.ts` - Integration tests (7 passing tests)

**Files Modified:**

- `/server/src/app.ts` - Registered Connect webhook route at `/v1/webhooks/stripe/connect`
- `/server/.env.example` - Added STRIPE_CONNECT_WEBHOOK_SECRET configuration
- `/.env.example` - Added STRIPE_CONNECT_WEBHOOK_SECRET configuration

**Key Features:**

- Separate webhook secret for Connect events (STRIPE_CONNECT_WEBHOOK_SECRET)
- account.updated handler tracks charges_enabled status and updates tenant.stripeOnboarded
- account.application.deauthorized handler clears tenant Stripe account data and encrypted secrets
- Graceful handling of unknown accounts (logs warning, returns success to prevent retries)
- Rate limiting applied via existing webhookLimiter middleware
- Only registered in real mode when both STRIPE_SECRET_KEY and STRIPE_CONNECT_WEBHOOK_SECRET are configured

**Testing:**

- 7 integration tests covering account updates, deauthorization, and schema constraints
- Tests verify database operations work correctly for webhook event handling
- All tests passing

## Resources

- [Stripe Connect Webhooks](https://stripe.com/docs/connect/webhooks)
- Related: `server/src/services/stripe-connect.service.ts`
