# ADR-007: Mock-First Development

**Date:** 2025-10-14
**Status:** Accepted
**Decision Makers:** Engineering Team
**Category:** Development Workflow
**Related Issues:** Developer experience, rapid iteration

## Context

External API integrations (Stripe, Postmark, Google Calendar) create friction in development:

- **Slow iteration:** Waiting for API calls adds 500ms-2s per request
- **API keys required:** All developers need production/test credentials
- **Rate limiting:** Development can hit API rate limits
- **Webhook testing:** Requires ngrok tunnels or webhook forwarding
- **Cost:** Test API calls can incur charges (Stripe, SendGrid)
- **Network dependency:** Can't code offline or without internet
- **External state:** Hard to reset test data between test runs

We needed a development workflow that:

1. Allows rapid iteration without external dependencies
2. Enables testing without real API keys
3. Works offline
4. Provides fast feedback loops
5. Supports CI/CD without external service dependencies

## Decision

We have adopted a **mock-first development** approach where:

1. **Ship complete flows using mock adapters first**
   - In-memory repositories (no database)
   - Fake checkout flows (no Stripe)
   - Console/file-sink emails (no Postmark)
   - Mock calendar (no Google Calendar)

2. **Flip to real adapters after feature is proven**
   - Contracts and domains stay stable
   - Only adapter implementations change
   - Services don't know the difference

3. **Environment variable controls mode:**

   ```bash
   # Mock mode (default for development)
   ADAPTERS_PRESET=mock npm run dev:api

   # Real mode (production, staging)
   ADAPTERS_PRESET=real npm run dev:api
   ```

**Architecture:**

```typescript
// All services depend on interfaces
interface CatalogRepository {
  getPackages(tenantId: string): Promise<Package[]>;
}

// Mock implementation (in-memory)
class MockCatalogRepository implements CatalogRepository {
  private packages: Map<string, Package[]> = new Map();

  async getPackages(tenantId: string) {
    return this.packages.get(tenantId) || [];
  }
}

// Real implementation (database)
class PrismaCatalogRepository implements CatalogRepository {
  async getPackages(tenantId: string) {
    return await this.prisma.package.findMany({
      where: { tenantId },
    });
  }
}

// Dependency injection swaps implementations
const catalogRepo =
  config.mode === 'mock' ? new MockCatalogRepository() : new PrismaCatalogRepository(prisma);
```

## Consequences

### Positive

- ✅ **Faster demos:** Can demo features before integrating real APIs
- ✅ **Faster tests:** E2E tests run in mock mode (no network calls)
- ✅ **No API keys needed:** Developers can start coding immediately
- ✅ **Offline development:** Can code on plane, train, etc.
- ✅ **Deterministic testing:** Mock data is predictable
- ✅ **CI/CD simplicity:** No secrets needed for test runs
- ✅ **Cost savings:** No accidental API charges during development
- ✅ **Clean contracts:** Forces us to design stable interfaces

### Negative

- ⚠️ **Mock divergence risk:** Mock behavior may drift from real APIs
- ⚠️ **Double implementation:** Must maintain both mock and real adapters
- ⚠️ **Integration bugs:** Real API quirks not caught until late
- ⚠️ **False confidence:** Tests pass in mock mode but fail in real mode

### Mitigation Strategies

- **Contract tests:** Verify real API responses match mock behavior
- **Real mode testing:** Run subset of E2E tests in real mode before deploy
- **Mock parity reviews:** Periodically review mock implementations
- **Documentation:** Keep mock adapter behavior documented
- **Canary deployments:** Test real mode in staging before production

## Implementation Details

### Mock Adapters Implemented

**1. Mock Catalog Repository** (`adapters/mock/catalog.mock.ts`)

