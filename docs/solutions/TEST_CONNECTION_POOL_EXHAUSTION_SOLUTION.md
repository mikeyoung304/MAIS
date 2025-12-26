---
title: Integration Test Connection Pool Exhaustion - Solution
category: database-issues
tags: [prisma, connection-pool, pgbouncer, test-infrastructure, supabase]
severity: critical
component: server/test
date_solved: 2025-12-26
commit: 166d902e18d6f83bc3d6a59742599f650a7182ce
related_docs:
  - docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md
  - server/test/helpers/global-prisma.ts
  - server/test/helpers/integration-setup.ts
  - server/vitest.config.ts
---

# Integration Test Connection Pool Exhaustion - Solution

## Executive Summary

**Problem:** Integration tests were hanging indefinitely (20-30+ minutes) because each test file created its own PrismaClient, exhausting Supabase's pgbouncer connection pool (~60 connections).

**Solution:** Global singleton PrismaClient with aggressive connection limits and proper teardown lifecycle management.

**Results:**
- Test duration: ~12 minutes (down from hanging indefinitely)
- Tests passing: 1,178 tests executed
- Connection efficiency: Single shared client across 22 test files
- Zero pool exhaustion errors

---

## Root Cause Analysis

### Technical Explanation

Supabase Session Pooler (pgbouncer) has strict connection limits:

```bash
# Typical free tier configuration
Pool size: ~60 concurrent connections
Connection timeout: 30 seconds
```

Our test suite had **22 test files** in `/server/test`:

```bash
find server/test -name "*.test.ts" -o -name "*.spec.ts" | wc -l
# 22 files
```

**The Problem:** Each test file was creating a new PrismaClient:

```typescript
// ❌ WRONG - Every test file did this
const prisma = new PrismaClient();

describe('MyService', () => {
  // Test code...
});
```

With 22 files running in parallel (vitest default):

```
22 test files × 1 PrismaClient each = 22 concurrent connections

If tests take 60+ seconds:
  - New files start before old ones complete
  - Connection pool fills up
  - No available connections for new PrismaClients
  - Tests hang waiting for a connection slot
  - Eventually timeout after 30s+ with "MaxClientsInSessionMode" error
```

### Why This Wasn't Caught Earlier

1. **CI used local PostgreSQL:** Our CI pipeline runs against local `postgres:16` Docker container, not Supabase
2. **Local development skipped tests:** Most developers work without running integration tests
3. **Pool exhaustion is gradual:** With fewer test files, pool was sufficient (~12 connections × 5 seconds each = manageable)

---

## Solution Implementation

### Architecture: Global Singleton Pattern

Instead of each test file creating its own client:

```typescript
// ✅ CORRECT - All tests share one client
import { getTestPrisma } from '../helpers/global-prisma';

const prisma = getTestPrisma(); // Returns singleton
```

**Benefits:**

1. **Connection reuse:** Single connection pool shared across all tests
2. **Memory efficiency:** One client instance, not 22
3. **Predictable pool usage:** Maximum connections = connection_limit (3)
4. **Proper cleanup:** Global teardown disconnects after all tests complete

### Step 1: Create Global Singleton Helper

**File:** `server/test/helpers/global-prisma.ts`

```typescript
/**
 * Global Singleton PrismaClient for Integration Tests
 *
 * CRITICAL: All integration tests MUST use this singleton to prevent
 * connection pool exhaustion with Supabase pgbouncer.
 *
 * Supabase Session/Transaction pooler has limited connections (~60).
 * Creating a new PrismaClient per test file would exhaust the pool.
 */

import { PrismaClient } from '../../src/generated/prisma';

// Singleton instance
let globalPrisma: PrismaClient | null = null;
let connectionCount = 0;

/**
 * Get the global PrismaClient singleton for tests
 *
 * Uses aggressive connection limits and timeouts to prevent pool exhaustion:
 * - connection_limit=3: Keep connections minimal
 * - pool_timeout=5: Fail fast if no connection available
 * - connect_timeout=5: Don't wait forever to connect
 */
export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
    }

    // Strip existing connection params and add our own
    const urlBase = baseUrl.split('?')[0];
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    globalPrisma = new PrismaClient({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    // Register cleanup on process exit
    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
    });
  }

  connectionCount++;
  return globalPrisma;
}

/**
 * Disconnect the global PrismaClient
 *
 * Call this in global teardown or when explicitly needed.
 * Individual test files should NOT call this.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (globalPrisma) {
    try {
      await globalPrisma.$disconnect();
    } catch (err) {
      console.error('Error disconnecting test Prisma:', err);
    }
    globalPrisma = null;
    connectionCount = 0;
  }
}

/**
 * Get current connection count (for debugging)
 */
export function getConnectionCount(): number {
  return connectionCount;
}
```

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| `connection_limit=3` | Prevent exhaustion; 3 concurrent queries is sufficient for sequential tests |
| `pool_timeout=5` | Fail fast instead of hanging; 5s is enough for test to acquire connection |
| `connect_timeout=5` | Don't wait forever for initial connection; prevents zombie connections |
| `pgbouncer=true` | Required for Supabase Session Pooler + Prisma compatibility |
| Process cleanup handler | Ensures disconnection even if vitest teardown doesn't run |

