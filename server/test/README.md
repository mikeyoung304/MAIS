# Test Documentation

This document provides comprehensive guidance for testing in the Elope server application.

## Test Structure

The test suite is organized into three main categories:

### 1. Unit Tests (`test/`)

**Location:** `/Users/mikeyoung/CODING/Elope/server/test/`

Unit tests verify individual components (services, utilities) in isolation using fake implementations.

**Key Files:**

- `*.service.spec.ts` - Service layer unit tests
- `*.spec.ts` - General unit tests
- `helpers/fakes.ts` - Fake implementations of repositories and providers

**Example Files:**

- `test/booking.service.spec.ts`
- `test/catalog.service.spec.ts`
- `test/availability.service.spec.ts`

### 2. Integration Tests (`test/integration/`)

**Location:** `/Users/mikeyoung/CODING/Elope/server/test/integration/`

Integration tests verify database interactions, transactions, race conditions, and multi-tenancy isolation using a real test database.

**Key Files:**

- `*repository.integration.spec.ts` - Repository tests with real database
- `*race-conditions.spec.ts` - Concurrent operation tests
- `cache-isolation.integration.spec.ts` - Multi-tenant cache isolation

**Example Files:**

- `test/integration/booking-repository.integration.spec.ts`
- `test/integration/catalog.repository.integration.spec.ts`
- `test/integration/webhook-repository.integration.spec.ts`

### 3. E2E Tests (`../e2e/`)

**Location:** `/Users/mikeyoung/CODING/Elope/e2e/`

End-to-end tests verify complete user flows using Playwright, simulating real browser interactions.

**Key Files:**

- `tests/booking-flow.spec.ts` - Customer booking journey
- `tests/admin-flow.spec.ts` - Admin management workflows
- `tests/booking-mock.spec.ts` - Mock adapter testing

## Running Tests

### All Tests (Unit + Integration)

```bash
# From server directory
cd /Users/mikeyoung/CODING/Elope/server
npm test

# From root directory
cd /Users/mikeyoung/CODING/Elope
npm test
```

### Unit Tests Only

```bash
# Run unit tests, excluding integration tests
npm test -- test/ --exclude="test/integration/**"
```

### Integration Tests Only

```bash
# Requires test database to be configured
npm run test:integration

# Watch mode for integration tests
npm run test:integration:watch
```

### E2E Tests

```bash
# From root directory
cd /Users/mikeyoung/CODING/Elope
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed
```

### Watch Mode

```bash
# Watch mode for unit tests
npm run test:watch

# Watch mode for integration tests
npm run test:integration:watch
```

### Coverage Reports

```bash
# Generate coverage report for all tests
npm run test:coverage

# Generate coverage for unit tests only (faster)
npm run test:coverage:unit

# Open HTML coverage report in browser (macOS)
npm run test:coverage:report

# From root directory
npm run test:coverage
npm run test:coverage:unit
npm run test:coverage:report
```

## Test Patterns

### Multi-Tenancy

**Critical Rule:** All service and repository methods require `tenantId` as the **first parameter**.

#### Example - Service Method

```typescript
// CORRECT
await bookingService.createCheckout('test-tenant', {
  packageId: 'basic',
  coupleName: 'John & Jane',
  email: 'couple@example.com',
  eventDate: '2025-07-01',
});

// INCORRECT - Missing tenantId
await bookingService.createCheckout({
  packageId: 'basic',
  coupleName: 'John & Jane',
  email: 'couple@example.com',
  eventDate: '2025-07-01',
});
```

#### Example - Repository Method

```typescript
// CORRECT
const packages = await catalogRepo.getAllPackages('test-tenant');

// INCORRECT - Missing tenantId
const packages = await catalogRepo.getAllPackages();
```

### Fake Implementations

Location: `test/helpers/fakes.ts`

Fake implementations provide in-memory versions of repositories and providers for unit testing.

#### Available Fakes

- `FakeBookingRepository` - In-memory booking storage
- `FakeCatalogRepository` - In-memory package/add-on storage
- `FakeBlackoutRepository` - In-memory blackout dates
- `FakeCalendarProvider` - Mock calendar integration
- `FakePaymentProvider` - Mock Stripe checkout
- `FakeEmailProvider` - Mock email sending
- `FakeUserRepository` - In-memory user storage
- `FakeWebhookRepository` - In-memory webhook tracking
- `FakeEventEmitter` - Mock event bus

#### Example Usage

