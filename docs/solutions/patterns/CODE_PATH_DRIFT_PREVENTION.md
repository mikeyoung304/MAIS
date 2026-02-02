---
title: 'Code Path Drift Prevention - Multiple Implementations Diverging'
category: patterns
tags:
  - code-review
  - data-integrity
  - dry-violations
  - repository-pattern
  - agent-routes
  - service-layer
severity: p1
components:
  - server/src/routes/internal-agent.routes.ts
  - server/src/adapters/prisma/tenant.repository.ts
  - server/src/services/landing-page.service.ts
symptoms:
  - '"No draft to publish" error when draft exists in legacy format'
  - Operation fails for some data formats but not others
  - Different error messages for the same operation via different endpoints
  - Missing transaction safety in one code path but not another
root_cause: 'Multiple implementations of the same operation diverge over time - repository evolves to handle edge cases while routes/services lag behind'
discovered: 2026-02-01
related_pitfalls: [19, 25, 56, 57, 81]
---

# Code Path Drift Prevention

## Problem Statement

**Code path drift** occurs when multiple implementations of the same business operation exist in different parts of the codebase and diverge over time. One path gets updated while others are forgotten, leading to inconsistent behavior.

**This pattern was discovered during code review of `feat/realtime-storefront-preview` branch:**

- Repository methods (`publishLandingPageDraft`, `discardLandingPageDraft`) correctly handle BOTH draft sources
- Agent routes (`/storefront/publish`, `/storefront/discard`) only check ONE draft source
- Result: Tenants with legacy drafts get "No draft to publish" errors through agent routes

## Root Cause

The root cause is **code path duplication** - the same business logic (determining if a publishable draft exists) was implemented in two places:

1. **Repository layer** (`tenant.repository.ts`): Correctly checks both draft sources
2. **Agent routes** (`internal-agent.routes.ts`): Only checks one draft source

When the dual-draft system was introduced (Build Mode column + Visual Editor wrapper), the repository was updated to handle both sources, but the agent routes were not. This created a silent regression where drafts saved through the Visual Editor wrapper format appeared as "no draft exists" when published through agent routes.

## The Pattern

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Agent Routes   │────▶│   Repository    │────▶│    Database     │
│  (thin layer)   │     │ (business logic)│     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ├── Check Build Mode column
         │                      ├── Check Visual Editor wrapper
    Just delegates              └── Future: Check third source
