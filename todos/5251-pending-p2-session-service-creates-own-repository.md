---
status: pending
priority: p2
issue_id: '5251'
tags: [code-review, architecture, testing]
dependencies: []
---

# P2: SessionService Creates Its Own Repository (DI Violation)

## Problem Statement

`SessionService` instantiates its own `SessionRepository` in the constructor instead of receiving it via dependency injection. This prevents injecting a mock repository for unit testing the service in isolation.

**Why it matters:** Makes unit testing difficult; forces integration tests for service logic.

## Findings

**File:** `server/src/services/session/session.service.ts:73-74`

```typescript
constructor(prisma: PrismaClient, cache?: SessionCache, config?: Partial<SessionServiceConfig>) {
  this.repository = createSessionRepository(prisma);  // Creates own dependency
  this.cache = cache ?? defaultCache;
  this.config = { ...DEFAULT_CONFIG, ...config };
}
```

Note: Cache is injectable but Repository is not - inconsistent pattern.

## Proposed Solutions

### Option A: Make repository injectable (Recommended)

**Pros:** Enables proper unit testing, consistent with cache
**Cons:** Minor API change
**Effort:** Small
**Risk:** Low

```typescript
constructor(
  repository: SessionRepository,  // Inject via constructor
  cache?: SessionCache,
  config?: Partial<SessionServiceConfig>
) {
  this.repository = repository;
  this.cache = cache ?? defaultCache;
  this.config = { ...DEFAULT_CONFIG, ...config };
}

// Update factory function
export function createSessionService(
  prisma: PrismaClient,
  repository?: SessionRepository,
  cache?: SessionCache,
  config?: Partial<SessionServiceConfig>
): SessionService {
  return new SessionService(
    repository ?? createSessionRepository(prisma),
    cache,
    config
  );
}
```

### Option B: Keep current behavior

**Pros:** No code change
**Cons:** Testing limitations remain
**Effort:** None
**Risk:** Technical debt

## Recommended Action

Option A - Make repository injectable through constructor.

## Technical Details

**Affected files:**

- `server/src/services/session/session.service.ts`
- Tests that create SessionService

## Acceptance Criteria

- [ ] SessionService accepts repository via constructor
- [ ] Factory function provides default repository
- [ ] Mock repository can be injected for testing
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [Dependency Injection Pattern](https://martinfowler.com/articles/injection.html)
