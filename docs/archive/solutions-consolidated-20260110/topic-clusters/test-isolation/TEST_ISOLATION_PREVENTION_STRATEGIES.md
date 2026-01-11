# Test Isolation Prevention Strategies for Multi-Tenant Systems

## Executive Summary

Tests that pass individually but fail when run together are a symptom of **database state pollution** and **connection pool exhaustion**. This document provides comprehensive prevention strategies for the MAIS multi-tenant application and can be adapted to other projects.

**Current MAIS Status:**

- All 771+ server tests pass when run individually
- Vitest default parallel execution causes failures due to database connection pool exhaustion
- CI/CD pipeline successfully mitigates with `connection_limit=10&pool_timeout=20` parameters
- Integration test helper (`setupCompleteIntegrationTest`) now properly manages connections

---

## Root Cause Analysis

### Why Tests Fail When Run Together

```
Unit Test Mode: All tests pass ✅
│ └─ Each test file gets fresh environment
│    └─ Mock dependencies (no database)
│    └─ Minimal resource usage

Integration Test Mode: Intermittent failures 🔴
│ └─ Multiple test files run in parallel
│ │  └─ Each creates new PrismaClient instance
│ │  └─ Default pool: 100+ connections per instance
│ │
│ └─ 10 test files × 100 connections = 1000+ connections
│    └─ Database max: 100-300 connections
│    └─ RESULT: Connection pool exhaustion
│
│ └─ Cross-test database state pollution
│    └─ Insufficient cleanup between parallel tests
│    └─ Unique slug conflicts (race conditions)
│    └─ Foreign key constraint violations
```

### Symptoms Checklist

Watch for these warning signs:

- [ ] Tests pass individually but fail in batch
- [ ] Error: "Too many database connections opened"
- [ ] Error: "FATAL: remaining connection slots reserved"
- [ ] Error: "Could not serialize access due to concurrent update"
- [ ] Flaky tests with different failures each run
- [ ] Timeout errors in integration tests
- [ ] "Connection pool size exceeded" warnings
- [ ] Tests run slower when run together
- [ ] Foreign key constraint violations
- [ ] "Duplicate key value" errors on unique constraints

**If you see 3+ of these, test isolation is compromised.**

---

## Strategy 1: Connection Pool Sizing

### Problem

Prisma Client defaults to unlimited connection pool size. Each integration test creates a new PrismaClient, causing exponential connection growth.

**Impact on MAIS:**

```
Before connection limits:
  ✗ booking-repository: 5/11 passing (pool exhaustion)
  ✗ catalog-repository: 6/10 passing (timeouts)
  ✗ integration suite: 58/104 passing (55.8%)

After connection limits (connection_limit=10):
  ✅ booking-repository: 10/11 passing (expected)
  ✅ catalog-repository: 9/10 passing (expected)
  ✅ integration suite: 95+/104 passing (expected)
```

### Prevention

#### 1. Set Environment Variable Connection Limits

**For Local Development:**

