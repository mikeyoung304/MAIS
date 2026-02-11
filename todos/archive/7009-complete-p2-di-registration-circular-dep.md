---
status: pending
priority: p2
issue_id: '7009'
tags: [code-review, architecture, testability, pr-45]
dependencies: ['7008']
---

# 7009: Register Services in DI + Resolve Circular Dependency + Env Injection

## Problem Statement

Three related architecture issues with `DiscoveryService` and `ResearchService`:

1. **Not in DI container** — Both services are instantiated inside the route factory function, not in `di.ts`. They can't be injected elsewhere or easily mocked in integration tests.

2. **Circular dependency via closure** — `ResearchService` takes a cache invalidation callback, `DiscoveryService` takes the `ResearchService`. Wired via a closure that captures `discoveryService` before it's assigned:

```typescript
const researchService = new ResearchService(
  tenantRepo,
  (tenantId) => discoveryService.invalidateBootstrapCache(tenantId) // captured before assignment!
);
const discoveryService = new DiscoveryService(tenantRepo, contextBuilder, researchService);
```

3. **ResearchService reads process.env in constructor** — `this.researchAgentUrl = process.env.RESEARCH_AGENT_URL` couples the service to the process environment, making it harder to test.

## Recommended Action

1. **Extract BootstrapCacheManager** — Create a shared cache manager that both services depend on, eliminating the circular reference:

```typescript
class BootstrapCacheManager {
  private cache: LRUCache<string, BootstrapData>;
  invalidate(tenantId: string): void { ... }
}
```

2. **Register in di.ts** — Instantiate `BootstrapCacheManager`, `ResearchService`, and `DiscoveryService` in the DI container, pass through route deps.

3. **Inject env vars** — Pass `researchAgentUrl` as a constructor parameter instead of reading `process.env`.

## Technical Details

- **Affected files:** `server/src/di.ts`, `server/src/services/discovery.service.ts`, `server/src/services/research.service.ts`, `server/src/routes/internal-agent-discovery.routes.ts`
- **Components:** DI container, DiscoveryService, ResearchService
- **Database:** No changes

## Acceptance Criteria

- [ ] DiscoveryService and ResearchService registered in `di.ts`
- [ ] No circular dependency (either via BootstrapCacheManager or setter pattern)
- [ ] ResearchService accepts `researchAgentUrl` as constructor param, not `process.env`
- [ ] Route factory receives services via deps, not instantiating them
- [ ] Typecheck passes
- [ ] Services can be instantiated with mock dependencies in tests

## Work Log

| Date       | Action                     | Learnings                              |
| ---------- | -------------------------- | -------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Architecture Strategist agent |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/di.ts`
- File: `server/src/routes/internal-agent-discovery.routes.ts:76-80`
