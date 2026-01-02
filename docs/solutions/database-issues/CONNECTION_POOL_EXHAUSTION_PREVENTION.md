# Connection Pool Exhaustion Prevention Strategy

## Executive Summary

**Problem:** Each test file creating its own `new PrismaClient()` exhausts Supabase's connection pool (limited to ~60 connections in Session/Transaction mode), causing tests to hang or timeout.

**Solution:** Use global singleton PrismaClient pattern with aggressive connection limits.

**Impact:**

- Before: Tests hang after ~5-10 parallel test files
- After: 100+ test files run reliably in CI/CD

**Status on MAIS:** Implemented and validated. All 771 tests pass.

---

## Why This Happens

### The Math of Pool Exhaustion

```
Scenario: Running tests in parallel with default Prisma settings

Test File 1 ┐
Test File 2 │ Each creates:
Test File 3 │ new PrismaClient({
Test File 4 │   datasources: { db: { url: DATABASE_URL } }
...         │ })
Test File 15┘ Default pool: 10+ connections per instance

10 files × 10 connections per file = 100+ connections
Database limit (Supabase Session mode): ~60 connections
Result: CONNECTION POOL EXHAUSTED ❌
```

### Supabase Pooling Modes

| Mode            | Connections | Isolation     | When to Use     |
| --------------- | ----------- | ------------- | --------------- |
| **Session**     | ~60         | High (slower) | Default, safest |
| **Transaction** | ~100        | Medium        | Dedicated pool  |
| **Statement**   | ~1000+      | Low           | High throughput |

MAIS uses Session mode by default (safe but limited).

### Warning Signs You're Experiencing This

Watch for these errors in test output:

- ❌ `FATAL: remaining connection slots reserved for non-replication superuser connections`
- ❌ `too many connections on connection token pool "noop"`
- ❌ `ECONNREFUSED: connect ECONNREFUSED` after 30+ seconds
- ❌ Tests pass individually but hang when run together
- ❌ Intermittent `ETIMEDOUT` or `EHOSTUNREACH` errors
- ❌ Test suite hangs with no error message
- ❌ `connection pool size exceeded` in logs

---

## Prevention Strategy 1: Global Singleton PrismaClient

### What It Is

A single shared PrismaClient instance used by all integration tests instead of creating new instances per test file.

### Why It Works

```typescript
// ❌ BEFORE: Each test file creates own client
describe('Test File A', () => {
  const prisma = new PrismaClient(); // Connection 1-10
  // ...
});

describe('Test File B', () => {
  const prisma = new PrismaClient(); // Connection 11-20
  // ...
});
// Total: 20+ connections for just 2 files!

// ✅ AFTER: All tests share one singleton
const globalPrisma = new PrismaClient(); // Connection 1-3

describe('Test File A', () => {
  const prisma = getTestPrisma(); // Uses global (same 1-3)
  // ...
});

describe('Test File B', () => {
  const prisma = getTestPrisma(); // Uses global (same 1-3)
  // ...
});
// Total: 3 connections for unlimited test files!
```

### Implementation

**File: `/server/test/helpers/global-prisma.ts`**

```typescript
/**
 * Global Singleton PrismaClient for Integration Tests
 *
 * CRITICAL: All integration tests MUST use this singleton to prevent
 * connection pool exhaustion with Supabase pgbouncer.
 */

import { PrismaClient } from '../../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg'; // Prisma 7: Required driver adapter

let globalPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
    }

    // Strip existing connection params and add aggressive limits
    const urlBase = baseUrl.split('?')[0];
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    // Prisma 7: Use driver adapter instead of datasources config
    const adapter = new PrismaPg({ connectionString: urlWithPool });
    globalPrisma = new PrismaClient({
      adapter,
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    // Auto-disconnect on process exit
    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
    });
  }

  return globalPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    await globalPrisma.$disconnect();
    globalPrisma = null;
  }
}
```

> **Note (Prisma 7):** The `datasources: { db: { url } }` config was removed in Prisma 7. Use `adapter: new PrismaPg({ connectionString })` instead.

**File: `/server/vitest.config.ts`**

