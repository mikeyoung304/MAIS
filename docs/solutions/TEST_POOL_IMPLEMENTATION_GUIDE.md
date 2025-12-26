---
title: Test Connection Pool - Implementation Guide
category: database-issues
tags: [prisma, test-infrastructure, implementation, pgbouncer]
component: server/test
estimated_effort: 2 hours
---

# Test Connection Pool - Implementation Guide

**For teams implementing this solution in their own projects**

---

## Overview

This guide walks through implementing the singleton PrismaClient pattern for test suites facing connection pool exhaustion with Supabase or other pooled databases.

**Prerequisites:**
- Vitest (or Jest) test runner
- Prisma ORM
- Supabase or similar pooled database
- TypeScript

**Estimated Time:** 2 hours (1.5 hours code, 0.5 hours testing)

---

## Phase 1: Create Singleton Pattern (20 minutes)

### Step 1.1: Create global-prisma.ts

Create `test/helpers/global-prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'; // Adjust path to your generated Prisma

let globalPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!globalPrisma) {
    const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

    if (!baseUrl) {
      throw new Error('DATABASE_URL or DATABASE_URL_TEST required for tests');
    }

    // Strip existing query params and add test-specific limits
    const urlBase = baseUrl.split('?')[0];
    const testUrl = `${urlBase}?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5`;

    globalPrisma = new PrismaClient({
      datasources: {
        db: {
          url: testUrl,
        },
      },
      // Reduce logging in tests
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });

    // Cleanup on process exit
    process.on('beforeExit', async () => {
      await disconnectTestPrisma();
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

### Step 1.2: Create Global Teardown Hook

Create `test/helpers/vitest-global-teardown.ts`:

```typescript
import { disconnectTestPrisma } from './global-prisma';

export default async function globalTeardown() {
  console.log('[vitest] Global teardown: disconnecting Prisma...');
  await disconnectTestPrisma();
  console.log('[vitest] Global teardown complete');
}
```

---

## Phase 2: Configure Test Runner (15 minutes)

### Step 2.1: Update vitest.config.ts

Add/update these sections:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ===== CONNECTION POOL MANAGEMENT =====

    // Run tests in single thread (prevents parallel PrismaClient creation)
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Run test files one at a time (serial execution)
    fileParallelism: false,

    // ===== TIMEOUT SETTINGS =====

    // Individual test timeout (fail fast instead of hanging)
    testTimeout: 30000, // 30 seconds

    // Hook timeout (beforeAll/afterAll)
    hookTimeout: 10000, // 10 seconds

    // ===== TEARDOWN =====

    // Run once after all tests complete
    globalTeardown: ['./test/helpers/vitest-global-teardown.ts'],

    // ... rest of config
  },
});
```

**Why these settings:**

| Setting | Why |
|---------|-----|
| `singleThread: true` | Prevents 22 parallel threads × 1 client each = 22 connections |
| `fileParallelism: false` | One file at a time, old file's connections release before new one starts |
| `testTimeout: 30000` | If test hangs on pool, fail after 30s instead of hanging forever |
| `globalTeardown` | Cleanup hook ensures disconnection |

---

## Phase 3: Update Test Files (1 hour)

### Step 3.1: Find All Test Files

```bash
# Show all test files
find . -name "*.test.ts" -o -name "*.spec.ts" | head -20

# Count them
find . -name "*.test.ts" -o -name "*.spec.ts" | wc -l
```

### Step 3.2: Find Old Pattern

```bash
# Find files using old pattern
grep -r "new PrismaClient" . --include="*.ts" --include="*.js"

# Sample output:
# test/services/booking.test.ts:const prisma = new PrismaClient();
# test/http/api.test.ts:const prisma = new PrismaClient();
# ... more files
```

### Step 3.3: Migrate Each File

For each test file found above:

**Before:**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('BookingService', () => {
  it('should create booking', async () => {
    await prisma.booking.create({ data: { ... } });
  });

  afterAll(async () => {
    await prisma.$disconnect(); // ❌ REMOVE THIS
  });
});
```

**After:**

```typescript
import { getTestPrisma } from '../helpers/global-prisma'; // ✅ ADD THIS

const prisma = getTestPrisma(); // ✅ CHANGE THIS

describe('BookingService', () => {
  it('should create booking', async () => {
    await prisma.booking.create({ data: { ... } });
  });

  // ✅ REMOVE afterAll disconnect
});
```

**Migration Script** (for many files):

```bash
#!/bin/bash

