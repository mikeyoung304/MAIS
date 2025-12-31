# P1: Missing AvailabilityService Dependency in BookingService

## Priority: P1 Critical

## Status: pending

## Feature: DATE Booking Flow

## Category: Architecture

## Issue

The `BookingService` constructor doesn't receive `AvailabilityService` as a dependency, but the DATE booking route assumes they work together. This prevents moving availability checking into the service layer.

**File:** `server/src/di.ts:481-489` (real mode), `167-185` (mock mode)

```typescript
// Real mode - AvailabilityService NOT injected into BookingService
const availabilityService = new AvailabilityService(calendarProvider, blackoutRepo, bookingRepo);
const bookingService = new BookingService(
  bookingRepo,
  catalogRepo,
  eventEmitter,
  paymentProvider,
  commissionService,
  tenantRepo,
  idempotencyService
  // ❌ availabilityService NOT injected
);
```

## Impact

- Cannot move availability checking into `BookingService.createDateBooking()`
- Forces business logic to stay in route handler
- Prevents proper encapsulation of DATE booking flow

## Recommended Fix

1. Update `BookingService` constructor:

```typescript
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly _eventEmitter: EventEmitter,
    private readonly paymentProvider: PaymentProvider,
    private readonly commissionService: CommissionService,
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly idempotencyService: IdempotencyService,
    private readonly schedulingAvailabilityService?: SchedulingAvailabilityService,
    private readonly serviceRepo?: ServiceRepository,
    private readonly availabilityService?: AvailabilityService // ✅ Add this
  ) {}
}
```

2. Update DI container (both real and mock modes):

```typescript
const bookingService = new BookingService(
  bookingRepo,
  catalogRepo,
  eventEmitter,
  paymentProvider,
  commissionService,
  tenantRepo,
  idempotencyService,
  schedulingAvailabilityService,
  serviceRepo,
  availabilityService // ✅ Inject AvailabilityService
);
```

## Files to Update

1. `server/src/services/booking.service.ts` - Add optional `availabilityService` parameter
2. `server/src/di.ts` - Inject availability service in both modes

## Related

- #305 (Layered Architecture Violation) - This blocks that fix

## Review Reference

- Architecture Review Finding P1 (Missing Dependency in DI Container)
