---
status: deferred
priority: p2
issue_id: '588'
tags: [code-review, data-integrity, transactions, database]
dependencies: []
created_at: 2026-01-02
---

# P2: Missing Transaction in Platform Admin Trace Routes

> **Data Integrity Review:** The POST /:traceId/actions endpoint creates a ReviewAction and updates ConversationTrace in two separate calls without a transaction.

## Problem Statement

The platform admin routes create a ReviewAction and then update the ConversationTrace in two separate database calls without a transaction.

**File:** `/server/src/routes/platform-admin-traces.routes.ts` (lines 284-337)

**Evidence:**

```typescript
const action = await prisma.reviewAction.create({ ... });
// No transaction wrapper
await prisma.conversationTrace.update({ ... });
```

**Impact:** If the second update fails, the system will have a ReviewAction without the corresponding trace status update, leading to inconsistent state.

**Comparison:** The `ReviewActionService.recordAction()` in `review-actions.ts` correctly uses `$transaction([...])` for the same operation.

## Findings

| Reviewer              | Finding                                                |
| --------------------- | ------------------------------------------------------ |
| Data Integrity Review | P2: Missing transaction in platform admin trace routes |

## Proposed Solution

Wrap both operations in `$transaction`:

```typescript
const [action] = await prisma.$transaction([
  prisma.reviewAction.create({
    data: {
      tenantId: trace.tenantId,
      traceId,
      action: body.action,
      notes: body.notes,
      correctedScore: body.correctedScore,
      performedBy: body.performedBy,
    },
  }),
  prisma.conversationTrace.update({
    where: { id: traceId },
    data: {
      reviewStatus: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: body.performedBy,
      reviewNotes: body.notes,
      ...(body.correctedScore !== undefined && {
        evalScore: body.correctedScore,
      }),
    },
  }),
]);
```

## Acceptance Criteria

- [ ] Transaction wrapper added to POST /:traceId/actions
- [ ] Test verifies atomic operation (mock failure of second operation)
- [ ] Consistent with ReviewActionService pattern

## Work Log

| Date       | Action                         | Learnings                                              |
| ---------- | ------------------------------ | ------------------------------------------------------ |
| 2026-01-02 | Created from /workflows:review | Data Integrity reviewer identified missing transaction |
