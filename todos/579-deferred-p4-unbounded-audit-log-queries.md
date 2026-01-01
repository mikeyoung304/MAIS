---
status: pending
priority: p2
issue_id: '579'
tags: [code-review, performance, database, pagination]
dependencies: []
---

# P2: Unbounded Audit Log Queries (Performance)

## Problem Statement

The audit service's `getEntityTimeline()` and `getChangesByEntity()` methods query audit logs **without pagination limits**:

```typescript
const logs = await this.prisma.configChangeLog.findMany({
  where: { tenantId, entityType, entityId },
  orderBy: { createdAt: 'desc' },
  // No take/skip limits!
});
```

For high-activity tenants, these queries could return **thousands of records**, causing:

- Memory pressure on the server
- Slow response times
- Potential timeouts

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/services/audit.service.ts:222-226, 300-302`

**Identified by:** Performance Oracle agent

**Risk scenarios:**

- Tenant with 10,000+ audit log entries
- Admin viewing entity history page
- API timeout or memory exhaustion

## Proposed Solutions

### Option A: Add Pagination Parameters (Recommended)

**Pros:** Simple, follows existing patterns
**Cons:** API change if consumed externally
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
async getEntityTimeline(
  tenantId: string,
  entityType: string,
  entityId: string,
  options?: { limit?: number; offset?: number }
): Promise<ConfigChangeLog[]> {
  return this.prisma.configChangeLog.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,  // Default limit
    skip: options?.offset ?? 0,
  });
}
```

### Option B: Hard Limit with Warning

**Pros:** No API change
**Cons:** May truncate data silently
**Effort:** Small
**Risk:** Low

### Option C: Cursor-Based Pagination

**Pros:** Better for large datasets
**Cons:** More complex, bigger API change
**Effort:** Medium
**Risk:** Low

## Recommended Action

**Choose Option A** - Add pagination with sensible defaults

## Technical Details

**Affected files:**

- `server/src/services/audit.service.ts` - Add pagination
- `server/src/routes/` - Update any routes using these methods
- `packages/contracts/` - Update API contracts if needed

**Database changes:** None (may want to verify index exists)

## Acceptance Criteria

- [ ] `getEntityTimeline()` has default limit of 100
- [ ] `getChangesByEntity()` has default limit of 100
- [ ] Maximum limit enforced (e.g., 1000)
- [ ] API supports `limit` and `offset` parameters
- [ ] UI pagination if displaying timeline
- [ ] Tests cover pagination edge cases

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- `server/src/services/audit.service.ts` - Current implementation
- `server/src/adapters/prisma/booking.repository.ts` - Reference pagination pattern