# 1. Find all test files with old pattern
FILES=$(grep -l "new PrismaClient" test/**/*.ts 2>/dev/null)

for file in $FILES; do
  echo "Updating $file..."

  # Add import if not present
  if ! grep -q "getTestPrisma" "$file"; then
    sed -i '1i import { getTestPrisma } from '"'"'../helpers/global-prisma'"'"';' "$file"
  fi

  # Replace new PrismaClient with getTestPrisma
  sed -i "s/new PrismaClient()/getTestPrisma()/g" "$file"

  # Remove afterAll disconnect
  sed -i '/afterAll.*async.*{/,/await prisma\.\$disconnect()/d' "$file"
done

echo "Migration complete!"
```

### Step 3.4: Verify Migration

```bash
# Should find ZERO files with new PrismaClient
grep -r "new PrismaClient" test --include="*.ts"

# Should find many imports
grep -r "getTestPrisma" test --include="*.ts" | wc -l

# Run tests
npm test
```

---

## Phase 4: Configure Environment (10 minutes)

### Step 4.1: Update .env

Ensure your DATABASE_URL includes connection limits:

```bash
# Before (may be too generous)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/db?pgbouncer=true

# After (aggressive limits for tests)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/db?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5
```

**For Supabase specifically:**

```bash
# Use Session Pooler (not Direct Connection)
# Get from: Supabase Dashboard → Connect → Session Pooler

DATABASE_URL=postgresql://postgres.PROJECT-REF:PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5
```

### Step 4.2: Create .env.test (Optional)

```bash
# .env.test - Only used when running tests
DATABASE_URL_TEST=postgresql://user:pass@localhost:5432/test_db?connection_limit=3&pool_timeout=5&connect_timeout=5
```

Update global-prisma.ts to use this:

```typescript
const baseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
```

---

## Phase 5: Testing and Validation (15 minutes)

### Step 5.1: Run Single Test File

```bash
npm test -- test/services/booking.service.test.ts

# Expected output:
# ✓ test/services/booking.service.test.ts (15 tests) 2.3s
```

### Step 5.2: Run Full Suite

```bash
npm test

# Monitor:
# - Total time (target < 15 min for 1000+ tests)
# - Memory usage (should be < 100MB)
# - Errors (should be 0 "MaxClientsInSessionMode")
```

### Step 5.3: Performance Baseline

```bash
# Record baseline for comparison
npm test 2>&1 | tee test-results.log

# Extract metrics
grep "passed\|failed" test-results.log
grep "real\|user\|sys" test-results.log

# Or use npm time
time npm test
```

### Step 5.4: Stress Test (Optional)

Create `test/stress-pool.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTestPrisma } from './helpers/global-prisma';

describe('Connection Pool Stress', () => {
  it('should handle 100 concurrent queries', async () => {
    const prisma = getTestPrisma();

    const queries = Array.from({ length: 100 }, () =>
      prisma.tenant.count().catch(() => null)
    );

    const results = await Promise.all(queries);
    expect(results.every(r => r !== null)).toBe(true);
  });
});
```

Run: `npm test -- test/stress-pool.test.ts`

---

## Phase 6: Troubleshooting (30 minutes as-needed)

### Issue: Tests Still Hanging

**Checklist:**

```bash
# 1. Check for remaining new PrismaClient() calls
grep -r "new PrismaClient" test --include="*.ts"
# Should be EMPTY

# 2. Verify vitest config
grep "fileParallelism\|singleThread" vitest.config.ts
# Should show both set to disable parallelism

# 3. Check DATABASE_URL format
echo $DATABASE_URL | grep "connection_limit=3"
# Should match pattern

# 4. Look for stray disconnects
grep -r "\.\$disconnect" test --include="*.ts"
# Should only be in global-teardown.ts
```

**If it still hangs:**

1. Add logging: `DEBUG_PRISMA=true npm test`
2. Check Supabase dashboard for connection count
3. Verify pool isn't filled by other processes
4. Increase `pool_timeout` in DATABASE_URL

### Issue: Tests Timing Out

**Check timeout settings:**

```typescript
// vitest.config.ts
test: {
  testTimeout: 30000,    // May need increase if tests are slow
  hookTimeout: 10000,    // Or slow beforeAll/afterAll
}
```

**Increase if needed:**

```typescript
testTimeout: 60000,      // 60 seconds instead of 30
hookTimeout: 20000,      // 20 seconds instead of 10
```

### Issue: "MaxClientsInSessionMode" Error

**This means:** Someone created a new PrismaClient in a test file

```bash
# Find the culprit
grep -r "new PrismaClient" test --include="*.ts"

