---
title: Test Connection Pool Exhaustion with Supabase pgbouncer
category: database-issues
severity: P1
component: server/test infrastructure
tags:
  - prisma
  - supabase
  - connection-pool
  - vitest
  - integration-tests
  - pgbouncer
  - singleton-pattern
symptoms:
  - Integration tests hang indefinitely (20-30+ minutes)
  - Tests never complete or timeout
  - "Timed out fetching a new connection from the connection pool" errors
  - Multiple test files create their own PrismaClient instances
  - P2024 Prisma errors mentioning connection pool timeout
root_cause: Each test file instantiating its own PrismaClient exhausted Supabase pgbouncer connection pool (~60 connections)
date: 2025-12-26
commit: 166d902
---

# Test Connection Pool Exhaustion - Supabase/Prisma

## Problem Summary

Integration tests were hanging indefinitely (20-30+ minutes) because each test file created its own `PrismaClient` instance, rapidly exhausting Supabase's pgbouncer connection pool.

**Before:** Tests hung forever, never completing
**After:** 1,178 tests pass in ~12 minutes

## Root Cause Analysis

### The Math

```
22 test files × 1 PrismaClient each = 22+ concurrent connections
Supabase pgbouncer limit: ~60 connections (Session mode)
Result: Pool exhaustion → indefinite hangs
```

### Why It Happened

```typescript
// ❌ BAD: Each test file did this
// test/http/packages.test.ts
const prisma = new PrismaClient();  // Connection #1

// test/http/auth-signup.test.ts
const prisma = new PrismaClient();  // Connection #2

// test/integration/booking.spec.ts
const prisma = new PrismaClient();  // Connection #3
// ... repeat for 22 files
```

Each `new PrismaClient()` creates a connection pool. With 22 test files running (even sequentially), connections accumulated and never released until the pool was exhausted.

## Solution: Global Singleton Pattern

### 1. Create Singleton (`test/helpers/global-prisma.ts`)

```typescript
import { PrismaClient } from '../../src/generated/prisma';

let globalPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    const urlBase = baseUrl?.split('?')[0];
    // Aggressive limits: 3 connections max, 5s timeout
    const urlWithPool = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    globalPrisma = new PrismaClient({
      datasources: { db: { url: urlWithPool } },
      log: ['error'],
    });

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

### 2. Create Global Teardown (`test/helpers/vitest-global-teardown.ts`)

```typescript
import { disconnectTestPrisma } from './global-prisma';

export default async function globalTeardown() {
  await disconnectTestPrisma();
}
```

### 3. Update Vitest Config (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],
    poolOptions: {
      threads: { singleThread: true },
    },
    fileParallelism: false,
    testTimeout: 30000,  // 30s - fail fast
    hookTimeout: 10000,  // 10s for beforeAll/afterAll
  },
});
```

### 4. Update Test Files

```typescript
// ❌ BEFORE
import { PrismaClient } from '../../src/generated/prisma';
const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// ✅ AFTER
import { getTestPrisma } from '../helpers/global-prisma';
const prisma = getTestPrisma();

afterAll(async () => {
  // No-op: singleton handles lifecycle
});
```

## Files Modified

### Created
- `server/test/helpers/global-prisma.ts` (92 lines)
- `server/test/helpers/vitest-global-teardown.ts` (15 lines)

### Modified
- `server/vitest.config.ts` - Added global teardown + timeouts
- `server/test/helpers/integration-setup.ts` - Use singleton
- 10 test files updated to use `getTestPrisma()`

## Results

| Metric | Before | After |
|--------|--------|-------|
| Duration | ∞ (hung) | **~12 min** |
| Tests Passed | 0 | **1,178** |
| Connection Usage | 22+ | **3 max** |
| Pool Utilization | 100%+ | **5%** |

## Prevention Checklist

### Before Writing New Tests

- [ ] Use `getTestPrisma()` instead of `new PrismaClient()`
- [ ] Don't call `prisma.$disconnect()` in test cleanup
- [ ] Use `setupIntegrationTest()` helper for integration tests

### Code Review Checklist

- [ ] No `new PrismaClient()` in test files
- [ ] No `$disconnect()` calls in individual test files
- [ ] Imports from `../helpers/global-prisma`

### Detection Commands

```bash
# Find violations
grep -r "new PrismaClient" server/test/ --include="*.ts" | grep -v "global-prisma"

# Should return 0 results in test files (except global-prisma.ts)
```

## Warning Signs

Watch for these symptoms indicating pool exhaustion:

1. **Test hangs** - Tests stop making progress for >30 seconds
2. **P2024 errors** - "Timed out fetching a new connection from the connection pool"
3. **Slow cleanup** - afterAll hooks timing out
4. **Memory growth** - Node process memory increasing during test run

## Troubleshooting

### Tests Still Hanging?

```bash
# Check for rogue PrismaClient instances
grep -rn "new PrismaClient" server/test/

# Verify singleton is being used
grep -rn "getTestPrisma" server/test/ | wc -l
# Should match number of test files using DB
```

### Connection Pool Errors?

1. Reduce `connection_limit` in global-prisma.ts (try 2)
2. Increase `pool_timeout` (try 10)
3. Check Supabase dashboard for connection count

## Related Documentation

- [TEST_ISOLATION_INDEX.md](../TEST_ISOLATION_INDEX.md) - Master test isolation guide
- [supabase-ipv6-session-pooler-connection.md](./supabase-ipv6-session-pooler-connection.md) - Supabase pooler config
- [TESTING.md](../../TESTING.md) - Overall testing strategy
- [server/test/helpers/README.md](../../../server/test/helpers/README.md) - Test helper usage

## Commit Reference

- **Commit:** `166d902`
- **Branch:** `quality-remediation-plan`
- **Date:** 2025-12-26
- **Message:** "fix: resolve test connection pool exhaustion and lint cleanup"
