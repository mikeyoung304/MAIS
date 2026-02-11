---
title: Service Extraction with DI Registration and Circular Dependency Resolution
category: logic-errors
severity: medium
component: server/src/services/discovery.service.ts, server/src/services/research.service.ts, server/src/di.ts
date: 2026-02-11
symptoms:
  - Business logic duplicated between route handlers and service layer
  - Route handlers contain 40-50 lines of inline orchestration
  - Cannot register services in DI due to circular dependency
  - ResearchService reads process.env directly, making testing difficult
  - No unit tests for service methods that were embedded in routes
root_cause: Route handlers contained business logic (onboarding completion, reveal marking) that belonged in the service layer, and ResearchService ↔ DiscoveryService had a circular callback dependency that blocked DI registration
solution_pattern: Discriminated union result types + setter injection for circular DI dependencies
tags:
  [
    service-extraction,
    dependency-injection,
    circular-dependency,
    setter-injection,
    discriminated-unions,
    testing,
    vitest,
  ]
related:
  - docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md
  - docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md
  - docs/solutions/test-failures/test-isolation-di-container-race-conditions.md
---

# Service Extraction with DI Registration and Circular Dependency Resolution

## Problem

Three related issues in the MAIS codebase needed sequential resolution:

### 1. Business Logic in Route Handlers

Route handlers in `internal-agent-discovery.routes.ts` contained 40-50 lines of inline logic for `complete-onboarding` and `mark-reveal-completed` endpoints. This violated the thin-handler pattern and made unit testing impossible without HTTP infrastructure.

```typescript
// BEFORE: Route handler doing too much
router.post('/complete-onboarding', async (req, res) => {
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) return res.status(404).json({ error: 'Not found' });
  if (tenant.onboardingPhase === 'COMPLETED') {
    return res.json({ status: 'already_complete', completedAt: tenant.onboardingCompletedAt });
  }
  const packages = await catalogService.getAllPackages(tenantId);
  if (packages.length === 0) {
    return res.json({ status: 'no_packages' });
  }
  const now = new Date();
  await tenantRepo.update(tenantId, { onboardingPhase: 'COMPLETED', onboardingCompletedAt: now });
  discoveryService.invalidateBootstrapCache(tenantId);
  return res.json({ status: 'completed', completedAt: now /* ...more fields */ });
});
```

### 2. Circular Dependency Blocking DI Registration

`DiscoveryService` depends on `ResearchService` (to trigger research). `ResearchService` needs to call `DiscoveryService.invalidateBootstrapCache()` after storing research results. This circular callback dependency prevented straightforward DI registration:

```
DiscoveryService
    ↓ constructor param
ResearchService
    ↓ needs callback to
DiscoveryService.invalidateBootstrapCache()
    ↓ CYCLE!
```

### 3. Environment Coupling in ResearchService

`ResearchService` read `process.env.RESEARCH_AGENT_URL` directly in the constructor, coupling it to the runtime environment and making unit testing require environment variable manipulation.

## Investigation Steps

1. **Mapped the dependency graph** between DiscoveryService, ResearchService, and route handlers
2. **Identified the circular callback** — ResearchService's `storeResearchData()` calls `invalidateBootstrapCache` which lives on DiscoveryService
3. **Evaluated two patterns**: registry extraction (used in [orchestrator circular dep](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)) vs setter injection
4. **Chose setter injection** because the callback is a single function, not a complex interface — registry extraction would be over-engineering

## Solution

### Step 1: Service Extraction with Discriminated Union Results

Extract business logic into service methods that return discriminated union types, keeping route handlers as thin HTTP mappers:

```typescript
// discovery.service.ts — Result types
export type CompleteOnboardingResult =
  | { status: 'completed'; completedAt: Date; publishedUrl?: string; packagesCreated?: number }
  | { status: 'already_complete'; completedAt: Date | null }
  | { status: 'no_packages' };

export type MarkRevealCompletedResult =
  | { status: 'completed' }
  | { status: 'already_completed' };

// discovery.service.ts — Service method
async completeOnboarding(
  tenantId: string,
  opts?: { publishedUrl?: string }
): Promise<CompleteOnboardingResult> {
  const tenant = await this.tenantRepo.findById(tenantId);
  if (!tenant) throw new TenantNotFoundError(tenantId);

  if (tenant.onboardingPhase === 'COMPLETED') {
    return { status: 'already_complete', completedAt: tenant.onboardingCompletedAt };
  }

  if (!this.catalogService) throw new ServiceUnavailableError('CatalogService');
  const packages = await this.catalogService.getAllPackages(tenantId);
  if (packages.length === 0) return { status: 'no_packages' };

  const now = new Date();
  await this.tenantRepo.update(tenantId, {
    onboardingPhase: 'COMPLETED',
    onboardingCompletedAt: now,
  });
  this.invalidateBootstrapCache(tenantId);

  return {
    status: 'completed',
    completedAt: now,
    publishedUrl: opts?.publishedUrl,
    packagesCreated: packages.length,
  };
}
```

