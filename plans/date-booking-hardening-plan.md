# DATE Booking Flow Hardening Plan

> Address security, architecture, and quality issues from DATE booking code review

---

## Executive Summary

- **Core issues:** 11 P1 + 14 P2 findings from code review
- **Revised scope:** 2-3 days (trimmed from original 4-day estimate)
- **Status:** APPROVED (with reviewer feedback incorporated)
- **Priority:** P0 (blocking production readiness)

### Key Changes from Review
- Removed TOCTOU webhook re-check (theoretical risk, DB constraints sufficient)
- Added integration test for race condition prevention
- Kept service layer refactor (testability matters)
- Trimmed Phase 3 to essential items only
- Removed Phase 4 polish items (defer to future)

---

## Problem Statement

The DATE booking flow MVP was implemented quickly. A code review identified security and architecture issues. This plan addresses the essential fixes while avoiding over-engineering.

### Critical Issues (P1 - Must Fix)
| # | Issue | Category | Fix |
|---|-------|----------|-----|
| 304 | Date validation bypass | Security | Add Zod refinements |
| 308 | Unique constraint mismatch | Data Integrity | Add bookingType filter |
| 305 | Layered architecture violation | Architecture | Create service method |
| 306 | Missing DI dependency | Architecture | Inject AvailabilityService |

---

## Phase 1: Security & Data Integrity

**Goal:** Eliminate security vulnerabilities
**Effort:** 4-5 hours
**Files:** 4

### 1.1 Fix Date Validation Bypass (#304)

**File:** `packages/contracts/src/dto.ts:169`

```typescript
// Simplified validation (per reviewer feedback - drop year range check)
date: z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => {
    const date = new Date(val + 'T00:00:00Z');
    return !isNaN(date.getTime());
  }, 'Invalid calendar date')
  .refine((val) => {
    const date = new Date(val + 'T00:00:00Z');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date >= now;
  }, 'Date must be in the future'),
```

### 1.2 Fix Unique Constraint Mismatch (#308)

**File:** `server/src/adapters/prisma/booking.repository.ts:188-190`

```typescript
const existing = await tx.booking.findFirst({
  where: {
    tenantId,
    date: new Date(booking.eventDate),
    bookingType: booking.bookingType || 'DATE',  // Add filter
  },
});
```

### 1.3 Fix Duplicate Email Validation (#311)

**File:** `packages/contracts/src/dto.ts:171`

```typescript
// Remove duplicate .email() call
customerEmail: z.string().email('Valid email address required'),
```

### 1.4 Add bookingType to Create (#310)

**File:** `server/src/routes/public-date-booking.routes.ts`

Ensure `bookingType: 'DATE'` is passed to createCheckout.

### 1.5 Add TOCTOU Integration Test (NEW - per Kieran)

**File:** `server/test/integration/booking-race-condition.test.ts` (new)

```typescript
describe('DATE Booking Race Condition Prevention', () => {
  it('prevents double-booking via database constraint', async () => {
    const { tenantId, cleanup } = await createTestTenant();
    try {
      const date = '2025-06-15';

      // First booking succeeds
      await bookingRepo.create({
        tenantId,
        date,
        bookingType: 'DATE',
        // ... other fields
      });

      // Second booking for same date should fail
      await expect(bookingRepo.create({
        tenantId,
        date,
        bookingType: 'DATE',
        // ... other fields
      })).rejects.toThrow(/unique constraint/i);
    } finally {
      await cleanup();
    }
  });

  it('allows TIMESLOT booking on same date as DATE booking', async () => {
    const { tenantId, cleanup } = await createTestTenant();
    try {
      const date = '2025-06-15';

      // DATE booking
      await bookingRepo.create({
        tenantId,
        date,
        bookingType: 'DATE',
      });

      // TIMESLOT booking on same date should succeed
      await expect(bookingRepo.create({
        tenantId,
        date,
        bookingType: 'TIMESLOT',
        startTime: new Date('2025-06-15T14:00:00Z'),
        endTime: new Date('2025-06-15T15:00:00Z'),
      })).resolves.toBeDefined();
    } finally {
      await cleanup();
    }
  });
});
```

