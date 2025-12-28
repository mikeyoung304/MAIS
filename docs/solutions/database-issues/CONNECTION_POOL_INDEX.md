# Connection Pool Exhaustion Prevention Index

**Complete reference for preventing and fixing Supabase connection pool exhaustion in test suites.**

---

## Quick Navigation

**First time here?** Start with: **[Quick Checklist](CONNECTION_POOL_QUICK_CHECKLIST.md)** (2 minutes)

**Writing tests?** Use: **[Code Examples](CONNECTION_POOL_CODE_EXAMPLES.md)** (copy-paste ready)

**Reviewing PRs?** Use: **[Detection Patterns](CONNECTION_POOL_DETECTION_PATTERNS.md)** (grep commands)

**Deep dive?** Read: **[Prevention Strategy](CONNECTION_POOL_EXHAUSTION_PREVENTION.md)** (comprehensive)

---

## The Problem in 30 Seconds

Each test file that creates `new PrismaClient()` opens 10+ connections.

Running 10 test files in parallel = 100+ connections.

Supabase Session mode supports ~60 connections.

**Result:** Tests hang or timeout. 💥

**Solution:** Use a global singleton PrismaClient shared by all tests.

---

## Documentation Map

### Core Documents

| Document                                                        | Duration | Purpose                       |
| --------------------------------------------------------------- | -------- | ----------------------------- |
| [Quick Checklist](CONNECTION_POOL_QUICK_CHECKLIST.md)           | 2 min    | Before writing tests          |
| [Code Examples](CONNECTION_POOL_CODE_EXAMPLES.md)               | 10 min   | Copy-paste implementations    |
| [Detection Patterns](CONNECTION_POOL_DETECTION_PATTERNS.md)     | 5 min    | Find violations (grep/ESLint) |
| [Prevention Strategy](CONNECTION_POOL_EXHAUSTION_PREVENTION.md) | 30 min   | Full explanation              |

### Quick Reference

```
Before Writing Tests
└─ Read: Quick Checklist (2 min)
   └─ Have file-specific slug (e.g., "booking-service")
   └─ Plan to use setupCompleteIntegrationTest()
   └─ Plan afterEach cleanup

Writing Tests
└─ Use: Code Examples (10 min)
   └─ Copy ✅ GOOD example
   └─ Avoid ❌ BAD patterns
   └─ Use factory classes

Reviewing PRs
└─ Use: Detection Patterns (5 min)
   └─ Run grep commands
   └─ Check ESLint rule
   └─ Verify cleanup in afterEach

Deep Dive
└─ Read: Prevention Strategy (30 min)
   └─ Why this happens (math)
   └─ 5 prevention strategies
   └─ Real-world fixes
   └─ FAQ & troubleshooting
```

---

## 5-Minute Quick Start

### Step 1: Understand the Issue

```
❌ WRONG (exhausts pool):
for each test file:
  const prisma = new PrismaClient() // 10+ connections
  // If 10 files run parallel: 100+ connections!
  // Database limit: 60
  // Result: POOL EXHAUSTED

✅ RIGHT (singleton):
const globalPrisma = new PrismaClient() // 3 connections total
for each test file:
  const prisma = getTestPrisma() // Reuse global
  // No matter how many files: always 3 connections
  // Result: SAFE ✅
```

### Step 2: Update Configuration

**In `.env.test`:**

```bash
DATABASE_URL_TEST="postgresql://user:pass@host/db?connection_limit=3&pool_timeout=5&connect_timeout=5"
```

**In `vitest.config.ts`:**

```typescript
export default defineConfig({
  test: {
    poolOptions: { threads: { singleThread: true } }, // Add this
    fileParallelism: false, // Add this
    globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],
  },
});
```

### Step 3: Write Tests

```typescript
// Use this pattern for ALL integration tests
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe('My Tests', () => {
  const ctx = setupCompleteIntegrationTest('my-service');

  beforeEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    await ctx.cleanup();
  });

  it('should work', async () => {
    // Test code
  });
});
```

