---
status: pending
priority: p1
issue_id: '584'
tags: [code-review, data-integrity, cleanup, database]
dependencies: []
created_at: 2026-01-02
---

# P1: Missing Cleanup Job for ConversationTrace expiresAt

> **Data Integrity Review:** The ConversationTrace model has an expiresAt column for 90-day retention, but there is NO cleanup job that deletes expired traces.

## Problem Statement

ConversationTrace records set `expiresAt` 90 days in the future, but no job actually deletes them when expired.

**Evidence:**

- Schema line 948-949: `expiresAt DateTime? // Auto-cleanup after this date`
- tracer.ts line 410-411: Sets `expiresAt` 90 days in the future
- cleanup.ts: Only cleans sessions and proposals - **no trace cleanup**

**Impact:** Database bloat over time. Traces with expired `expiresAt` will accumulate indefinitely, potentially containing encrypted PII that should have been purged per retention policy.

## Findings

| Reviewer              | Finding                                                 |
| --------------------- | ------------------------------------------------------- |
| Data Integrity Review | P1: Missing cleanup job for ConversationTrace expiresAt |
| Data Integrity Review | P1: AgentUsage has no retention policy or cleanup       |

## Proposed Solution

Add cleanup function to `server/src/jobs/cleanup.ts`:

```typescript
/**
 * Delete expired conversation traces.
 * Called by scheduled job daily.
 */
export async function cleanupExpiredTraces(prisma: PrismaClient): Promise<number> {
  const result = await prisma.conversationTrace.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  logger.info({ deletedCount: result.count }, 'Cleaned up expired conversation traces');
  return result.count;
}

/**
 * Delete old AgentUsage records (90+ days).
 */
export async function cleanupOldAgentUsage(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await prisma.agentUsage.deleteMany({
    where: {
      timestamp: { lt: cutoff },
    },
  });
  logger.info({ deletedCount: result.count }, 'Cleaned up old agent usage records');
  return result.count;
}
```

Wire into scheduled job runner or add to existing cleanup schedule.

## Acceptance Criteria

- [ ] cleanupExpiredTraces() function added
- [ ] cleanupOldAgentUsage() function added
- [ ] Functions wired into scheduled job
- [ ] Test verifies traces deleted when expired

## Work Log

| Date       | Action                         | Learnings                                          |
| ---------- | ------------------------------ | -------------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Data Integrity reviewer identified missing cleanup |
