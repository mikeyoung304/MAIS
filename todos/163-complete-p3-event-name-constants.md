---
status: complete
priority: p3
issue_id: "163"
tags: [code-review, quality, mvp-gaps, typescript]
dependencies: []
---

# Magic Strings for Event Names

## Problem Statement

Event names are hardcoded strings throughout the codebase. Typos cause silent event delivery failures.

**Why This Matters:**
- No compile-time safety
- Typos cause silent failures
- Hard to refactor

## Findings

**Examples:** `'BookingPaid'`, `'BookingRescheduled'`, `'BookingCancelled'`, `'BookingReminderDue'`

## Solution Implemented

Created event name constants in `/server/src/lib/core/events.ts`:

```typescript
export const BookingEvents = {
  PAID: 'BookingPaid',
  RESCHEDULED: 'BookingRescheduled',
  CANCELLED: 'BookingCancelled',
  REMINDER_DUE: 'BookingReminderDue',
  REFUNDED: 'BookingRefunded',
  BALANCE_PAYMENT_COMPLETED: 'BalancePaymentCompleted',
} as const;

export const AppointmentEvents = {
  BOOKED: 'AppointmentBooked',
} as const;
```

## Acceptance Criteria

- [x] Event name constants created
- [x] All emitters use constants
- [x] All subscribers use constants
- [x] TypeScript passes

## Implementation Details

### Files Modified:

1. **server/src/lib/core/events.ts** - Created event constant objects with full type safety
2. **server/src/services/booking.service.ts** - Updated 6 event emitters:
   - BookingPaid (line 633)
   - BalancePaymentCompleted (line 415)
   - BookingRescheduled (line 963)
   - BookingCancelled (line 1030)
   - BookingRefunded (line 1137)
   - AppointmentBooked (line 834)

3. **server/src/services/reminder.service.ts** - Updated reminder event:
   - BookingReminderDue (line 159)

4. **server/src/di.ts** - Updated 3 event subscribers:
   - BookingPaid subscriber (line 503)
   - BookingReminderDue subscriber (line 526)
   - AppointmentBooked subscriber (line 554)

5. **Test files** - Updated assertions in:
   - server/test/booking.service.spec.ts (line 141)
   - server/test/integration/payment-flow.integration.spec.ts (line 229)
   - server/test/integration/booking-race-conditions.spec.ts (line 340)
   - server/test/controllers/webhooks.controller.spec.ts (line 388)

### Test Results:

All 927 relevant tests pass. The few failing tests are pre-existing database connection issues unrelated to this change.

### Benefits:

- **Type Safety:** All event names are now typed constants
- **Compile-time Validation:** Typos caught at compile time instead of runtime
- **Refactoring:** Easily rename event names with IDE support
- **Maintainability:** Single source of truth for event names
