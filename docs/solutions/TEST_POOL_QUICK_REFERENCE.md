---
title: Test Connection Pool - Quick Reference
category: database-issues
tags: [prisma, test-infrastructure, pgbouncer, quick-reference]
component: server/test
---

# Test Connection Pool - Quick Reference

**Print this and pin to your desk!**

---

## The Problem (30 seconds)

```
❌ WRONG: Each test file creates new PrismaClient
  → 22 test files = 22 connections
  → Supabase pool (60 connections) exhausted
  → Tests hang indefinitely

✅ RIGHT: All test files share one singleton
  → 22 test files = 1 connection
  → Max 3 concurrent queries (connection_limit=3)
  → Tests complete in ~12 minutes
```

---

## The Solution (One Image)

```
┌─────────────────────────────────────────────────────────┐
│                  Test Files (22 total)                  │
├─────────────────────────────────────────────────────────┤
│  test-1.ts  test-2.ts  test-3.ts  ...  test-22.ts      │
│       ↓          ↓          ↓                ↓           │
│     getTestPrisma()  getTestPrisma() ... getTestPrisma()
│       ↓          ↓          ↓                ↓           │
├─────────────────────────────────────────────────────────┤
│              global-prisma.ts (Singleton)               │
│              ┌─────────────────────────┐                │
│              │   PrismaClient          │                │
│              │  (1 instance, 3 max     │                │
│              │   concurrent queries)   │                │
│              └─────────────────────────┘                │
├─────────────────────────────────────────────────────────┤
│              Supabase (60 connections)                  │
│              ████░░░░░░░░░░░░░░░░░░░░ (3/60 used)      │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Checklist

### Before Writing Tests

- [ ] Import from: `import { getTestPrisma } from '../helpers/global-prisma';`
- [ ] Use: `const prisma = getTestPrisma();`
- [ ] NOT: `const prisma = new PrismaClient();`
- [ ] NOT: Don't add `afterAll(() => prisma.$disconnect());`

### Before Pushing

```bash
# Check for old pattern
grep -r "new PrismaClient" server/test --include="*.ts"

# Should be empty!
# If it finds anything, that file needs updating
```

### Common Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { getTestPrisma } from '../helpers/global-prisma';

describe('MyService', () => {
  const prisma = getTestPrisma(); // ✅ Once at top level

  it('should do something', async () => {
    const result = await prisma.tenant.count();
    expect(result).toBeGreaterThan(0);
  });

  // ✅ DO NOT add afterAll disconnect!
  // Singleton manages its own lifecycle
});
```

---

## If Tests Hang

### Step 1: Diagnose

```bash
# Is it hanging during tests or after?
ps aux | grep "node.*vitest"

# Check if all test files use singleton
grep -r "new PrismaClient" server/test
```

### Step 2: Fix

| Symptom                           | Fix                                         |
| --------------------------------- | ------------------------------------------- |
| `grep` finds `new PrismaClient()` | Replace with `getTestPrisma()` in that file |
| Pool error message                | Check DATABASE_URL has `connection_limit=3` |
| Process won't exit                | Global teardown missing in vitest.config.ts |

### Step 3: Verify

```bash
npm test 2>&1 | tail -20
# Look for:
# ✓ 1178 passed
# NOT: "MaxClientsInSessionMode"
```

---

## Connection Limits

**In DATABASE_URL:**

```
postgresql://...@...?pgbouncer=true&connection_limit=3&pool_timeout=5&connect_timeout=5
                     └──────────────┬──────────────┘
                              Test specific
                          (Production uses 5-10)
```

**What each does:**

| Param              | Value | Meaning                        |
| ------------------ | ----- | ------------------------------ |
| `connection_limit` | 3     | Max 3 queries at once          |
| `pool_timeout`     | 5s    | Give up if no connection in 5s |
| `connect_timeout`  | 5s    | Don't wait forever to connect  |

---

## Files to Know

| File                                | Purpose                 | Edit When?                             |
| ----------------------------------- | ----------------------- | -------------------------------------- |
| `test/helpers/global-prisma.ts`     | Singleton factory       | Never (unless tuning connection_limit) |
| `test/helpers/integration-setup.ts` | Test setup utilities    | Adding new helper functions            |
| `vitest.config.ts`                  | Serial execution config | Never (unless disabling serial mode)   |
| `test/**/*.test.ts`                 | Actual tests            | Always use `getTestPrisma()`           |
| `.env`                              | DATABASE_URL string     | For `connection_limit=3` param         |

---

## Performance Targets

```
Healthy test run:
├─ Total tests: 1178
├─ Duration: ~12 minutes (88 tests/min)
├─ Memory: ~50MB (not 1.1GB)
├─ Pool usage: ~3/60 connections
└─ Errors: 0 "MaxClientsInSessionMode"
```

If you see:

- Duration > 20 min: Check for hanging tests
- Memory > 200MB: Check for new PrismaClient() creations
- "MaxClientsInSessionMode" error: Someone created new PrismaClient()

---

## One-Liner Validation

```bash
# This should return nothing (empty result = good)
grep -r "new PrismaClient" server/test --include="*.ts"
```

---

## Debug Commands

```bash
# Show all test files
find server/test -name "*.test.ts" -o -name "*.spec.ts"

# Show which ones still use old pattern
grep -l "new PrismaClient" server/test/**/*.ts

# Run one test file to verify singleton
npm test -- server/test/services/booking.service.test.ts

# Run with verbose logging
DEBUG_PRISMA=true npm test

# Check what's in DATABASE_URL
echo $DATABASE_URL
```

---

## Historical Context

| Date       | Issue                      | Fix                       |
| ---------- | -------------------------- | ------------------------- |
| 2025-12-23 | Tests hanging indefinitely | Created singleton pattern |
| 2025-12-26 | 0 lint errors achieved     | Cleaned up all violations |

**Commit:** `166d902e18d6f83bc3d6a59742599f650a7182ce`

---

## TL;DR

```
OLD:  const prisma = new PrismaClient();  ❌ Bad
NEW:  const prisma = getTestPrisma();     ✅ Good

✓ 1178 tests passing
✓ ~12 min runtime
✓ Zero pool exhaustion
```

That's it. Don't overthink it.