### Phase 1 Checklist
- [ ] Date validation with simplified Zod refinements
- [ ] bookingType filter in conflict check
- [ ] bookingType passed to createCheckout
- [ ] Fix duplicate email validation
- [ ] Add race condition integration test
- [ ] Run test suite: `npm test`

---

## Phase 2: Architecture Refactor

**Goal:** Move business logic to service layer for testability
**Effort:** 4-5 hours
**Files:** 4
**Dependencies:** Phase 1 complete

### 2.1 Inject AvailabilityService into BookingService (#306)

**File:** `server/src/services/booking.service.ts`

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
    private readonly availabilityService?: AvailabilityService  // ADD
  ) {}
}
```

**File:** `server/src/di.ts` (both real and mock modes)

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
  availabilityService  // ADD
);
```

### 2.2 Create BookingService.createDateBooking() (#305)

**File:** `server/src/services/booking.service.ts`

```typescript
/**
 * Create a DATE booking checkout session
 * Consolidates package lookup, availability check, and checkout creation
 */
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
  // 1. Fetch package by ID
  const pkg = await this.catalogRepo.getPackageById(tenantId, input.packageId);
  if (!pkg) {
    throw new NotFoundError(`Package not found: ${input.packageId}`);
  }

  // 2. Validate package is DATE type
  if (pkg.bookingType !== 'DATE') {
    throw new InvalidBookingTypeError(
      `Package ${pkg.name} does not support date-only booking`
    );
  }

  // 3. Check availability
  if (this.availabilityService) {
    const availability = await this.availabilityService.checkAvailability(
      tenantId,
      input.date
    );
    if (!availability.available) {
      throw new BookingConflictError(input.date);
    }
  }

  // 4. Delegate to createCheckout
  return this.createCheckout(tenantId, {
    packageId: pkg.slug,
    date: input.date,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    notes: input.notes,
    addOnIds: input.addOnIds,
    bookingType: 'DATE',
  });
}
```

### 2.3 Simplify Route Handler (#305, #317)

**File:** `server/src/routes/public-date-booking.routes.ts`

```typescript
router.post('/', tenantMiddleware, async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const input = CreateDateBookingDtoSchema.parse(req.body);
    const result = await bookingService.createDateBooking(tenantId, input);

    logger.info(
      { tenantId, packageId: input.packageId, date: input.date },
      'Date booking checkout created'
    );

    res.status(200).json(result);
  } catch (error) {
    // Error handling...
    next(error);
  }
});
```

### 2.4 Add Unit Tests for createDateBooking()

**File:** `server/test/services/booking.service.date.test.ts` (new)

```typescript
describe('BookingService.createDateBooking', () => {
  it('throws NotFoundError for missing package', async () => {
    catalogRepo.getPackageById.mockResolvedValue(null);
    await expect(
      bookingService.createDateBooking(tenantId, { packageId: 'bad-id', ... })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws InvalidBookingTypeError for TIMESLOT package', async () => {
    catalogRepo.getPackageById.mockResolvedValue({ bookingType: 'TIMESLOT' });
    await expect(
      bookingService.createDateBooking(tenantId, { ... })
    ).rejects.toThrow(InvalidBookingTypeError);
  });

  it('throws BookingConflictError when date unavailable', async () => {
    catalogRepo.getPackageById.mockResolvedValue({ bookingType: 'DATE' });
    availabilityService.checkAvailability.mockResolvedValue({ available: false });
    await expect(
      bookingService.createDateBooking(tenantId, { ... })
    ).rejects.toThrow(BookingConflictError);
  });

  it('creates checkout for valid DATE booking', async () => {
    // Happy path test
  });
});
```

### Phase 2 Checklist
- [ ] AvailabilityService injected into BookingService
- [ ] DI container updated (real + mock modes)
- [ ] createDateBooking() method implemented
- [ ] Route handler simplified
- [ ] Unit tests for createDateBooking()
- [ ] Run test suite: `npm test`

---

