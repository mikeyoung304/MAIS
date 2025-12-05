# CL-ADAPTER-001: Mock-First Development

**Severity:** P1 | **Category:** Architecture | **Impact:** CI failures, integration brittleness

## Problem

Implementing real adapters (Prisma, Stripe, external APIs) before mock adapters leads to tests that require live services, making CI unreliable and development slow.

## Bug Pattern

```typescript
// BROKEN: Service directly uses Prisma (untestable without database)
export class BookingService {
  async createBooking(data: BookingInput) {
    return await prisma.booking.create({ data });
  }
}

// BROKEN: Test requires live database
test('creates booking', async () => {
  const result = await bookingService.createBooking(testData);
  // Fails in CI - no database connection
});
```

## Fix Pattern

```typescript
// CORRECT: Service depends on interface (port)
export class BookingService {
  constructor(private bookingRepo: BookingRepository) {}

  async createBooking(tenantId: string, data: BookingInput) {
    return await this.bookingRepo.create(tenantId, data);
  }
}

// CORRECT: Mock adapter for testing
export class MockBookingRepository implements BookingRepository {
  private bookings = new Map<string, Booking[]>();

  async create(tenantId: string, data: BookingInput): Promise<Booking> {
    const booking = { id: generateId(), tenantId, ...data };
    // Store in-memory
    return booking;
  }
}

// CORRECT: DI wiring based on ADAPTERS_PRESET
const bookingRepo = process.env.ADAPTERS_PRESET === 'mock'
  ? new MockBookingRepository()
  : new PrismaBookingRepository(prisma);
```

## Prevention Checklist

- [ ] Define interface in `ports.ts` BEFORE implementation
- [ ] Create mock adapter first (fast, in-memory)
- [ ] Unit tests use mock adapters exclusively
- [ ] Real adapters only for integration tests
- [ ] `ADAPTERS_PRESET=mock` runs ALL unit tests without external deps

## Detection

- CI tests timeout or fail with "ECONNREFUSED"
- Tests require `DATABASE_URL` to pass
- Local tests pass, CI fails
- Adding new feature requires running Docker/Postgres locally