```typescript
import {
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeEventEmitter,
  buildPackage,
  buildBooking,
} from './helpers/fakes';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: FakeBookingRepository;
  let catalogRepo: FakeCatalogRepository;

  beforeEach(() => {
    // Create fresh instances for each test
    bookingRepo = new FakeBookingRepository();
    catalogRepo = new FakeCatalogRepository();

    service = new BookingService(
      bookingRepo,
      catalogRepo
      // ... other dependencies
    );
  });

  it('creates a booking', async () => {
    // Arrange
    const pkg = buildPackage({ id: 'pkg_1', priceCents: 100000 });
    catalogRepo.addPackage(pkg);

    // Act
    const result = await service.createCheckout('test-tenant', {
      packageId: 'pkg_1',
      // ... booking data
    });

    // Assert
    expect(result.checkoutUrl).toBeDefined();
  });
});
```

### Test Setup

Use `beforeEach` for fresh instances to ensure test isolation:

```typescript
beforeEach(() => {
  // Create new instances for each test
  bookingRepo = new FakeBookingRepository();
  catalogRepo = new FakeCatalogRepository();
  eventEmitter = new FakeEventEmitter();

  // Clear any state
  bookingRepo.clear();
  catalogRepo.clear();

  service = new BookingService(
    bookingRepo,
    catalogRepo,
    eventEmitter
    // ... other deps
  );
});
```

### Mocking Services

For complex services like `commissionService` and `tenantRepo`, use Vitest mocks:

```typescript
import { vi } from 'vitest';

let commissionService: any;
let tenantRepo: any;

beforeEach(() => {
  commissionService = {
    calculateCommission: vi.fn().mockReturnValue({
      platformFeeCents: 500,
      vendorPayoutCents: 99500,
    }),
    calculateBookingTotal: vi.fn().mockResolvedValue({
      basePrice: 100000,
      addOnsTotal: 50000,
      subtotal: 150000,
      platformFeeCents: 7500,
      vendorPayoutCents: 142500,
      customerTotalCents: 150000,
    }),
  };

  tenantRepo = {
    findById: vi.fn().mockResolvedValue({
      id: 'test-tenant',
      stripeConnectedAccountId: 'acct_test123',
      name: 'Test Tenant',
    }),
  };

  service = new BookingService(
    bookingRepo,
    catalogRepo,
    eventEmitter,
    paymentProvider,
    commissionService, // Mock
    tenantRepo // Mock
  );
});
```

### HTTP/API Tests

For HTTP endpoint testing, use Supertest with the Express app:

```typescript
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';

describe('GET /v1/packages', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Setup test tenant with known API key
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'elope' },
      update: {
        apiKeyPublic: 'pk_live_elope_0123456789abcdef',
        isActive: true,
      },
      create: {
        id: 'tenant_default_legacy',
        slug: 'elope',
        name: 'Elope (Test)',
        apiKeyPublic: 'pk_live_elope_0123456789abcdef',
        // ... other fields
      },
    });

    testTenantApiKey = tenant.apiKeyPublic;
    await prisma.$disconnect();

    // Create app with mock adapters
    const config = loadConfig();
    app = createApp({ ...config, ADAPTERS_PRESET: 'mock' });
  });

  it('returns packages list', async () => {
    const res = await request(app)
      .get('/v1/packages')
      .set('X-Tenant-Key', testTenantApiKey) // REQUIRED for multi-tenancy
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

### Integration Test Patterns

Integration tests use real database connections and test helpers:

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe.sequential('PrismaBookingRepository - Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('booking-repository');
  let repository: PrismaBookingRepository;
  let testTenantId: string;

  beforeEach(async () => {
    // Setup tenant
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    testTenantId = ctx.tenants.tenantA.id;

    // Initialize repository
    repository = new PrismaBookingRepository(ctx.prisma);
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('creates booking with database transaction', async () => {
    const booking = ctx.factories.booking.create({
      eventDate: '2025-12-25',
    });

    const created = await repository.create(testTenantId, booking);
    expect(created.id).toBe(booking.id);
  });
});
```

## Common Issues

### Issue: Missing `tenantId` Parameter

**Symptom:**

```
TypeError: Cannot read property 'id' of undefined
```

**Solution:**
Add `'test-tenant'` as the first parameter to all service/repository method calls:

```typescript
// BEFORE (broken)
await service.createBooking({ ... });

// AFTER (fixed)
await service.createBooking('test-tenant', { ... });
```