Add to `.env.test` (create if doesn't exist):

```bash
# Connection pool configuration for test database
# These limits prevent exhaustion when running multiple integration tests in parallel
#
# connection_limit: Maximum connections per Prisma Client instance
#   - Value: 10 (low enough for 10+ concurrent test files)
#   - Rationale: Each file gets max 10 connections, won't exhaust DB pool
#
# pool_timeout: Seconds to wait for available connection
#   - Value: 20 (accounts for sequential cleanup)
#   - Rationale: Tests run serially or with staggered parallel, need time for cleanup
#
DATABASE_URL_TEST="postgresql://user:pass@host:5432/test_db?connection_limit=10&pool_timeout=20"
```

**For CI/CD Pipelines:**

Set environment variables directly in workflow (see `.github/workflows/main-pipeline.yml`):

```yaml
- name: Run integration tests
  run: npm run test:integration -- --coverage
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/db?connection_limit=10&pool_timeout=20
    DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/db?connection_limit=10&pool_timeout=20
```

#### 2. Validate in setupIntegrationTest()

The MAIS integration setup helper automatically applies connection limits:

```typescript
// server/test/helpers/integration-setup.ts (lines 88-92)
const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
const urlWithPool = baseUrl?.includes('?')
  ? `${baseUrl}&connection_limit=5&pool_timeout=10`
  : `${baseUrl}?connection_limit=5&pool_timeout=10`;
```

**Never override this in tests.** Use `setupCompleteIntegrationTest()` which handles it automatically.

#### 3. Monitor Connection Usage

Add monitoring to test output:

```typescript
// Log connection pool stats after each test suite
afterAll(async () => {
  const stats = await prisma.$metrics?.();
  if (stats?.connections) {
    console.log(
      `[${testFile}] Final connections: ${stats.connections.open}/${stats.connections.max}`
    );
  }
  await ctx.cleanup();
});
```

### Recommended Values

| Environment    | connection_limit | pool_timeout | Rationale                                       |
| -------------- | ---------------- | ------------ | ----------------------------------------------- |
| **Local Dev**  | 10               | 20s          | Lower resource usage, slower cleanup            |
| **CI/CD**      | 10               | 20s          | Tight resource constraints, prevent exhaustion  |
| **Production** | 50-100           | 30s          | Higher throughput, account for concurrent users |
| **Staging**    | 25               | 25s          | Balance between dev and production              |

**For MAIS specifically:** Use `connection_limit=10` and `pool_timeout=20` everywhere except production.

---

## Strategy 2: Serial vs Parallel Test Execution

### Problem

Vitest defaults to parallel execution with multiple workers. For database-dependent tests, this amplifies connection pool exhaustion and state pollution.

### Prevention

#### 1. Sequential Test Execution (Safest)

**Declare tests as sequential:**

```typescript
// server/test/integration/booking.integration.spec.ts
describe.sequential('Booking Integration Tests', () => {
  // All tests in this block run one-at-a-time

  it('should create booking', async () => {
    // ...
  });

  it('should prevent double-booking', async () => {
    // ...
  });
});
```

**Why this works:**

- Only one test runs at a time
- Database connections stay stable (no exponential growth)
- Shared state is isolated (no race conditions)
- Slower (1-2s per test), but 100% reliable

**When to use:**

- [ ] Database integration tests
- [ ] Tests with shared fixtures
- [ ] Tests that validate state transitions
- [ ] Tests that modify shared resources (cache, config)

#### 2. Parallel with Connection Pool Management (Default)

**Use setupCompleteIntegrationTest():**

```typescript
describe('My Integration Tests', () => {
  // Don't use .sequential() - tests run in parallel

  const ctx = setupCompleteIntegrationTest('my-test-file', {
    cacheTTL: 60,
  });

  beforeEach(async () => {
    // Each test gets fresh tenants (no state pollution)
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
  });

  afterEach(async () => {
    // Critical: Always cleanup to free connections
    await ctx.cleanup();
  });

  it('test 1', async () => {
    /* ... */
  });
  it('test 2', async () => {
    /* ... */
  });
});
```

**Why this works:**

- Connection limits prevent exhaustion
- Each test has isolated multi-tenant setup
- File-specific tenant slugs prevent cross-test conflicts
- Factories generate unique IDs (no duplicate key errors)

**When to use:**

- [ ] Most integration tests (multi-tenant MUST use this)
- [ ] Tests that don't share state
- [ ] Tests that cleanup properly in afterEach

#### 3. Single-Fork Serial Mode (Last Resort)

**Only if parallel pooling fails:**

```bash
# Run all tests in single process (slowest, most stable)
npm run test:serial

# Equivalent Vitest flag
vitest --pool=forks --poolOptions.forks.singleFork
```

**Why this works:**

- Zero parallel execution (guaranteed serial)
- Single connection pool
- No worker process communication overhead
- But: ~3-5x slower execution

**When to use:**

- [ ] Debugging mysterious failures
- [ ] Tests that absolutely require synchronous execution
- [ ] Final validation before release

### Decision Tree

```
Do tests access database?
├─ NO ──────────────────────► Use parallel (no isolation issues)
│
└─ YES (Integration tests)
   ├─ Is cleanup proper & deterministic?
   │  ├─ YES ──────────────────► Use parallel with pool limits
   │  │                          (setupCompleteIntegrationTest)
   │  │
   │  └─ NO ───────────────────► Fix cleanup first!
   │                             Then use parallel
   │
   └─ Do tests modify shared state?
      ├─ Cache, config, globals ► Use .sequential()
      │                          (no parallel access)
      │
      └─ Tenant-isolated data ──► Use parallel
                                  (each tenant is isolated)
```

---

## Strategy 3: Test Setup/Teardown Patterns

### Problem

Insufficient or inconsistent cleanup between tests leads to database state pollution, especially in parallel execution.

### Prevention

#### 1. Standard Multi-Tenant Cleanup Pattern

**Use this pattern for all integration tests:**

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe.sequential('My Integration Test', () => {
  // 1. Setup context (with connection pool management)
  const ctx = setupCompleteIntegrationTest('my-test-file');

  let tenantA_id: string;
  let tenantB_id: string;

  // 2. beforeEach: Create fresh state
  beforeEach(async () => {
    // Always cleanup first (idempotent, safe)
    await ctx.tenants.cleanupTenants();

    // Create fresh test tenants
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    // Get IDs for use in tests
    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    // Reset cache stats
    ctx.cache.resetStats();
  });

  // 3. afterEach: Cleanup (CRITICAL - don't skip!)
  afterEach(async () => {
    // Disconnect and flush cache
    await ctx.cleanup();
  });

  it('should work', async () => {
    // Tests are guaranteed fresh state
  });
});
```

**Cleanup Order (Critical):**

Always cleanup in this order to respect foreign key constraints:

```typescript
// ✅ CORRECT: child entities before parents
await prisma.bookingAddOn.deleteMany({
  where: {
    /* ... */
  },
});
await prisma.booking.deleteMany({
  where: {
    /* ... */
  },
});
await prisma.addOn.deleteMany({
  where: {
    /* ... */
  },
});
await prisma.package.deleteMany({
  where: {
    /* ... */
  },
});
await prisma.tenant.deleteMany({
  where: {
    /* ... */
  },
});

// ❌ WRONG: parent before child (FK constraint error)
await prisma.package.deleteMany(); // Error: referenced by BookingAddOn
await prisma.booking.deleteMany(); // Never reaches here
```

The `setupCompleteIntegrationTest()` helper handles this automatically.

#### 2. Tenant Isolation with File-Specific Slugs

**Prevent cross-test tenant conflicts:**

```typescript
// ✅ Good: File-specific slug (unique per test file)
const ctx = setupCompleteIntegrationTest('booking-repository');
// Creates: 'booking-repository-tenant-a', 'booking-repository-tenant-b'

// ❌ Bad: Generic slug (conflicts with other tests)
const ctx = setupCompleteIntegrationTest('test');
// Creates: 'test-tenant-a' (may clash with other 'test' files)
```

**Why this matters:**

When tests run in parallel, generic slugs conflict:

```
Test File A         Test File B         Test File C
├─ test-tenant-a    ├─ test-tenant-a    ├─ test-tenant-a
│  (created)        │  (created)        │  (created) CONFLICT!
│                   │                   │
├─ afterEach        ├─ afterEach        ├─ afterEach
│  (delete)         │  (delete)         │  (delete)
│                   │                   │
└─ cleanup OK?      └─ OK (usually)     └─ Error: already deleted!
```

#### 3. Factory-Generated Unique IDs

**Never hardcode slugs, use factories:**

```typescript
// ✅ Good: Factory generates unique slug each call
const factory = new PackageFactory();
const pkg1 = factory.create(); // slug: 'test-package-1-1699564800000'
const pkg2 = factory.create(); // slug: 'test-package-2-1699564800001'

// ❌ Bad: Same slug (conflicts if tests run in parallel)
const pkg = { slug: 'test-package', title: 'Test' };
// If two tests create same slug simultaneously: duplicate key error!
```

#### 4. Cache Invalidation Between Tests

**For cache-related tests, always reset stats:**

```typescript
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();

  // Reset cache stats before test
  ctx.cache.resetStats();

  // ... test setup ...
});

