# P2: ID vs Slug Impedance Mismatch

## Priority: P2 Important

## Status: pending

## Feature: DATE Booking Flow

## Category: Architecture

## Issue

The route receives `packageId` (ID) from the contract but `BookingService.createCheckout` expects `packageId` as a slug, requiring conversion in the route.

**File:** `server/src/routes/public-date-booking.routes.ts:69, 100`

```typescript
// Line 69: Fetch by ID
const pkg = await catalogRepo.getPackageById(tenantId, input.packageId);

// Line 100: Pass slug to service
const checkout = await bookingService.createCheckout(tenantId, {
  packageId: pkg.slug, // Use slug as expected by booking service
  // ...
});
```

## Root Cause

1. **Contract accepts ID** (`dto.ts:167`): `packageId: z.string().min(1, 'Package ID is required')`
2. **Route fetches by ID** (line 69)
3. **BookingService.createCheckout expects slug** (`booking.service.ts:223`):
   ```typescript
   const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
   ```

## Impact

- **Two package lookups** for the same package (one by ID, one by slug)
- Violates DRY principle
- Unnecessary database query overhead
- Confusing API (ID vs slug)

## Recommended Fixes

### Option 1: Update BookingService to accept ID

```typescript
async createCheckoutById(
  tenantId: string,
  input: Omit<CreateBookingInput, 'packageId'> & { packageId: string }
): Promise<{ checkoutUrl: string }> {
  const pkg = await this.catalogRepo.getPackageById(tenantId, input.packageId);
  if (!pkg) throw new NotFoundError();

  return this.createCheckout(tenantId, {
    ...input,
    packageId: pkg.slug,
  });
}
```

### Option 2: Use only the ID path (if moving to service layer per #305)

When implementing `BookingService.createDateBooking()`, use ID consistently.

## Files to Update

1. `server/src/services/booking.service.ts` - Add `createCheckoutById` or unify to ID
2. `server/src/routes/public-date-booking.routes.ts` - Remove double lookup

## Related

- #305 (Layered Architecture Violation) - Could resolve this as part of that refactor

## Review Reference

- Architecture Review Finding P2 (ID vs Slug Impedance Mismatch)
