---
status: closed
priority: p2
issue_id: 610
tags: [code-review, performance, database, agent-eval]
dependencies: []
created: 2026-01-02
triage_notes: 'FIXED: Composite index @@index([traceId, createdAt]) added to UserFeedback model in schema.prisma.'
closed_at: '2026-01-26'
---

# Missing Index for Orphaned Feedback Cleanup Query

## Problem Statement

The `cleanupOrphanedFeedback` query filters on `traceId = NULL AND createdAt < date`, but there's no composite index for this combination. This could cause slow queries on large datasets.

## Findings

**Source:** performance-oracle review

**Location:** `server/src/jobs/cleanup.ts` lines 84-89

**Evidence:**

```typescript
const result = await prisma.userFeedback.deleteMany({
  where: {
    traceId: null,
    createdAt: { lt: thirtyDaysAgo },
  },
});
```

**Current indexes on UserFeedback:**

- `@@index([tenantId, sessionId])`
- `@@index([tenantId, createdAt])`
- `@@index([traceId])`

**Gap:** No index covering `traceId IS NULL AND createdAt < ?`

## Proposed Solutions

### Option 1: Add composite index (Recommended)

**Pros:** Covers the query pattern exactly
**Cons:** Additional index storage
**Effort:** Small
**Risk:** Low

```prisma
// In UserFeedback model
@@index([traceId, createdAt])
```

### Option 2: Add partial index for orphans (Better for selectivity)

**Pros:** Smaller index, only covers NULL traceId
**Cons:** Requires raw SQL migration
**Effort:** Medium
**Risk:** Low

```sql
CREATE INDEX idx_user_feedback_orphaned ON "UserFeedback" (createdAt)
WHERE "traceId" IS NULL;
```

### Option 3: Accept current performance

**Pros:** No change needed
**Cons:** May be slow on large datasets
**Effort:** None
**Risk:** Performance regression potential

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/prisma/schema.prisma`
- Migration file to be created

**Impact:** Low-to-medium. Cleanup jobs run daily, but on datasets with millions of feedback records, this query could become slow.

## Acceptance Criteria

- [ ] Index exists that covers the `traceId IS NULL AND createdAt < ?` query
- [ ] EXPLAIN ANALYZE shows index usage for the cleanup query
- [ ] No performance regression in cleanup job duration

## Work Log

| Date       | Action                           | Learnings                              |
| ---------- | -------------------------------- | -------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by performance-oracle agent |

## Resources

- [Schema drift prevention](docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md)
