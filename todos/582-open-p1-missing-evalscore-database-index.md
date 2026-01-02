---
status: open
priority: p1
issue_id: '582'
tags: [code-review, performance, database, indexing]
dependencies: []
created_at: 2026-01-02
---

# P1: Missing Database Index for evalScore NULL Queries

> **Performance Review:** The ConversationTrace model lacks an index for evalScore which is queried as `evalScore: null` in the pipeline batch processing.

## Problem Statement

The `getUnevaluatedTraces()` method queries for traces where `evalScore IS NULL`, but there's no index on this column for efficient filtering.

**File:** `/server/prisma/schema.prisma`

**Current indexes:**

```prisma
@@index([tenantId, startedAt])
@@index([tenantId, agentType, startedAt])
@@index([tenantId, flagged, reviewStatus])
@@index([tenantId, evalScore])  // Tenant-scoped, but pipeline doesn't use tenantId
@@index([sessionId])
@@index([expiresAt])
// Missing: @@index([evalScore, startedAt]) for cross-tenant batch processing
```

**Impact:** As the ConversationTrace table grows, queries for unevaluated traces will become progressively slower without a proper index.

## Findings

| Reviewer           | Finding                                          |
| ------------------ | ------------------------------------------------ |
| Performance Review | P1: Missing evalScore index for batch processing |
| Performance Review | P3: Missing composite cleanup index              |

## Proposed Solution

Add index to schema.prisma:

```prisma
model ConversationTrace {
  // ... existing fields ...

  @@index([tenantId, startedAt])
  @@index([tenantId, agentType, startedAt])
  @@index([tenantId, flagged, reviewStatus])
  @@index([tenantId, evalScore])
  @@index([evalScore, startedAt])  // ADD: For batch unevaluated trace queries
  @@index([sessionId])
  @@index([expiresAt])
}
```

Then run migration:

```bash
cd server && npm exec prisma migrate dev --name add-evalscore-index
```

## Acceptance Criteria

- [ ] Index added to schema.prisma
- [ ] Migration created and applied
- [ ] Query plan verified with EXPLAIN

## Work Log

| Date       | Action                         | Learnings                                     |
| ---------- | ------------------------------ | --------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Performance reviewer identified missing index |