```

**Rule:** Routes should be thin HTTP handlers that delegate to services/repositories. Business logic belongs in one place.

## Solution

### Before (WRONG) - Route implements business logic directly

```typescript
// internal-agent.routes.ts - INCOMPLETE LOGIC
router.post('/storefront/publish', async (req, res) => {
  const { tenantId } = TenantIdSchema.parse(req.body);
  const tenant = await tenantRepo.findById(tenantId);

  // BUG: Only checks Build Mode column, ignores Visual Editor wrapper
  if (!tenant.landingPageConfigDraft) {
    res.status(400).json({ error: 'No draft to publish' });
    return;
  }

  // ... manual publish logic duplicating repository code
});
```

### After (CORRECT) - Route delegates to service/repository

```typescript
// internal-agent.routes.ts - DELEGATE TO SERVICE
router.post('/storefront/publish', async (req, res) => {
  const { tenantId } = TenantIdSchema.parse(req.body);

  try {
    // Service/Repository handles ALL draft sources correctly
    const result = await landingPageService.publishBuildModeDraft(tenantId);
    res.json({
      success: true,
      action: 'published',
      ...result,
    });
  } catch (error) {
    if (error.message === 'No draft changes to publish.') {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});
```

## Why Delegation is Better Than Duplication

### 1. Single Source of Truth

The repository is the canonical authority for data access patterns. When business rules change (e.g., adding a third draft source), only the repository needs updating.

### 2. Prevents Drift

With duplication, code paths inevitably drift apart:

- Developer A updates the repository
- Developer B updates the routes
- Neither knows about the other's changes
- Bug only surfaces when specific code path is used

### 3. Easier Testing

Repository methods can be unit tested with all edge cases. Routes only need integration tests verifying they call the repository correctly.

### 4. Clearer Error Handling

Repository can throw typed errors that routes translate to HTTP responses:

```typescript
// Repository throws domain errors
if (!draftToPublish) {
  throw new ValidationError('No draft to publish');
}

// Routes translate to HTTP
catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}
```

## Prevention Strategies

### Code Review Checklist

When reviewing code that performs data mutations:

```markdown
- [ ] Is this operation already implemented elsewhere?
  - Search: `grep -rn "publish.*draft\|discard.*draft" server/src/`
- [ ] If yes, does this new code DELEGATE to the existing implementation?
- [ ] If no delegation, document WHY a separate implementation is needed
- [ ] Are transaction/atomicity requirements satisfied?
- [ ] Is version management handled consistently?
```

### Red Flags (Smell Detection)

| Smell                              | Example                                         | What It Means              |
| ---------------------------------- | ----------------------------------------------- | -------------------------- |
| **Route handler > 15 lines**       | Long business logic in route                    | Should delegate to service |
| **Direct Prisma in routes**        | `await prisma.tenant.update(...)`               | Bypassing service layer    |
| **Conditional in multiple places** | `if (!tenant.draftConfig)` in route AND service | Duplicated validation      |
| **Comment referencing other impl** | `// Similar to publishDraft`                    | Will drift                 |
| **Missing transaction wrapper**    | Sequential updates without `$transaction`       | Lost atomicity             |

### Architectural Guidelines

| Operation Type          | Delegate To                 | Never In Routes          |
| ----------------------- | --------------------------- | ------------------------ |
| Publish/Discard draft   | `LandingPageService`        | Route handlers           |
| Create/Update entities  | `*Repository`               | Direct Prisma calls      |
| Multi-step transactions | Service with `$transaction` | Sequential route updates |
| Format transformations  | Shared utility functions    | Inline in routes         |

### Testing Strategy

Test that ALL paths produce identical results:

```typescript
describe('Publish Draft - Cross-Path Consistency', () => {
  it('REST API and Agent route handle dual-draft identically', async () => {
    // Setup: Draft in BOTH locations (edge case)
    await setupDraftInBothSources();

    // Test REST API path
    const restResult = await landingPageService.publish(tenantId);
    const tenantAfterRest = await getTenant();

    // Reset and test Agent route path
    await setupDraftInBothSources();
    const agentResult = await agentPublishRoute(tenantId);
    const tenantAfterAgent = await getTenant();

    // Both should clear BOTH draft sources
    expect(tenantAfterRest.landingPageConfigDraft).toBeNull();
    expect(tenantAfterRest.landingPageConfig.draft).toBeNull();
    expect(tenantAfterAgent.landingPageConfigDraft).toBeNull();
    expect(tenantAfterAgent.landingPageConfig.draft).toBeNull();
  });
});
```

### Detection Commands

```bash
# Find all implementations of "publish draft" operation
grep -rn "publish.*[Dd]raft\|landingPageConfig.*null" server/src/

# Find routes with direct repository calls that bypass services
grep -rn "tenantRepo\.\(update\|create\|delete\)" server/src/routes/

# Find conditional checks that might be duplicated
grep -rn "landingPageConfigDraft\s*[!=]=\|landingPageConfigDraft)" server/src/
```

## Quick Reference Card

```
CODE PATH DRIFT PREVENTION

Ask Before Writing:
1. Does this operation exist elsewhere? (grep it)
2. Should I delegate instead of implement?
3. What edge cases does the existing impl handle?

Red Flags in Review:
- Route handler > 15 lines
- Direct Prisma in routes
- Same conditional in multiple files
- Missing transaction wrapper

Testing Rule:
- Every operation needs cross-path test
- Same input → Same result across ALL paths
- Spy to verify delegation happens

The Fix Pattern:
- Identify canonical implementation (usually repository)
- Routes delegate to services
- Services call repositories
- Thin routes, thick services
```

## Related Documentation

- [CLAUDE.md Pitfall #19](../../../CLAUDE.md) - Duplicated tool logic (extract to shared utilities)
- [CLAUDE.md Pitfall #81](../../../CLAUDE.md) - Duplicate queries across service chain
- [CLAUDE.md Pitfalls #56-57](../../../CLAUDE.md) - Multi-path data format mismatch
- [SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md](SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md) - Service layer wiring
- [AGENT_TOOLS_PREVENTION_INDEX.md](AGENT_TOOLS_PREVENTION_INDEX.md) - Prevention Strategy 3: Code Duplication
- [mais-critical-patterns.md](mais-critical-patterns.md) - Repository interface patterns

## Resolution

**Todo #817** tracks the fix for the specific issue found:

1. Update `server/src/routes/internal-agent.routes.ts` to delegate `/storefront/publish` and `/storefront/discard` to repository methods
2. Add cross-path integration tests
3. Add CLAUDE.md pitfall #92 for this pattern

## CLAUDE.md Pitfall Addition

```markdown
### Code Path Drift Pitfalls (92)

92. Code path drift in duplicate implementations - Multiple implementations of same operation (e.g., publish draft) diverge when one is updated but others aren't; routes should delegate to service/repository layer, not implement business logic directly; test all paths with same edge cases; detect with `grep -rn "operation_name" server/src/routes/ server/src/services/`. See `docs/solutions/patterns/CODE_PATH_DRIFT_PREVENTION.md`
```
