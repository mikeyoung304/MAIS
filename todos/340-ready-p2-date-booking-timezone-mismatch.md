# P2: Timezone Mismatch Between Client and Server Date Validation

## Priority: P2 Important
## Status: ready
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The date validation uses different timezone handling between client and server, which could cause dates to be valid on one side but invalid on the other near midnight.

**Server (packages/contracts/src/dto.ts:170-183):**
```typescript
.refine((val) => {
  const date = new Date(val + 'T00:00:00Z');  // ← UTC
  return !isNaN(date.getTime());
})
.refine((val) => {
  const date = new Date(val + 'T00:00:00Z');  // ← UTC
  const now = new Date();
  now.setHours(0, 0, 0, 0);                   // ← Local time!
  return date >= now;
})
```

**Client (client/src/features/storefront/DateBookingWizard.tsx:83):**
```typescript
return unavailableDatesData.map((dateStr) => new Date(dateStr + 'T00:00:00')); // ← Local time
```

## Impact

- A user in PST (UTC-8) booking at 11pm for "today" could have different validation results
- Dates displayed in calendar might not match server's understanding
- Edge case: booking "today" at 11:30pm PST could fail validation when it should succeed

## Recommended Fix

Use consistent UTC handling everywhere:

```typescript
// Server - also use UTC for comparison
.refine((val) => {
  const date = new Date(val + 'T00:00:00Z');
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date >= todayUTC;
})

// Client - also use UTC
return unavailableDatesData.map((dateStr) => new Date(dateStr + 'T00:00:00Z'));
```

## Testing

- Test booking at 11:30pm in different timezones
- Verify calendar disabled dates match server validation



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Code Review PR: feat/date-booking-hardening (ce6443d)
