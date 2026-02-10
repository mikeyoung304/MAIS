---
status: pending
priority: p3
issue_id: '5255'
tags: [code-review, testability, pr-44]
dependencies: []
---

# Extract cache implementations trapped in route closures

## Problem Statement

Three LRUCache instances created inside route factory functions in discovery.routes.ts:91,116 and marketing.routes.ts:301. Prevents testing cache behavior in isolation.

## Findings

- Cache instances trapped in closure scope at:
  - `server/src/routes/internal-agent/discovery.routes.ts:91`
  - `server/src/routes/internal-agent/discovery.routes.ts:116`
  - `server/src/routes/internal-agent/marketing.routes.ts:301`
- Current pattern makes cache behavior untestable
- No way to verify cache hits/misses in unit tests
- Cannot test cache invalidation logic independently

## Proposed Solutions

### Option 1: Extract to shared agent-caches module

**Approach:** Create `server/src/lib/agent-caches.ts` with singleton instances and get/set/invalidate methods.

**Pros:**

- Enables isolated testing of cache behavior
- Centralizes cache configuration
- Follows existing singleton pattern in codebase

**Cons:**

- Requires refactoring route factories
- Adds one more shared module

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent/discovery.routes.ts:91,116` - two cache instances
- `server/src/routes/internal-agent/marketing.routes.ts:301` - one cache instance
- New file: `server/src/lib/agent-caches.ts` - shared cache module

**Related components:**

- All agent route handlers using caches
- Test suites that need cache behavior verification

## Resources

- **PR:** #44
- **Pattern reference:** Existing singleton patterns in `server/src/lib/`

## Acceptance Criteria

- [ ] Cache instances extracted to shared module
- [ ] Route factories import and use shared cache instances
- [ ] Unit tests verify cache behavior
- [ ] All existing tests pass
- [ ] Cache invalidation methods exposed and tested

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Found 3 cache instances trapped in route closures
- Documented testability impact

## Notes

- Low priority: existing pattern works functionally
- Testability improvement is nice-to-have
- Consider during next major refactor of agent routes