```typescript
// Route handler — thin HTTP mapper
router.post('/complete-onboarding', async (req, res) => {
  try {
    const result = await discoveryService.completeOnboarding(tenantId, {
      publishedUrl: req.body.publishedUrl,
    });
    switch (result.status) {
      case 'completed':
        return res.json({ ok: true, ...result });
      case 'already_complete':
        return res.json({ ok: true, ...result });
      case 'no_packages':
        return res.status(400).json({ error: 'No packages created yet' });
    }
  } catch (err) {
    if (err instanceof TenantNotFoundError) return res.status(404).json({ error: err.message });
    throw err;
  }
});
```

### Step 2: Setter Injection for Circular Dependency

Break the circular dependency by constructing ResearchService first without the callback, then wiring it after DiscoveryService exists:

```typescript
// research.service.ts — Setter injection
export class ResearchService {
  private readonly researchAgentUrl: string | undefined;
  private onBootstrapCacheInvalidate: ((tenantId: string) => void) | undefined;

  constructor(
    private readonly tenantRepo: PrismaTenantRepository,
    researchAgentUrl?: string // Param injection instead of process.env
  ) {
    this.researchAgentUrl = researchAgentUrl;
  }

  /** Setter injection — called after DiscoveryService is constructed */
  setBootstrapCacheInvalidator(fn: (tenantId: string) => void): void {
    this.onBootstrapCacheInvalidate = fn;
  }

  private async storeResearchData(tenantId: string, data: unknown): Promise<void> {
    // ... store logic ...
    this.onBootstrapCacheInvalidate?.(tenantId); // Optional chaining — safe before setter called
  }
}
```

### Step 3: DI Registration with Setter Wiring

```typescript
// di.ts — Registration order matters
const researchService = new ResearchService(tenantRepo, process.env.RESEARCH_AGENT_URL);
const discoveryService = new DiscoveryService(
  tenantRepo,
  contextBuilder,
  researchService,
  catalogService
);
// Wire the circular callback AFTER both exist
researchService.setBootstrapCacheInvalidator((tenantId) =>
  discoveryService.invalidateBootstrapCache(tenantId)
);
```

### Step 4: Route Factory DI Resolution with Fallback

```typescript
// internal-agent-discovery.routes.ts — Prefer DI, fallback to local construction
let discoveryService: DiscoveryService;
let researchService: ResearchService;

if (deps.discoveryService && deps.researchService) {
  discoveryService = deps.discoveryService;
  researchService = deps.researchService;
} else {
  // Fallback for tests that don't provide DI services
  researchService = new ResearchService(tenantRepo, process.env.RESEARCH_AGENT_URL);
  discoveryService = new DiscoveryService(
    tenantRepo,
    contextBuilder,
    researchService,
    catalogService
  );
  researchService.setBootstrapCacheInvalidator((tenantId) =>
    discoveryService.invalidateBootstrapCache(tenantId)
  );
}
```

## Testing Patterns

### Fire-and-Forget Async Testing

`triggerAsync()` starts an async IIFE and returns immediately. Use `vi.waitFor()` to wait for the async work to settle:

```typescript
it('fires fetch when researchAgentUrl is configured', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ competitors: [] }),
    })
  );
  tenantRepo.findById.mockResolvedValue(makeTenant());

  service.triggerAsync('tenant-1', 'Photography', 'Austin');

  // Wait for fire-and-forget async IIFE to complete
  await vi.waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      'https://research.test.com/research',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

### Constants Sync Testing

Cloud Run agents maintain local copies of constants due to `rootDir` constraints. Drift tests catch when someone edits one source but forgets the other:

```typescript
import { MVP_REVEAL_SECTION_TYPES } from '@macon/contracts';
import { MVP_SECTION_TYPES as AGENT_MVP_SECTION_TYPES } from '../agent-v2/deploy/tenant/src/constants/shared';

