---
status: complete
completed_date: 2026-01-01
priority: p2
issue_id: '517'
tags:
  - code-review
  - architecture
  - testability
  - phase-5
dependencies: []
---

# Singleton Cache Pattern Prevents Testability

## Problem Statement

The context cache is exported as a singleton (`contextCache`), making it impossible to inject a mock cache in tests or configure different TTLs for different environments.

**Why it matters:** The orchestrator imports `contextCache` directly instead of receiving it via constructor injection. This couples the orchestrator tightly to the singleton and makes unit testing require module mocking hacks.

## Findings

**Source:** Architecture Review Agent

**Location:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/context/context-cache.ts` (line 181)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts` (line 850)

**Evidence:**

```typescript
// context-cache.ts:181
export const contextCache = new ContextCache();

// orchestrator.ts:850
const cached = contextCache.get(tenantId); // Direct import, not injected
```

## Proposed Solutions

### Solution 1: Dependency Injection Pattern (Recommended)

**Description:** Export class and factory, allow injection in orchestrator

```typescript
// context-cache.ts
export class ContextCache { ... }

export function createContextCache(config?: Partial<ContextCacheConfig>): ContextCache {
  return new ContextCache(config);
}

export const defaultContextCache = new ContextCache();

// orchestrator.ts
constructor(
  private readonly prisma: PrismaClient,
  config: Partial<OrchestratorConfig> = {},
  private readonly cache: ContextCache = defaultContextCache
) { ... }
```

**Pros:**

- Enables test injection without module mocking
- Allows per-environment configuration
- Maintains backward compatibility via default

**Cons:**

- Slightly more complex constructor
- Need to update tests that create orchestrator

**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Module-Level Reset Function

**Description:** Add a reset function for tests

```typescript
export function resetCacheForTesting(): void {
  contextCache.clear();
}
```

**Pros:**

- Simple implementation
- Minimal code changes

**Cons:**

- Only solves test isolation, not configuration
- Still can't inject mocks

**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

Implemented Solution 1 (Dependency Injection Pattern).

## Technical Details

**Affected files:**

- `server/src/agent/context/context-cache.ts`
- `server/src/agent/orchestrator/base-orchestrator.ts`
- `server/src/agent/orchestrator/admin-orchestrator.ts`

**Components:** Agent context caching, orchestrator

## Acceptance Criteria

- [x] ContextCache class is injectable via constructor
- [x] Orchestrator accepts cache via constructor parameter
- [x] Default singleton maintained for backward compatibility
- [x] Unit tests can inject mock cache
- [x] Integration tests pass

## Work Log

| Date       | Action                                                                                  | Learnings                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-12-31 | Created from Phase 5 code review                                                        | Singleton pattern hinders testability                                                                                                        |
| 2026-01-01 | Implemented DI pattern: added defaultContextCache, updated BaseOrchestrator constructor | AdminOrchestrator inherits cache via protected `this.cache` from BaseOrchestrator; 243 tests pass including all cache and orchestrator tests |

## Implementation Summary

### Changes Made

1. **context-cache.ts**:
   - Added `defaultContextCache` as the primary export (preferred in new code)
   - Kept `contextCache` as a backward-compatible alias (deprecated)
   - `createContextCache()` factory already existed

2. **base-orchestrator.ts**:
   - Added `protected readonly cache: ContextCache` class property
   - Updated constructor to accept optional `cache` parameter with default to `defaultContextCache`
   - Updated all usages from global `contextCache` to `this.cache`
   - All subclasses automatically inherit cache via `this.cache`

3. **admin-orchestrator.ts**:
   - Removed direct import of `contextCache`
   - Updated `buildCachedContext()` to use `this.cache` from parent class

### Test Injection Pattern

```typescript
// In tests - create isolated cache instance
import { createContextCache, ContextCache } from './context-cache';
import { MyOrchestrator } from './my-orchestrator';

describe('MyOrchestrator', () => {
  let testCache: ContextCache;
  let orchestrator: MyOrchestrator;

  beforeEach(() => {
    testCache = createContextCache({ ttlMs: 100 }); // Short TTL for tests
    orchestrator = new MyOrchestrator(prisma, testCache);
  });

  afterEach(() => {
    testCache.clear(); // Isolated cleanup
  });
});
```

## Resources

- [Phase 5 Architecture Review](internal)
- [Dependency Injection in TypeScript](https://www.typescriptlang.org/docs/handbook/2/classes.html)
