---
module: MAIS
date: 2026-01-02
problem_type: test_failure
component: test/agent-eval/tenant-isolation.test.ts
symptoms:
  - Integration tests always skipped even when database is available
  - beforeAll never executes - no console.log output
  - "7 skipped" shows in test output regardless of environment
  - Tests using it.skipIf with async-checked conditions never run
root_cause: vitest_two_phase_execution
resolution_type: code_pattern
severity: P2
tags: [vitest, testing, skipIf, async, beforeAll, integration-tests]
---

# Vitest skipIf Collection Phase Timing Issue

**Purpose:** Prevent integration tests from always skipping due to `it.skipIf()` evaluating before `beforeAll` runs.

**When to read:** Before using `it.skipIf()` or `describe.skipIf()` with conditions that depend on async data.

---

## Problem Statement

Integration tests using `it.skipIf(() => !tableExists)` were always skipping, even when the database table existed. The `tableExists` variable was set in `beforeAll`, but the tests never ran.

**Observed Behavior:**

```
↓ test/agent-eval/tenant-isolation.test.ts > should NOT return traces from other tenants
↓ test/agent-eval/tenant-isolation.test.ts > should return empty array when no traces exist
... (7 tests skipped)
```

**Expected Behavior:**
Tests should run when `DATABASE_URL` is set and the table exists.

---

## Root Cause: Vitest Two-Phase Execution

Vitest runs tests in two phases:

1. **Collection Phase**: All `describe()`, `it()`, and `skipIf()` conditions are evaluated
2. **Execution Phase**: `beforeAll()`, `beforeEach()`, and test callbacks run

The `it.skipIf(callback)` evaluates the callback during the **collection phase**, not when the test is about to run.

```typescript
// ❌ WRONG - This will always skip because tableExists is false during collection
let tableExists = false; // Initial value at collection time

beforeAll(async () => {
  // This runs AFTER skipIf has already been evaluated!
  tableExists = await checkTableExists();
});

const itIfTableExists = it.skipIf(() => !tableExists); // Sees tableExists = false

itIfTableExists('test', async () => {
  // Never runs - already skipped during collection
});
```

