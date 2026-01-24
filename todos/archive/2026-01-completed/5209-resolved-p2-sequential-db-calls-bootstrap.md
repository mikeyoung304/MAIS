---
status: complete
priority: p2
issue_id: '5209'
tags: [code-review, session-bootstrap, performance]
dependencies: []
---

# Sequential DB Calls in Bootstrap Could Be Parallelized

## Problem Statement

The bootstrap endpoint makes 2 sequential database calls that are independent and could run in parallel with `Promise.all()`.

**Why it matters:** Adds ~50-100ms latency per cache miss. At scale, this adds up.

## Findings

**Location:** `server/src/routes/internal-agent.routes.ts:309-338`

**Current Code:**

```typescript
const tenant = await tenantRepo.findById(tenantId);
// ... validation ...
const context = await advisorMemoryService.getOnboardingContext(tenantId);
```

These two calls are independent - tenant lookup and memory context fetch can run simultaneously.

**Reviewer:** Performance Oracle (P2)

## Proposed Solutions

### Option A: Parallelize with Promise.all (Recommended)

**Pros:** ~50% latency reduction on cache miss
**Cons:** Slightly more complex error handling
**Effort:** Small
**Risk:** Low

```typescript
const [tenant, context] = await Promise.all([
  tenantRepo.findById(tenantId),
  advisorMemoryService.getOnboardingContext(tenantId).catch((err) => {
    logger.warn({ tenantId, error: err }, 'Failed to fetch advisor memory');
    return null;
  }),
]);

if (!tenant) {
  return res.status(404).json({ error: 'Tenant not found' });
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`

**Performance Impact:**

- Before: ~100-150ms (sequential)
- After: ~50-100ms (parallel)

## Acceptance Criteria

- [ ] Both DB calls execute in parallel
- [ ] Error handling preserved (tenant 404, graceful memory degradation)
- [ ] Latency reduced by ~30-50% on cache miss

## Work Log

| Date       | Action                         | Learnings                                      |
| ---------- | ------------------------------ | ---------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Performance Oracle identified sequential calls |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Performance Oracle
