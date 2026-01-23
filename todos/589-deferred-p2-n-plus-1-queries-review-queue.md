---
status: deferred
priority: p2
issue_id: '589'
tags: [code-review, performance, database, n-plus-1]
dependencies: []
created_at: 2026-01-02
---

# P2: N+1 Query Pattern in Review Queue submitReview

> **Performance Review:** submitReview makes 2-3 separate queries to the same record instead of using a transaction efficiently.

## Problem Statement

The `submitReview` method makes multiple database round trips:

**File:** `/server/src/agent/feedback/review-queue.ts` (lines 229-264)

```typescript
async submitReview(...): Promise<void> {
  // Query 1: Verify trace belongs to tenant
  const trace = await this.prisma.conversationTrace.findFirst({
    where: { id: traceId, tenantId },
  });

  if (!trace) throw new Error('...');

  // Query 2: Update the trace
  await this.prisma.conversationTrace.update({
    where: { id: traceId },
    data: { ... },
  });

  // Query 3: Possibly create review action
  if (review.actionTaken !== 'none') {
    await this.prisma.reviewAction.create({ ... });
  }
}
```

**Impact:** 2-3 database round trips per review submission adds latency.

## Findings

| Reviewer           | Finding                                      |
| ------------------ | -------------------------------------------- |
| Performance Review | P2: N+1 queries in submitReview              |
| Performance Review | P2: Unbounded groupBy query in getQueueStats |

## Proposed Solution

Use a transaction with `updateMany` that includes tenant check:

```typescript
async submitReview(
  tenantId: string,
  traceId: string,
  review: ReviewSubmission
): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Single query that validates and updates
    const result = await tx.conversationTrace.updateMany({
      where: { id: traceId, tenantId },  // Tenant check in where
      data: {
        reviewStatus: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: review.reviewedBy,
        reviewNotes: review.notes,
        ...(review.correctEvalScore !== undefined && {
          evalScore: review.correctEvalScore,
        }),
      },
    });

    if (result.count === 0) {
      throw new Error('Trace not found or access denied');
    }

    // Create action if needed
    if (review.actionTaken !== 'none') {
      await tx.reviewAction.create({ ... });
    }
  });
}
```

## Acceptance Criteria

- [ ] submitReview uses single transaction
- [ ] Tenant validation done in same query as update
- [ ] Test verifies reduced query count

## Work Log

| Date       | Action                         | Learnings                                   |
| ---------- | ------------------------------ | ------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Performance reviewer identified N+1 pattern |
