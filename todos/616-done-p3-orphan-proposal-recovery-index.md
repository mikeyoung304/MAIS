---
status: done
priority: p3
issue_id: 616
tags: [code-review, performance, database, agent-eval]
dependencies: []
created: 2026-01-02
---

# Missing Index for Orphan Proposal Recovery Query

## Problem Statement

The orphan recovery query filters on `status = 'CONFIRMED' AND updatedAt < date`, but the existing index is `[status, expiresAt]`, not `[status, updatedAt]`.

## Findings

**Source:** performance-oracle review

**Location:** `server/src/jobs/cleanup.ts` lines 141-148

**Evidence:**

```typescript
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: orphanCutoff },
  },
  take: 100,
});
```

**Current AgentProposal indexes:**

- `@@index([status, expiresAt])` - Doesn't cover updatedAt

**Impact:** Low. The `take: 100` limit and `CONFIRMED` status filter significantly reduce scan size.

## Proposed Solutions

### Option 1: Add index on [status, updatedAt]

**Pros:** Covers the orphan recovery query
**Cons:** Additional index storage
**Effort:** Small
**Risk:** Very low

```prisma
@@index([status, updatedAt])  // For orphan recovery
```

### Option 2: Accept current performance

**Pros:** No change
**Cons:** Query may scan more rows than necessary
**Effort:** None
**Risk:** Very low (query is infrequent)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/prisma/schema.prisma`

## Acceptance Criteria

- [ ] Index exists on AgentProposal [status, updatedAt]
- [ ] EXPLAIN ANALYZE shows index usage

## Work Log

| Date       | Action                           | Learnings                              |
| ---------- | -------------------------------- | -------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by performance-oracle agent |

## Resources

- [Prisma index docs](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