**Evidence from Vitest Issue [#2923](https://github.com/vitest-dev/vitest/issues/2923):**

> "Currently, describe and tests can be conditionally skipped using skipIf() properties... However there are many scenarios where it is a lot cleaner, and more logical, to assess whether a test needs to be skipped only during test execution."

---

## Solution: Synchronous Checks at Module Level

Use `describe.runIf()` with **synchronous** checks at module level, not async checks in `beforeAll`.

### Pattern: Environment Variable Check (Recommended)

```typescript
// ✅ CORRECT - Synchronous check at module level
const hasDatabaseUrl = !!process.env.DATABASE_URL;

describe.runIf(hasDatabaseUrl)('Integration Tests', () => {
  // This entire describe block is skipped if no DATABASE_URL

  beforeAll(async () => {
    // If we get here, DATABASE_URL is set
    // Any async validation here can throw on failure (not skip)
    const tableExists = await checkTableExists();
    if (!tableExists) {
      throw new Error('Table not found - run migrations');
    }
  });

  it('should work', async () => {
    // Test runs normally
  });
});
```

### Why This Works

| Phase      | What Happens                                                                 |
| ---------- | ---------------------------------------------------------------------------- |
| Collection | `process.env.DATABASE_URL` is read synchronously, `describe.runIf` evaluated |
| Execution  | `beforeAll` runs, throws if async condition fails                            |

### Philosophy: Skip vs Fail

- **Skip**: When environment is not configured (e.g., CI without database)
- **Fail**: When environment IS configured but something is wrong (e.g., missing migration)

```typescript
// Skip when no DB configured (valid for CI)
describe.runIf(process.env.DATABASE_URL)('DB Tests', () => {
  beforeAll(async () => {
    // FAIL (not skip) if table missing - indicates migration issue
    try {
      await prisma.$queryRaw`SELECT 1 FROM "MyTable" LIMIT 1`;
    } catch (err) {
      throw new Error(`MyTable not found. Run 'npm exec prisma migrate dev' to create it.`);
    }
  });
});
```

---

## Alternatives Considered

### 1. Check Table at Import Time (Complex)

```typescript
// Works but adds complexity
let tableExistsPromise = checkTableExists();
describe.runIf(await tableExistsPromise)(...);  // Can't await at module level!
```

**Rejected:** Can't use await at module level in standard ES modules.

### 2. Early Return in Each Test (Verbose)

```typescript
it('test', async () => {
  if (!tableExists) {
    expect.soft(true, 'SKIPPED: table not found').toBe(true);
    return;
  }
  // ... test code
});
```

**Rejected:** Requires boilerplate in every test, tests show as "passed" not "skipped".

### 3. Vitest `test.skip()` in Hook (Not Supported)

```typescript
beforeAll(async () => {
  if (!tableExists) {
    test.skip(); // Doesn't exist!
  }
});
```

**Rejected:** Vitest doesn't support skipping from within hooks (see [#2923](https://github.com/vitest-dev/vitest/issues/2923)).

---

## Prevention Strategies

### Rule: Check Skip Condition Timing

Before using `skipIf`, ask: **Can the condition be evaluated synchronously at module load time?**

| Condition Type       | Pattern                    | Works?       |
| -------------------- | -------------------------- | ------------ |
| Environment variable | `process.env.DATABASE_URL` | ✅ Sync      |
| File existence       | `fs.existsSync(path)`      | ✅ Sync      |
| Database query       | `await prisma.$queryRaw`   | ❌ Async     |
| API call             | `await fetch(...)`         | ❌ Async     |
| Feature flag         | Depends on implementation  | Check timing |

### Dotenv in Test Setup

Ensure environment variables are loaded before test collection:

```typescript
// test/helpers/global-prisma.ts
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from server directory (handles running from any cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

// Now process.env.DATABASE_URL is available at import time
```

### ESLint Rule (Recommended)

Add custom rule to detect async conditions in skipIf:

```javascript
// .eslintrc.json (conceptual - actual implementation varies)
{
  "rules": {
    "no-async-skipif": "warn"  // Custom rule to detect this pattern
  }
}
```

---

## Code Example: Before and After

### Before (Broken)

```typescript
describe('Tenant Isolation - EvalPipeline', () => {
  let tableExists = false;
  const itIfTableExists = it.skipIf(() => !tableExists); // ❌ Always false

  beforeAll(async () => {
    tableExists = await checkTable(); // Too late!
  });

  itIfTableExists('should isolate tenants', async () => {
    // Never runs
  });
});
```

### After (Working)

```typescript
const hasDatabaseUrl = !!process.env.DATABASE_URL;

describe.runIf(hasDatabaseUrl)('Tenant Isolation - EvalPipeline', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ConversationTrace" LIMIT 1`;
    } catch (err) {
      throw new Error(`Table not found. Run migrations. Error: ${err.message}`);
    }
  });

  it('should isolate tenants', async () => {
    // Runs when DATABASE_URL is set
  });
});
```

---

## Related Documentation

- [Vitest Test API - skipIf](https://vitest.dev/api/#test-skipif)
- [Vitest Issue #2923 - Skip during execution](https://github.com/vitest-dev/vitest/issues/2923)
- [Phase 5 Testing Prevention Strategies](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)

---

## Quick Reference

```typescript
// ✅ DO: Synchronous check at module level
const hasDB = !!process.env.DATABASE_URL;
describe.runIf(hasDB)('tests', () => { ... });

// ❌ DON'T: Async check in skipIf
let ready = false;
beforeAll(async () => { ready = await check(); });
it.skipIf(() => !ready)('test', () => { ... });

// ✅ DO: Throw in beforeAll for async failures
beforeAll(async () => {
  if (!await asyncCheck()) throw new Error('Setup failed');
});
```

---

**Last Updated:** 2026-01-02
**Source:** Tenant isolation test debugging session
**Maintainer:** Compound engineering workflow