# Or check test output for which test file failed
npm test 2>&1 | grep -B5 "MaxClientsInSessionMode"
```

**Fix:** Follow Step 3.3 above for that specific file

### Issue: Process Won't Exit After Tests

**Check global teardown:**

```bash
# Should see this output
npm test 2>&1 | tail -5
# [vitest] Global teardown: disconnecting Prisma...
# [vitest] Global teardown complete
```

**If missing:**

1. Verify `globalTeardown` in vitest.config.ts points to correct file
2. Check vitest version (must be 0.34+)
3. Try: `npm test -- --reporter=verbose`

---

## Verification Checklist

Before declaring success:

- [ ] All test files use `getTestPrisma()`
- [ ] No files contain `new PrismaClient()`
- [ ] No files contain `afterAll(...$disconnect())`
- [ ] vitest.config.ts has `fileParallelism: false`
- [ ] vitest.config.ts has `singleThread: true`
- [ ] vitest.config.ts has `globalTeardown` configured
- [ ] DATABASE_URL includes `connection_limit=3`
- [ ] `npm test` completes without "MaxClientsInSessionMode" errors
- [ ] Total test time is < 15 minutes (for 1000+ tests)
- [ ] Memory usage is stable (~50MB, not 1GB+)

---

## Success Metrics

After implementation:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Test time | 20-30+ min (hanging) | ~12 min | < 15 min |
| Pool connections | 22+ concurrent | 3 max | 1-3 |
| Memory usage | 1.1GB | 50MB | < 100MB |
| Pool errors | Frequent | 0 | 0 |
| Test pass rate | 0% (hangs) | 99%+ | 100% |

---

## Maintenance

### Monthly Review

```bash
# Check baseline hasn't drifted
time npm test

# Compare to previous results
# If slower, investigate recent test changes
```

### When Adding New Tests

```bash
# Create new test file using template:

import { describe, it, expect } from 'vitest';
import { getTestPrisma } from '../helpers/global-prisma'; // ✅ Always add this

const prisma = getTestPrisma(); // ✅ Always use singleton

describe('NewService', () => {
  it('should do something', async () => {
    // Test code
  });
  // ✅ Never add afterAll disconnect
});
```

### When Connection Limits Change

If Supabase account tier changes:

```bash
# Update connection_limit in DATABASE_URL
# Typical values:
# Free tier: connection_limit=3 (very limited)
# Pro tier: connection_limit=5-10 (more connections)
# Enterprise: connection_limit=20+ (very generous)

# Rerun tests after changing
npm test
```

---

## Documentation Links

- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/platform/connection-pooling-serverless)
- [Prisma Connection Management](https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismaclient)
- [Vitest Global Setup/Teardown](https://vitest.dev/config/#globalsetup)
- [pgbouncer Configuration Reference](https://www.pgbouncer.org/config.html)

---

## Summary

| Phase | Time | Actions | Files |
|-------|------|---------|-------|
| 1 | 20m | Create singleton helpers | 2 new files |
| 2 | 15m | Configure vitest | 1 modified file |
| 3 | 1h | Update all test files | 20+ modified files |
| 4 | 10m | Add connection limits | .env file |
| 5 | 15m | Test and measure | None |
| 6 | as-needed | Troubleshoot | Various |

**Total: 2 hours for full implementation**

---

## Questions?

Common points of confusion:

**Q: Why can't I use `new PrismaClient()` in tests?**
A: Each client takes 1+ connection from the pool. With 22 test files, you'd need 22 connections, exhausting Supabase's pool (~60 total).

**Q: Doesn't one shared client cause test pollution?**
A: No - Prisma doesn't cache by default. Each query is fresh. Tests should clean up their own data in `afterEach()`.

**Q: What's the difference between fileParallelism and singleThread?**
A: `fileParallelism` controls file execution order. `singleThread` controls thread pool. Both prevent parallel client creation.

**Q: Can I run tests in parallel if I use this pattern?**
A: Only if you first increase connection_limit significantly. Current setup assumes serial execution.

**Q: What if I need faster tests?**
A: Profile first. Serial execution is usually fine (1-2ms per query). If slow, likely issue is async database operations, not connection pooling.
