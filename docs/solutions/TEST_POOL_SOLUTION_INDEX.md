---
title: Test Connection Pool Solution - Complete Index
category: database-issues
tags: [index, test-infrastructure, prisma, pgbouncer, supabase]
component: server/test
---

# Test Connection Pool Solution - Complete Index

**Complete extraction of the connection pool exhaustion fix from commit 166d902**

---

## Documentation Map

### Quick Start (5 minutes)

1. **TEST_POOL_QUICK_REFERENCE.md** (6.5 KB, 229 lines)
   - 30-second problem/solution overview
   - Visual diagram of the solution
   - Before/after code patterns
   - Common fixes lookup table
   - One-liner validation commands
   - **Use when:** You need quick answers, doing code review, or learning the pattern

### Deep Dive (30 minutes)

2. **TEST_CONNECTION_POOL_EXHAUSTION_SOLUTION.md** (20 KB, 707 lines)
   - Executive summary
   - Technical root cause analysis
   - Complete solution architecture
   - Connection pool parameters explained
   - Results and performance metrics
   - Monitoring and debugging
   - Common issues with solutions
   - Migration checklist
   - **Use when:** You want to understand the problem deeply, implement in new project, or train others

### Implementation (2 hours)

3. **TEST_POOL_IMPLEMENTATION_GUIDE.md** (13 KB, 556 lines)
   - 6-phase step-by-step walkthrough
   - Copy-paste code for all files
   - Bulk migration script
   - Verification checklist
   - Success metrics
   - Troubleshooting procedures
   - **Use when:** Implementing this pattern from scratch, training new developers, or migrating another project

---

## The Problem (30 seconds)

```
22 test files × 1 new PrismaClient per file = 22 connections
Supabase pool has ~60 connections total
Result: Pool exhausted → Tests hang indefinitely → No error message
```

---

## The Solution (30 seconds)

```
Create one shared PrismaClient singleton
All 22 test files use: getTestPrisma()
Result: 1-3 concurrent connections, ~12 min runtime
```

---

## Key Code Changes

### New Files

**`server/test/helpers/global-prisma.ts`** (92 lines)

- Singleton factory function
- Connection limit: 3, timeout: 5s
- Process cleanup on exit

**`server/test/helpers/vitest-global-teardown.ts`** (15 lines)

- Global teardown hook
- Runs after all tests complete
- Disconnects singleton

### Modified Files

**`server/vitest.config.ts`**

```typescript
test: {
  fileParallelism: false,        // One file at a time
  poolOptions: { threads: { singleThread: true } },
  testTimeout: 30000,            // Fail fast
  globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],
}
```

**All test files in `server/test/`**

```typescript
// Before: const prisma = new PrismaClient();
// After:  const prisma = getTestPrisma();
// Also:   Remove afterAll(...$disconnect())
```

---

## Results

| Metric      | Before               | After   | Improvement   |
| ----------- | -------------------- | ------- | ------------- |
| Duration    | 20-30+ min (hanging) | ~12 min | 2.5-3x faster |
| Tests       | 1,178                | 1,178   | Same          |
| Connections | 22+ concurrent       | 3 max   | 7x reduction  |
| Memory      | 1.1 GB               | 50 MB   | 95% reduction |
| Pool errors | Frequent             | 0       | 100% fixed    |

---

## Implementation Checklist

### Phase 1: Create Helpers (20 min)

- [ ] Create `test/helpers/global-prisma.ts`
- [ ] Create `test/helpers/vitest-global-teardown.ts`

### Phase 2: Configure Vitest (15 min)

- [ ] Update `vitest.config.ts` with globalTeardown
- [ ] Add fileParallelism: false
- [ ] Add singleThread: true
- [ ] Add timeouts (30s test, 10s hooks)

### Phase 3: Update Tests (1 hour)

- [ ] Find all: `grep -r "new PrismaClient" test/`
- [ ] Update all test files with getTestPrisma()
- [ ] Remove afterAll disconnect calls