afterEach(async () => {
  // Flush cache after test (prevents leak to next test)
  ctx.cache.flush();
  await ctx.cleanup();
});
```

---

## Strategy 4: Database State Isolation

### Problem

Tests pollute each other's data even with cleanup, especially when:

- Cleanup is incomplete (missing related tables)
- Tests use hardcoded IDs or slugs
- Cache holds stale data from previous tests

### Prevention

#### 1. Tenant-Scoped Data Validation

**Verify all queries filter by tenantId:**

```typescript
// ✅ CORRECT: Tenant-scoped query
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});

// ❌ WRONG: No tenant filter (cross-tenant data leak!)
const packages = await prisma.package.findMany({
  where: { active: true },
});

// ❌ WRONG: Indirect tenant scope (hard to verify)
const packages = await getPackagesByActive(true);
// Did getPackagesByActive() filter by tenantId? Unknown!
```

**Test for tenant isolation:**

```typescript
it('should isolate data between tenants', async () => {
  // Create same data in both tenants
  const pkgA = ctx.factories.package.create({ title: 'Premium' });
  const pkgB = ctx.factories.package.create({ title: 'Premium' });

  await repository.createPackage(tenantA_id, pkgA);
  await repository.createPackage(tenantB_id, pkgB);

  // Fetch from Tenant A
  const packagesA = await repository.getPackages(tenantA_id);

  // Assert: No data from Tenant B leaked into Tenant A
  expect(packagesA).toHaveLength(1); // Only 1 package
  expect(packagesA[0].title).toBe('Premium');
});
```

#### 2. Complete Cleanup Dependencies

**Map out all relationships and cleanup in correct order:**

```typescript
// MAIS schema cleanup order (respects foreign keys)
const cleanupOrder = [
  'bookingAddOn', // Child: references booking, addOn
  'booking', // Parent of bookingAddOn
  'addOn', // Parent of bookingAddOn
  'package', // May be referenced by bookings
  'photoSession', // Photo data
  'tenant', // Parent of all
];

