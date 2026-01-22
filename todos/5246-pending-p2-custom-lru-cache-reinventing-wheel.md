---
status: pending
priority: p2
issue_id: '5246'
tags: [code-review, simplicity, yagni]
dependencies: []
---

# P2: Custom LRU Cache Reinvents the Wheel

## Problem Statement

A 248-line custom LRU cache implementation exists when `lru-cache` npm package is already installed and used elsewhere in the codebase (`internal-agent.routes.ts:56`).

**Why it matters:**

- 238 lines of unnecessary code to maintain
- Higher bug risk (custom implementation vs battle-tested library)
- Inconsistent patterns across codebase

## Findings

**File:** `server/src/services/session/session.cache.ts` (248 lines)

```typescript
// Current: 248 lines of custom code
export class SessionCache {
  private cache = new Map<string, CacheEntry>();
  // ... 200+ lines of manual LRU logic, TTL handling, eviction, etc.
}
```

**Better approach (10 lines):**

```typescript
import { LRUCache } from 'lru-cache';

const sessionCache = new LRUCache<string, SessionWithMessages>({
  max: 2000,
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

**Flagged by:** Simplicity reviewer as P1 finding

## Proposed Solutions

### Option A: Replace with lru-cache (Recommended)

**Pros:** Battle-tested, less code, consistent with rest of codebase
**Cons:** Minor API differences
**Effort:** Small
**Risk:** Low

### Option B: Keep custom implementation

**Pros:** No code changes
**Cons:** Maintains tech debt, inconsistent patterns
**Effort:** None
**Risk:** Higher maintenance burden

## Recommended Action

Option A - Replace with `lru-cache` package. The package is already a dependency.

## Technical Details

**Affected files:**

- `server/src/services/session/session.cache.ts` (rewrite)
- `server/src/services/session/session.service.ts` (minor interface updates)
- `server/src/services/session/index.ts` (update exports)

**Lines saved:** ~238

## Acceptance Criteria

- [ ] Custom cache replaced with lru-cache
- [ ] Same TTL (5 minutes) and max entries (2000)
- [ ] Cache key includes tenantId for isolation
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [lru-cache npm package](https://www.npmjs.com/package/lru-cache)
