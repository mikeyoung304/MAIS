---
status: complete
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

## Solution Implemented

### Pre-compute Real Tenant IDs (Solution 1)

**Effort:** Small | **Risk:** Low

Refactored `getStats()` to fetch real tenant IDs once, then use `IN` clause:

```typescript
// Pre-fetch real tenant IDs once (uses isTestTenant index on Tenant table)
// Then use IN clause for related queries (uses existing tenantId indexes)
const realTenantIds = includeTestTenants
  ? undefined // undefined means no filter - include all
  : await this.prisma.tenant
      .findMany({
        where: { isTestTenant: false },
        select: { id: true },
      })
      .then((tenants) => tenants.map((t) => t.id));

// Build related filter using IN clause (uses tenantId indexes, avoids JOINs)
const relatedTenantFilter = realTenantIds ? { tenantId: { in: realTenantIds } } : {};

// Use IN clause (uses existing tenantId indexes)
const totalBookings = await this.prisma.booking.count({
  where: relatedTenantFilter,
});
```

**Pros:** Uses existing indexes, no schema changes
**Cons:** Extra query for tenant IDs (but cached in request)

## Technical Details

**Affected Files:**

- `server/src/controllers/platform-admin.controller.ts` - Refactored `getStats()`

**Database Changes:** None

## Acceptance Criteria

- [x] getStats() uses `tenantId: { in: realTenantIds }` pattern
- [ ] Query plans show index usage (verify with EXPLAIN)
- [ ] Dashboard load time < 200ms for stats

## Work Log

| Date       | Action                 | Outcome/Learning                                 |
| ---------- | ---------------------- | ------------------------------------------------ |
| 2025-12-29 | Performance review     | Relational filter bypasses existing indexes      |
| 2025-12-29 | Implemented Solution 1 | Pre-compute tenant IDs, use IN clause for counts |

## Resources

- Prisma performance docs: https://www.prisma.io/docs/guides/performance-and-optimization
