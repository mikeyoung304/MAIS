# P2: Silent Test Skip May Hide CI Failures

**Status:** open
**Priority:** P2 (Important)
**Category:** Quality
**File:** `server/test/agent-eval/tenant-isolation.test.ts`
**Lines:** 65-66, 105-106, 118-119, etc. (7 occurrences)

## Problem

Tests use early returns that silently pass when the table doesn't exist:

```typescript
it('should NOT return traces from other tenants', async () => {
  if (!tableExists) return; // Test silently passes
  // ... actual test code
});
```

**Impact:**

- CI reports 100% pass rate even when tests didn't run
- No visibility into which tests were actually executed

## Fix

Use Vitest's built-in skip mechanism:

```typescript
// Option 1: Suite-level skip
describe.skipIf(!tableExists)('Tenant Isolation - EvalPipeline', () => {
  // All tests in this suite skip if table doesn't exist
});

// Option 2: Per-test skip
it.skipIf(!tableExists)('should NOT return traces from other tenants', async () => {
  // No guard needed
});

// Option 3: Custom wrapper
const itIfTableExists = tableExists ? it : it.skip;

describe('getUnevaluatedTraces', () => {
  itIfTableExists('should NOT return traces from other tenants', async () => {
    // Actual test code, no guard
  });
});
```

This makes skipped tests visible in CI output.

## Source

Code review of commit b2cab182 - Quality/Architecture reviewer finding