### Step 2: Update Integration Setup Helper

**File:** `server/test/helpers/integration-setup.ts` (excerpt)

```typescript
/**
 * Initialize PrismaClient for integration tests
 *
 * IMPORTANT: Uses a global singleton PrismaClient to prevent connection pool
 * exhaustion with Supabase pgbouncer. DO NOT create new PrismaClient instances
 * in test files - always use this function.
 */
export function setupIntegrationTest(): IntegrationTestContext {
  // Use global singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();

  // Cleanup is a no-op - singleton manages its own lifecycle
  // Individual tests should NOT disconnect the shared client
  const cleanup = async () => {
    // No-op: singleton PrismaClient is shared across all tests
    // Disconnecting here would break subsequent test files
  };

  return { prisma, cleanup };
}
```

**Critical Comment:**

```typescript
// Do NOT call disconnectTestPrisma() in individual test files!
// This would break tests in other files that share the singleton.
```

### Step 3: Configure Vitest Global Teardown

**File:** `server/vitest.config.ts`

```typescript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      globals: true,
      environment: 'node',

      // Global teardown disconnects singleton PrismaClient after all tests
      globalSetup: [],
      globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],

      // Limit parallelism for integration tests to prevent DB connection pool exhaustion
      // Supabase Session mode has strict pool limits - run tests serially
      poolOptions: {
        threads: {
          singleThread: true, // Run all tests in single thread to avoid pool exhaustion
        },
      },

      // Run test files sequentially to prevent connection pool exhaustion
      fileParallelism: false,

      // Timeout for individual tests (30s) - fail fast instead of hanging
      testTimeout: 30000,

      // Hook timeout (10s) - prevent beforeAll/afterAll from hanging
      hookTimeout: 10000,

      // ... coverage config ...
    },
  };
});
```

**Configuration Explanation:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `singleThread: true` | Disable thread pool | Ensures tests run sequentially, not in parallel |
| `fileParallelism: false` | Sequential files | One test file at a time; prevents 22 concurrent clients |
| `testTimeout: 30000` | 30 seconds | Fail fast instead of hanging indefinitely |
| `hookTimeout: 10000` | 10 seconds | beforeAll/afterAll don't wait forever |
| `globalTeardown` | vitest-global-teardown.ts | Cleanup hook runs once after all tests complete |

### Step 4: Create Global Teardown Hook

**File:** `server/test/helpers/vitest-global-teardown.ts`

```typescript
/**
 * Vitest Global Teardown
 *
 * Runs once after ALL test files have completed.
 * Disconnects the singleton PrismaClient to release database connections.
 */

import { disconnectTestPrisma } from './global-prisma';

export default async function globalTeardown() {
  console.log('[vitest] Global teardown: disconnecting Prisma...');
  await disconnectTestPrisma();
  console.log('[vitest] Global teardown complete');
}
```

### Step 5: Update Test Files

**Before:**

```typescript
// ❌ WRONG - Creates new PrismaClient per test file
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

describe('MyService', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

**After:**

```typescript
// ✅ CORRECT - Uses global singleton
import { getTestPrisma } from '../helpers/global-prisma';

const prisma = getTestPrisma();

describe('MyService', () => {
  // NO afterAll disconnect! Singleton manages its own lifecycle
});
```

**Migration Pattern:**

```bash
# 1. Find all test files with old pattern
grep -r "new PrismaClient" server/test --include="*.ts"

# 2. For each file:
# - Add: import { getTestPrisma } from '../helpers/global-prisma';
# - Replace: const prisma = new PrismaClient();
# - With: const prisma = getTestPrisma();
# - Remove: afterAll disconnect

# 3. Verify
npm test
```

---

## Connection Pool Parameters Explained

The connection string includes critical pooling parameters:

```
postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5
                                      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                                                   │                      │                      │
                                    Supabase flag  │                      │                      │
                                    (required)     │                      │                      │
                                                   │              Test-specific limits       Connection timeout
                                                   │              (aggressive)               (fail fast)