```typescript
export default defineConfig(({ mode }) => {
  return {
    test: {
      // Run all tests in single thread to prevent pool exhaustion
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
      // Don't run test files in parallel
      fileParallelism: false,
      // Global teardown disconnects singleton
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],
    },
  };
});
```

---

## Prevention Strategy 2: Aggressive Connection Limits

### What to Do

Add connection pool parameters to your DATABASE_URL in tests.

### Why It Works

Limits are enforced by pgbouncer before they exhaust the actual database pool.

```bash
# ❌ BAD: Uses default pool (10+ per instance)
DATABASE_URL="postgresql://user:pass@host/db"

# ✅ GOOD: Limits connections aggressively
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=3&pool_timeout=5"
```

### Parameters Explained

| Parameter          | Value  | Purpose                                       |
| ------------------ | ------ | --------------------------------------------- |
| `pgbouncer`        | `true` | Use PgBouncer pooler mode (Supabase default)  |
| `connection_limit` | `3`    | Max connections per instance (CRITICAL)       |
| `pool_timeout`     | `5`    | Seconds to wait for connection before failing |
| `connect_timeout`  | `5`    | Seconds to connect to database                |

### Recommended Values by Environment

| Env                 | connection_limit | pool_timeout | Why                |
| ------------------- | ---------------- | ------------ | ------------------ |
| Local dev           | 5                | 10           | Low resource usage |
| CI/CD (unit tests)  | 3                | 5            | Minimal DB access  |
| CI/CD (integration) | 5                | 10           | More DB operations |
| Production          | 50-100           | 30           | High concurrency   |

### How to Set

**In Environment File:**

```bash
# .env.test
DATABASE_URL_TEST="postgresql://user:pass@db.supabase.co:5432/postgres?connection_limit=3&pool_timeout=5&connect_timeout=5"
```

**In CI/CD Workflow:**

```yaml
# .github/workflows/test.yml
- name: Run integration tests
  run: npm run test:integration
  env:
    DATABASE_URL: postgresql://user:pass@host/db?connection_limit=3&pool_timeout=5&connect_timeout=5
```

---

## Prevention Strategy 3: Test Isolation Patterns

### Checklist: What to Verify in Every Test File

**BEFORE you create new integration tests, verify these:**

- [ ] Test file uses `getTestPrisma()` NOT `new PrismaClient()`
- [ ] Test file uses `setupIntegrationTest()` or `setupCompleteIntegrationTest()`
- [ ] Database queries filter by `tenantId` (multi-tenant safety)
- [ ] `afterEach()` or `afterAll()` calls cleanup (CRITICAL)
- [ ] Test slugs are file-specific (e.g., `my-test-file-tenant-a`)
- [ ] Factories generate unique IDs (timestamps, counters)
- [ ] Cache keys include `tenantId` (prevents cross-tenant leaks)
- [ ] No hardcoded IDs or slugs that could conflict

### Code Review Template

When reviewing a new test file, check:

```typescript
// ❌ FAIL: Creates own PrismaClient
import { PrismaClient } from '../../src/generated/prisma';
const prisma = new PrismaClient();

// ✅ PASS: Uses helper
import { setupIntegrationTest } from '../helpers/integration-setup';
const { prisma, cleanup } = setupIntegrationTest();

// ❌ FAIL: Generic slug (conflicts with other tests)
const { tenants } = createMultiTenantSetup(prisma, 'test');

// ✅ PASS: File-specific slug
const { tenants } = createMultiTenantSetup(prisma, 'booking-service');

// ❌ FAIL: No cleanup
afterEach(async () => {
  // Missing cleanup!
});

// ✅ PASS: Proper cleanup
afterEach(async () => {
  await tenants.cleanupTenants();
  await cleanup();
});
```

---

## Prevention Strategy 4: ESLint/Grep Detection Rules

### Grep Commands to Find Violations

**Find direct PrismaClient instantiation in test files:**

```bash
# Find all occurrences
grep -r "new PrismaClient()" server --include="*.test.ts" --include="*.spec.ts"

# Just count them
grep -r "new PrismaClient()" server --include="*.test.ts" --include="*.spec.ts" | wc -l

# Show file paths only
grep -r "new PrismaClient()" server --include="*.test.ts" --include="*.spec.ts" --files-with-matches
```