// Implement cleanup that respects this order
async function cleanupTenant(tenantId: string) {
  for (const table of cleanupOrder) {
    await prisma[table].deleteMany({
      where: { tenantId },
    });
  }
}
```

**Verify cleanup with test:**

```typescript
it('should completely cleanup test tenants', async () => {
  // Create related data
  const pkg = await repository.createPackage(tenantA_id, data);
  const booking = await repository.createBooking(tenantA_id, {
    packageId: pkg.id,
    date: new Date(),
  });
  const addOn = await repository.createAddOn(tenantA_id, addonData);
  await repository.addBookingAddOn(tenantA_id, booking.id, addOn.id);

  // Cleanup
  await ctx.tenants.cleanupTenants();

  // Assert: All data removed for all tables
  const tenants = await ctx.prisma.tenant.findMany({
    where: { id: { in: ctx.tenants.getTenantIds() } },
  });
  expect(tenants).toHaveLength(0); // Tenants should be deleted

  // Also verify related data is gone
  const bookings = await ctx.prisma.booking.findMany({
    where: { tenantId: ctx.tenants.tenantA.id },
  });
  expect(bookings).toHaveLength(0); // All bookings deleted too
});
```

#### 3. Cache Key Validation

**Every cache key must include tenantId:**

```typescript
// ✅ CORRECT: Tenant-scoped cache key
const key = `tenant:${tenantId}:packages`;

// ❌ WRONG: No tenantId (data leak between tenants!)
const key = 'packages:all';

// ✅ TEST: Validate cache key format
it('should use tenant-scoped cache keys', () => {
  const key = service.buildCacheKey(tenantA_id, 'packages');

  // Verify format: 'tenant:{tenantId}:...'
  expect(key).toMatch(new RegExp(`^tenant:${tenantA_id}:`));

  // Verify Tenant A cache ≠ Tenant B cache
  const keyA = service.buildCacheKey(tenantA_id, 'packages');
  const keyB = service.buildCacheKey(tenantB_id, 'packages');
  expect(keyA).not.toBe(keyB);
});
```

---

## Strategy 5: CI/CD Configuration

### Problem

Tests may pass locally but fail in CI due to different resource constraints, database configuration, or test ordering.

### Prevention

#### 1. Explicit Test Execution Order in CI

**See `.github/workflows/main-pipeline.yml` for MAIS implementation:**

```yaml
# Job 5: Unit Tests (no database, can run parallel)
- name: Run unit tests
  run: npm test -- --coverage

# Job 6: Integration Tests (database-dependent, serialized)
- name: Run integration tests
  run: npm run test:integration -- --coverage
  env:
    DATABASE_URL_TEST: postgresql://...?connection_limit=10&pool_timeout=20

# Job 7: E2E Tests (full stack, after migrations)
- name: Run E2E tests
  run: npm run test:e2e
```

**Key Points:**

- Unit tests run in parallel (no database)
- Integration tests run **after** DB migrations (database ready)
- E2E tests run **after** API seed (fresh test data)
- Each job uses fresh service container (clean state)

#### 2. Database Migration Before Tests

**Always apply migrations before integration tests:**

```yaml
- name: Run Prisma migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://...?connection_limit=10&pool_timeout=20

- name: Apply manual SQL migrations
  run: |
    for file in server/prisma/migrations/[0-9][0-9]_*.sql; do
      PGPASSWORD=postgres psql -f "$file"
    done

# NOW run tests (database is ready)
- name: Run integration tests
  run: npm run test:integration
