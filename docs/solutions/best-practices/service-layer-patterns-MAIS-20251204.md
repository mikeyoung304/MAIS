---
module: MAIS
date: 2025-12-04
problem_type: best_practice
component: server/services
symptoms:
  - Business logic duplicated across route handlers
  - Routes exceed 20 lines of code
  - Tests require HTTP layer to verify business rules
  - Changing validation requires modifying routes
root_cause: Business logic embedded in route handlers instead of dedicated service layer
resolution_type: architectural_pattern
severity: P1
related_files:
  - server/src/services/booking.service.ts
  - server/src/routes/bookings.routes.ts
  - server/src/lib/ports.ts
  - server/src/di.ts
tags: [architecture, services, separation-of-concerns, testability]
---

# Service Layer Patterns

## Problem

Business logic in route handlers creates tightly-coupled, untestable code. Routes should orchestrate—services should decide.

## Anti-Pattern

```typescript
// BAD: Route handler does everything
app.post('/v1/bookings', async (req, res) => {
  if (new Date(req.body.date) < new Date()) {
    return res.status(400).json({ error: 'Cannot book past dates' });
  }
  const existing = await prisma.booking.findFirst({ where: { ... } });
  if (existing) return res.status(409).json({ error: 'Already booked' });
  const booking = await prisma.booking.create({ data: { ... } });
  await sendEmail(booking.email, 'Confirmed');
  res.json(booking);
});
```

## Solution Pattern

```typescript
// GOOD: Thin route, delegates to service
const bookingRouter = tsRestExpress(contract.createBooking, async (req) => {
  const booking = await bookingService.create(req.tenantId, req.body);
  return { status: 201, body: booking };
});

// GOOD: Service owns business logic
export class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private eventEmitter: EventEmitter
  ) {}

  async create(tenantId: string, input: BookingInput): Promise<Booking> {
    if (new Date(input.date) < new Date()) {
      throw new ValidationError('Cannot book past dates');
    }
    const booking = await this.bookingRepo.createWithLock(tenantId, input);
    this.eventEmitter.emit('booking.created', booking);
    return booking;
  }
}
```

## Implementation Checklist

- [ ] Routes: parse request → call service → return response (only)
- [ ] Services: all business rules, validation, orchestration
- [ ] Services depend on interfaces (ports), never direct implementations
- [ ] Side effects (email, webhooks) via EventEmitter pattern
- [ ] Unit tests target services without HTTP layer

## Detection Signals

- Route handler > 20 lines
- Test imports `supertest` for business logic validation
- Same validation logic in multiple routes
- Prisma calls directly in route handlers

## Reference Implementation

See `server/src/services/booking.service.ts` for canonical pattern.
