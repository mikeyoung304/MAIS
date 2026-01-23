---
status: deferred
priority: p2
issue_id: '592'
tags: [code-review, data-integrity, cleanup, database]
dependencies: ['584']
created_at: 2026-01-02
---

# P2: UserFeedback Records Orphaned After Trace Deletion

> **Data Integrity Review:** UserFeedback uses onDelete: SetNull for traceId, creating orphaned records when traces are deleted.

## Problem Statement

UserFeedback model lacks retention policy. When traces are deleted, feedback remains with `traceId: null`.

**File:** `/server/prisma/schema.prisma` (lines 1007-1026)

**Schema:**

```prisma
model UserFeedback {
  // ...
  traceId  String?
  trace    ConversationTrace? @relation(fields: [traceId], references: [id], onDelete: SetNull)
  // No expiresAt field
}
```

**Impact:**

1. Orphaned feedback records after trace cleanup
2. No automatic cleanup of old feedback
3. `traceId` becomes null after trace deletion, losing context

## Findings

| Reviewer              | Finding                                               |
| --------------------- | ----------------------------------------------------- |
| Data Integrity Review | P2: UserFeedback has no expiresAt or retention policy |

## Proposed Solution

**Option A: Cascade delete feedback with trace:**

```prisma
trace ConversationTrace? @relation(fields: [traceId], references: [id], onDelete: Cascade)
```

**Option B: Add cleanup job for orphaned feedback:**

```typescript
export async function cleanupOrphanedFeedback(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await prisma.userFeedback.deleteMany({
    where: {
      traceId: null,
      createdAt: { lt: cutoff },
    },
  });
  logger.info({ deletedCount: result.count }, 'Cleaned up orphaned user feedback');
  return result.count;
}
```

**Recommendation:** Option A (Cascade) is simpler and ensures feedback is always deleted with its trace.

## Acceptance Criteria

- [ ] Either change to onDelete: Cascade OR add cleanup job
- [ ] Test verifies feedback handling on trace deletion
- [ ] No orphaned feedback after cleanup runs

## Work Log

| Date       | Action                         | Learnings                                      |
| ---------- | ------------------------------ | ---------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Data Integrity reviewer identified orphan risk |
