---
status: complete
priority: p2
issue_id: '449'
tags: [agent, tools, bookings, crud]
dependencies: []
completed_at: 2025-12-28
---

# Add Booking Update Tool for Reschedules

## Problem Statement

Bookings have create and cancel, but no update. Users ask to reschedule and agent can't help without canceling and recreating - which loses payment info.

## Severity: P2 - IMPORTANT

CRUD incompleteness. Reschedule is common user request.

## Solution Implemented

Enhanced the existing `update_booking` tool in `server/src/agent/tools/write-tools.ts` with:

1. **New Parameters**:
   - `newTime` (optional): Time in HH:MM format for timeslot bookings
   - `notifyCustomer` (optional, default true): Whether to notify customer of changes

2. **Trust Tier**: T2 (soft confirm) - preserves payment info and customer details

3. **Input Schema**:

   ```typescript
   {
     bookingId: string,      // Required - ID of booking to update
     newDate: string,        // Optional - YYYY-MM-DD format
     newTime: string,        // Optional - HH:MM 24-hour format
     notes: string,          // Optional - internal notes
     status: 'CONFIRMED' | 'FULFILLED',  // Optional - status update
     notifyCustomer: boolean // Optional - default true
   }
   ```

4. **Validation**:
   - Tenant isolation verified (booking must belong to tenant)
   - Cannot update cancelled/refunded bookings
   - New date cannot be in the past
   - New date cannot have conflicting booking
   - New date cannot be a blackout date
   - Time format validated (HH:MM in 24-hour format)

5. **Executor Logic** (in `server/src/agent/executors/index.ts`):
   - Uses advisory locks for date/time changes to prevent race conditions
   - Updates `startTime` field when `newTime` is provided
   - Updates `reminderDueDate` and clears `reminderSentAt` on date changes
   - Preserves all payment info (depositPaidAmount, balancePaidAmount, etc.)
   - Logs customer notification intent for future notification service

## Files Modified

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts` - Enhanced updateBookingTool
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/index.ts` - Enhanced update_booking executor

## Acceptance Criteria

- [x] `update_booking` tool created (T2 trust tier)
- [x] Validates booking ownership (tenant isolation)
- [x] Checks new date availability (no double-booking)
- [x] Checks new date isn't blacked out
- [x] Preserves payment status and customer info
- [x] Optional customer notification flag
- [x] TypeScript compiles without errors
- [x] Tests pass

## Testing

- TypeScript compilation: PASS
- Agent context builder tests: PASS (2 passed)
- Full test suite runs without new failures

## Notes

The tool was already partially implemented - this change added:

- `newTime` parameter support for timeslot bookings
- `notifyCustomer` parameter (default true)
- Better validation (past date check, time format validation)
- Enhanced error messages
- Improved executor with race condition prevention
- Customer notification logging for future integration