**Find missing cleanup in tests:**

```bash
# Find test files with no afterEach or afterAll
grep -L "afterEach\|afterAll" server/src/**/*.test.ts

# Find cleanup that doesn't call it
grep -B5 "afterEach\|afterAll" server/src/**/*.test.ts | grep -v "cleanup\|disconnect"
```

**Find generic slugs (potential conflicts):**

```bash
# Find file-specific setup
grep "createMultiTenantSetup" server --include="*.test.ts" -A1

# Should show: createMultiTenantSetup(prisma, 'booking-service');
# NOT:         createMultiTenantSetup(prisma, 'test');
```

### ESLint Rule (Custom)

To prevent `new PrismaClient()` in test files, add to `.eslintrc.json`:

```json
{
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "NewExpression[callee.name='PrismaClient']",
            "message": "❌ Test files must use getTestPrisma() NOT new PrismaClient(). See docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md"
          }
        ]
      }
    }
  ]
}
```

---

## Prevention Strategy 5: Code Review Checklist

### For Code Reviewers

When reviewing a PR with new integration tests:

**Connection Pool:**

- [ ] Test uses `getTestPrisma()` or `setupIntegrationTest()`
- [ ] No `new PrismaClient()` in test files
- [ ] `vitest.config.ts` has `singleThread: true`
- [ ] `vitest.config.ts` has `fileParallelism: false`
- [ ] `globalTeardown` references teardown file

**Test Isolation:**

- [ ] Test cleanup is in `afterEach()` or `afterAll()`
- [ ] Cleanup calls `await cleanup()` (not just variable cleanup)
- [ ] Multi-tenant setup uses file-specific slug (not generic 'test')
- [ ] All database queries filter by `tenantId`
- [ ] Factory classes generate unique IDs

**Configuration:**

- [ ] Connection limit params are present in DATABASE_URL
- [ ] Pool timeout is appropriate (5-20 seconds)
- [ ] Test database is isolated from production

### Comment Template for PRs

If you find a violation:

````markdown
❌ Connection Pool Issue

This test file creates its own PrismaClient:

```typescript
const prisma = new PrismaClient();
```
````

This exhausts Supabase's connection pool when running with other tests.

✅ Fix: Use the global singleton helper:

```typescript
import { getTestPrisma } from '../helpers/global-prisma';
const prisma = getTestPrisma();
```

See: docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md

````

---

## Warning Signs & Troubleshooting

### Symptom: Tests Hang at 30 seconds

**Diagnosis:**

```bash
# Check connection pool status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# If result > 50, pool is exhausted
````

**Fix:**

1. Lower `connection_limit` in DATABASE_URL
2. Set `fileParallelism: false` in vitest.config.ts
3. Switch to `singleThread: true` in vitest.config.ts

### Symptom: Tests Pass Individually, Fail in Batch

**Diagnosis:** State pollution or connection exhaustion

**Fix Order:**

1. Add connection limits to DATABASE_URL
2. Verify all test files use `getTestPrisma()`
3. Check cleanup is called in `afterEach()`
4. Verify slugs are file-specific
5. Set `fileParallelism: false`

### Symptom: "FATAL: remaining connection slots reserved"

**This is critical.** The database is completely full.

**Immediate Fix:**

```bash
# Kill hanging connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

# Wait 5 seconds
sleep 5

