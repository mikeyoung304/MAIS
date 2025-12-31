# P3: DI Container Uses undefined Placeholders

## Priority: P3 Nice-to-Have

## Status: complete

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

## Work Log

### 2025-12-24 - Implementation Complete

**By:** Claude Code Agent
**Actions:**

- Verified the fix was already implemented in the codebase
- BookingService now uses `BookingServiceOptions` interface (options object pattern)
- DI container (`server/src/di.ts`) uses the options object pattern at lines 195-207 (mock mode) and 494-504 (real mode)
- All 28 BookingService tests pass
- TypeScript compilation passes with no errors
- Status changed from ready → complete

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference

- Code Review PR: feat/date-booking-hardening (ce6443d)

## Implementation Details

### Solution Applied: Option 1 - Options Object Pattern

The `BookingService` constructor was refactored to accept a single `BookingServiceOptions` interface:

```typescript
// server/src/services/booking.service.ts (lines 78-95)
export interface BookingServiceOptions {
  // Required dependencies
  bookingRepo: BookingRepository;
  catalogRepo: CatalogRepository;
  eventEmitter: EventEmitter;
  paymentProvider: PaymentProvider;
  commissionService: CommissionService;
  tenantRepo: PrismaTenantRepository;
  idempotencyService: IdempotencyService;

  // Optional dependencies (omit rather than pass undefined)
  schedulingAvailabilityService?: SchedulingAvailabilityService;
  serviceRepo?: ServiceRepository;
  availabilityService?: AvailabilityService;
}

constructor(options: BookingServiceOptions) {
  this.bookingRepo = options.bookingRepo;
  // ... etc
}
```

### Files Modified

1. **server/src/services/booking.service.ts** - Added `BookingServiceOptions` interface, refactored constructor
2. **server/src/di.ts** - Updated both mock and real mode to use options object pattern
3. **All test files** - Updated to use options object pattern

### Benefits Achieved

1. **Clearer intent** - Optional dependencies are simply omitted, not passed as undefined
2. **No parameter order dependency** - Can add/remove params without updating order
3. **Reduced maintenance burden** - Adding optional deps doesn't require updating all call sites
4. **Self-documenting** - Named parameters make call sites readable
