---
status: pending
priority: p3
issue_id: '5255'
tags: [code-review, performance, database]
dependencies: []
---

# P3: Missing Composite Index for Cleanup Query

## Problem Statement

The `cleanupExpiredSessions` method queries on `(lastActivityAt, deletedAt)` but no composite index exists for this query pattern.

**Why it matters:** Cleanup job will be slow and hold locks during scheduled maintenance windows.

## Findings

**File:** `server/prisma/schema.prisma:901-908`

The repository's `cleanupExpiredSessions` method queries:

```typescript
where: {
  lastActivityAt: { lt: cutoff },
  deletedAt: null,
}
```

**Current indexes:**

- `@@index([lastActivityAt])` - Standalone
- `@@index([tenantId, deletedAt])` - Wrong column order for cleanup query

**Missing:** No composite index on `(deletedAt, lastActivityAt)`.

## Proposed Solutions

### Option A: Add composite index (Recommended)

**Pros:** Efficient cleanup queries
**Cons:** Minor index maintenance overhead
**Effort:** Small
**Risk:** Low

```prisma
@@index([deletedAt, lastActivityAt]) // Cleanup job: WHERE deletedAt IS NULL AND lastActivityAt < cutoff
```

## Recommended Action

Option A - Add the composite index.

## Technical Details

**Affected files:**

- `server/prisma/schema.prisma`

## Acceptance Criteria

- [ ] Composite index added
- [ ] Migration created and applied
- [ ] Cleanup job query plan verified

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
