---
status: pending
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

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent/context/context-cache.ts`
- `server/src/agent/orchestrator/orchestrator.ts`

**Components:** Agent context caching, orchestrator

## Acceptance Criteria

- [ ] ContextCache class is injectable via constructor
- [ ] Orchestrator accepts cache via constructor parameter
- [ ] Default singleton maintained for backward compatibility
- [ ] Unit tests can inject mock cache
- [ ] Integration tests pass

## Work Log

| Date       | Action                           | Learnings                             |
| ---------- | -------------------------------- | ------------------------------------- |
| 2025-12-31 | Created from Phase 5 code review | Singleton pattern hinders testability |

## Resources

- [Phase 5 Architecture Review](internal)
- [Dependency Injection in TypeScript](https://www.typescriptlang.org/docs/handbook/2/classes.html)
