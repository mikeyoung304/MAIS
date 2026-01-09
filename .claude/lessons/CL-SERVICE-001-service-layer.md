# CL-SERVICE-001: Service Layer Patterns

**Severity:** P1 | **Category:** Architecture | **Impact:** Untestable code, tight coupling

## Problem

Business logic in route handlers creates tightly-coupled code that's difficult to test, reuse, and maintain. Routes should be thin orchestration layers.

## Bug Pattern

```typescript
// BROKEN: Business logic in route handler
app.post('/v1/bookings', async (req, res) => {
  // Validation, business rules, database, all mixed together
  if (new Date(req.body.date) < new Date()) {
    return res.status(400).json({ error: 'Cannot book past dates' });
  }

  const existing = await prisma.booking.findFirst({
    where: { date: req.body.date, tenantId: req.tenantId }
  });
  if (existing) {
    return res.status(409).json({ error: 'Date already booked' });
  }

  const booking = await prisma.booking.create({ data: { ... } });
  await sendEmail(booking.email, 'Booking confirmed');
  res.json(booking);
});
```

## Fix Pattern

```typescript
// CORRECT: Thin route, delegates to service
const bookingRouter = tsRestExpress(contract.createBooking, async (req) => {
  const booking = await bookingService.create(req.tenantId, req.body);
  return { status: 201, body: booking };
});

// CORRECT: Service encapsulates business logic
export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private emailProvider: EmailProvider,
    private eventEmitter: EventEmitter
  ) {}

  async create(tenantId: string, input: BookingInput): Promise<Booking> {
    // Business rule: no past dates
    if (new Date(input.date) < new Date()) {
      throw new ValidationError('Cannot book past dates');
    }

    // Transaction with lock for double-booking prevention
    const booking = await this.bookingRepo.createWithLock(tenantId, input);

    // Side effects through events
    this.eventEmitter.emit('booking.created', booking);

    return booking;
  }
}
```

## Prevention Checklist

- [ ] Routes only: parse request, call service, return response
- [ ] Services own ALL business logic and validation
- [ ] Services depend on interfaces (ports), not implementations
- [ ] Side effects (email, webhooks) via EventEmitter
- [ ] Unit tests cover services without HTTP layer

## Detection

- Test file imports `app` or `supertest` for business logic
- Route handler > 20 lines
- Business rule duplicated across routes
- Changing validation requires modifying route
