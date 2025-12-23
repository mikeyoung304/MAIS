# P2: Direct localStorage Access Pattern

## Priority: P2 Important
## Status: complete
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Direct localStorage access in the component couples it to browser API and is redundant with existing API client tenant key handling.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:132-134`

```typescript
...(localStorage.getItem('impersonationTenantKey')
  ? { 'X-Tenant-Key': localStorage.getItem('impersonationTenantKey')! }
  : {}),
```

## Problems

1. Direct localStorage access couples component to browser API
2. Double `getItem()` call is inefficient
3. Pattern inconsistent with api.ts which already handles tenant keys (lines 28, 107-112)
4. Harder to test (requires mocking localStorage)

## Impact

- Redundant with existing API client tenant key handling
- Creates maintenance burden
- Increases test complexity

## Recommended Fix

The API client in `client/src/lib/api.ts` already handles tenant keys. This manual header injection is unnecessary since the api client's fetch wrapper already injects `X-Tenant-Key` for tenant-scoped routes.

**Remove manual injection:**

```typescript
const response = await fetch(`${baseUrl}/v1/public/bookings/date`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Remove manual tenant key injection - api client handles this
  },
  body: JSON.stringify({...}),
});
```

**Better: Use typed API client instead of raw fetch (see #323)**

## Related

- #323 (Use Typed API Client) - Should use api client instead of fetch



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Code Simplicity Review Finding P2-4 (Direct localStorage Access)