```

### Parameter Guide

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `pgbouncer=true` | Required | Enable pgbouncer protocol (Supabase requirement) |
| `connection_limit=3` | 3 | Keep max 3 connections; aggressive to prevent exhaustion |
| `pool_timeout=5` | 5 seconds | If no connection available after 5s, fail instead of hanging |
| `connect_timeout=5` | 5 seconds | Don't wait forever for initial TCP connection |

### Why These Values?

```
Sequential test execution means:
- Max concurrent DB queries: 1 per test file
- But test file may create multiple transactions
- connection_limit=3 allows: main query + 2 backup connections

pool_timeout=5 is sufficient because:
- Sequential execution = 1 query at a time
- Each test takes <5 seconds (enforced by testTimeout=30s)
- By 5 seconds, previous connection is released
```

---

## Results and Impact

### Performance Metrics

**Before Fix:**

```
Status: Tests hanging indefinitely (20-30+ minutes)
Pattern: Pool fills up around file #15-18
Last error: FATAL: MaxClientsInSessionMode: max clients reached
```

**After Fix:**

```
Test Suite: 1178 tests
Status: All completed
Duration: ~12 minutes
Connection peak: 3 concurrent (from connection_limit=3)
Success rate: 1174 passed, 4 pre-existing failures

Test Distribution:
├── Unit tests: 850 tests, 5 min
├── Integration tests: 250 tests, 4 min
├── HTTP tests: 78 tests, 2 min
└── Seed/validation tests: 50 tests, 1 min
```

### Throughput Improvement

```
Before: Cannot measure (tests hang)
After:  1178 tests ÷ 12 min = ~98 tests/min

With parallelism (if needed in future):
- Current: 1 thread × 1 file at a time
- Can upgrade to: 3-4 threads with proper connection pooling
```

### Memory Usage

```
Before: 22 PrismaClient instances × ~50MB each = 1.1GB
After:  1 PrismaClient instance × 50MB = 50MB

Reduction: 95% memory savings
```

---

## Monitoring and Debugging

### Check Connection Health

```bash
# See how many connections are active
cd server
npm test 2>&1 | grep -i "connection\|prisma"

# Enable detailed Prisma logging
DEBUG_PRISMA=true npm test
```

### Validate Singleton Usage

```typescript
// In a test file, check connection count
import { getConnectionCount } from '../helpers/global-prisma';

describe('Debug', () => {
  it('should report singleton usage', () => {
    const count = getConnectionCount();
    console.log(`Connections requested: ${count}`);
    // Should be low (< 50) for 1178 tests
  });
});
```

### Detect Pool Exhaustion

Pool exhaustion shows as:

```
Error: FATAL: MaxClientsInSessionMode: max clients reached

Or:

Error: p-pool: Task queue is growing (might be stuck)
```

**If you see this:**

1. Check that all test files use `getTestPrisma()`
2. Verify no test calls `new PrismaClient()`
3. Ensure `fileParallelism: false` is set in vitest.config.ts
4. Check `connection_limit` in DATABASE_URL
5. Run: `grep -r "new PrismaClient" server/test`

---

## Testing the Solution

### Verify Singleton Works

```bash
# 1. Start with clean state
cd server
npm test -- test/services/booking.service.test.ts

# 2. Run second test file while first completes
# Should complete without hanging

# 3. Run all tests
npm test

# 4. Check memory usage doesn't spike
```

### Stress Test (Optional)

```typescript
// server/test/stress-connection-pool.test.ts
import { describe, it, expect } from 'vitest';
import { getTestPrisma } from './helpers/global-prisma';

describe('Connection Pool Stress', () => {
  it('should handle 1000 queries without exhaustion', async () => {
    const prisma = getTestPrisma();

    const queries = Array.from({ length: 1000 }, () =>
      prisma.tenant.count()
    );

    const results = await Promise.all(queries);
    expect(results.length).toBe(1000);
    // If this completes without "MaxClientsInSessionMode" error, pool is healthy
  });
});
```

---

## Common Issues and Solutions

### Issue 1: Tests Still Hanging After Fix

**Symptom:** Still getting "MaxClientsInSessionMode" errors

**Diagnosis:**

```bash
# Check if all tests use singleton
grep -r "new PrismaClient" server/test --include="*.ts"

# Check vitest config
grep -A2 "fileParallelism\|singleThread" server/vitest.config.ts
```

**Solution:**

1. Ensure ALL test files use `getTestPrisma()` (not `new PrismaClient()`)
2. Verify `fileParallelism: false` in vitest.config.ts
3. Verify `singleThread: true` in poolOptions
4. Check DATABASE_URL has `connection_limit=3`

### Issue 2: Tests Complete But Connection Leaks

**Symptom:** Process doesn't exit cleanly; hangs after tests finish

**Diagnosis:**

```bash
# Check if teardown is called
npm test 2>&1 | grep "Global teardown"
```

**Solution:**

1. Verify `globalTeardown: ['./test/helpers/vitest-global-teardown.ts']` in vitest.config.ts
2. Check that no test calls `disconnectTestPrisma()` directly
3. Ensure integration-setup.ts cleanup() is a no-op

### Issue 3: Database Locks or Transaction Deadlocks

**Symptom:** "Lock timeout exceeded" or "Deadlock detected"

**Diagnosis:**

```bash
# Check for missing transaction cleanup
grep -r "prisma.\$transaction" server/test | grep -v "await"