### Step 4: Validate

```bash
# No violations found?
grep -r "new PrismaClient()" server/src --include="*.test.ts" | wc -l
# Should output: 0

# Tests complete without hanging?
npm test
# Should complete in < 30 seconds total
```

---

## Common Scenarios

### Scenario 1: You're Writing a New Test File

1. Open [Code Examples](CONNECTION_POOL_CODE_EXAMPLES.md)
2. Copy ✅ GOOD example (e.g., `BookingService.test.ts`)
3. Update: Change `'booking-service'` to your file name
4. Run `npm test` to verify

**Time: 5 minutes**

### Scenario 2: You Found a Failing Test

1. Check error message for "connection pool", "FATAL", or "timeout"
2. Open [Prevention Strategy](CONNECTION_POOL_EXHAUSTION_PREVENTION.md) → Troubleshooting
3. Follow debugging steps
4. Apply fixes

**Time: 10-15 minutes**

### Scenario 3: You're Reviewing a PR with New Tests

1. Run grep commands from [Detection Patterns](CONNECTION_POOL_DETECTION_PATTERNS.md)
2. Check for:
   - ✅ No `new PrismaClient()`
   - ✅ afterEach has cleanup
   - ✅ File-specific slug
   - ✅ Factories for unique IDs
3. Use comment template to report findings

**Time: 2 minutes**

### Scenario 4: You Need to Debug Connection Pool

1. Run monitoring script from [Detection Patterns](CONNECTION_POOL_DETECTION_PATTERNS.md)
2. Check connection count during tests: `psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"`
3. If > 50: Kill hung connections and re-run
4. Review [Prevention Strategy](CONNECTION_POOL_EXHAUSTION_PREVENTION.md) → Warning Signs

**Time: 15-30 minutes**

---

## Checklists by Role

### Test Writer

- [ ] Read: Quick Checklist (2 min)
- [ ] Use: Code Examples ✅ GOOD pattern
- [ ] Use: `setupCompleteIntegrationTest('my-service')`
- [ ] Add: `beforeEach` with tenant setup
- [ ] Add: `afterEach` with cleanup
- [ ] Use: Factory classes for unique IDs
- [ ] Verify: All queries filter by `tenantId`

### Code Reviewer

- [ ] Read: Detection Patterns (grep commands)
- [ ] Run: Grep for `new PrismaClient()` violations
- [ ] Check: afterEach calls cleanup
- [ ] Check: File-specific slug (not generic 'test')
- [ ] Check: tenantId filtering in queries
- [ ] Report: Use comment template

### DevOps/CI Engineer

- [ ] Set: CONNECTION_LIMIT=3 in CI environment
- [ ] Verify: vitest has `singleThread: true`
- [ ] Verify: vitest has `fileParallelism: false`
- [ ] Monitor: Connection pool during test runs
- [ ] Alert: If connections exceed 50

---

## Files Referenced

### Implementation Files

- `/server/test/helpers/global-prisma.ts` - Singleton instance
- `/server/test/helpers/integration-setup.ts` - Setup helpers
- `/server/test/helpers/vitest-global-teardown.ts` - Cleanup
- `/server/vitest.config.ts` - Vitest configuration

### Example Test Files

- `/server/src/services/booking.service.test.ts` - ✅ GOOD example
- `/server/src/services/catalog.service.integration.test.ts` - ❌ BAD → FIXED example

### Configuration Files

- `.env.test` - Connection limits
- `.eslintrc.json` - ESLint rules (add restriction)
- `.husky/pre-commit` - Pre-commit hook (optional)

---

## Key Learnings

### Learning 1: Why Singleton Works

```
10 test files × 10 connections each = 100+ connections
                 ↓
But with singleton:
10 test files × 1 shared PrismaClient = 3-5 connections
```

### Learning 2: Connection Limit Parameters

