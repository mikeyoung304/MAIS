# P2: Missing Validation of package.active Status

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The route validates that the package exists and has `bookingType = 'DATE'`, but does NOT check if the package is active.

**File:** `server/src/routes/public-date-booking.routes.ts:69-82`

```typescript
// Line 69-72: Fetch package
const pkg = await catalogRepo.getPackageById(tenantId, input.packageId);
if (!pkg) {
  throw new NotFoundError(`Package not found: ${input.packageId}`);
}

// Line 74-81: Check bookingType but NOT active status
if (pkg.bookingType !== 'DATE') {
  res.status(400).json({ error: 'Invalid package type' });
  return;
}
// ❌ MISSING: Check pkg.active === true
```

## Impact

- Customers can book inactive/archived packages
- Tenants who deactivate packages to prevent new bookings will still receive orders
- Violates business rule: only active packages should be bookable
- Financial implications if pricing has changed and old package is booked

## Recommended Fix

```typescript
// After package fetch, add active check:
if (!pkg.active) {
  throw new PackageNotAvailableError(pkg.id);
}

// Or with user-friendly message:
if (!pkg.active) {
  res.status(400).json({
    error: 'Package not available',
    message: 'This package is no longer available for booking.',
  });
  return;
}
```

## Testing

- Deactivate a package and try to book it
- Verify appropriate error message is returned

## Review Reference
- Data Integrity Review Finding P2-001 (Missing validation of package.active)
