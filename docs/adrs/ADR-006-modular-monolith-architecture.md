# ADR-006: Modular Monolith Architecture

**Date:** 2025-10-14
**Status:** Accepted
**Decision Makers:** Engineering Team
**Category:** Architecture
**Related Issues:** Initial architecture design

## Context

MAIS is being built as a solo development project with the goal of rapid MVP delivery while maintaining future extractability. We needed to choose an architecture that balances:

- **Simplicity:** Solo developer, need to ship fast
- **Maintainability:** Clean boundaries between domains
- **Scalability:** Future potential to extract services if needed
- **Development velocity:** Minimal infrastructure overhead

Key constraints:

- Single developer (no team coordination overhead)
- Rapid MVP timeline (6-week sprint)
- Future growth potential (may need to scale)
- Cost sensitivity (minimize infrastructure costs)

## Decision

We have chosen a **modular monolith** architecture with:

1. **Domains/Ports/Adapters pattern** (Hexagonal Architecture)
2. **Contract-first API design** using ts-rest + Zod
3. **Mock-first development** for external dependencies
4. **Clean layered architecture:**
   - Routes (HTTP layer)
   - Services (business logic)
   - Adapters (external integrations)
   - Ports (interfaces)

**Architecture Overview:**

```
┌─────────────────────────────────────────┐
│          API Routes (ts-rest)           │
│         (Thin HTTP handlers)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Services (Business Logic)         │
│  - Catalog  - Booking  - Availability   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Adapters (External Systems)        │
│  - Prisma  - Stripe  - Postmark  - GCal │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Ports (Interfaces)               │
│  Repository + Provider abstractions     │
└─────────────────────────────────────────┘
```

**Key Principles:**

- Services depend on interfaces (ports), not implementations
- Dependency injection wires real vs mock adapters
- All external dependencies abstracted behind interfaces
- Single deployable unit (monolith)
- Clear module boundaries (can extract later)

## Consequences

### Positive

- ✅ **Simple deployment:** Single Node.js process, single database
- ✅ **Fewer moving parts:** No microservices coordination
- ✅ **Faster development:** No network calls between services
- ✅ **Safer vibe-coding:** Refactoring is IDE-supported (find all references)
- ✅ **Clean seams:** Modules have clear boundaries for future extraction
- ✅ **Lower costs:** Single server, single database
- ✅ **Easier debugging:** Single process, single log stream
- ✅ **Shared transactions:** Can use database transactions across modules

### Negative

- ⚠️ **Vertical scaling only:** Can't scale modules independently
- ⚠️ **Coupling risk:** Must enforce module boundaries manually
- ⚠️ **Single point of failure:** If process dies, entire app is down
- ⚠️ **Deployment coupling:** All modules deploy together

### Mitigation Strategies

- Use dependency injection to enforce clean boundaries
- Create port interfaces to prevent tight coupling
- Document module boundaries clearly
- Design for extractability from day one
- Consider modular deployments if scale requires it later

## Alternatives Considered

### Alternative 1: Microservices

**Approach:** Build separate services for catalog, booking, payments, etc.

**Why Rejected:**

- ❌ Solo developer - no team to own separate services
- ❌ Infrastructure overhead (multiple deploys, service mesh, etc.)
- ❌ Network latency between services
- ❌ Distributed transactions complexity
- ❌ Higher hosting costs (multiple servers)
- ❌ Premature optimization (no scale requirements yet)

**When to Reconsider:**

- Team grows to 5+ developers
- Need to scale specific modules independently
- Revenue justifies infrastructure investment

### Alternative 2: Serverless Functions

**Approach:** Deploy each domain as separate Lambda/Cloud Functions.

**Why Rejected:**

- ❌ Cold start latency unacceptable for booking flows
- ❌ Difficult to share database connections
- ❌ Limited transaction support across functions
- ❌ More complex testing (local environment simulation)
- ❌ Vendor lock-in (AWS Lambda, Google Cloud Functions)

**When to Reconsider:**

- Need extreme horizontal scaling
- Traffic is very spiky (can benefit from auto-scaling)

### Alternative 3: Traditional Monolith (No Module Boundaries)

**Approach:** Build single Express app with no architectural boundaries.

**Why Rejected:**

- ❌ Coupling increases over time (spaghetti code risk)
- ❌ Difficult to extract services later
- ❌ No clean test boundaries
- ❌ Refactoring becomes risky

**Better Than:** Modular monolith provides same deployment simplicity with better maintainability.

## Implementation Details

**File Structure:**

```
server/src/
├── routes/              # HTTP handlers (ts-rest)
│   ├── catalog.routes.ts
│   ├── booking.routes.ts
│   └── webhooks.routes.ts
├── services/            # Business logic
│   ├── catalog.service.ts
│   ├── booking.service.ts
│   └── availability.service.ts
├── adapters/            # External integrations
│   ├── prisma/          # Database repositories
│   ├── stripe.adapter.ts
│   ├── postmark.adapter.ts
│   └── mock/            # Mock implementations
├── lib/
│   ├── ports.ts         # Interfaces
│   └── entities.ts      # Domain models
└── di.ts                # Dependency injection
```

**Dependency Injection Example:**

```typescript
// di.ts - Wire dependencies based on mode
const catalogRepo =
  config.mode === 'real' ? new PrismaCatalogRepository(prisma) : new MockCatalogRepository();

const paymentProvider =
  config.mode === 'real' ? new StripePaymentAdapter(stripe) : new MockPaymentProvider();

const catalogService = new CatalogService(catalogRepo);
const bookingService = new BookingService(bookingRepo, catalogRepo, paymentProvider, eventEmitter);
```

**Module Boundaries:**

- Routes only call services (never adapters directly)
- Services only depend on ports (never concrete adapters)
- Adapters implement ports (never import services)
- No circular dependencies between modules

## Migration Path to Microservices

If future scale requires extraction to microservices:

1. **Extract booking service:**
   - Already has clean boundaries (BookingService)
   - Expose via API gateway
   - Share database initially (separate later)

2. **Extract payment service:**
   - PaymentProvider interface already exists
   - Can run as separate service
   - Communicate via events

3. **Extract catalog service:**
   - CatalogService is read-heavy (good candidate for caching)
   - Can replicate to separate database

**Estimated extraction effort per service:** 2-3 weeks

## References

- Simon Brown: [Modular Monoliths](https://www.youtube.com/watch?v=5OjqD-ow8GE)
- Sam Newman: [Monolith to Microservices](https://www.oreilly.com/library/view/monolith-to-microservices/9781492047834/)
- Alistair Cockburn: [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- Martin Fowler: [MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)

## Related ADRs

- ADR-007: Mock-First Development
- ADR-005: PaymentProvider Interface (example of ports pattern)
- ADR-002: Database-Based Webhook DLQ (shared database advantage)