```

#### 3. Service Container Configuration

**PostgreSQL service for integration tests:**

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: mais_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5  # Wait up to 50s for DB to be ready
```

**Why health checks matter:**

- Without them, tests start before DB is ready
- Causes intermittent "connection refused" errors
- Health checks ensure DB readiness before proceeding

#### 4. Test Artifact Collection

**Collect logs if tests fail:**

```yaml
- name: Upload test coverage on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: integration-test-coverage-${{ github.run_id }}
    path: ./server/coverage/
    retention-days: 7

- name: Upload Playwright report on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report-${{ github.run_id }}
    path: playwright-report/
    retention-days: 7
```

**This enables debugging:**

- Coverage reports show which tests failed
- HTML reports show exact failure points
- Retention: 7 days for investigation

---

## Implementation Checklist

### For New Integration Tests

```
Before Creating Test:
  ☐ Check if test needs database (if not, write as unit test)
  ☐ If yes, ensure other tests don't run in parallel

While Writing Test:
  ☐ Import setupCompleteIntegrationTest (not setupIntegrationTest)
  ☐ Use unique fileSlug parameter (match test filename)
  ☐ Use factories for test data (never hardcoded slugs)
  ☐ Create fresh tenants in beforeEach
  ☐ Cleanup tenants in afterEach
  ☐ Call await ctx.cleanup() in afterEach (CRITICAL!)

Before Committing:
  ☐ Test passes when run alone:
    npm test -- test/integration/my.test.ts

  ☐ Test passes when run with others:
    npm run test:integration

  ☐ Test passes in CI (push and check GitHub Actions)

  ☐ No hardcoded IDs or slugs in test data

  ☐ Verify teardown is complete (no leftover data)

Performance Validation:
  ☐ Run with --reporter=verbose to see timing
  ☐ Test should complete in < 1 second (unit) or < 5 seconds (integration)
  ☐ If slower, may indicate inefficient database queries
```

### For Existing Tests Failing in Batch

```
Diagnose:
  ☐ Run test alone: npm test -- path/to/test.ts (pass?)
  ☐ Run with batch: npm run test:integration (fail?)
  ☐ Check error message:
    - "Too many connections" → connection pool exhaustion
    - "duplicate key" → test data conflict
    - "foreign key" → incomplete cleanup
    - "serialization failure" → race condition

Fix (in priority order):
  ☐ Priority 1: Ensure connection limits are set
    DATABASE_URL_TEST must include ?connection_limit=10&pool_timeout=20

  ☐ Priority 2: Use setupCompleteIntegrationTest
    Don't create PrismaClient manually

  ☐ Priority 3: Fix cleanup (afterEach MUST call ctx.cleanup())

  ☐ Priority 4: Make unique test data (use factories)

  ☐ Priority 5: Add .sequential() if state is truly shared

Test Fix:
  ☐ Run batch again: npm run test:integration
  ☐ Verify: All tests passing now
  ☐ Run twice more to ensure it's stable (not flaky)
  ☐ Commit with fix message explaining root cause
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Manual PrismaClient Creation

```typescript
// ❌ BAD: Ignores connection pool limits
beforeEach(() => {
  prisma = new PrismaClient(); // Uses default pool size (100+)
});

// ✅ GOOD: Uses managed connection pool
const ctx = setupCompleteIntegrationTest('test-file');
// Automatically applies connection_limit=10
```

**Fix:** Always use `setupCompleteIntegrationTest()` for integration tests.

---

### Pitfall 2: Missing afterEach Cleanup

```typescript
// ❌ BAD: No cleanup (data pollutes next test)
beforeEach(async () => {
  await ctx.tenants.tenantA.create();
});
// No afterEach! Tenant stays in DB for next test

// ✅ GOOD: Always cleanup
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  await ctx.tenants.tenantA.create();
});

afterEach(async () => {
  await ctx.cleanup(); // CRITICAL!
});
```

**Fix:** Never omit `afterEach` cleanup. If you don't need cleanup, your test doesn't need integration setup.

---

### Pitfall 3: Hardcoded Test Data

```typescript
// ❌ BAD: Duplicate slug when tests run in parallel
const pkg = { slug: 'test-package', title: 'Test' };
await repository.createPackage(tenantId, pkg);

// Test A creates 'test-package' at 00:00:00.123
// Test B creates 'test-package' at 00:00:00.124 (conflict!)