## Phase 3: Essential Frontend Fixes (Trimmed)

**Goal:** Fix only the essential frontend issues
**Effort:** 2-3 hours
**Files:** 3

### KEPT (Essential)

#### 3.1 Fetch Unavailable Dates (#307)

Currently the wizard does NOT fetch unavailable dates. This is a UX bug.

**File:** `client/src/features/storefront/DateBookingWizard.tsx`

```typescript
const { data: unavailableDates = [] } = useQuery({
  queryKey: ['unavailable-dates', tenantId],
  queryFn: async () => {
    const response = await api.getUnavailableDates({ tenantId });
    return response.body.dates;
  },
  staleTime: 30 * 1000, // 30 seconds
});
```

#### 3.2 Use Zod for Customer Form (#323)

Server validates, but client should too for better UX.

```typescript
import { zodResolver } from '@hookform/resolvers/zod';

const customerSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
});

const form = useForm({
  resolver: zodResolver(customerSchema),
});
```

### DEFERRED (Per Reviewer Feedback)

| # | Issue | Why Deferred |
|---|-------|--------------|
| 321 | Component too large | Works fine at 472 lines |
| 320 | Missing React.memo | No profiled perf issue |
| 318 | React Query for all | Only add where needed |
| 322 | Abstract localStorage | Over-abstraction |

### Phase 3 Checklist
- [ ] Fetch unavailable dates on wizard load
- [ ] Add Zod validation to customer form
- [ ] Run: `npm run typecheck`

---

## Removed Items (Per Reviewer Feedback)

### Removed from Phase 1
- **#309 TOCTOU webhook re-check** - Theoretical risk. Database constraints + advisory locks are sufficient. If we see actual double-bookings in production, we'll add this.

### Removed Phase 4 Entirely
- Contract registration - Already works
- Composite index - No profiled slow queries
- Enhanced logging - Current logging is adequate
- Documentation - Write after code stabilizes

---

## Files Affected Summary

### Phase 1 (5 files)
- `packages/contracts/src/dto.ts`
- `server/src/adapters/prisma/booking.repository.ts`
- `server/src/routes/public-date-booking.routes.ts`
- `server/test/integration/booking-race-condition.test.ts` (new)

### Phase 2 (5 files)
- `server/src/services/booking.service.ts`
- `server/src/di.ts`
- `server/src/routes/public-date-booking.routes.ts`
- `server/src/routes/index.ts`
- `server/test/services/booking.service.date.test.ts` (new)

### Phase 3 (2 files)
- `client/src/features/storefront/DateBookingWizard.tsx`

---

## Testing Strategy

### Unit Tests (Phase 2)
- `createDateBooking()` error cases
- Package type validation
- Availability check integration

### Integration Tests (Phase 1)
- Race condition via database constraint
- DATE vs TIMESLOT same-date behavior

### Manual Tests
- Full booking flow with real Stripe
- Invalid date submission
- Unavailable date selection

---

## Success Criteria

- [ ] All P1 security issues resolved (#304, #308, #310, #311)
- [ ] Architecture follows service layer pattern (#305, #306)
- [ ] Race condition test proves protection works
- [ ] Unavailable dates shown in wizard (#307)
- [ ] 70%+ test coverage maintained
- [ ] No regression in existing functionality

---

## Effort Summary

| Phase | Original | Revised | Savings |
|-------|----------|---------|---------|
| Phase 1 | 4-6 hrs | 4-5 hrs | - |
| Phase 2 | 4-6 hrs | 4-5 hrs | - |
| Phase 3 | 6-8 hrs | 2-3 hrs | 4-5 hrs |
| Phase 4 | 4-6 hrs | 0 hrs | 4-6 hrs |
| **Total** | **18-26 hrs** | **10-13 hrs** | **~50%** |

---

## Reviewer Sign-off

- [x] DHH perspective considered (avoided over-engineering)
- [x] Kieran architecture concerns addressed (service layer + tests)
- [x] Code Simplicity feedback incorporated (trimmed scope)

---

*Plan revised: 2025-12-20*
*Approved with reviewer feedback incorporated*