it('agent copy matches canonical contracts source', () => {
  const canonical = [...MVP_REVEAL_SECTION_TYPES].sort();
  const agent = [...AGENT_MVP_SECTION_TYPES].sort();
  expect(agent).toEqual(canonical);
});
```

### Mock Factory Pattern

Each dependency gets a factory function that returns a mock with sensible defaults:

```typescript
function createMockTenantRepo() {
  return { findById: vi.fn(), update: vi.fn() };
}

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Studio',
    tier: 'FREE',
    onboardingPhase: 'NOT_STARTED',
    branding: {},
    ...overrides,
  };
}
```

## Prevention Strategies

### 1. Recognize Route Handler Bloat Early

**Rule of thumb:** If a route handler exceeds ~15 lines of logic beyond request parsing and response formatting, extract to service layer.

**Signs of bloat:**

- Multiple `await` calls to repositories
- Conditional branching on business rules
- Result construction with derived fields

### 2. Choose the Right Circular Dependency Pattern

| Pattern                  | When to Use                           | Complexity |
| ------------------------ | ------------------------------------- | ---------- |
| **Setter injection**     | Single callback between two services  | Low        |
| **Registry extraction**  | Multiple consumers need shared lookup | Medium     |
| **Event emitter**        | Many-to-many notifications            | High       |
| **Interface extraction** | Complex bidirectional dependency      | Medium     |

### 3. Constructor Param Injection Over process.env

**Always** pass configuration values as constructor parameters:

- Enables unit testing without environment manipulation
- Makes dependencies explicit in the type signature
- DI container owns the `process.env` read, not the service

### 4. Discriminated Union Results Over Exceptions

Use discriminated unions for expected outcomes, exceptions for unexpected failures:

```typescript
// Good — expected outcomes as union members
type Result = { status: 'completed' } | { status: 'already_complete' } | { status: 'no_packages' };

// Bad — using exceptions for expected business outcomes
if (alreadyComplete) throw new AlreadyCompleteError();
```

### 5. Test Fire-and-Forget Methods

Any method that starts async work without awaiting must be tested with `vi.waitFor()`:

```typescript
// The method returns void but does async work internally
service.triggerAsync('tenant-1', 'Photography', 'Austin');

// vi.waitFor polls until the assertion passes or times out
await vi.waitFor(() => {
  expect(fetch).toHaveBeenCalled();
});
```

## Files Modified

| File                                                   | Change                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `server/src/services/discovery.service.ts`             | Added CatalogService dep, CompleteOnboardingResult/MarkRevealCompletedResult types, 2 new methods |
| `server/src/services/research.service.ts`              | Constructor param injection, setter injection for cache invalidation                              |
| `server/src/routes/internal-agent-discovery.routes.ts` | Thin route handlers, DI service resolution with fallback                                          |
| `server/src/routes/internal-agent-shared.ts`           | Extended DiscoveryRoutesDeps with optional service fields                                         |
| `server/src/routes/index.ts`                           | Added discovery/research to Services interface                                                    |
| `server/src/di.ts`                                     | Registered both services in mock + real branches                                                  |
| `server/src/services/discovery.service.test.ts`        | 28 unit tests (new)                                                                               |
| `server/src/services/research.service.test.ts`         | 11 unit tests (new)                                                                               |
| `server/src/lib/constants-sync.test.ts`                | 3 constants drift tests (new)                                                                     |

## Cross-References

- **Related pattern (different approach):** [Circular Dependency: Executor Registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md) — uses registry module extraction for complex multi-consumer scenarios
- **Service layer patterns:** [Service Layer Best Practices](../best-practices/service-layer-patterns-MAIS-20251204.md)
- **DI container patterns:** [Test Isolation: DI Container Race Conditions](../test-failures/test-isolation-di-container-race-conditions.md)
- **Agent debt cleanup PR:** [PR #45](https://github.com/mikeyoung/mais/pull/45) — parent sprint that identified these todos
- **Pitfall #14:** Orphan imports after deletions — always run clean typecheck
- **Pitfall #18:** Cloud Run constants sync — tested by constants-sync.test.ts
