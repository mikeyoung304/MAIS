---
title: Test Failure Prevention Strategies
category: testing
tags: [testing, integration-tests, best-practices, reliability]
priority: P0
date: 2025-11-28
---

# Test Failure Prevention Strategies

**Critical patterns to prevent flaky and non-deterministic test failures**

This document provides actionable strategies to prevent the three major test failure patterns identified during the MAIS project code review.

---

## Table of Contents

1. [Pattern 1: Concurrent Transaction Contention](#pattern-1-concurrent-transaction-contention)
2. [Pattern 2: Undefined Dependencies in Mock Mode](#pattern-2-undefined-dependencies-in-mock-mode)
3. [Pattern 3: Insufficient Timeouts for Bulk Operations](#pattern-3-insufficient-timeouts-for-bulk-operations)
4. [Best Practices Summary](#best-practices-summary)
5. [Code Review Checklist](#code-review-checklist)
6. [Recommended Test Patterns](#recommended-test-patterns)

---

## Pattern 1: Concurrent Transaction Contention

### Problem

Tests that run multiple database transactions in parallel can cause:

- Transaction timeouts and deadlocks
- Non-deterministic failures under load
- False negatives in CI environments
- Flaky test results that block deployments

**Example of problematic code:**

```typescript
it('should handle multiple concurrent bookings', async () => {
  // ❌ BAD: Running transactions in parallel for correctness test
  await Promise.all([
    bookingService.create(tenantId, { date: '2025-12-01', ... }),
    bookingService.create(tenantId, { date: '2025-12-02', ... }),
    bookingService.create(tenantId, { date: '2025-12-03', ... }),
  ]);

  // Test may timeout or fail due to transaction contention
  const bookings = await bookingRepo.findAll(tenantId);
  expect(bookings).toHaveLength(3);
});
```

### Root Cause

- **Database locking:** Multiple transactions acquiring locks simultaneously
- **Connection pool exhaustion:** Parallel transactions consume available connections
- **Transaction serialization:** Database enforces SERIALIZABLE isolation level, causing conflicts
- **Test intent mismatch:** Using parallel execution when sequential correctness is the goal

### Prevention Strategy

#### 1. **Use Sequential Processing for Correctness Tests**

```typescript
// ✅ GOOD: Sequential execution for correctness validation
it('should create multiple bookings successfully', async () => {
  // Create bookings sequentially
  await bookingService.create(tenantId, { date: '2025-12-01', ... });
  await bookingService.create(tenantId, { date: '2025-12-02', ... });
  await bookingService.create(tenantId, { date: '2025-12-03', ... });

  const bookings = await bookingRepo.findAll(tenantId);
  expect(bookings).toHaveLength(3);
});
```

#### 2. **Reserve Parallel Tests for Stress/Load Testing**

```typescript
// ✅ GOOD: Clearly marked as a stress test
describe('Booking Service - Load Tests', () => {
  it('should handle concurrent booking attempts (stress test)', async () => {
    // This test EXPECTS contention and validates handling
    const results = await Promise.allSettled([
      bookingService.create(tenantId, { date: '2025-12-01', ... }),
      bookingService.create(tenantId, { date: '2025-12-01', ... }), // Same date = conflict
      bookingService.create(tenantId, { date: '2025-12-01', ... }),
    ]);

    // Expect exactly one success, two failures (BookingConflictError)
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
  }, 10000); // Higher timeout for stress tests
});
```

#### 3. **Use Test Isolation Helpers**

```typescript
// ✅ GOOD: Proper isolation with cleanup
it('should create package with audit log', async () => {
  const { tenantId, cleanup } = await createTestTenant();

  try {
    await catalogService.createPackage(tenantId, {
      slug: 'test-pkg',
      title: 'Test Package',
      priceCents: 10000,
    });

    const packages = await catalogRepo.getAllPackages(tenantId);
    expect(packages).toHaveLength(1);
  } finally {
    await cleanup(); // Always cleanup, even on failure
  }
});
```

### Best Practices

| Scenario               | Approach                             | Timeout                    |
| ---------------------- | ------------------------------------ | -------------------------- |
| Correctness validation | Sequential (`await` each operation)  | Default (5s)               |
| Stress/load testing    | Parallel with `Promise.allSettled()` | Extended (10-30s)          |
| Bulk operations        | Batch with transaction pooling       | Configured (see Pattern 3) |
| Tenant isolation       | Independent tenants, can parallelize | Default (5s)               |

### Decision Tree

```
Are you testing concurrency handling (e.g., race conditions, double-booking)?
  ├─ YES → Use Promise.allSettled(), expect conflicts, higher timeout
  └─ NO  → Use sequential await, default timeout
```

---

## Pattern 2: Undefined Dependencies in Mock Mode

### Problem

The DI container returns `undefined` for required dependencies, causing:

- Test failures in `afterAll` cleanup
- Null pointer exceptions during test teardown
- Misleading error messages
- Difficulty debugging root cause

**Example of problematic code:**

```typescript
// ❌ BAD: Mock instances not exported from buildMockAdapters()
export function buildMockAdapters() {
  const catalogRepo = new MockCatalogRepository();
  const bookingRepo = new MockBookingRepository();

  return {
    catalogRepo,
    bookingRepo,
    // Missing: calendarProvider, webhookRepo, etc.
  };
}

// Test cleanup fails:
afterAll(async () => {
  // container.prisma is undefined in mock mode!
  await container.prisma?.$disconnect();
});
```

### Root Cause

- **Incomplete DI container setup:** Mock mode returns partial object
- **Missing exports:** Mock adapter instances not included in return value
- **Optional chaining assumptions:** Code assumes dependencies always exist
- **Mock/Real mode divergence:** Different container shapes between modes

### Prevention Strategy

#### 1. **Always Export All Mock Instances**

```typescript
// ✅ GOOD: Complete mock adapter export
export function buildMockAdapters() {
  const catalogRepo = new MockCatalogRepository();
  const bookingRepo = new MockBookingRepository();
  const blackoutRepo = new MockBlackoutRepository();
  const calendarProvider = new MockCalendarProvider();
  const paymentProvider = new MockPaymentProvider();
  const emailProvider = new MockEmailProvider();
  const userRepo = new MockUserRepository();
  const webhookRepo = new MockWebhookRepository();

  return {
    catalogRepo,
    bookingRepo,
    blackoutRepo,
    calendarProvider,
    paymentProvider,
    emailProvider,
    userRepo,
    webhookRepo,
  };
}
```

#### 2. **Add Guards in Cleanup Code**

```typescript
// ✅ GOOD: Safe cleanup with guards
afterAll(async () => {
  // Check if Prisma instance exists before disconnecting
  if (container.prisma) {
    await container.prisma.$disconnect();
  }

  // Check if cache adapter exists before cleanup
  if (container.cacheAdapter?.disconnect) {
    await container.cacheAdapter.disconnect();
  }
});
```

#### 3. **Validate DI Container Completeness**

```typescript
// ✅ GOOD: Runtime validation in buildContainer()
export function buildContainer(config: Config): Container {
  const eventEmitter = new InProcessEventEmitter();

  // ... build services and controllers

  // Validate container completeness
  const container = {
    controllers,
    services,
    repositories,
    mailProvider,
    cacheAdapter,
    prisma: mockPrisma, // Always defined, even in mock mode
  };

  // Runtime check (dev mode only)
  if (process.env.NODE_ENV !== 'production') {
    validateContainer(container);
  }

  return container;
}

function validateContainer(container: Container): void {
  const required = ['controllers', 'services', 'cacheAdapter', 'prisma'];

  for (const key of required) {
    if (!container[key]) {
      throw new Error(`DI container missing required key: ${key}`);
    }
  }
}
```

#### 4. **Use Consistent Container Interface**

```typescript
// ✅ GOOD: Mock mode returns same shape as real mode
if (config.ADAPTERS_PRESET === 'mock') {
  const adapters = buildMockAdapters();
  const mockPrisma = new PrismaClient(); // Mock Prisma (in-memory)

  return {
    controllers,
    services,
    repositories,
    mailProvider: undefined, // Explicitly undefined, not missing
    cacheAdapter,
    prisma: mockPrisma, // Always present
  };
}

// Real mode
return {
  controllers,
  services,
  repositories,
  mailProvider,
  cacheAdapter,
  prisma, // Always present
};
```

### Best Practices

| Issue              | Solution                                          |
| ------------------ | ------------------------------------------------- |
| Missing dependency | Add to `buildMockAdapters()` return value         |
| Cleanup failures   | Add existence checks (`if (dep)`) before cleanup  |
| Partial mocks      | Export complete mock object matching real adapter |
| Runtime errors     | Add `validateContainer()` helper in dev mode      |

### Decision Tree

```
Is this dependency used in tests?
  ├─ YES → Export from buildMockAdapters()
  └─ NO  → Still export as undefined (explicit)

Is this dependency cleaned up in afterAll?
  ├─ YES → Add existence check before cleanup
  └─ NO  → No guard needed
```

---

## Pattern 3: Insufficient Timeouts for Bulk Operations

### Problem

Tests creating many records exceed default timeouts (5000ms), causing:

- Flaky tests under system load
- CI pipeline failures
- False test failures masking real issues
- Developer frustration

**Example of problematic code:**

```typescript
// ❌ BAD: Bulk operation without timeout configuration
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await catalogService.createPackage(tenantId, {
      slug: `pkg-${i}`,
      title: `Package ${i}`,
      priceCents: 10000,
    });
  }

  const packages = await catalogRepo.getAllPackages(tenantId);
  expect(packages).toHaveLength(50);
}); // Default 5s timeout - likely to fail!
```

### Root Cause

- **Default timeout too low:** Vitest default is 5000ms
- **Bulk operations:** Creating N records takes O(N) time
- **Database overhead:** Transaction commits, index updates, constraint checks
- **System load variance:** CI environments have variable performance

### Prevention Strategy

#### 1. **Configure Appropriate Timeouts**

```typescript
// ✅ GOOD: Explicit timeout for bulk operation
it('should create 50 packages', async () => {
  for (let i = 0; i < 50; i++) {
    await catalogService.createPackage(tenantId, {
      slug: `pkg-${i}`,
      title: `Package ${i}`,
      priceCents: 10000,
    });
  }

  const packages = await catalogRepo.getAllPackages(tenantId);
  expect(packages).toHaveLength(50);
}, 30000); // 30 second timeout for bulk operation
```

#### 2. **Use Batch Operations**

```typescript
// ✅ BETTER: Batch insert when supported
it('should create 50 packages efficiently', async () => {
  const packageData = Array.from({ length: 50 }, (_, i) => ({
    slug: `pkg-${i}`,
    title: `Package ${i}`,
    priceCents: 10000,
  }));

  // Prisma createMany for batch insert
  await prisma.package.createMany({
    data: packageData.map((p) => ({
      ...p,
      tenantId,
    })),
  });

  const packages = await catalogRepo.getAllPackages(tenantId);
  expect(packages).toHaveLength(50);
}, 10000); // Faster with batch insert
```

#### 3. **Calculate Dynamic Timeouts**

```typescript
// ✅ BEST: Calculate timeout based on operation count
const TIMEOUT_PER_OPERATION = 200; // ms per record
const BASE_TIMEOUT = 5000; // ms base overhead

function calculateTimeout(operationCount: number): number {
  return BASE_TIMEOUT + (operationCount * TIMEOUT_PER_OPERATION);
}

it('should create 50 packages', async () => {
  const count = 50;

  for (let i = 0; i < count; i++) {
    await catalogService.createPackage(tenantId, { ... });
  }

  const packages = await catalogRepo.getAllPackages(tenantId);
  expect(packages).toHaveLength(count);
}, calculateTimeout(50)); // 15000ms (5000 + 50*200)
```

#### 4. **Set Suite-Level Timeouts**

```typescript
// ✅ GOOD: Configure timeout for entire describe block
describe('Catalog Service - Bulk Operations', () => {
  // All tests in this suite get 30s timeout
  beforeAll(() => {
    vi.setConfig({ testTimeout: 30000 });
  });

  afterAll(() => {
    vi.setConfig({ testTimeout: 5000 }); // Reset to default
  });

  it('should create 50 packages', async () => {
    // No explicit timeout needed - uses suite default
    for (let i = 0; i < 50; i++) {
      await catalogService.createPackage(tenantId, { ... });
    }
  });

  it('should create 100 add-ons', async () => {
    // Also uses 30s timeout
    for (let i = 0; i < 100; i++) {
      await catalogService.createAddOn(tenantId, packageId, { ... });
    }
  });
});
```

### Best Practices

| Operation Type | Records | Recommended Timeout    |
| -------------- | ------- | ---------------------- |
| Single CRUD    | 1       | Default (5s)           |
| Small batch    | 10-20   | 10s                    |
| Medium batch   | 20-50   | 15-30s                 |
| Large batch    | 50-100  | 30-60s                 |
| Bulk import    | 100+    | Use batch insert + 60s |

### Timeout Calculation Formula

```typescript
timeout = BASE_TIMEOUT + operationCount * timePerOperation;

// Examples:
// 10 operations  = 5000 + (10 * 200)  = 7000ms
// 50 operations  = 5000 + (50 * 200)  = 15000ms
// 100 operations = 5000 + (100 * 200) = 25000ms
```

### Decision Tree

```
How many records are being created?
  ├─ < 10   → Default timeout (5s)
  ├─ 10-50  → 15-30s timeout
  ├─ 50-100 → 30-60s timeout
  └─ > 100  → Use batch insert + 60s timeout
```

---

## Best Practices Summary

### 🎯 Golden Rules

1. **Parallel vs Sequential**
   - Use sequential `await` for correctness tests
   - Reserve parallel execution for stress tests only
   - Always mark stress tests clearly in test name

2. **DI Container Completeness**
   - Export ALL mock instances from `buildMockAdapters()`
   - Add guards (`if (dep)`) before cleanup operations
   - Validate container in dev mode with runtime checks

3. **Timeout Configuration**
   - Calculate timeouts based on operation count
   - Use batch operations for bulk inserts when possible
   - Set suite-level timeouts for bulk operation suites

4. **Test Isolation**
   - Always use `createTestTenant()` for isolated tenants
   - Always cleanup in `finally` blocks
   - Never share test data between tests

5. **Error Messages**
   - Use descriptive test names (e.g., "stress test", "bulk operation")
   - Add comments explaining unusual patterns
   - Log operation counts in bulk tests

---

## Code Review Checklist

Copy-paste this into your PR description for integration tests:

```markdown
## Integration Test Checklist

### Transaction Contention

- [ ] Tests use sequential `await` for correctness validation
- [ ] Parallel tests are clearly marked as stress/load tests
- [ ] Stress tests use `Promise.allSettled()` and validate conflicts
- [ ] No unnecessary parallel execution in standard tests

### Dependency Injection

- [ ] All mock instances exported from `buildMockAdapters()`
- [ ] Cleanup code has existence checks (`if (dep)`)
- [ ] Mock container shape matches real container shape
- [ ] No `undefined` errors in test output

### Timeouts

- [ ] Bulk operation tests have explicit timeouts
- [ ] Timeout calculation based on operation count
- [ ] Batch operations used where appropriate
- [ ] Suite-level timeouts set for bulk operation suites

### Test Isolation

- [ ] Tests use `createTestTenant()` helper
- [ ] Cleanup in `finally` blocks
- [ ] No shared test data between tests
- [ ] Tenant isolation verified

### Code Quality

- [ ] Test names are descriptive and accurate
- [ ] Comments explain unusual patterns
- [ ] Error messages don't leak implementation details
- [ ] Tests are deterministic (no random data without seeds)
```

---

## Recommended Test Patterns

### Pattern 1: Standard Integration Test

```typescript
describe('CatalogService', () => {
  let tenantId: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testTenant = await createTestTenant();
    tenantId = testTenant.tenantId;
    cleanup = testTenant.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create package with audit log', async () => {
    const pkg = await catalogService.createPackage(tenantId, {
      slug: 'test-pkg',
      title: 'Test Package',
      priceCents: 10000,
    });

    expect(pkg.id).toBeDefined();
    expect(pkg.slug).toBe('test-pkg');
  });
});
```

### Pattern 2: Bulk Operation Test

```typescript
describe('CatalogService - Bulk Operations', () => {
  // Suite-level timeout
  beforeAll(() => {
    vi.setConfig({ testTimeout: 30000 });
  });

  afterAll(() => {
    vi.setConfig({ testTimeout: 5000 });
  });

  it('should create 50 packages efficiently', async () => {
    const packageData = Array.from({ length: 50 }, (_, i) => ({
      slug: `pkg-${i}`,
      title: `Package ${i}`,
      priceCents: 10000,
    }));

    // Batch insert
    await prisma.package.createMany({
      data: packageData.map((p) => ({ ...p, tenantId })),
    });

    const packages = await catalogRepo.getAllPackages(tenantId);
    expect(packages).toHaveLength(50);
  });
});
```

### Pattern 3: Stress Test

```typescript
describe('BookingService - Stress Tests', () => {
  it('should handle concurrent booking attempts (stress test)', async () => {
    // Parallel execution to test race conditions
    const results = await Promise.allSettled([
      bookingService.create(tenantId, { date: '2025-12-01', ... }),
      bookingService.create(tenantId, { date: '2025-12-01', ... }), // Conflict
      bookingService.create(tenantId, { date: '2025-12-01', ... }), // Conflict
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);

    // Validate error type
    failures.forEach(f => {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(BookingConflictError);
    });
  }, 10000); // Higher timeout
});
```

### Pattern 4: Multi-Tenant Isolation Test

```typescript
describe('CatalogService - Tenant Isolation', () => {
  it('should not return data from other tenants', async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();

    try {
      await catalogService.createPackage(tenantA.tenantId, {
        slug: 'pkg-a',
        title: 'Tenant A Package',
        priceCents: 10000,
      });

      await catalogService.createPackage(tenantB.tenantId, {
        slug: 'pkg-b',
        title: 'Tenant B Package',
        priceCents: 20000,
      });

      const packagesA = await catalogRepo.getAllPackages(tenantA.tenantId);
      const packagesB = await catalogRepo.getAllPackages(tenantB.tenantId);

      expect(packagesA).toHaveLength(1);
      expect(packagesA[0].slug).toBe('pkg-a');

      expect(packagesB).toHaveLength(1);
      expect(packagesB[0].slug).toBe('pkg-b');
    } finally {
      await tenantA.cleanup();
      await tenantB.cleanup();
    }
  });
});
```

### Pattern 5: Safe Cleanup

```typescript
describe('CatalogService', () => {
  let container: Container;

  beforeAll(async () => {
    const config = loadConfig();
    container = buildContainer(config);
  });

  afterAll(async () => {
    // Safe cleanup with guards
    if (container.prisma) {
      await container.prisma.$disconnect();
    }

    if (container.cacheAdapter?.disconnect) {
      await container.cacheAdapter.disconnect();
    }
  });
});
```

---

## Quick Reference

### When to Use What

| Scenario               | Pattern               | Timeout      |
| ---------------------- | --------------------- | ------------ |
| Standard CRUD test     | Sequential await      | Default (5s) |
| Bulk insert (10-50)    | Batch operation       | 15-30s       |
| Bulk insert (100+)     | Batch + suite timeout | 60s          |
| Race condition test    | Promise.allSettled    | 10s          |
| Multi-tenant isolation | Independent tenants   | Default (5s) |
| Cleanup operations     | Guards + finally      | N/A          |

### Common Mistakes

| ❌ Don't Do This                       | ✅ Do This Instead                |
| -------------------------------------- | --------------------------------- |
| `Promise.all([create(), create()])`    | `await create(); await create();` |
| Missing timeout on bulk ops            | Add explicit timeout or batch     |
| `await container.prisma.$disconnect()` | `if (container.prisma) await ...` |
| Share test data between tests          | Use `createTestTenant()` per test |
| Hardcoded tenant IDs in tests          | Use `createTestTenant()` helper   |

---

## Next Steps

1. **Update Existing Tests**
   - Review integration tests for these patterns
   - Add timeouts to bulk operation tests
   - Add guards to cleanup code
   - Convert parallel tests to sequential (or mark as stress tests)

2. **Update Test Helpers**
   - Ensure `createTestTenant()` returns cleanup function
   - Add `calculateTimeout()` utility
   - Add `validateContainer()` dev mode check

3. **Update Documentation**
   - Add these patterns to CLAUDE.md
   - Update TESTING.md with examples
   - Create test templates in `server/test/templates/`

4. **CI/CD Integration**
   - Add pattern validation to pre-commit hook
   - Monitor test flakiness metrics
   - Set up retry logic for known flaky tests (temporary)

---

**Last Updated:** 2025-11-28
**Author:** Claude Code
**Status:** Active
