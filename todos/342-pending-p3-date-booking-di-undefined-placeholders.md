# P3: DI Container Uses undefined Placeholders

## Priority: P3 Nice-to-Have
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Quality

## Issue

The DI container passes `undefined` explicitly for optional dependencies with comments "set later", which is a code smell.

**File:** `server/src/di.ts:184-188` and `488-492`

```typescript
const bookingService = new BookingService(
  bookingRepo,
  catalogRepo,
  eventEmitter,
  paymentProvider,
  commissionService,
  tenantRepo,
  idempotencyService,
  undefined, // schedulingAvailabilityService - set later
  undefined, // serviceRepo - set later
  availabilityService
);
```

## Problems

1. **Unclear intent** - "set later" suggests incomplete wiring
2. **Parameter order dependency** - Optional params in middle require explicit undefined
3. **Maintenance burden** - Adding params requires updating all call sites

## Recommended Fix

### Option 1: Use options object pattern

```typescript
const bookingService = new BookingService({
  bookingRepo,
  catalogRepo,
  eventEmitter,
  paymentProvider,
  commissionService,
  tenantRepo,
  idempotencyService,
  availabilityService,
  // Optional deps omitted rather than undefined
});
```

### Option 2: Builder pattern

```typescript
const bookingService = BookingService.builder()
  .withBookingRepo(bookingRepo)
  .withCatalogRepo(catalogRepo)
  .withAvailabilityService(availabilityService)
  .build();
```

## Review Reference
- Code Review PR: feat/date-booking-hardening (ce6443d)
