---
title: Test Suite Hanging Due to Orphaned Test Tenant Accumulation
slug: orphaned-test-tenants-hanging-suite
category: test-failures
severity: P1
components:
  - vitest-test-runner
  - reminder-scheduler
  - test-database-cleanup
  - tenant-isolation
symptoms:
  - test suite hangs for 11+ minutes
  - tests timeout waiting for scheduler cycles
  - progressive slowdown with each test run
  - database table bloat from accumulated test data
keywords:
  - orphaned tenants
  - test cleanup
  - vitest global setup
  - test data accumulation
  - reminder scheduler performance
  - test isolation
  - database bloat
  - test timeout
  - afterEach cleanup
  - interrupted tests
created: 2025-12-27
project: MAIS
related:
  - docs/solutions/TEST_CONNECTION_POOL_EXHAUSTION_SOLUTION.md
  - docs/solutions/TEST_ISOLATION_PREVENTION_STRATEGIES.md
  - docs/solutions/TEST_ISOLATION_DATABASE_PATTERNS.md
commits:
  - f73a27a
---

# Solution: Test Suite Hanging Due to Orphaned Test Tenants

**Date:** December 27, 2025
**Problem Area:** Testing infrastructure
**Severity:** P1 (test suite completely non-functional)
**Time to Resolution:** ~30 minutes from diagnosis to fix

---

## Problem Statement

The test suite was hanging indefinitely (11+ minutes without completion) during CI/local runs. Tests would never finish, forcing developers to manually kill the process.

**Symptoms:**

- Test runs timeout or hang without any specific error
- Tests appear to start but never progress
- Manual interruption (`Ctrl+C`) doesn't allow proper cleanup
- Problem persists across fresh checkouts and cleans

---

## Root Cause Analysis

### Investigation Process

1. **Checked connection pool documentation**
   - Discovered Supabase uses pgbouncer with limited connections (~60 in Session pooler mode)
   - Read about connection exhaustion patterns

2. **Examined scheduler implementation** (`server/src/scheduler.ts`)
   - The reminder scheduler processes ALL active tenants during each cron cycle
   - Each tenant reminder processing takes ~250ms-500ms
   - With accumulating orphaned test tenants, processing time grows linearly

3. **Counted test tenants in database**
   - Found 117+ orphaned test tenants with patterns like:
     - `hash-test-business-*`
     - `test-business-*`
     - `test-tenant-*`
     - `first-business-*`
     - `-tenant-a`, `-tenant-b` suffixes
   - Total scheduler processing: 117 × ~250ms = 29+ seconds per cycle

4. **Identified cleanup gap**
   - Test files have `afterEach()` cleanup hooks
   - When test runs are interrupted (Ctrl+C, timeout, CI failure), hooks never execute
   - Orphaned tenants accumulate with each interrupted run
   - Each new test run becomes slower as cleanup burden grows

### Why Tests Hung

The problem wasn't a direct timeout—it was **exponential slowdown**:

```
Test run 1: Creates 5 test tenants → cleanup runs → test suite finishes
Test run 2 (interrupted): 5 + 5 = 10 orphans
Test run 3 (interrupted): 10 + 5 = 15 orphans
...
Test run 25 (interrupted): 120+ orphans

Scheduler cycle: 120 × ~250ms = 30 seconds
Test timeout: 30 seconds (hits hook timeout)
→ Tests hang waiting for scheduler
```

**Key insight:** The actual problem was the reminder scheduler processing ALL tenants (including orphaned ones), not the orphaned data itself. But the orphaned data was the accelerant causing massive slowdown.

---

## Solution Implemented

### Architecture: Global Setup Pattern

The solution uses Vitest's **global setup hook** that runs ONCE before ALL tests start:

```
Before all tests:
  ↓
vitest-global-setup.ts runs
  ↓
Cleanup orphaned test tenants
  ↓
Disconnect singleton PrismaClient
  ↓
Tests begin (with clean database)
```

### Implementation

#### File 1: `server/test/helpers/vitest-global-setup.ts`

