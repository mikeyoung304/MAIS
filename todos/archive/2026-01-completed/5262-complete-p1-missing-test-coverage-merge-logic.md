---
status: complete
priority: p1
issue_id: '5262'
tags: [code-review, testing, pr-28]
source: PR #28 multi-agent review
---

# P1: Missing Test Coverage for Critical Merge Logic

## Problem Statement

Major features added in PR #28 lack corresponding test coverage. The merge logic in `normalizeToPages()` is complex with multiple edge cases that could cause regressions.

**Why it matters:** Without tests, the complex section merging, ID collision prevention, and defaults logic could regress silently.

## Findings

**Missing tests identified:**

1. **`revert_branding` tool** - No tests in `storefront-tools.test.ts`
2. **`buildStorefrontCompletionStatus()`** - No test file exists
3. **`mergeWithDefaults()` and `mergeSections()`** - No tests for merge logic
4. **`normalizeToPages()` enhancements** - Existing tests may not cover new merge paths
5. **Circuit breaker idle timeout** - `isIdle()` method added but not tested

**Location:** `apps/web/src/lib/tenant.client.ts` (lines 179-282)

**Edge cases needing coverage:**

- ID collision when merging sections
- Type matching with fallback
- Section ordering preservation
- Empty/null config handling
- Corrupted branding history format

## Proposed Solutions

### Option A: Add Unit Tests Before Merge (Recommended)

**Pros:** Ensures correctness, enables safe refactoring
**Cons:** Delays merge by ~2 hours
**Effort:** Medium (2 hours)

```typescript
// storefront-tools.test.ts - add to imports
import { revertBrandingTool } from '...';

describe('revert_branding', () => {
  it('should pre-check for history existence', async () => { ... });
  it('should validate 24-hour TTL', async () => { ... });
  it('should return canRevert flag', async () => { ... });
  it('should handle corrupted history format', async () => { ... });
});

// tenant.client.test.ts - new file or extend existing
describe('normalizeToPages merge logic', () => {
  it('should merge existing sections with defaults by type', () => { ... });
  it('should avoid duplicate sections with same ID', () => { ... });
  it('should preserve custom section order', () => { ... });
  it('should handle empty config gracefully', () => { ... });
});
```

### Option B: Track as Follow-up Tech Debt

**Pros:** Allows faster merge
**Cons:** Risk of regression, violates test-first principle
**Effort:** None now, Medium later

## Technical Details

**Files needing tests:**

- `server/test/agent/storefront/storefront-tools.test.ts`
- `apps/web/src/lib/__tests__/tenant.client.test.ts` (new)
- `server/test/agent/orchestrator/circuit-breaker.test.ts`

**Test patterns to follow:**

- Use `vitest` for unit tests
- Mock Prisma client for DB interactions
- Test edge cases explicitly

## Acceptance Criteria

- [ ] `revert_branding` tool has test coverage
- [ ] `mergeWithDefaults()` has tests for ID collision
- [ ] `mergeSections()` has tests for type matching
- [ ] `normalizeToPages()` has tests for empty/corrupted input
- [ ] Circuit breaker `isIdle()` has test coverage

## Work Log

| Date       | Action                                       | Learnings                                                 |
| ---------- | -------------------------------------------- | --------------------------------------------------------- |
| 2026-01-22 | Identified during PR #28 code quality review | Complex merge logic without tests is high regression risk |

## Resources

- PR #28: Agent system integrity fixes
- Code quality review agent finding P1 #3
