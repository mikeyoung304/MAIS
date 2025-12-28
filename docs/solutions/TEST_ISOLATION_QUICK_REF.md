# Test Isolation Quick Reference

## The Problem

Tests pass individually but fail when run together. Symptoms:

- "Too many database connections"
- "Could not serialize access"
- "Duplicate key" errors
- Flaky/intermittent failures

## The Root Cause

```
Multiple test files × Multiple Vitest workers × 100 connections per Prisma Client
= Thousands of connections against database max of 100-300
```

## The Solution: 5-Step Fix

### Step 1: Set Connection Limits (CRITICAL)

Add to `.env.test`:

```bash
DATABASE_URL_TEST="postgresql://user:pass@localhost:5432/db?connection_limit=10&pool_timeout=20"
```

CI/CD: Add to `.github/workflows/main-pipeline.yml`:

```yaml
env:
  DATABASE_URL: postgresql://...?connection_limit=10&pool_timeout=20
```

**Why:** Prevents exponential connection growth. Each test file gets max 10 connections.

---

### Step 2: Use setupCompleteIntegrationTest()

```typescript
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('My Tests', () => {
  // ✓ Auto-manages connection limits
  // ✓ Auto-isolates multi-tenant data
  // ✓ Auto-provides cache utilities
  const ctx = setupCompleteIntegrationTest('my-test-file');

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();
  });

  afterEach(async () => {
    await ctx.cleanup(); // CRITICAL - always cleanup!
  });

  it('should work', async () => {
    // Test code here
  });
});
```

**Why:** This helper handles connection pooling, tenant isolation, and cleanup automatically.

---

### Step 3: Always Cleanup in afterEach

```typescript
afterEach(async () => {
  // ✓ Disconnects Prisma
  // ✓ Flushes cache
  // ✓ Frees database connections
  await ctx.cleanup();
});
```

**If you skip this:** Database connections accumulate and you get exhaustion errors.

---

### Step 4: Use Factories for Test Data

```typescript
// ✓ Good - unique slug per call
const pkg = ctx.factories.package.create();

// ✓ Good - multiple unique packages
const pkgs = ctx.factories.package.createMany(3);

// ✗ Bad - duplicate slug (race condition in parallel)
const pkg = { slug: 'test-package', title: 'Test' };
```

**Why:** Prevents "duplicate key" errors when tests run in parallel.

---

### Step 5: Run Validation

```bash
# Test passes individually
npm test -- test/integration/my.test.ts
# Expected: ✅ Pass

# Test passes in batch
npm run test:integration
# Expected: ✅ Pass

# Test stable (run twice)
npm run test:integration && npm run test:integration
# Expected: ✅ Pass both times
```

---

## When to Use Serial Execution

Use `.sequential()` only when tests access shared state:

```typescript
describe.sequential('Cache Tests', () => {
  // Tests run one-at-a-time (slower but safer)
  it('test 1', () => {});
  it('test 2', () => {});
});
```

**Use Serial For:**

- Cache validation
- Config/global state tests
- Tests with timing dependencies

**Don't Use Serial For:**

- Most database tests (use pool limits instead)
- Multi-tenant tests (they're isolated by tenant)

---

## Troubleshooting

### Error: "Too many database connections"

**Fix:** Add `connection_limit=10` to DATABASE_URL_TEST

### Error: "Duplicate key value violates unique constraint"

**Fix:** Use factories (`ctx.factories.package.create()`) instead of hardcoded slugs

### Error: "Could not serialize access due to concurrent update"

**Fix:** Either:

1. Use advisory locks in transaction, OR
2. Use `.sequential()` for that test

### Error: "Foreign key constraint violation"

**Fix:** Cleanup must respect dependency order:

```typescript
// Correct order (child before parent)
bookingAddOn → booking → addOn → package → tenant
```

The helper handles this automatically.

### Tests pass locally but fail in CI

**Fix:** Ensure CI has same connection limits as local:

```yaml
DATABASE_URL_TEST: postgresql://...?connection_limit=10&pool_timeout=20
```

---

## Template: New Integration Test

Copy and paste this template for new integration tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('My Feature Tests', () => {
  const ctx = setupCompleteIntegrationTest('my-feature');

  let tenantA_id: string;
  let tenantB_id: string;

  beforeEach(async () => {
    // Always cleanup first
    await ctx.tenants.cleanupTenants();

    // Create fresh test tenants
    await ctx.tenants.tenantA.create();
    await ctx.tenants.tenantB.create();

    tenantA_id = ctx.tenants.tenantA.id;
    tenantB_id = ctx.tenants.tenantB.id;

    // Reset cache
    ctx.cache.resetStats();
  });

  afterEach(async () => {
    // CRITICAL: Always cleanup
    await ctx.cleanup();
  });

  it('should do something', async () => {
    // Use factories for unique data
    const data = ctx.factories.package.create({
      /* overrides */
    });

    // Your test logic here

    expect(result).toBeDefined();
  });
});
```

---

## One-Page Checklist

```
Creating New Integration Test:
  ☐ Import setupCompleteIntegrationTest
  ☐ Use unique fileSlug (match test filename)
  ☐ Use factories for test data (never hardcoded)
  ☐ Call cleanupTenants() in beforeEach
  ☐ Call cleanup() in afterEach (CRITICAL!)
  ☐ Test passes alone: npm test -- path/to/test.ts
  ☐ Test passes in batch: npm run test:integration
  ☐ No hardcoded slugs or IDs

Existing Tests Failing in Batch:
  ☐ Check DATABASE_URL_TEST has connection_limit=10
  ☐ Update test to use setupCompleteIntegrationTest
  ☐ Ensure afterEach calls ctx.cleanup()
  ☐ Replace hardcoded slugs with factories
  ☐ Run: npm run test:integration
  ☐ Run again to verify stability

CI/CD Setup:
  ☐ Add connection_limit=10&pool_timeout=20 to DATABASE_URL
  ☐ Run migrations before tests
  ☐ Integration tests after unit tests
  ☐ E2E tests after integration tests
```

---

## Key Parameters

| Parameter          | Value                | Purpose                                                 |
| ------------------ | -------------------- | ------------------------------------------------------- |
| `connection_limit` | 10                   | Max connections per Prisma Client (prevents exhaustion) |
| `pool_timeout`     | 20                   | Seconds to wait for available connection                |
| `fileSlug`         | Unique per test file | Prevents cross-test tenant conflicts                    |
| Cleanup order      | Child before parent  | Respects foreign key constraints                        |

---

## Success Criteria

✅ All integration tests pass when run together
✅ All tests pass when run twice in a row
✅ No "connection" or "duplicate key" errors
✅ Tests complete in reasonable time (< 30 seconds total)
✅ CI/CD pipeline passes consistently

---

## When to Escalate

If after following this guide you still have test failures:

1. Check error messages for hints
2. Review similar test files for patterns
3. Check if test really needs database (consider unit test instead)
4. Ask team lead about test-specific issues

See `TEST_ISOLATION_PREVENTION_STRATEGIES.md` for detailed troubleshooting.
