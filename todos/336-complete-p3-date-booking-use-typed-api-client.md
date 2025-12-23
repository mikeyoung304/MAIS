# P3: Use Typed API Client Instead of Raw Fetch

## Priority: P3 Nice-to-have
## Status: complete
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Manual `fetch()` call instead of using the typed API client.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:128-144`

```typescript
// Comment on line 127:
// Make direct fetch call to the new endpoint since ts-rest may not have picked it up yet
const response = await fetch(`${baseUrl}/v1/public/bookings/date`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...}),
});
```

## Impact

- Loses type safety benefits of ts-rest
- Inconsistent with rest of codebase
- Manual error handling required

## Recommendation

Once contract is registered (#332), use typed API client:

```typescript
// After contract registration
const result = await api.createDateBooking({
  body: {
    packageId: pkg.id,
    date: dateStr,
    customerName: customerDetails.name.trim(),
    customerEmail: customerDetails.email.trim(),
    customerPhone: customerDetails.phone.trim() || undefined,
    notes: customerDetails.notes.trim() || undefined,
  },
});

if (result.status === 200) {
  window.location.href = result.body.checkoutUrl;
} else if (result.status === 409) {
  toast.error('Date unavailable');
  setCurrentStepIndex(1);
}
```

## Dependencies

- #332 (Missing Contract Registration) - Must be done first



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Code Simplicity Review Finding P3-9 (Inconsistent Error Handling in Fetch)
