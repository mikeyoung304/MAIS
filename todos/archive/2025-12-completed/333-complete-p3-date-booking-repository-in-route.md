# P3: Repository Passed to Route Layer

## Priority: P3 Nice-to-have

## Status: pending

## Feature: DATE Booking Flow

## Category: Architecture

## Issue

Routes should only receive services, not repositories. Repositories are implementation details of the service layer.

**File:** `server/src/routes/index.ts:604-610`

```typescript
const publicDateBookingRouter = createPublicDateBookingRoutes(
  repositories.catalog, // ❌ Repository passed to route layer
  services.booking,
  services.availability
);
```

**File:** `server/src/routes/public-date-booking.routes.ts:31-35`

```typescript
export function createPublicDateBookingRoutes(
  catalogRepo: CatalogRepository,  // ❌ Route accepts repository
  bookingService: BookingService,
  availabilityService: AvailabilityService
): Router {
```

## Impact

- Violates separation of concerns
- Makes route harder to test
- Exposes implementation details to routing layer

## Recommendation

Remove `catalogRepo` from route signature:

```typescript
export function createPublicDateBookingRoutes(
  bookingService: BookingService,
  availabilityService: AvailabilityService
): Router {
```

Move the `catalogRepo.getPackageById` call into `BookingService.createDateBooking()`.

## Related

- #305 (Layered Architecture Violation) - This is part of that larger refactor

## Review Reference

- Architecture Review Finding P3 (Repository Passed to Route Layer)