### Issue: 401 Unauthorized in HTTP Tests

**Symptom:**

```
Expected status 200, received 401
```

**Solution:**
Add the `X-Tenant-Key` header with a valid tenant API key:

```typescript
await request(app)
  .get('/v1/packages')
  .set('X-Tenant-Key', testTenantApiKey) // Add this line
  .expect(200);
```

### Issue: Repository Method Signature Mismatch

**Symptom:**

```
Expected 2 arguments, but got 1
```

**Solution:**
Check `test/helpers/fakes.ts` for the current interface. All repository methods follow this pattern:

```typescript
// Fake repository interface
async methodName(tenantId: string, ...otherParams): Promise<Result>

// Usage
await repo.findById('test-tenant', 'booking-123');
await repo.create('test-tenant', bookingData);
await repo.findAll('test-tenant');
```

### Issue: Test Database Not Configured

**Symptom:**

```
Error: DATABASE_URL_TEST environment variable not set
```

**Solution:**

1. Copy `.env.example` to `.env.test`
2. Set `DATABASE_URL_TEST` to your test database connection string
3. Run `npm run test:integration`

### Issue: Stale Test Data

**Symptom:**
Tests pass individually but fail when run together

**Solution:**
Ensure proper cleanup in `beforeEach` and `afterEach` hooks:

```typescript
beforeEach(() => {
  fakeRepo.clear(); // Clear fake repository state
});

afterEach(async () => {
  await ctx.cleanup(); // Clean up integration test database
});
```

## Builder Functions

Location: `test/helpers/fakes.ts`

Builder functions create test entities with sensible defaults:

```typescript
// Build a package with defaults
const pkg = buildPackage();
// Result: { id: 'pkg_1', slug: 'basic-package', priceCents: 100000, ... }

// Build with overrides
const customPkg = buildPackage({
  id: 'pkg_custom',
  priceCents: 200000
});

// Available builders
buildPackage(overrides?: Partial<Package>): Package
buildAddOn(overrides?: Partial<AddOn>): AddOn
buildBooking(overrides?: Partial<Booking>): Booking
buildUser(overrides?: Partial<User>): User
```

## Test Organization

### File Naming Conventions

- Unit tests: `*.spec.ts`
- Integration tests: `*.integration.spec.ts`
- HTTP tests: `*.test.ts`
- E2E tests: `*.spec.ts` (in `e2e/tests/`)

### Directory Structure

```
server/test/
├── README.md                          # This file
├── helpers/
│   ├── fakes.ts                       # Fake implementations
│   └── integration-setup.ts           # Integration test utilities
├── http/
│   └── packages.test.ts               # HTTP endpoint tests
├── integration/
│   ├── booking-repository.integration.spec.ts
│   ├── catalog.repository.integration.spec.ts
│   └── webhook-repository.integration.spec.ts
├── middleware/
│   └── tenant-middleware.spec.ts
├── repositories/
│   └── *.spec.ts
├── controllers/
│   └── *.spec.ts
├── booking.service.spec.ts            # Service unit tests
├── catalog.service.spec.ts
└── availability.service.spec.ts

../e2e/
├── playwright.config.ts
└── tests/
    ├── booking-flow.spec.ts           # E2E user flows
    ├── admin-flow.spec.ts
    └── booking-mock.spec.ts
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on state from other tests.

```typescript
// GOOD - Fresh state for each test
beforeEach(() => {
  repo = new FakeBookingRepository();
  service = new BookingService(repo, ...);
});

// BAD - Shared state across tests
const repo = new FakeBookingRepository();
```

### 2. Descriptive Test Names

Use clear, behavior-focused test descriptions:

```typescript
// GOOD
it('throws NotFoundError when package does not exist', async () => { ... });

// BAD
it('test package', async () => { ... });
```

### 3. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('calculates total with add-ons', async () => {
  // Arrange - Setup test data
  const pkg = buildPackage({ priceCents: 100000 });
  catalogRepo.addPackage(pkg);

  // Act - Execute the operation
  const result = await service.createCheckout('test-tenant', {
    packageId: pkg.id,
    addOnIds: ['addon_1'],
  });

  // Assert - Verify the result
  expect(result.totalCents).toBe(150000);
});
```

### 4. Multi-Tenancy Testing

Always test tenant isolation for repository operations:

```typescript
it('isolates data by tenant', async () => {
  await repo.create('tenant-a', bookingA);
  await repo.create('tenant-b', bookingB);

  const tenantABookings = await repo.findAll('tenant-a');
  expect(tenantABookings).toHaveLength(1);
  expect(tenantABookings[0].id).toBe(bookingA.id);
});
```

### 5. Error Cases

Always test both success and error scenarios:

```typescript
describe('createBooking', () => {
  it('creates booking successfully', async () => { ... });

  it('throws NotFoundError for invalid package', async () => { ... });

  it('throws BookingConflictError for duplicate date', async () => { ... });
});
```

## Debugging Tests

### Run Single Test

```bash
# Run specific test file
npm test -- booking.service.spec.ts

# Run specific test by name pattern
npm test -- -t "creates booking successfully"
```

### Enable Verbose Output

```bash
# Already enabled by default in package.json
npm test  # Uses --reporter=verbose
```

### Debug Integration Tests

```bash
# Run single integration test file
npm run test:integration -- booking-repository.integration.spec.ts

# Watch mode for debugging
npm run test:integration:watch
```

## CI/CD Integration

Tests are automatically run in CI/CD pipelines. See `docs/TESTING.md` for CI configuration.

### Pre-Commit Recommendations

```bash
# Run fast unit tests before committing
npm test -- test/ --exclude="test/integration/**"

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

## Code Coverage

### Overview

The project uses Vitest with V8 coverage provider to track test coverage. Coverage reports help identify untested code and ensure comprehensive test coverage across the codebase.

### Current Coverage Status

**Baseline Coverage (as of 2025-11-14):**

- Lines: 42.35% (Target: 80%)
- Branches: 77.45% (Target: 75%) ✓ PASSING
- Functions: 36.94% (Target: 80%)
- Statements: 42.35% (Target: 80%)

### Coverage Thresholds

Coverage thresholds are enforced in `server/vitest.config.ts`:

```typescript
thresholds: {
  lines: 40,        // Current baseline, targeting 80%
  branches: 75,     // PASSING ✓
  functions: 35,    // Current baseline, targeting 80%
  statements: 40,   // Current baseline, targeting 80%
}
```

**Note:** Thresholds are currently set to match the baseline to prevent regressions. We are working towards 80% coverage for all metrics.

### Running Coverage

```bash
# Generate coverage for all tests (unit + integration)
npm run test:coverage

# Generate coverage for unit tests only (faster, recommended for dev)
npm run test:coverage:unit

# Open HTML report in browser (macOS)
npm run test:coverage:report
```

### Viewing Coverage Reports

Coverage reports are generated in multiple formats:

1. **Terminal Output** - Immediate summary after test run
2. **HTML Report** - Interactive browser-based report at `server/coverage/index.html`
3. **LCOV Report** - For CI/CD integration at `server/coverage/lcov-report/`
4. **JSON Report** - Machine-readable at `server/coverage/coverage-final.json`

### What's Excluded from Coverage

The following files are excluded from coverage calculations:

- Test files: `*.spec.ts`, `*.test.ts`
- Test directory: `test/**`
- Build artifacts: `dist/**`, `coverage/**`
- Configuration files: `*.config.ts`, `*.config.js`
- Scripts: `scripts/**`
- Database schema: `prisma/**`
- Type definitions: `**/*.d.ts`
- Index/barrel files: `**/index.ts` (usually just re-exports)

### Coverage by Area

**High Coverage (>70%):**

- ✓ Validation schemas (100%)
- ✓ Error handling middleware (100%)
- ✓ Identity service (100%)
- ✓ Admin schemas (100%)
- ✓ Booking service (86.66%)
- ✓ Availability service (88.46%)

**Medium Coverage (40-70%):**

- Catalog service (72.35%)
- DI container (48.64%)
- Cache service (47.56%)
- App setup (54.42%)

**Low Coverage (<40%):**

- Adapters (7.83%) - Mostly tested via integration tests
- Prisma repositories (10.46%) - Tested via integration tests
- Controllers (2.99%) - Tested via HTTP tests
- Routes (31.75%) - Tested via HTTP/E2E tests
- OAuth service (21.81%)
- Commission service (23.07%)

### Coverage Gaps

**Priority Areas for Improvement:**

1. **Adapters (7.83% → 60%)**
   - Stripe adapter (7.03%)
   - Google Calendar adapter (11.26%)
   - Resend adapter (9.41%)
   - **Action:** Add unit tests with mocked external APIs

2. **Repositories (10.46% → 40%)**
   - Already have comprehensive integration tests
   - **Action:** Add unit tests for error handling and edge cases

3. **Controllers (2.99% → 70%)**
   - Currently tested via HTTP tests
   - **Action:** Add unit tests for request validation and error paths

4. **Routes (31.75% → 70%)**
   - Admin routes (36%)
   - Auth routes (20.47%)
   - Settings routes (19.35%)
   - **Action:** Add more HTTP endpoint tests

5. **Services (36.2% → 80%)**
   - Commission service (5.23%)
   - Product service (10.95%)
   - OAuth service (21.81%)
   - Upload service (31.88%)
   - **Action:** Add comprehensive unit tests

### Improving Coverage

When adding new code or improving coverage:

1. **Write Tests First** - TDD approach ensures coverage from the start
2. **Test Edge Cases** - Error conditions, null/undefined, boundary values
3. **Test Happy Path** - Ensure success scenarios are covered
4. **Check Coverage** - Run `npm run test:coverage:unit` to verify
5. **Review Report** - Open HTML report to identify uncovered lines

**Example Workflow:**

```bash
# 1. Make changes to src/services/booking.service.ts
# 2. Run unit tests with coverage
npm run test:coverage:unit -- booking.service.spec.ts

