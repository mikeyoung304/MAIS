---
status: deferred
priority: p2
issue_id: '5207'
tags: [code-review, session-bootstrap, testing, cache]
dependencies: ['5206']
---

# Cache TTL and Eviction Not Tested

## Problem Statement

The bootstrap cache has TTL (30 min) and max size (1000) limits, but no tests verify this behavior. The cache could silently serve stale data or grow unbounded.

**Why it matters:** Cache bugs are hard to debug in production and could cause incorrect onboarding state to be served.

## Findings

**Location:** `server/test/routes/internal-agent-bootstrap.test.ts:254-269`

**Current Test:** Only verifies cached responses reduce DB calls, but:

- Doesn't test TTL expiration
- Doesn't test max size eviction
- Doesn't test cache invalidation after mutations

**Missing Test Cases:**

1. `should expire cache after TTL`
2. `should evict oldest entry when cache exceeds max size`
3. `should invalidate cache after complete-onboarding`
4. `should invalidate cache after store-discovery-fact`

**Reviewer:** Test Coverage Review (TC-003, TC-008)

## Proposed Solutions

### Option A: Add Cache Behavior Tests (Recommended)

**Pros:** Validates cache correctness
**Cons:** May need to mock Date.now() or expose cache for testing
**Effort:** Small
**Risk:** Low

```typescript
it('should expire cache after TTL', async () => {
  // First call - cache miss
  await request(app).post('/bootstrap').send({ tenantId });

  // Advance time past TTL
  vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

  // Second call - should be cache miss (expired)
  await request(app).post('/bootstrap').send({ tenantId });

  expect(mockTenantRepo.findById).toHaveBeenCalledTimes(2);
});
```

### Option B: Extract Cache to Injectable Service

**Pros:** Better testability, follows DI pattern
**Cons:** Larger refactor
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/routes/internal-agent-bootstrap.test.ts`

**Test Infrastructure Needed:**

- `vi.useFakeTimers()` for TTL tests
- May need to expose cache size for eviction tests

## Acceptance Criteria

- [ ] Test verifies cache expires after 30 minutes
- [ ] Test verifies cache evicts entries at 1000 max size
- [ ] Test verifies cache invalidation after mutations
- [ ] All cache tests pass

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-20 | Created from /workflows:review | Test Coverage reviewer found missing cache tests |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Test Coverage Reviewer
- Cache implementation: internal-agent.routes.ts:263-378
