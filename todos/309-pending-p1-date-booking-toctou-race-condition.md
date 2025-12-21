# P1: TOCTOU Race Condition in DATE Booking Flow

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Data Integrity / Security

## Issue

The date booking route performs availability check BEFORE creating the checkout session, creating a Time-of-Check to Time-of-Use (TOCTOU) vulnerability.

**File:** `server/src/routes/public-date-booking.routes.ts:84-106`

```typescript
// Line 84-94: Check happens outside booking transaction
const availability = await availabilityService.checkAvailability(tenantId, input.date);
if (!availability.available) {
  throw new BookingConflictError(...);
}

// Line 96-106: Checkout created separately (could be minutes later)
const checkout = await bookingService.createCheckout(tenantId, { ... });
```

## Race Condition Timeline

```
Time  Request A                    Request B
----  ---------------------------  ---------------------------
T0    Check date 2025-06-15 ✓
T1                                  Check date 2025-06-15 ✓
T2    Create checkout
T3                                  Create checkout (DOUBLE BOOK!)
T4    Complete payment
T5                                  Complete payment
```

## Impact

- Users could both proceed to Stripe checkout thinking date is available
- Window between availability check and payment could be 5-10 minutes
- While `bookingRepo.create()` has advisory locks, the availability check doesn't acquire the lock early enough

## Recommended Fixes

### Option 1: Acquire advisory lock during availability check (BEST)

```typescript
const availability = await availabilityService.checkAvailabilityWithLock(
  tenantId,
  input.date,
  { holdLockForSeconds: 300 } // Hold for 5 minutes
);
```

### Option 2: Re-check in webhook handler

```typescript
async onPaymentCompleted() {
  // Inside transaction, BEFORE creating booking:
  const stillAvailable = await availabilityService.checkAvailability(tenantId, date);
  if (!stillAvailable.available) {
    await paymentProvider.refund(sessionId);
    throw new BookingConflictError(date);
  }
  // ... proceed with booking creation
}
```

### Option 3: Use idempotency key that includes date

The checkout session already uses idempotency - enhance to include date.

## Files to Update

1. `server/src/services/availability.service.ts` - Add `checkAvailabilityWithLock()`
2. `server/src/services/booking.service.ts` - Re-check availability in payment handler
3. Consider optimistic locking with version field

## Note

The advisory lock in `bookingRepo.create()` (line 185) mitigates this but doesn't eliminate the race condition during the checkout creation phase.

## Review Reference
- Data Integrity Review Finding P1-006 (Missing transaction atomicity)
- Security Review Finding P2-004 (Race Condition in Date Availability Check)