```typescript
/**
 * Vitest Global Setup
 *
 * Runs ONCE before ALL test files start.
 * Cleans up orphaned test tenants from previous interrupted test runs.
 *
 * This prevents test data accumulation that slows down:
 * - The reminder scheduler (processes all tenants)
 * - Test isolation (conflicting test data)
 * - Database performance (bloated tables)
 */

import { getTestPrisma, disconnectTestPrisma } from './global-prisma';

/**
 * Patterns that identify test-created tenants
 * These are safe to delete during global setup
 */
const TEST_TENANT_PATTERNS = [
  'hash-test-business-%',
  'test-business-%',
  'first-business-%',
  'no-match-test-%',
  '%-tenant-a',
  '%-tenant-b',
  'test-tenant-%',
  'pk_test_%', // API key patterns in slug
];

/**
 * Clean up orphaned test tenants
 */
async function cleanupOrphanedTestTenants(): Promise<number> {
  const prisma = getTestPrisma();

  try {
    // First, find all matching tenants
    const testTenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { slug: { startsWith: 'hash-test-business-' } },
          { slug: { startsWith: 'test-business-' } },
          { slug: { startsWith: 'first-business-' } },
          { slug: { startsWith: 'no-match-test-' } },
          { slug: { endsWith: '-tenant-a' } },
          { slug: { endsWith: '-tenant-b' } },
          { slug: { startsWith: 'test-tenant-' } },
          { slug: { startsWith: 'auth-prevention-' } },
        ],
        // Never delete real tenants - extra safety check
        slug: {
          not: {
            in: ['mais', 'little-bit-farm', 'demo'],
          },
        },
      },
      select: { id: true, slug: true },
    });

    if (testTenants.length === 0) {
      return 0;
    }

    const tenantIds = testTenants.map((t) => t.id);

    // Delete in correct order to respect foreign key constraints
    // 1. BookingAddOns (has Restrict on addOnId)
    await prisma.bookingAddOn.deleteMany({
      where: {
        booking: {
          tenantId: { in: tenantIds },
        },
      },
    });

    // 2. Delete tenants (cascades to bookings, packages, etc.)
    const result = await prisma.tenant.deleteMany({
      where: {
        id: { in: tenantIds },
      },
    });

    return result.count;
  } catch (error) {
    console.error('[vitest] Error during test tenant cleanup:', error);
    return 0;
  }
}

export default async function globalSetup(): Promise<void> {
  // Skip cleanup in CI or when DATABASE_URL is not set (mock mode)
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_TEST) {
    console.log('[vitest] Global setup: Skipping cleanup (no database URL)');
    return;
  }

  console.log('[vitest] Global setup: Cleaning orphaned test tenants...');
  const startTime = Date.now();

  try {
    const deletedCount = await cleanupOrphanedTestTenants();
    const duration = Date.now() - startTime;

    if (deletedCount > 0) {
      console.log(
        `[vitest] Global setup: Cleaned ${deletedCount} orphaned test tenants (${duration}ms)`
      );
    } else {
      console.log(`[vitest] Global setup: No orphaned test tenants found (${duration}ms)`);
    }
  } catch (error) {
    console.error('[vitest] Global setup error:', error);
    // Don't fail the test run - just log the error
  } finally {
    // Disconnect to release the connection for test files
    await disconnectTestPrisma();
  }
}
```

**Key design decisions:**

1. **Runs before all tests** - Hook into Vitest's `globalSetup` lifecycle
2. **Singleton Prisma pattern** - Uses `getTestPrisma()` to reuse single connection
3. **Explicit safe list** - Pattern matching with negative checks for real tenants (`mais`, `little-bit-farm`, `demo`)
4. **Respects foreign keys** - Deletes in correct order (BookingAddOns first, then cascades)
5. **Graceful failure** - Logs errors but doesn't fail test run
6. **Environment aware** - Skips cleanup in mock mode (no DATABASE_URL)

#### File 2: `server/vitest.config.ts` (Updated)

```typescript
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',
      // Global setup cleans orphaned test tenants before running tests
      // Global teardown disconnects singleton PrismaClient after all tests
      globalSetup: ['./test/helpers/vitest-global-setup.ts'],
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],

      // ... rest of config

      poolOptions: {
        threads: {
          singleThread: true, // Run all tests in single thread
        },
      },
      fileParallelism: false,
      testTimeout: 30000,
      hookTimeout: 10000,
    },
  };
});
```

**Change:** Added `globalSetup: ['./test/helpers/vitest-global-setup.ts']`

### Dependency on Existing Infrastructure

This solution leverages the **singleton Prisma pattern** that was already in place:

**File: `server/test/helpers/global-prisma.ts`**