```
connection_limit=3      ← Max connections per instance
pool_timeout=5          ← Wait max 5s for available connection
connect_timeout=5       ← Spend max 5s establishing connection

Strict limits = fail fast instead of hanging indefinitely
```

### Learning 3: Test Isolation Depends On

1. **Singleton** - Same PrismaClient instance (connection limit)
2. **Sequential Execution** - `fileParallelism: false` (prevents race conditions)
3. **Cleanup** - `afterEach` cleanup (prevents state pollution)
4. **Unique IDs** - Factories generate unique slugs (prevents duplicate key errors)
5. **Tenant Scoping** - Filter all queries by `tenantId` (prevents cross-tenant leaks)

Missing any one = tests will fail or hang.

### Learning 4: What Doesn't Work

❌ Just increasing connection limits (band-aid fix)
❌ Running tests serially in CI only (local devs still have issues)
❌ Cleanup without singleton (still uses too many connections)
❌ Singleton without cleanup (leaks connections)
❌ Using different Prisma instances per test file (defeats purpose)

**All 5 strategies required together.**

---

## Troubleshooting Flowchart

```
Tests hang at 30 seconds?
├─ Run: grep -r "new PrismaClient()" server/src --include="*.test.ts"
│  ├─ Found violations?
│  │  ├─ YES → Fix: Use getTestPrisma() instead
│  │  │        Read: Code Examples
│  │  └─ NO → Continue to next check
│  │
│  └─ Check: Pool status during test
│     ├─ psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
│     ├─ Count > 50?
│     │  ├─ YES → Kill connections, check vitest.config.ts
│     │  └─ NO → Check afterEach cleanup
│     │
│     └─ afterEach properly cleanup?
│        ├─ Missing cleanup?
│        │  └─ Add: await ctx.cleanup()
│        └─ Has cleanup?
│           ├─ Check: connection_limit=3 in DATABASE_URL
│           └─ Check: singleThread: true in vitest.config.ts
```

---

## Success Criteria

After implementing prevention, verify:

- ✅ `npm test` completes in < 30 seconds
- ✅ No "connection pool exhausted" errors
- ✅ No "FATAL: remaining connection slots" errors
- ✅ Connection count stays < 10 during tests (monitor via psql)
- ✅ 0 violations: `grep -r "new PrismaClient()" server/src --include="*.test.ts"`
- ✅ 100% cleanup: All test files have `afterEach` with cleanup
- ✅ No generic slugs: No `createMultiTenantSetup(prisma, 'test')`

---

## Related Documentation

- **Test Isolation Strategies:** `/docs/solutions/TEST_ISOLATION_PREVENTION_STRATEGIES.md`
- **Multi-Tenant Guide:** `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
- **Quality Prevention Index:** `/docs/solutions/PREVENTION-STRATEGIES-INDEX.md`

---

## FAQ

**Q: Can I use a different connection pool size?**
A: `connection_limit=3-5` is recommended. Higher risks exhaustion; lower may cause timeouts.

**Q: Does this apply to unit tests?**
A: No. Unit tests use mocks, not real database. This is for integration tests only.

**Q: Can I run tests in parallel?**
A: Not recommended. Set `fileParallelism: false` in vitest.config.ts.

**Q: What if I have 100 test files?**
A: Singleton pattern scales to any number of files (we have 100+).

**Q: Is this production-ready?**
A: This pattern is MAIS production standard. All 771+ tests use it.

---

## Quick Links

- [Quick Checklist](CONNECTION_POOL_QUICK_CHECKLIST.md) - Start here
- [Code Examples](CONNECTION_POOL_CODE_EXAMPLES.md) - Copy-paste
- [Detection Patterns](CONNECTION_POOL_DETECTION_PATTERNS.md) - Grep commands
- [Prevention Strategy](CONNECTION_POOL_EXHAUSTION_PREVENTION.md) - Deep dive
- [Issue Report](/docs/solutions/database-issues/) - Browse all database solutions