### Phase 4: Configure Environment (10 min)

- [ ] Update DATABASE_URL with connection_limit=3
- [ ] Add pool_timeout=5, connect_timeout=5

### Phase 5: Verify (15 min)

- [ ] npm test completes successfully
- [ ] Check duration (should be < 15 min)
- [ ] Verify no "MaxClientsInSessionMode" errors

---

## Verification Commands

```bash
# Check no old pattern remains
grep -r "new PrismaClient" server/test

# Should be empty!
# If it finds anything, that file needs updating

# Check all tests use singleton
grep -r "getTestPrisma" server/test | wc -l

# Should match your test file count

# Run tests
time npm test

# Should complete in < 15 minutes for 1000+ tests
```

---

## Quick Troubleshooting

### Tests Still Hanging

1. Check for `new PrismaClient` in test files
2. Verify `fileParallelism: false` in vitest.config.ts
3. Verify `singleThread: true` in poolOptions
4. Check DATABASE_URL has `connection_limit=3`

### Pool Errors ("MaxClientsInSessionMode")

This means someone created a new PrismaClient:

```bash
grep -r "new PrismaClient" server/test
```

### Process Won't Exit

Check global teardown is configured:

```bash
npm test 2>&1 | grep "Global teardown"
```

Should see:

```
[vitest] Global teardown: disconnecting Prisma...
[vitest] Global teardown complete
```

---

## Files Modified in Original Commit

**Commit:** 166d902e18d6f83bc3d6a59742599f650a7182ce

### Created (2 files)

- server/test/helpers/global-prisma.ts
- server/test/helpers/vitest-global-teardown.ts

### Modified (3 files + 22 test files)

- server/vitest.config.ts
- server/test/helpers/integration-setup.ts
- .env (DATABASE_URL parameters)
- 22 test files (use getTestPrisma)

### Bonus Cleanup

- 5 React hooks violations fixed
- 68 unused variable errors fixed
- ESLint configuration updated

---

## For Different Audiences

### I'm a Developer

**Start here:** TEST_POOL_QUICK_REFERENCE.md

Read the:

- 30-second problem explanation
- Before/after code
- Quick checklist
- Debug commands

Keep at your desk for daily reference.

---

### I'm a Tech Lead

**Start here:** TEST_CONNECTION_POOL_EXHAUSTION_SOLUTION.md

Review the:

- Root cause analysis
- Solution architecture
- Results and metrics
- Monitoring procedures
- Prevention strategies

Share with team during technical discussions.

---

### I'm Implementing This

**Start here:** TEST_POOL_IMPLEMENTATION_GUIDE.md

Follow the:

- 6-phase walkthrough
- Copy-paste code blocks
- Migration script
- Verification checklist
- Troubleshooting section

Complete in ~2 hours, phase by phase.

---

### I'm Reviewing Code

**Quick checklist:**

```bash
# All test files should use this:
grep -r "getTestPrisma" test/

# None should have this:
grep -r "new PrismaClient" test/
grep -r "afterAll.*disconnect" test/
```

**Configuration should have:**

- vitest.config.ts: fileParallelism: false
- vitest.config.ts: singleThread: true
- DATABASE_URL: connection_limit=3

---

## Key Concepts

### Singleton Pattern

One shared instance instead of many:

```typescript
// ❌ Bad (22 instances)
const prisma = new PrismaClient();

// ✅ Good (1 shared instance)
const prisma = getTestPrisma();
```

### Serial Execution

One test file at a time, not parallel:

```typescript
// vitest.config.ts
fileParallelism: false; // Sequential, not parallel
singleThread: true; // Single thread, not thread pool
```

### Connection Limits

Aggressive limits prevent exhaustion:

```
connection_limit=3      // Max 3 concurrent queries
pool_timeout=5         // Fail if no connection in 5s
connect_timeout=5      // Don't wait forever for TCP
```

### Global Teardown