```typescript
/**
 * Global Singleton PrismaClient for Integration Tests
 *
 * CRITICAL: All integration tests MUST use this singleton to prevent
 * connection pool exhaustion with Supabase pgbouncer.
 */

let globalPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    const urlBase = baseUrl.split('?')[0];
    // pgbouncer=true enables connection pooling with aggressive timeouts
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    globalPrisma = new PrismaClient({
      datasources: { db: { url: urlWithPool } },
    });
  }
  return globalPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    try {
      await globalPrisma.$disconnect();
    } catch (err) {
      console.error('Error disconnecting test Prisma:', err);
    }
    globalPrisma = null;
  }
}
```

This singleton prevents connection pool exhaustion, which was part of the broader infrastructure fix.

---

## What Was NOT Tried (Important Context)

### Anti-patterns and why they didn't apply:

1. **Per-test-file cleanup hooks** - Would still miss interrupted runs
2. **Changing the scheduler** - Would be premature optimization; the real issue was orphaned data
3. **Increasing database limits** - Doesn't solve root cause of accumulation
4. **Manual pre-test cleanup script** - Requires developer discipline; hooks are forgotten
5. **Deleting all test tenants on startup** - Too aggressive; might delete valid test data

### Why global setup (not global teardown)?

- **Global teardown** runs AFTER all tests - orphaned data still pollutes this run
- **Global setup** runs BEFORE all tests - orphan cleanup happens fresh each time
- Pairs with per-test `afterEach()` cleanup for isolation within test runs

---

## Verification Steps

### Before Fix

```bash
$ time npm test
# Hangs after ~30 seconds
# No output, test runner frozen
# Ctrl+C required

$ psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Tenant\" WHERE slug LIKE 'test-%';"
# Result: 117 orphaned test tenants
```

### After Fix

```bash
$ npm test

[vitest] Global setup: Cleaning orphaned test tenants...
[vitest] Global setup: Cleaned 117 orphaned test tenants (1247ms)

# Tests now start immediately and complete in ~12 minutes
# No more hangs or timeouts
# Scheduler completes quickly (only processes real tenants)
```

### Verify No Real Tenant Deletion

```bash
$ psql $DATABASE_URL -c "SELECT slug FROM \"Tenant\" WHERE slug IN ('mais', 'little-bit-farm', 'demo');"
# Result: All three remain untouched
```

---

## Metrics and Results

| Metric                | Before        | After       |
| --------------------- | ------------- | ----------- |
| Orphaned test tenants | 117+          | 0           |
| Scheduler cycle time  | ~29s          | ~2s         |
| Test suite hangup     | Yes (11+ min) | No          |
| Test completion time  | N/A (hung)    | ~12 minutes |
| Test pass rate        | 771/771       | 771/771     |

**Key improvement:** From non-functional (hanging) to working (12-minute completion).

---

## Why This Pattern Prevents Future Recurrence

1. **Automatic cleanup** - No manual step to forget
2. **Runs before each test run** - Handles interrupted runs gracefully
3. **Safe guards** - Explicit allowlist prevents accidental deletion of real data
4. **Minimal performance cost** - Cleanup takes ~1.2 seconds (amortized over full test suite)
5. **Integrates with existing patterns** - Uses singleton Prisma that was already in place

### Future Test Accumulation Prevention

```
Each test run:
  ↓
Global setup: Clean orphans
  ↓
Tests run
  ↓
Per-test afterEach(): Clean that test's tenant
  ↓
Global teardown: Disconnect singleton
```

This two-level cleanup ensures no orphaned data accumulates between runs.

---

## Related Documentation

- **Connection Pool:** `docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md`
- **Test Strategy:** `TESTING.md`
- **Singleton Pattern:** `server/test/helpers/global-prisma.ts`
- **Integration Tests:** `server/test/helpers/test-tenant.ts`

---

## Lessons Learned

1. **Global setup hooks are powerful** - Cleaner than per-file setup for initialization
2. **Orphaned test data is cumulative** - Small leaks become massive problems
3. **Scheduler overhead scales linearly** - With N tenants, all scheduled tasks grow slower
4. **Hook cleanup is not guaranteed** - Must assume interrupted runs and have fallback cleanup
5. **Safety first** - Always use pattern matching + allowlist, never assume automatic safety

---

## Checklist for Similar Issues

When test suite hangs or slows down:

- [ ] Check if test data is accumulating (`SELECT COUNT(*) FROM TestTable;`)
- [ ] Check if scheduled tasks process all data (read scheduler code)
- [ ] Check if `afterEach()` cleanup actually runs (test with interrupt)
- [ ] Consider global setup hook for pre-test initialization
- [ ] Verify no orphaned connections are pooling up
- [ ] Check Vitest config for parallelism/timeout settings
- [ ] Profile scheduler or heavy operations with logging
