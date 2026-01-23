---
status: complete
priority: p2
issue_id: '5241'
tags: [code-review, performance, database, index]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P2: Missing Compound Index for Customer Bootstrap Query

> **Performance Review:** Customer lookup query needs compound index.

## Problem Statement

The `bootstrapCustomer` method queries by `[tenantId, customerId, status]` but no compound index exists for this pattern.

**File:** `server/src/services/project-hub.service.ts`
**Lines:** 179-202

**Query:**

```typescript
await this.prisma.project.findFirst({
  where: {
    tenantId,
    customerId,
    status: 'ACTIVE',
  },
  orderBy: { createdAt: 'desc' },
});
```

**Current indexes (schema lines 1110-1114):**

```prisma
@@index([tenantId])
@@index([customerId])
@@index([status])
@@index([tenantId, status])
```

**Missing:** `@@index([tenantId, customerId, status])`

## Proposed Solution

Add migration to create compound index:

```sql
-- migrations/27_add_project_customer_compound_index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_tenantId_customerId_status_idx"
ON "Project" ("tenantId", "customerId", "status");
```

And update schema:

```prisma
@@index([tenantId, customerId, status])
```

**Effort:** Small (15 minutes)
**Risk:** Low (CONCURRENTLY prevents locks)

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