Cleanup happens once after all tests:

```typescript
// vitest.config.ts
globalTeardown: ['./test/helpers/vitest-global-teardown.ts'];

// This runs AFTER all tests complete
// Disconnects the singleton PrismaClient
```

---

## Performance Targets

After implementation, you should see:

- **Duration:** ~12 minutes for 1,000+ tests
- **Memory:** ~50 MB (stable, no bloat)
- **Pool usage:** 3/60 connections (5%)
- **Errors:** 0 "MaxClientsInSessionMode"
- **Success rate:** 99%+ tests passing

---

## Related Documentation

- [Supabase Connection Pooling](https://supabase.com/docs/guides/platform/connection-pooling-serverless)
- [Prisma Connection Management](https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismaclient)
- [Vitest Global Setup/Teardown](https://vitest.dev/config/#globalsetup)
- [Project Testing Strategy](/TESTING.md)
- [Database Setup Guide](/docs/setup/SUPABASE.md)

---

## Prevention Going Forward

### Code Review Checklist

- [ ] New test files use getTestPrisma()
- [ ] No `new PrismaClient()` in test directory
- [ ] No `afterAll(...$disconnect())` calls
- [ ] DATABASE_URL includes connection limits

### CI Validation

Add to your CI pipeline:

```bash
# Prevent regressions
grep -r "new PrismaClient" server/test && exit 1 || true
grep -r "afterAll.*disconnect" server/test && exit 1 || true
```

### Monitoring

Monthly checks:

- Test duration (should stay < 15 min)
- Memory usage (should stay < 100 MB)
- Pool error count (should be 0)

---

## Questions?

### Q: Why can't I use new PrismaClient in tests?

A: Each client takes 1+ connections. With 22 test files × 1 client each = 22 connections, exhausting Supabase's pool (~60 total).

### Q: Doesn't one shared client cause test pollution?

A: No. Prisma doesn't cache query results by default. Each query is fresh. Tests should clean up their own data in `afterEach()`.

### Q: Can I run tests in parallel?

A: Only if you increase connection_limit significantly (5-10). Current setup assumes serial execution for resource efficiency.

### Q: What if tests are still slow?

A: Profile first. Usually it's the database operations, not the pooling. Look at query time with `DEBUG_PRISMA=true npm test`.

### Q: Do I need to change my test logic?

A: No. Replace `new PrismaClient()` with `getTestPrisma()` and remove disconnect calls. Everything else stays the same.

---

## Implementation Timeline

| Phase | Time     | What                     |
| ----- | -------- | ------------------------ |
| 1     | 20 min   | Create singleton helpers |
| 2     | 15 min   | Update vitest config     |
| 3     | 1 hour   | Update test files        |
| 4     | 10 min   | Configure DATABASE_URL   |
| 5     | 15 min   | Test and measure         |
| 6     | variable | Troubleshoot if needed   |

**Total: 2 hours for greenfield project**

---

## Summary

| Item       | Details                                                        |
| ---------- | -------------------------------------------------------------- |
| Problem    | Tests hanging due to connection pool exhaustion                |
| Root Cause | 22 test files × 1 new PrismaClient = 22 concurrent connections |
| Solution   | Global singleton with serial execution                         |
| Result     | 1,178 tests in ~12 minutes                                     |
| Status     | Implemented & verified in production                           |
| Commit     | 166d902e18d6f83bc3d6a59742599f650a7182ce                       |

---

## Next Steps

1. **Quick Review:** Read TEST_POOL_QUICK_REFERENCE.md (5 min)
2. **Understanding:** Read TEST_CONNECTION_POOL_EXHAUSTION_SOLUTION.md (20 min)
3. **Implementation:** Follow TEST_POOL_IMPLEMENTATION_GUIDE.md (2 hours)
4. **Verification:** Run verification commands above
5. **Maintenance:** Review code review checklist before pushing

---

**These three documents provide everything needed to understand, implement, and maintain this solution across any team or project.**
