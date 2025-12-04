# MAIS Code Patterns

> **Critical**: These patterns are enforced by `.claude/hooks/validate-patterns.sh` and CI/CD pipeline. Violations will fail builds.

## Repository Pattern

All repository methods MUST have tenantId as first parameter:

```typescript
// ✅ Correct
export interface BookingRepository {
  create(tenantId: string, booking: Booking): Promise<Booking>;
  findById(tenantId: string, id: string): Promise<Booking | null>;
  findAll(tenantId: string): Promise<Booking[]>;
}

// ❌ Wrong - missing tenantId
export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
}
```

## Service Pattern

Services handle business logic, NOT HTTP concerns:

```typescript
export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private catalogRepo: CatalogRepository,
    private eventEmitter: EventEmitter,
    private paymentProvider: PaymentProvider
  ) {}

  async createCheckout(tenantId: string, input: CreateBookingInput) {
    // 1. Validate package exists
    const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) {
      throw new NotFoundError(`Package ${input.packageId} not found`);
    }

    // 2. Check availability
    const available = await this.availabilityService.isDateAvailable(tenantId, input.date);
    if (!available) {
      throw new BookingConflictError(input.date);
    }

    // 3. Calculate commission
    const commission = Math.ceil(total * 0.125); // ALWAYS Math.ceil

    // 4. Create checkout session
    const session = await this.paymentProvider.createCheckoutSession({
      amountCents: total,
      metadata: { tenantId, ... }
    });

    return { checkoutUrl: session.url };
  }
}
```

## Route Pattern

Routes are thin HTTP layers that delegate to services:

```typescript
// ✅ Correct - thin route
router.post('/bookings', resolveTenant, async (req, res, next) => {
  try {
    const result = await bookingService.createCheckout(req.tenantId!, req.body);
    res.json(result);
  } catch (error) {
    next(error); // Error middleware handles response
  }
});

// ❌ Wrong - business logic in route
router.post('/bookings', async (req, res) => {
  const pkg = await prisma.package.findFirst(...);
  const commission = Math.floor(...); // Wrong!
  // ... lots of logic
});
```

## Transaction Pattern

Use pessimistic locking for critical operations:

```typescript
async create(tenantId: string, booking: Booking): Promise<Booking> {
  return await this.prisma.$transaction(async (tx) => {
    // Lock the row to prevent concurrent bookings
    const lockQuery = `
      SELECT 1 FROM "Booking"
      WHERE "tenantId" = $1 AND date = $2
      FOR UPDATE NOWAIT
    `;
    await tx.$queryRawUnsafe(lockQuery, tenantId, booking.date);

    // Check if date already booked
    const existing = await tx.booking.findFirst({
      where: { tenantId, date: booking.date }
    });

    if (existing) {
      throw new BookingConflictError(booking.date);
    }

    // Create booking
    return await tx.booking.create({ data: { ... } });
  }, {
    timeout: 5000,
    isolationLevel: 'Serializable'
  });
}
```

## Cache Pattern

Cache keys MUST include tenantId:

```typescript
// ✅ Correct
const cacheKey = `${tenantId}:packages`;
const cached = await cacheService.get(cacheKey);

// ❌ Wrong - missing tenantId
const cacheKey = 'packages';
```

## Test Pattern

Use fake implementations, not mocks:

```typescript
describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: FakeBookingRepository;
  let catalogRepo: FakeCatalogRepository;

  beforeEach(() => {
    bookingRepo = new FakeBookingRepository();
    catalogRepo = new FakeCatalogRepository();
    service = new BookingService(bookingRepo, catalogRepo, ...);
  });

  it('validates package exists', async () => {
    // Arrange - add test data to fake
    catalogRepo.addPackage({ id: 'pkg_1', slug: 'basic', ... });

    // Act
    const result = await service.createCheckout('tenant_1', {
      packageId: 'basic',
      date: '2025-07-01',
      ...
    });

    // Assert
    expect(result.checkoutUrl).toContain('checkout.stripe.com');
  });
});
```

## Error Pattern

Use domain errors with HTTP mapping:

```typescript
// Domain error
export class BookingConflictError extends DomainError {
  constructor(date: string) {
    super(`Date ${date} is already booked`, 'BOOKING_CONFLICT', 409);
  }
}

// Service throws domain error
if (!available) {
  throw new BookingConflictError(date);
}

// Error middleware maps to HTTP
if (error instanceof DomainError) {
  res.status(error.statusCode).json({
    error: error.code,
    message: error.message,
  });
}
```

## Component Pattern (Frontend)

Feature-based organization with TanStack Query:

```typescript
// features/booking/hooks.ts
export function useBookings(tenantId: string) {
  return useQuery({
    queryKey: ['bookings', tenantId],
    queryFn: async () => {
      const response = await api.bookings.list();
      return response.status === 200 ? response.body : [];
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

// features/booking/BookingList.tsx
export function BookingList() {
  const { data: bookings, isLoading } = useBookings(tenantId);

  if (isLoading) return <Loading />;

  return (
    <div>
      {bookings?.map(booking => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  );
}
```

## Webhook Pattern

Always check for duplicates:

```typescript
async handleStripeWebhook(rawBody: string, signature: string) {
  // 1. Verify signature
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  // 2. Check for duplicate (idempotency)
  const isDuplicate = await this.webhookRepo.isDuplicate(event.id);
  if (isDuplicate) {
    return; // Return 200 OK to Stripe without processing
  }

  // 3. Record webhook
  await this.webhookRepo.create({
    eventId: event.id,
    type: event.type,
    status: 'PENDING'
  });

  // 4. Process event
  if (event.type === 'checkout.session.completed') {
    await this.processCheckoutCompleted(event.data.object);
  }

  // 5. Mark processed
  await this.webhookRepo.markProcessed(event.id);
}
```

## API Contract Pattern

Use ts-rest + Zod for type safety:

```typescript
// packages/contracts/src/api.v1.ts
export const contracts = c.router({
  getPackages: {
    method: 'GET',
    path: '/v1/packages',
    responses: {
      200: z.array(PackageSchema),
    },
  },
  createBooking: {
    method: 'POST',
    path: '/v1/bookings',
    body: CreateBookingSchema,
    responses: {
      200: z.object({ checkoutUrl: z.string() }),
      409: z.object({ error: z.literal('BOOKING_CONFLICT') }),
    },
  },
});

// Client usage (type-safe)
const response = await api.getPackages();
if (response.status === 200) {
  // response.body is Package[]
}
```

## Commission Calculation Pattern

ALWAYS round UP to protect platform revenue:

```typescript
// ✅ Correct - Math.ceil ensures platform never loses revenue
const commission = Math.ceil((subtotal * tenant.commissionPercent) / 100);
// Example: $100.01 * 12.5% = $12.50125 → $13 (not $12)

// ❌ Wrong - Math.floor shortchanges platform
const commission = Math.floor((subtotal * tenant.commissionPercent) / 100);
// Example: $100.01 * 12.5% = $12.50125 → $12 (lose $1!)

// ❌ Wrong - Math.round inconsistent
const commission = Math.round((subtotal * tenant.commissionPercent) / 100);
// Sometimes rounds down, sometimes up - unpredictable revenue
```