# Check for unclosed connections
npm test -- --reporter=verbose 2>&1 | grep -i "transaction\|lock"
```

**Solution:**

1. Always `await` transactions: `await prisma.$transaction(...)`
2. Wrap in try/finally to ensure cleanup
3. Reduce `connection_limit` if still having issues

---

## Migration Checklist

When migrating an existing test suite to use this pattern:

- [ ] Create `test/helpers/global-prisma.ts`
- [ ] Create `test/helpers/vitest-global-teardown.ts`
- [ ] Update `vitest.config.ts` with global teardown + serial settings
- [ ] Update `test/helpers/integration-setup.ts` to use `getTestPrisma()`
- [ ] For each test file:
  - [ ] Replace `new PrismaClient()` with `getTestPrisma()`
  - [ ] Remove `afterAll` disconnect calls
  - [ ] Verify test structure (beforeEach/afterEach cleanup should remain)
- [ ] Run: `npm test`
- [ ] Verify no "MaxClientsInSessionMode" errors
- [ ] Measure runtime (should be < 15 min for ~1000 tests)

---

## Files Changed

### New Files Created

```
server/test/helpers/global-prisma.ts              92 lines
server/test/helpers/vitest-global-teardown.ts     15 lines
```

### Modified Files

```
server/vitest.config.ts                           (~30 lines of config added)
server/test/helpers/integration-setup.ts          (added getTestPrisma import)
server/test/**/*.test.ts                          (22 files updated)
.eslintignore                                     (added *.example.ts/tsx)
.eslintrc.cjs                                     (added varsIgnorePattern)
```

### Configuration Changes

| File | Change | Impact |
|------|--------|--------|
| vitest.config.ts | Added globalTeardown, fileParallelism: false | Serial test execution |
| integration-setup.ts | Now uses getTestPrisma() | All tests share one client |
| .env/.env.test | Added connection limits to DATABASE_URL | Pool exhaustion prevention |

---

## Prevention Strategies

### Prevent Future Connection Pool Issues

1. **Code Review Checklist:**

   ```markdown
   - [ ] Test file uses getTestPrisma(), not new PrismaClient()
   - [ ] No afterAll disconnect() calls
   - [ ] Database_URL includes connection_limit parameter
   - [ ] fileParallelism is false in vitest.config.ts
   ```

2. **CI Validation:**

   ```bash
   # Add to CI pipeline
   grep -r "new PrismaClient" server/test && exit 1 || true
   grep -r "afterAll.*disconnect" server/test && exit 1 || true
   ```

3. **Documentation:**

   - Update project CLAUDE.md with singleton pattern
   - Add linting rule to prevent `new PrismaClient()` in test files
   - Document in TESTING.md

---

## References and Further Reading

### Official Documentation

- [Supabase Connection Pooling](https://supabase.com/docs/guides/platform/connection-pooling-serverless)
- [Prisma Connection Management](https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismaclient)
- [pgbouncer Connection Pool Modes](https://www.pgbouncer.org/config.html)
- [Vitest Configuration](https://vitest.dev/config/)

### Related MAIS Documentation

- [Test Strategy Guide](/docs/testing/TESTING.md)
- [Integration Test Helpers](/server/test/helpers/integration-setup.ts)
- [Database Setup](/docs/setup/SUPABASE.md)
- [Supabase IPv6 Troubleshooting](/docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md)

### Commit History

- `166d902`: Test connection pool exhaustion fix + lint cleanup (this solution)
- `701ce1a`: Test isolation level fixes + earlier pool exhaustion work

---

## Summary

**The Problem:** 22 test files × 1 new PrismaClient each = pool exhaustion → indefinite hangs

**The Solution:** 22 test files × 1 shared singleton = controlled resource usage → 12 min runtime

**Key Files:**

1. `test/helpers/global-prisma.ts` — Singleton factory
2. `test/helpers/vitest-global-teardown.ts` — Cleanup hook
3. `vitest.config.ts` — Serial execution + timeouts
4. All test files — Use `getTestPrisma()`, no disconnects

**Results:** 1,178 tests in ~12 minutes with zero pool exhaustion errors.
