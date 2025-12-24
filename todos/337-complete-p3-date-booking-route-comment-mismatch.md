# P3: Backend Route Comment Mismatch

## Priority: P3 Nice-to-have

## Status: pending

## Feature: DATE Booking Flow

## Category: Code Simplicity

## Issue

Misleading comment suggests a workaround that may confuse future developers.

**File:** `server/src/routes/public-date-booking.routes.ts:99-100`

```typescript
// The booking service expects packageId as slug, but we have the ID
// Use the package slug for the createCheckout call
```

## Impact

- Future developers may be confused by this comment
- Comment implies confusion about ID vs slug that should be resolved

## Recommendation

Either:

1. **Clarify the comment:**

   ```typescript
   // BookingService.createCheckout expects package slug (not ID) for
   // backward compatibility with existing booking flows. We fetch by ID
   // (more secure) and convert to slug here.
   ```

2. **Remove comment if #317 is resolved** (ID vs Slug fix makes this moot)

## Related

- #317 (ID vs Slug Impedance Mismatch) - Root cause

## Review Reference

- Code Simplicity Review Finding P3-11 (Backend Route Comment Mismatch)
