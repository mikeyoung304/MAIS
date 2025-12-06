---
status: pending
priority: p2
issue_id: "284"
tags: [code-review, security, jwt, tokens, booking-management]
dependencies: []
---

# Missing Token Revocation for Booking Management Links

## Problem Statement

JWT tokens for booking management are stateless with no revocation mechanism. If a customer cancels their booking, the old reschedule link remains valid for 7 days. This creates business logic bypass risks.

**Why it matters:**
- Canceled bookings can be "un-canceled" via old link
- Modified bookings accessible via outdated cached links
- No way to invalidate compromised tokens
- Customer confusion from stale links

## Findings

### Agent: security-sentinel
- **Location:** `server/src/lib/booking-tokens.ts`
- **Evidence:**
```typescript
export function validateBookingToken(token: string): ValidateTokenResult {
  const payload = jwt.verify(token, getBookingTokenSecret(config));
  return { valid: true, payload }; // No check if token was revoked or booking state changed
}
```
- **Severity:** MEDIUM - Business logic bypass

### Attack Scenario:
1. Customer books wedding for June 15
2. Receives reschedule link (valid 7 days)
3. Cancels booking on June 2
4. Reschedule link still works until June 9
5. Customer or attacker can "un-cancel" or cause data inconsistency

## Proposed Solutions

### Option A: State Validation on Token Use (Recommended)
**Description:** Validate booking state when token is used, not just signature

```typescript
export async function validateBookingToken(
  token: string,
  expectedAction?: BookingTokenAction,
  bookingRepo?: BookingRepository
): Promise<ValidateTokenResult> {
  try {
    const payload = jwt.verify(token, getBookingTokenSecret(config)) as BookingTokenPayload;

    // Check action match
    if (expectedAction && payload.action !== expectedAction) {
      return { valid: false, error: 'invalid', message: 'Token action mismatch' };
    }

    // Check booking state
    if (bookingRepo) {
      const booking = await bookingRepo.findById(payload.tenantId, payload.bookingId);

      if (!booking) {
        return { valid: false, error: 'invalid', message: 'Booking not found' };
      }

      // Block operations on canceled bookings
      if (booking.status === 'CANCELED' && payload.action !== 'view') {
        return { valid: false, error: 'invalid', message: 'Booking is canceled' };
      }

      // Block reschedule on fulfilled bookings
      if (booking.status === 'FULFILLED' && payload.action === 'reschedule') {
        return { valid: false, error: 'invalid', message: 'Booking is already completed' };
      }

      // Add more state checks as needed
    }

    return { valid: true, payload };
  } catch (error) {
    // ... error handling
  }
}
```

**Pros:**
- No database schema changes
- Validates against real-time booking state
- Granular control per action type

**Cons:**
- Adds database query to token validation
- Slight latency increase

**Effort:** Small (2-3 hours)
**Risk:** Low

### Option B: Token Versioning
**Description:** Add version counter to booking, invalidate tokens when version changes

```prisma
model Booking {
  // Existing fields...
  tokenVersion Int @default(0) // Increment on status change
}
```

```typescript
// Include version in token
payload: { bookingId, tenantId, action, version: booking.tokenVersion }

// Validate version matches
if (payload.version !== booking.tokenVersion) {
  return { valid: false, error: 'expired', message: 'Link has expired' };
}
```

**Effort:** Medium (4-6 hours)
**Risk:** Low

### Option C: Reduce Token Expiry
**Description:** Reduce token validity from 7 days to 48 hours

**Effort:** Small (15 minutes)
**Risk:** Low (but impacts user experience)

## Recommended Action

Implement Option A (state validation) with Option C (reduced expiry) as defense in depth.

## Technical Details

**Affected Files:**
- `server/src/lib/booking-tokens.ts`
- `server/src/routes/public-booking-management.routes.ts`
- `server/src/middleware/booking-token.middleware.ts` (if exists)

**State Transition Rules:**
| Current Status | Allowed Actions |
|----------------|-----------------|
| PENDING | reschedule, cancel, view |
| DEPOSIT_PAID | reschedule, cancel, pay_balance, view |
| PAID | reschedule, cancel, view |
| CONFIRMED | reschedule, cancel, view |
| CANCELED | view only |
| FULFILLED | view only |
| REFUNDED | view only |

## Acceptance Criteria

- [ ] Token validation checks booking state
- [ ] Canceled bookings reject modification tokens
- [ ] Fulfilled bookings reject reschedule tokens
- [ ] Token expiry reduced to 48 hours
- [ ] User-friendly error messages for invalid state
- [ ] Unit tests for state validation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from security review | Business logic bypass risk |

## Resources

- Related: `server/src/lib/booking-tokens.ts`
- Related: `server/src/routes/public-booking-management.routes.ts`
