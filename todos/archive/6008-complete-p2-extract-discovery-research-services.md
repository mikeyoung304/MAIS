# Extract DiscoveryService and ResearchService from Routes

**Priority:** P2
**Files:** `server/src/routes/internal-agent-discovery.routes.ts` → new service files
**Blocked by:** 6007 (dead code cleanup simplifies routes first)
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

The `/store-discovery-fact` route handler is 140 lines containing business logic that should be in services:

- Fact storage in branding JSON (read-modify-write)
- Research trigger condition evaluation
- Phase computation via slot machine
- Bootstrap cache invalidation
- Fire-and-forget async HTTP call to research agent (50+ lines)
- Response assembly with slot machine metrics

The research integration is also embedded directly in the route with no retry logic, and a race condition on the branding JSON column.

## Fix

### 1. Create `DiscoveryService`

**New file:** `server/src/services/discovery.service.ts`

```typescript
export class DiscoveryService {
  constructor(
    private tenantRepo: ITenantRepository,
    private researchService: ResearchService,
  ) {}

  /**
   * Store a discovery fact and compute the next action.
   * Handles: fact merge, phase computation, research trigger, cache invalidation.
   */
  async storeFact(tenantId: string, key: string, value: unknown): Promise<StoreFactResult> {
    // 1. Read tenant branding
    // 2. Merge fact into discoveryFacts
    // 3. Write back (TODO: consider advisory lock for concurrency)
    // 4. Compute slot machine result
    // 5. Trigger research if needed (via researchService)
    // 6. Return slot machine result
  }

  async getDiscoveryFacts(tenantId: string): Promise<DiscoveryFactsResult> { ... }
  async getResearchData(tenantId: string): Promise<ResearchDataResult> { ... }
}
```

### 2. Create `ResearchService`

**New file:** `server/src/services/research.service.ts`

```typescript
export class ResearchService {
  /**
   * Fire-and-forget async research trigger.
   * Handles: auth token, HTTP call, result storage, error handling.
   */
  async triggerAsync(tenantId: string, businessType: string, location: string): Promise<void> {
    // Extract the 50-line async HTTP workflow from the route
    // Add retry logic (currently missing — if research fails, it's permanently lost)
    // Fix: clear _researchTriggered flag on failure so retry is possible
  }

  async getPrecomputedResults(tenantId: string): Promise<ResearchData | null> { ... }
}
```

### 3. Slim the route handler

The `/store-discovery-fact` route should become:

```typescript
router.post('/store-discovery-fact', async (req, res) => {
  const { tenantId, key, value } = StoreDiscoveryFactSchema.parse(req.body);
  const result = await discoveryService.storeFact(tenantId, key, value);
  res.json(result);
});
```

~140 lines → ~5 lines.

### 4. Fix the race condition

The current read-modify-write on `tenant.branding` has no locking. Two concurrent `store_discovery_fact` calls can lose data. In the new `DiscoveryService`:

- Use Prisma's `$executeRaw` with a JSON merge (PostgreSQL `jsonb_set`) for atomic updates, OR
- Use an advisory lock around the read-modify-write, OR
- At minimum, document the race condition and add a comment

### 5. Fix \_researchTriggered on failure

Currently `_researchTriggered` is set BEFORE the async call. If research fails (timeout, 500), the flag stays set permanently and research can never be retried. Fix: only set the flag AFTER successful research storage, or add a retry mechanism.

### 6. Register services in DI

Add `DiscoveryService` and `ResearchService` to `server/src/di.ts`.

## Verification

```bash
npm run --workspace=server typecheck
npm run --workspace=server test
```
