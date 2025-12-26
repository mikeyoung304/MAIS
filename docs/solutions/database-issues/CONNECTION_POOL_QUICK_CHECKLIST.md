# Connection Pool Exhaustion: Quick Checklist

**Use this 2-minute checklist before every new test file.**

---

## Pre-Development Checklist

Before writing integration tests:

- [ ] Read `/docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md`
- [ ] Have `.env.test` with connection limits set
- [ ] Know your test file's unique slug (e.g., `my-booking-service`)

---

## Test File Creation Checklist

As you write tests:

**Imports:**
```typescript
// ✅ DO use these
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { getTestPrisma } from '../helpers/global-prisma';

// ❌ DON'T use these
import { PrismaClient } from '../../src/generated/prisma';
// new PrismaClient() anywhere in file
```

**Setup:**
```typescript
describe('My Service', () => {
  // ✅ Required
  const ctx = setupCompleteIntegrationTest('my-service-name');

  beforeEach(async () => {
    // ✅ Create fresh tenants
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
  });

  afterEach(async () => {
    // ✅ CRITICAL: Always cleanup
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup();
  });
});
```

**Data Creation:**
```typescript
// ✅ Use factories (generate unique IDs)
const factory = new PackageFactory();
const pkg = factory.create({ title: 'Test' });

// ❌ Hardcoded slugs (conflict with parallel tests)
const pkg = { slug: 'test-package', title: 'Test' };
```

**Queries:**
```typescript
// ✅ Filter by tenantId
const packages = await prisma.package.findMany({
  where: { tenantId: ctx.tenants.tenantA.id },
});

// ❌ Missing tenantId (security + test isolation issue)
const packages = await prisma.package.findMany({
  where: { active: true },
});
```

---

## Code Review Checklist

When reviewing PR with tests:

**Connection Pool:**
- [ ] No `new PrismaClient()` in test files
- [ ] Uses `getTestPrisma()` or `setupIntegrationTest()`
- [ ] Vitest config has `singleThread: true` + `fileParallelism: false`

**Test Isolation:**
- [ ] `afterEach()` has `await cleanup()`
- [ ] Multi-tenant setup uses file-specific slug
- [ ] Factory generates unique IDs (not hardcoded slugs)
- [ ] All DB queries filter by `tenantId`

**Configuration:**
- [ ] DATABASE_URL has `connection_limit=3`
- [ ] DATABASE_URL has `pool_timeout=5`
- [ ] No hardcoded database URLs in tests

---

## Grep Commands (Copy-Paste)

**Check for violations:**

```bash
# Find any new PrismaClient() in tests
grep -r "new PrismaClient()" server/src --include="*.test.ts" --include="*.spec.ts"

# Find test files with no cleanup
grep -L "afterEach\|afterAll" server/src/**/*.test.ts

# Find generic slugs (potential conflicts)
grep "createMultiTenantSetup.*'test'" server/src --include="*.test.ts"

# Count total test files
find server/src -name "*.test.ts" -o -name "*.spec.ts" | wc -l
```

---

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `new PrismaClient()` | Exhausts pool | Use `getTestPrisma()` |
| No `afterEach` cleanup | Leaks connections | Add `await cleanup()` |
| Generic slug `'test'` | Conflicts when parallel | Use `'booking-service'` |
| Hardcoded IDs | Duplicate key errors | Use factories |
| Missing `tenantId` filter | Test data pollution | Add `where: { tenantId }` |
| `connection_limit=10` | Still exhausts | Lower to `connection_limit=3` |

---

## Debugging Failing Tests

**Symptom: Tests hang at 30s**

```bash
# 1. Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
# If > 50, pool is exhausted

# 2. Kill hanging connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

# 3. Check for new PrismaClient() in tests
grep -r "new PrismaClient()" server/src --include="*.test.ts"

# 4. Verify connection limits in .env.test
cat .env.test | grep connection_limit
```

**Symptom: Tests pass alone, fail together**

1. [ ] Run grep command above (likely finding violations)
2. [ ] Check cleanup is called: `grep -B5 "afterEach" file.test.ts`
3. [ ] Verify file-specific slug: `createMultiTenantSetup(prisma, 'file-name')`
4. [ ] Check for hardcoded IDs in test data

---

## Quick Fixes

### Fix #1: Add Missing Imports

```typescript
// At top of test file
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

// Replace PrismaClient usage
const ctx = setupCompleteIntegrationTest('my-test-file');
// Then use: ctx.prisma instead of prisma
```

### Fix #2: Add Missing Cleanup

```typescript
afterEach(async () => {
  // Add this line
  await ctx.cleanup();
});
```

### Fix #3: Add Connection Limits

```bash
# In .env.test
DATABASE_URL_TEST="postgresql://...?connection_limit=3&pool_timeout=5&connect_timeout=5"
```

### Fix #4: Update Vitest Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        singleThread: true, // Add this
      },
    },
    fileParallelism: false, // Add this
  },
});
```

---

## Success Metrics

After implementing prevention:

✅ All 100+ test files run without hanging
✅ No "connection pool exhausted" errors
✅ Tests complete in < 30 seconds total
✅ Connection count stays < 10 during tests
✅ ESLint catches new violations

---

## File References

| File | Purpose |
|------|---------|
| `/server/test/helpers/global-prisma.ts` | Singleton PrismaClient |
| `/server/test/helpers/integration-setup.ts` | Test setup helpers |
| `/server/vitest.config.ts` | Vitest configuration |
| `/server/test/helpers/vitest-global-teardown.ts` | Global teardown |
| `/docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md` | Full guide |

---

## Still Having Issues?

1. Check the full guide: `/docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md`
2. Review working example: `/server/src/services/booking.service.test.ts`
3. Compare with bad example: `/server/src/services/catalog.service.integration.test.ts` (before fix)
4. Ask: "Is my test using the singleton? Is cleanup called?"
