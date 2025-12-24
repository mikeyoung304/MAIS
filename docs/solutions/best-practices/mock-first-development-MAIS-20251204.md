---
module: MAIS
date: 2025-12-04
problem_type: best_practice
component: server/adapters
symptoms:
  - CI tests fail with ECONNREFUSED
  - Tests require DATABASE_URL to pass
  - Local tests pass, CI fails
  - Adding features requires running Docker/Postgres
root_cause: Real adapters implemented before mock adapters, coupling tests to external services
resolution_type: architectural_pattern
severity: P1
related_files:
  - server/src/lib/ports.ts
  - server/src/adapters/mock/
  - server/src/adapters/prisma/
  - server/src/di.ts
tags: [architecture, testing, adapters, mock, ci]
---

# Mock-First Development

## Problem

Implementing real adapters (Prisma, Stripe, external APIs) before mock adapters creates tests that require live services, breaking CI and slowing development.

## Anti-Pattern

```typescript
// BAD: Service directly uses Prisma
export class BookingService {
  async createBooking(data: BookingInput) {
    return await prisma.booking.create({ data }); // Untestable without DB
  }
}

// BAD: Test requires live database
test('creates booking', async () => {
  const result = await bookingService.createBooking(testData);
  // Fails in CI - no database connection
});
```

## Solution Pattern

```typescript
// 1. Define interface FIRST (ports.ts)
interface BookingRepository {
  create(tenantId: string, data: BookingInput): Promise<Booking>;
  findByDate(tenantId: string, date: string): Promise<Booking | null>;
}

// 2. Create mock adapter FIRST (fast, in-memory)
export class MockBookingRepository implements BookingRepository {
  private bookings = new Map<string, Booking[]>();

  async create(tenantId: string, data: BookingInput): Promise<Booking> {
    const booking = { id: generateId(), tenantId, ...data, createdAt: new Date() };
    const tenantBookings = this.bookings.get(tenantId) ?? [];
    tenantBookings.push(booking);
    this.bookings.set(tenantId, tenantBookings);
    return booking;
  }
}

// 3. Service depends on interface
export class BookingService {
  constructor(private bookingRepo: BookingRepository) {}

  async createBooking(tenantId: string, data: BookingInput) {
    return await this.bookingRepo.create(tenantId, data);
  }
}

// 4. DI wiring based on ADAPTERS_PRESET
const bookingRepo =
  process.env.ADAPTERS_PRESET === 'mock'
    ? new MockBookingRepository()
    : new PrismaBookingRepository(prisma);
```

## Implementation Checklist

- [ ] Define interface in `ports.ts` BEFORE implementation
- [ ] Create mock adapter first (in-memory, no external deps)
- [ ] Unit tests use mock adapters exclusively
- [ ] Real adapters only for integration tests
- [ ] `ADAPTERS_PRESET=mock npm run dev:api` starts without database

## Development Workflow

1. **Feature work:** `ADAPTERS_PRESET=mock npm run dev:api`
2. **Unit tests:** Always use mock adapters
3. **Integration tests:** Use real adapters with test database
4. **CI:** Defaults to mock mode for unit tests

## Detection Signals

- CI timeout or ECONNREFUSED errors
- Tests fail without DATABASE_URL
- Adding features requires Docker running
- Test suite takes > 30s to start

## Reference Implementation

See `server/src/adapters/mock/` for canonical mock patterns.
