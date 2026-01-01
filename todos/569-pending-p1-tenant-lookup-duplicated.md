---
status: pending
priority: p1
issue_id: '569'
tags: [code-review, simplicity, agent-ecosystem, quality-first-triage, performance]
dependencies: []
---

# P1: Tenant Lookup Duplicated 26+ Times

> **Quality-First Triage:** Upgrade P2 → P1. "Same tenant fetched multiple times per request. N+1 queries. No single source of truth."

## Problem Statement

The codebase has **26+ occurrences** of `prisma.tenant.findUnique` in the agent directory. Within a single request, the same tenant is fetched multiple times:

| Orchestrator             | Queries | Select Fields             |
| ------------------------ | ------- | ------------------------- |
| AdminOrchestrator        | 2+      | `onboardingPhase`         |
| OnboardingOrchestrator   | 4+      | `name`, `onboardingPhase` |
| CustomerChatOrchestrator | 2+      | `name`, `packages`        |

Each method fetches tenant independently with different `select` clauses.

**Why it matters:**

- N+1 query pattern - Multiple DB hits for same data
- Inconsistent selects - "What fields do I have?" depends on call stack location
- No single source of truth - One place has `onboardingPhase`, another has more

## Findings

| Reviewer                   | Finding                                           |
| -------------------------- | ------------------------------------------------- |
| Simplicity Triage          | P1: N+1 queries, inconsistent data, no SoT        |
| Pattern Duplication Triage | P2: Tenant lookup duplicated across orchestrators |

## Proposed Solutions

### Option 1: Fetch Tenant Once at Session Start (Recommended)

**Effort:** Medium (3-4 hours)

Add tenant to session state, load once:

```typescript
interface SessionStateWithTenant extends SessionState {
  tenant: {
    id: string;
    name: string;
    onboardingPhase: OnboardingPhase | null;
    // ... all commonly needed fields
  };
}

// In getOrCreateSession or chat() entry
const tenant = await this.prisma.tenant.findUnique({
  where: { id: tenantId },
  select: this.getTenantSelectFields(), // Hook for subclasses
});
session.tenant = tenant;
```

### Option 2: Tenant Cache Service

**Effort:** Medium (3-4 hours)

Create dedicated tenant cache with TTL, invalidated on updates.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts` - Add tenant to session
- `server/src/agent/orchestrator/*-orchestrator.ts` - Remove redundant lookups

**Current Queries Per Session:**

- AdminOrchestrator: 2+
- OnboardingOrchestrator: 4+
- CustomerChatOrchestrator: 2+

**After Fix:**

- All: 1 query per session

## Acceptance Criteria

- [ ] Add tenant data to session state
- [ ] Load tenant once in getOrCreateSession
- [ ] Hook for subclass-specific select fields
- [ ] Remove redundant tenant lookups
- [ ] Tests verify single lookup per session

## Work Log

| Date       | Action                            | Learnings                               |
| ---------- | --------------------------------- | --------------------------------------- |
| 2026-01-01 | Created from quality-first triage | Simplicity agent identified N+1 pattern |
