# P1: Layered Architecture Violation in DATE Booking Route

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Architecture

## Issue

The route handler directly accesses `catalogRepo`, `bookingService`, and `availabilityService` instead of delegating all business logic to a single service layer.

**File:** `server/src/routes/public-date-booking.routes.ts:69-105`

```typescript
// 1. Fetch package - direct repo access in route ❌
const pkg = await catalogRepo.getPackageById(tenantId, input.packageId);

// 2. Validate package type - business logic in route ❌
if (pkg.bookingType !== 'DATE') { ... }

// 3. Check date availability - service call
const availability = await availabilityService.checkAvailability(tenantId, input.date);

// 4. Create checkout - service call
const checkout = await bookingService.createCheckout(tenantId, { ... });
```

## Problems

1. **Business logic in route handler** - Package type validation, availability checks should be in a service
2. **Orchestration complexity** - Route coordinates 3 different dependencies
3. **ID→Slug conversion in route** - Data transformation should be in service
4. **Duplication** - `BookingService.createCheckout` already validates package exists
5. **Testability** - Cannot unit test business logic without HTTP layer

## Impact

- **Maintainability:** ⬇️ High - Business logic scattered across routes and services
- **Testability:** ⬇️ High - Cannot unit test business logic without HTTP layer
- **Consistency:** ⬇️ High - Pattern differs from other booking routes

## Recommended Fix

Create `BookingService.createDateBooking()` method:

```typescript
// In BookingService
async createDateBooking(
  tenantId: string,
  input: {
    packageId: string;
    date: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
    addOnIds?: string[];
  }
): Promise<{ checkoutUrl: string }> {
  // 1. Fetch package by ID and validate
  const pkg = await this.catalogRepo.getPackageById(tenantId, input.packageId);
  if (!pkg) throw new NotFoundError();

  // 2. Validate package is DATE type
  if (pkg.bookingType !== 'DATE') throw new InvalidBookingTypeError();

  // 3. Check availability
  const availability = await this.availabilityService.checkAvailability(tenantId, input.date);
  if (!availability.available) throw new BookingConflictError();

  // 4. Delegate to createCheckout
  return this.createCheckout(tenantId, { ... });
}
```

## Files to Update

1. `server/src/services/booking.service.ts` - Add `createDateBooking()` method
2. `server/src/di.ts` - Inject `AvailabilityService` into `BookingService`
3. `server/src/routes/public-date-booking.routes.ts` - Simplify to only call service
4. `server/src/routes/index.ts` - Remove `repositories.catalog` from route factory

## Review Reference
- Architecture Review Finding P1 (Violation of Layered Architecture)