```typescript
class MockCatalogRepository implements CatalogRepository {
  private packages: Map<string, Package[]> = new Map();
  private bookingPreferences: Map<string, BookingPreferences> = new Map();

  async getActivePackages(tenantId: string): Promise<Package[]> {
    const pkgs = this.packages.get(tenantId) || [];
    return pkgs.filter((p) => p.active);
  }

  async createPackage(tenantId: string, pkg: CreatePackageDto): Promise<Package> {
    const newPackage = { id: randomUUID(), ...pkg, active: true };
    const existing = this.packages.get(tenantId) || [];
    this.packages.set(tenantId, [...existing, newPackage]);
    return newPackage;
  }
}
```

**2. Mock Payment Provider** (`adapters/mock/payment.mock.ts`)

```typescript
class MockPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
  }): Promise<{ url: string; sessionId: string }> {
    return {
      url: `http://localhost:5173/dev/checkout?amount=${params.amountCents}`,
      sessionId: `mock_session_${Date.now()}`,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    // Mock always verifies successfully
    return JSON.parse(rawBody);
  }
}
```

**3. Mock Email Provider** (`adapters/mock/email.mock.ts`)

```typescript
class MockEmailProvider implements EmailProvider {
  private sentEmails: Email[] = [];

  async sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
    console.log(`[MOCK EMAIL] To: ${params.to}, Subject: ${params.subject}`);
    this.sentEmails.push(params);

    // Optional: Write to file for inspection
    await fs.writeFile(`tmp/emails/${Date.now()}.json`, JSON.stringify(params, null, 2));
  }

  getSentEmails(): Email[] {
    return this.sentEmails;
  }
}
```

**4. Mock Calendar Provider** (`adapters/mock/calendar.mock.ts`)

```typescript
class MockCalendarProvider implements CalendarProvider {
  private events: Map<string, CalendarEvent[]> = new Map();

  async createEvent(params: {
    date: string;
    email: string;
    name: string;
  }): Promise<{ eventId: string }> {
    const event = {
      id: `mock_event_${Date.now()}`,
      ...params,
    };

    const tenantId = this.currentTenantId;
    const existing = this.events.get(tenantId) || [];
    this.events.set(tenantId, [...existing, event]);

    return { eventId: event.id };
  }
}
```

### Dependency Injection Configuration

**File:** `server/src/di.ts`

```typescript
export function createContainer(config: Config): Container {
  const mode = config.adapters.preset; // 'mock' | 'real'

  // Repositories
  const catalogRepo =
    mode === 'real' ? new PrismaCatalogRepository(prisma) : new MockCatalogRepository();

  const bookingRepo =
    mode === 'real' ? new PrismaBookingRepository(prisma) : new MockBookingRepository();

  // Providers
  const paymentProvider =
    mode === 'real' ? new StripePaymentAdapter(stripe, config.stripe) : new MockPaymentProvider();

  const emailProvider =
    mode === 'real' ? new PostmarkEmailAdapter(postmarkClient) : new MockEmailProvider();

  const calendarProvider =
    mode === 'real' ? new GoogleCalendarAdapter(googleClient) : new MockCalendarProvider();

  // Services (same regardless of mode)
  const catalogService = new CatalogService(catalogRepo);
  const bookingService = new BookingService(
    bookingRepo,
    catalogRepo,
    paymentProvider,
    emailProvider,
    calendarProvider,
    eventEmitter
  );

  return { catalogService, bookingService };
}
```

### Environment Configuration

**File:** `server/.env.example`

```bash
# Adapter mode: 'mock' (in-memory, no external APIs) or 'real' (PostgreSQL, Stripe, etc.)
ADAPTERS_PRESET=mock

# Database (only needed in real mode)
DATABASE_URL=postgresql://...