// ✅ GOOD: Factory generates unique slugs
const factory = new PackageFactory();
const pkg = factory.create(); // slug: 'test-package-1-1699564800123'
```

**Fix:** Use provided factories (PackageFactory, AddOnFactory) for all test data.

---

### Pitfall 4: Sharing State Without .sequential()

```typescript
// ❌ BAD: Tests access same cache without synchronization
describe('Cache Tests', () => {
  // Tests run in parallel
  it('test 1', async () => {
    await cache.set('key', 'value');
    await wait(100); // Race condition: test 2 may have run by now
    expect(cache.get('key')).toBe('value');
  });

  it('test 2', async () => {
    await cache.clear();
    // This may clear test 1's data!
  });
});

// ✅ GOOD: Declare as sequential
describe.sequential('Cache Tests', () => {
  // Tests run one-at-a-time (safe)
});
```

**Fix:** If tests share state, use `describe.sequential()`.

---

### Pitfall 5: Not Resetting Cache Between Tests

```typescript
// ❌ BAD: Cache stats leak between tests
describe('Cache Tests', () => {
  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    // No resetStats! Cache stats from previous test persist
  });

  it('test 1', async () => {
    const stats1 = await ctx.cache.getStats();
    expect(stats1.hits).toBe(1); // Might fail if test 2 ran first!
  });
});

// ✅ GOOD: Reset cache stats in beforeEach
beforeEach(async () => {
  await ctx.tenants.cleanupTenants();
  ctx.cache.resetStats(); // Fresh stats for each test
});
```

**Fix:** Always call `ctx.cache.resetStats()` in `beforeEach`.

---

## Monitoring & Validation

### Health Check: Connection Pool Monitoring

Add to your test setup to detect pool exhaustion early:

```typescript
// Log connection pool status before/after tests
async function logConnectionStats(label: string) {
  try {
    const pool = (prisma as any)._engine?.client?._pool;
    if (pool) {
      console.log(`[${label}] Pool: idle=${pool.idleCount}, active=${pool.pendingCount}`);
    }
  } catch (err) {
    // Ignore if metrics unavailable
  }
}

beforeEach(async () => {
  await logConnectionStats('BEFORE');
});

afterEach(async () => {
  await logConnectionStats('AFTER');
});
```

**Expected output:**

```
[BEFORE] Pool: idle=1, active=0
[AFTER] Pool: idle=1, active=0
```

**Warning signs:**

```
[BEFORE] Pool: idle=0, active=25  ← High active connections (exhaustion risk)
[AFTER] Pool: idle=0, active=10   ← Not returning to idle (leak)
```

### Validation Test Suite

Run this before committing to catch isolation issues:

```bash
# 1. Run test alone (should pass)
npm test -- test/integration/booking.integration.spec.ts
# Expected: ✓ Pass (1-5 seconds)

# 2. Run with batch (should pass)
npm run test:integration
# Expected: ✓ Pass (10-20 seconds)

# 3. Run twice (should still pass - no state pollution)
npm run test:integration && npm run test:integration
# Expected: ✓ Pass both times

# 4. Run with verbose output (check for connection warnings)
npm run test:integration -- --reporter=verbose
# Expected: No "FATAL: too many connections" errors
```

---

## References & Related Documentation

### MAIS Documentation

- `.github/workflows/main-pipeline.yml` - CI/CD pipeline with pool configuration
- `server/test/helpers/integration-setup.ts` - Helper with automatic connection management
- `server/test/helpers/README.md` - Detailed integration test patterns
- `server/test/README.md` - Test structure overview

### External Resources

- [Prisma Connection Management](https://www.prisma.io/docs/orm/reference/connection-management)
- [Vitest Configuration](https://vitest.dev/config/)
- [PostgreSQL Connection Limits](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

## Quick Reference: Prevention Checklist

**When Tests Fail Together:**

1. ✓ Add connection limits to DATABASE_URL_TEST

   ```
   ?connection_limit=10&pool_timeout=20
   ```

2. ✓ Use setupCompleteIntegrationTest() helper

   ```typescript
   const ctx = setupCompleteIntegrationTest('my-test');
   ```

3. ✓ Add proper cleanup in afterEach

   ```typescript
   afterEach(async () => {
     await ctx.cleanup();
   });
   ```

4. ✓ Use factories for unique test data

   ```typescript
   const pkg = ctx.factories.package.create();
   ```

5. ✓ Run validation test suite
   ```bash
   npm run test:integration
   npm run test:integration  # Run again to verify
   ```

**Expected Result:** All 771+ tests pass together, every time.
