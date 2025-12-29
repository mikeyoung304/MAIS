---
status: pending
priority: p2
issue_id: '465'
tags: [code-review, test-data-isolation, performance]
dependencies: []
---

# P2: Relational Filter Causes Inefficient JOINs

## Problem Statement

The `relatedTenantFilter` pattern `{ tenant: { isTestTenant: false } }` forces Prisma to JOIN to the Tenant table for every COUNT/aggregate query. This is expensive because no composite index exists, and 10 separate queries each perform the same JOIN.

**Why it matters:** On a dashboard with 1000 tenants and 50K bookings, this could add 100-500ms latency per request.

## Findings

### Discovery 1: JOIN on every query

**Source:** Performance Review Agent
**Location:** `server/src/controllers/platform-admin.controller.ts` lines 72-88

Generated SQL (approximate):

```sql
SELECT COUNT(*) FROM "Booking" b
JOIN "Tenant" t ON b."tenantId" = t."id"
WHERE t."is_test_tenant" = false AND b."status" = 'CONFIRMED';
```

### Discovery 2: Existing tenantId indexes bypassed

**Source:** Performance Review Agent

The existing `@@index([tenantId])` on Booking/Segment tables is not used because the filter goes through the Tenant relation.

## Proposed Solutions

### Solution 1: Pre-compute Real Tenant IDs (Recommended)

**Effort:** Small | **Risk:** Low

Fetch real tenant IDs once, then use `IN` clause:

```typescript
// Fetch real tenant IDs once (uses isTestTenant index)
const realTenantIds = await this.prisma.tenant
  .findMany({
    where: { isTestTenant: false },
    select: { id: true },
  })
  .then((t) => t.map((x) => x.id));

// Use IN clause (uses existing tenantId indexes)
const totalBookings = await this.prisma.booking.count({
  where: { tenantId: { in: realTenantIds } },
});
```

**Pros:** Uses existing indexes, no schema changes
**Cons:** Extra query for tenant IDs (but cached in request)

### Solution 2: $transaction with Parallel Queries

**Effort:** Medium | **Risk:** Low

Combine Solution 1 with parallel execution:

```typescript
const [tenantStats, bookingStats] = await this.prisma.$transaction([
  this.prisma.tenant.groupBy({ by: ['isActive'], _count: true, where: tenantFilter }),
  this.prisma.booking.groupBy({
    by: ['status'],
    _count: true,
    where: { tenantId: { in: realTenantIds } },
  }),
]);
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/controllers/platform-admin.controller.ts` - Refactor `getStats()`

**Database Changes:** None

## Acceptance Criteria

- [ ] getStats() uses `tenantId: { in: realTenantIds }` pattern
- [ ] Query plans show index usage (verify with EXPLAIN)
- [ ] Dashboard load time < 200ms for stats

## Work Log

| Date       | Action             | Outcome/Learning                            |
| ---------- | ------------------ | ------------------------------------------- |
| 2025-12-29 | Performance review | Relational filter bypasses existing indexes |

## Resources

- Prisma performance docs: https://www.prisma.io/docs/guides/performance-and-optimization