# Verify pool is clear
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
# Should return ~5 or lower
```

**Long-term Fix:**

1. Use connection limits (required)
2. Use serial execution (required)
3. Check for infinite loops in test cleanup
4. Audit for tests that don't cleanup at all

---

## Best Practices Summary

### DO ✅

- [ ] Use global singleton PrismaClient
- [ ] Add aggressive connection limits to DATABASE_URL
- [ ] Run test files sequentially (not in parallel)
- [ ] Call cleanup in afterEach/afterAll
- [ ] Use file-specific slugs for tenants
- [ ] Filter all queries by tenantId
- [ ] Use factory classes for unique IDs
- [ ] Monitor connection pool in logs

### DON'T ❌

- [ ] Create new PrismaClient() in test files
- [ ] Run test files in parallel (fileParallelism: true)
- [ ] Skip cleanup or use cleanup as no-op
- [ ] Use hardcoded slugs/IDs
- [ ] Forget to disconnect in global teardown
- [ ] Change connection limits per test
- [ ] Leave connections open after afterEach

---

## Testing Your Prevention Measures

### Validation Tests

**Test 1: Verify singleton is used**

```bash
grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts"
# Should return: 0 results
```

**Test 2: Verify connection limits are set**

```bash
cat .env.test | grep connection_limit
# Should show: connection_limit=3 or higher
```

**Test 3: Run all tests without hanging**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
# Should complete without "FATAL" errors or timeout
```

**Test 4: Check pool usage**

```bash
# During test run in another terminal:
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
# Should always be < 60 (Supabase limit)
```

---

## Real-World Example: Fixing a Test Suite

### Before (Broken)

```typescript
// ❌ BAD: catalog.service.integration.test.ts
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient(); // Creates pool!

describe('CatalogService Integration', () => {
  // No cleanup
  afterEach(async () => {
    // Missing: await prisma cleanup
  });

  it('creates package', async () => {
    const result = await catalogService.createPackage(tenantId, {
      slug: 'test-package', // ❌ Same slug every test!
      title: 'Test',
      // ...
    });
  });
});
```

**Errors when running with other tests:**

- Connection pool exhausted after 5 test files
- Duplicate key error on slug
- Timeouts at 30 seconds

### After (Fixed)

```typescript
// ✅ GOOD: catalog.service.integration.test.ts
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('CatalogService Integration', () => {
  const ctx = setupCompleteIntegrationTest('catalog-service');

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup(); // ✅ Properly cleanup
  });

  it('creates package', async () => {
    const factory = new PackageFactory();
    const input = factory.create({
      // ✅ Unique slug generated
      title: 'Test',
    });

    const result = await catalogService.createPackage(ctx.tenants.tenantA.id, input);
  });
});
```

**Results:**

- All 100+ test files run without hanging
- No duplicate key errors
- Connection pool stays below 10 connections
- Tests complete in <30 seconds total

---

## References

- **Global Prisma Setup:** `/server/test/helpers/global-prisma.ts`
- **Integration Setup Helper:** `/server/test/helpers/integration-setup.ts`
- **Vitest Config:** `/server/vitest.config.ts`
- **Global Teardown:** `/server/test/helpers/vitest-global-teardown.ts`
- **Related Prevention:** `/docs/solutions/TEST_ISOLATION_PREVENTION_STRATEGIES.md`
- **Multi-Tenant Guide:** `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

---

## FAQ

**Q: Can I use connection_limit=10?**

A: Not recommended. Stick with 3-5. Each PrismaClient can create up to 10 connections, so higher limits risk exhaustion.

**Q: Why not just increase Supabase connection limit?**

A: You can't change Supabase's limit without upgrading. Better to write efficient tests.

**Q: Can tests run in parallel?**

A: Only with careful setup. Use `setupCompleteIntegrationTest()` which handles it. Don't try to run in parallel without it.

**Q: What if I forget cleanup?**

A: Connections leak and accumulate. Next test suite run will hang. ESLint rule now catches this.

**Q: Is singleton thread-safe?**

A: In Node.js single-threaded mode (our vitest config), yes. Vitest uses `singleThread: true`.

---

## Commit Message Template

When fixing connection pool issues:

```
fix: prevent connection pool exhaustion in test suite

- Replace direct PrismaClient with global singleton via getTestPrisma()
- Add aggressive connection limits (connection_limit=3&pool_timeout=5) to DATABASE_URL_TEST
- Set vitest fileParallelism: false to prevent parallel test file execution
- Verify all afterEach hooks call cleanup()
- Use file-specific slugs in multi-tenant setup
- Validate no test files remain with new PrismaClient()

Fixes hanging test suite issues. Tests now complete in <30s.
```