# External services (only needed in real mode)
STRIPE_SECRET_KEY=sk_test_...
POSTMARK_SERVER_TOKEN=...
GOOGLE_CALENDAR_ID=...
```

### Testing with Mock Adapters

**E2E Test Example:**

```typescript
// e2e/tests/booking-mock.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Flow (Mock Mode)', () => {
  test('customer can book package and receive confirmation', async ({ page }) => {
    // Navigate to catalog
    await page.goto('http://localhost:5173');

    // Select package
    await page.click('text=Wedding Photography');

    // Fill booking form
    await page.fill('[name="eventDate"]', '2025-06-15');
    await page.fill('[name="email"]', 'test@example.com');

    // Proceed to checkout (mock mode)
    await page.click('text=Book Now');

    // Mock payment page (no real Stripe)
    await expect(page).toHaveURL(/\/dev\/checkout/);
    await page.click('text=Simulate Payment Success');

    // Confirmation page
    await expect(page).toHaveURL(/\/booking\/confirmation/);
    await expect(page.locator('text=Booking Confirmed')).toBeVisible();
  });
});
```

## Workflow

### Development Workflow (Mock Mode)

1. **Start API in mock mode:**

   ```bash
   ADAPTERS_PRESET=mock npm run dev:api
   ```

2. **Build feature using mock adapters**
   - Write service logic
   - Test with mock data
   - Iterate quickly

3. **Run E2E tests (mock mode):**

   ```bash
   npm run test:e2e
   ```

4. **Switch to real mode for integration testing:**

   ```bash
   ADAPTERS_PRESET=real npm run dev:api
   ```

5. **Test with real APIs** (Stripe test mode, Postmark, etc.)

6. **Deploy to staging (real mode)**

### Production Workflow (Real Mode)

1. **Staging environment:**
   - `ADAPTERS_PRESET=real`
   - Stripe test mode
   - Postmark test server
   - Test database

2. **Production environment:**
   - `ADAPTERS_PRESET=real`
   - Stripe live mode
   - Postmark production
   - Production database

## Alternatives Considered

### Alternative 1: Real APIs Only (No Mocks)

**Approach:** Always use real external APIs, even in development.

**Why Rejected:**

- ❌ Slow iteration (network latency)
- ❌ Requires API keys for all developers
- ❌ Can't develop offline
- ❌ CI/CD requires secrets
- ❌ Costs money (Stripe test charges)

### Alternative 2: Docker Compose with Local Services

**Approach:** Run Stripe CLI, Mailhog, etc. in Docker for local development.

**Why Rejected:**

- ❌ Complex setup (Docker Compose file, multiple services)
- ❌ Still requires network calls (slower than in-memory)
- ❌ Not all services have local alternatives (Google Calendar)
- ❌ More infrastructure to maintain

**When Appropriate:**

- Integration testing before production deploy
- Reproducing production bugs locally

### Alternative 3: VCR/Polly.js (Record/Replay)

**Approach:** Record real API responses, replay in tests.

**Why Rejected:**

- ❌ Requires initial real API setup
- ❌ Recorded responses go stale
- ❌ Hard to simulate error scenarios
- ❌ Complex for mutating operations (POST, DELETE)

**When Appropriate:**

- Contract testing (verify API shape hasn't changed)
- Regression testing

## Future Enhancements

### Potential Improvements

1. **Mock admin UI:**
   - Dashboard to inspect mock state
   - Clear mock data between test runs
   - Simulate webhook delivery

2. **Hybrid mode:**
   - Use real database but mock external APIs
   - Useful for data migration testing

3. **Mock divergence detection:**
   - Automated tests that compare mock vs real responses
   - Alert if mock behavior drifts

4. **Fuzz testing:**
   - Generate random inputs for mock adapters
   - Ensure services handle edge cases

## References

- Martin Fowler: [Test Double](https://martinfowler.com/bliki/TestDouble.html)
- Gary Bernhardt: [Fast Test, Slow Test](https://www.youtube.com/watch?v=RAxiiRPHS9k)
- DHH: [Test-induced design damage](https://dhh.dk/2014/test-induced-design-damage.html) (counter-argument)
- Growing Object-Oriented Software: [Mock Roles, Not Objects](http://www.growing-object-oriented-software.com/)

## Related ADRs

- ADR-006: Modular Monolith Architecture (enables clean adapter swapping)
- ADR-011: PaymentProvider Interface (example of mockable port)
