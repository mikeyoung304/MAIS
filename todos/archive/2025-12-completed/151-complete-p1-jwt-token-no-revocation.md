---
status: complete
priority: p1
issue_id: '151'
tags: [code-review, security, mvp-gaps, jwt]
dependencies: []
---

# JWT Booking Tokens Cannot Be Revoked

## Problem Statement

JWT booking tokens are stateless and cannot be revoked when a booking is cancelled. A customer can use an old manage booking link to attempt actions on a cancelled booking.

**Why This Matters:**

- Data integrity risk (reschedule cancelled booking)
- Customer confusion
- Security vulnerability if links shared/leaked

## Findings

### Agent: architecture-strategist

**Location:** `server/src/lib/booking-tokens.ts` (entire file)

**Evidence:**

```typescript
// JWTs are stateless - cannot be revoked
export function validateBookingToken(
  token: string,
  expectedAction?: BookingTokenAction
): TokenValidationResult {
  // Only checks signature and expiration
  // Does NOT check if booking is still active
}
```

**Attack Scenario:**

1. Customer receives booking confirmation email with "Manage Booking" link
2. Customer calls venue and cancels over phone
3. Tenant admin marks booking as CANCELED
4. **Customer can still use link to reschedule the cancelled booking** (JWT valid)

## Proposed Solutions

### Option A: Check Booking Status in Routes (Recommended - MVP)

**Pros:** Simple, immediate fix
**Cons:** Extra DB query per request
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
// In route handlers
const booking = await bookingService.getBookingById(tenantId, bookingId);
if (booking.status === 'CANCELED') {
  return res.status(410).json({ error: 'BOOKING_CANCELLED' });
}
```

### Option B: Token Revocation List

**Pros:** Most secure, no extra DB query
**Cons:** Requires Redis/cache infrastructure
**Effort:** Medium (4-6 hours)
**Risk:** Low

Add revoked tokens to cache: `revoked:${bookingId}` with TTL = token expiry.

### Option C: Short-Lived Tokens with Refresh

**Pros:** Limits attack window
**Cons:** UX impact (links expire quickly)
**Effort:** High
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/public-booking-management.routes.ts`
- `server/src/routes/public-balance-payment.routes.ts`

**Components:** Public booking management, balance payment

## Acceptance Criteria

- [ ] Cancelled booking returns 410 Gone with clear error
- [ ] All public routes check booking status before actions
- [ ] E2E test verifies cancelled booking rejection
- [ ] Error message guides customer appropriately

## Work Log

| Date       | Action  | Notes                     |
| ---------- | ------- | ------------------------- |
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- JWT: Stateless token limitations
