---
status: duplicate
priority: p2
issue_id: '559'
tags: [code-review, duplication, agent-ecosystem, performance]
dependencies: []
duplicate_of: '569'
closed_date: '2026-01-01'
---

# P2: Tenant Lookup Pattern Duplication Across Orchestrators

## Problem Statement

Each orchestrator fetches tenant data with slightly different `select` clauses, often multiple times per session:

| File                            | Queries    | Select Fields             |
| ------------------------------- | ---------- | ------------------------- |
| `onboarding-orchestrator.ts`    | 4 separate | `name`, `onboardingPhase` |
| `customer-chat-orchestrator.ts` | 2 separate | `name`, `packages`        |
| `admin-orchestrator.ts`         | 2 separate | `onboardingPhase`         |

**Why it matters:**

- Same tenant is fetched multiple times per session
- Could lead to N+1 queries
- Risk of stale data between lookups
- Duplication of query patterns

## Findings

| Reviewer                     | Finding                              |
| ---------------------------- | ------------------------------------ |
| Pattern Duplication Reviewer | P2: Tenant lookup pattern duplicated |

## Proposed Solutions

### Option 1: Load Tenant Once at Session Start (Recommended)

**Effort:** Medium (2-3 hours)

Add tenant to session state and load once:

```typescript
interface SessionStateWithTenant extends SessionState {
  tenant: {
    name: string;
    onboardingPhase: string | null;
    packages?: Package[];
  };
}

// In getOrCreateSession
const tenant = await this.prisma.tenant.findUnique({
  where: { id: tenantId },
  select: this.getTenantSelectFields(), // Hook for subclasses
});
session.tenant = tenant;
```

**Pros:**

- Single query per session
- Consistent data
- No duplication

**Cons:**

- Need to invalidate on tenant updates
- Session state grows

### Option 2: Tenant Cache Service

**Effort:** Medium (3-4 hours)

Create a dedicated tenant cache with TTL.

**Pros:**

- Reusable across all orchestrators
- Central invalidation

**Cons:**

- New service to maintain
- Cache coherence challenges

## Recommended Action

Implement **Option 1** - load tenant once into session state.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts` - Add tenant to session
- `server/src/agent/orchestrator/*-orchestrator.ts` - Remove redundant lookups

**Current Queries Per Session:**

- Onboarding: Up to 4 tenant lookups
- Customer: Up to 2 tenant lookups
- Admin: Up to 2 tenant lookups

**After Fix:**

- All: 1 tenant lookup per session

## Acceptance Criteria

- [ ] Add tenant data to session state
- [ ] Load tenant once in getOrCreateSession
- [ ] Add hook for subclass-specific select fields
- [ ] Remove redundant tenant lookups from orchestrators
- [ ] Verify behavior unchanged

## Work Log

| Date       | Action                   | Learnings                            |
| ---------- | ------------------------ | ------------------------------------ |
| 2026-01-01 | Created from code review | Pattern Duplication Reviewer flagged |
| 2026-01-01 | Marked as duplicate      | Already resolved by Todo 569         |

## Resources

- Session state: base-orchestrator.ts:282-374