# 3. Open coverage report
npm run test:coverage:report

# 4. Navigate to src/services/booking.service.ts in report
# 5. Identify uncovered lines (shown in red)
# 6. Add tests for uncovered code paths
```

### Coverage and CI/CD

Coverage reports are generated in CI/CD pipelines (see `.github/workflows/ci.yml`). The pipeline will:

1. Run all tests with coverage
2. Generate coverage reports
3. Enforce coverage thresholds
4. Upload coverage artifacts

**Note:** Integration tests are excluded from CI coverage runs due to database requirements.

### Coverage Best Practices

1. **Don't Chase 100%** - Focus on critical paths and business logic
2. **Quality Over Quantity** - Meaningful tests > high coverage numbers
3. **Test Behavior, Not Implementation** - Tests should validate outcomes
4. **Exclude Generated Code** - Prisma client, OpenAPI types, etc.
5. **Use Integration Tests Wisely** - They provide coverage but are slower
6. **Monitor Trends** - Coverage should improve over time, not decrease

### What to Do if Coverage Drops

If coverage drops below thresholds:

1. **Check the Diff** - Review what code was added/changed
2. **Add Tests** - Write tests for new code paths
3. **Review Exclusions** - Ensure appropriate files are excluded
4. **Update Thresholds** - If intentional (document reasoning)

**Example:**

```bash
# Coverage dropped from 42% to 38%
ERROR: Coverage for lines (38%) does not meet threshold (40%)

# 1. Run coverage to see detailed report
npm run test:coverage:unit

# 2. Open HTML report
npm run test:coverage:report

# 3. Filter by "Uncovered" to see files with low coverage
# 4. Add tests for the new code
# 5. Re-run coverage to verify
npm run test:coverage:unit
```

### Roadmap to 80% Coverage

**Phase 1: Reach 50% (Current + 8%)**

- Add adapter unit tests with mocked APIs
- Add service unit tests for commission/product
- Timeline: 2-3 weeks

**Phase 2: Reach 65% (Phase 1 + 15%)**

- Add controller unit tests
- Add route HTTP tests
- Add error path coverage
- Timeline: 4-6 weeks

**Phase 3: Reach 80% (Phase 2 + 15%)**

- Add edge case tests
- Add integration test coverage
- Fill remaining gaps
- Timeline: 8-10 weeks

### Files Not Requiring Tests

Some files legitimately don't need tests:

- Type definitions (`*.d.ts`)
- Configuration files (`*.config.ts`)
- Barrel exports (`index.ts`)
- Database migrations
- Build scripts

These are excluded from coverage calculations.

## Further Reading

- `/Users/mikeyoung/CODING/Elope/docs/TESTING.md` - High-level testing philosophy and strategy
- `/Users/mikeyoung/CODING/Elope/docs/architecture/MULTI_TENANT_ISOLATION.md` - Multi-tenancy architecture
- `/Users/mikeyoung/CODING/Elope/e2e/playwright.config.ts` - Playwright configuration
- [Vitest Documentation](https://vitest.dev/) - Test runner reference
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage.html) - Coverage configuration
- [Playwright Documentation](https://playwright.dev/) - E2E testing reference
