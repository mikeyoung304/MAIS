---
status: resolved
priority: p1
issue_id: 609
tags: [code-review, security, agent-eval, defense-in-depth]
dependencies: []
created: 2026-01-02
---

# Missing tenantId in Proposal Update Queries

## Problem Statement

The `recoverOrphanedProposals` function in `cleanup.ts` updates proposals using only the `id` in the `where` clause, without including `tenantId` for defense-in-depth. While the proposals are fetched correctly, the subsequent updates should include tenant scoping.

## Findings

**Source:** security-sentinel review

**Location:** `server/src/jobs/cleanup.ts` lines 175-181, 200-206, 221-228, 242-248

**Evidence:**

```typescript
// Current (lines 175-181)
await prisma.agentProposal.update({
  where: { id: proposalId },  // Missing tenantId
  data: { status: 'FAILED', ... },
});
```

**Risk:** While practical attack vectors are limited (batch job context), this violates the defense-in-depth principle documented in `docs/solutions/code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md`.

## Proposed Solutions

### Option 1: Add tenantId to all proposal updates (Recommended)

**Pros:** Consistent with MAIS patterns, defense-in-depth
**Cons:** Minor code change
**Effort:** Small
**Risk:** Very low

```typescript
// Extract tenantId from proposal and use in updates
const tenantId = proposal.tenantId;
await prisma.agentProposal.update({
  where: { id: proposalId, tenantId },
  data: { status: 'FAILED', ... },
});
```

### Option 2: Accept current pattern with documentation

**Pros:** No code change
**Cons:** Inconsistent with other parts of codebase
**Effort:** Small
**Risk:** Low (documentation debt)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/jobs/cleanup.ts`

**Lines to update:** 175-181, 200-206, 221-228, 242-248

## Acceptance Criteria

- [ ] All `agentProposal.update` calls in cleanup.ts include `tenantId` in where clause
- [ ] Tests verify tenant scoping in proposal updates
- [ ] Pattern matches other tenant-scoped updates in codebase

## Work Log

| Date       | Action                           | Learnings                             |
| ---------- | -------------------------------- | ------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by security-sentinel agent |

## Resources

- [Defense-in-depth pattern](docs/solutions/code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md)
- [MAIS multi-tenant patterns](docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
