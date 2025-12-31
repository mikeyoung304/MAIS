---
status: complete
priority: p1
issue_id: '144'
tags: [code-review, security, mvp-gaps, balance-payment]
dependencies: []
---

# Balance Payment Token Replay Vulnerability

## Problem Statement

Balance payment tokens can be replayed indefinitely to create multiple Stripe checkout sessions for the same booking. Once a customer completes payment, the token is not invalidated, allowing attackers to create additional checkout sessions.

**Why This Matters:**

- Security vulnerability allowing duplicate payments
- Financial risk from multiple charges for same balance
- Customer trust impact if overcharged

## Findings

### Agent: security-sentinel

**Location:** `server/src/routes/public-balance-payment.routes.ts:32-56`

**Evidence:**

```typescript
async createBalancePaymentCheckout(token: string): Promise<{
  checkoutUrl: string;
  balanceAmountCents: number;
}> {
  const result = validateBookingToken(token, 'pay_balance');
  if (!result.valid) {
    throw new Error(`Token validation failed: ${result.message}`);
  }

  const { tenantId, bookingId } = result.payload;

  // NO CHECK: Token can be used multiple times
  // NO CHECK: Booking balance status not verified before creating checkout
  const checkout = await this.bookingService.createBalancePaymentCheckout(
    tenantId,
    bookingId
  );

  return checkout;
}
```

**Attack Scenario:**

1. Customer receives balance payment link with token
2. Customer uses token to create checkout session #1
3. Customer completes payment
4. Attacker intercepts token from email/browser history
5. Attacker creates checkout session #2, #3, etc.
6. Multiple payments processed for same balance

## Proposed Solutions

### Option A: Check Balance Status Before Checkout (Recommended)

**Pros:** Simple, immediate fix
**Cons:** None significant
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// Check if balance already paid
const booking = await this.bookingService.getBookingById(tenantId, bookingId);
if (booking.balancePaidAt || booking.balancePaidAmount) {
  throw new Error('Balance has already been paid for this booking');
}
```

### Option B: One-Time Token Usage

**Pros:** Most secure, prevents all replay attacks
**Cons:** Requires token usage tracking
**Effort:** Medium (4-6 hours)
**Risk:** Medium

Add token usage tracking in Redis/database to ensure single use.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/public-balance-payment.routes.ts`
- `server/src/services/booking.service.ts`

**Components:** Balance payment flow

## Acceptance Criteria

- [ ] Balance payment endpoint checks if balance already paid before creating checkout
- [ ] Attempting to create checkout for already-paid balance returns clear error
- [ ] Unit test verifies duplicate balance payment prevention
- [ ] E2E test verifies token cannot create multiple checkouts after payment

## Work Log

| Date       | Action  | Notes                     |
| ---------- | ------- | ------------------------- |
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Related: Balance payment webhook idempotency (P2-006)
