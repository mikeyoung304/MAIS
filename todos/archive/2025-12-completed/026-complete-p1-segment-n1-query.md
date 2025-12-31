---
status: complete
priority: p1
issue_id: '026'
tags: [code-review, performance, database, n-plus-1]
dependencies: []
---

# Segment N+1 Query Pattern on Landing Pages

## Problem Statement

`findBySlugWithRelations()` fetches packages with add-ons, then makes a SEPARATE query for global add-ons. This creates an N+1 pattern: 1 query for segment + packages (with joins) + 1 additional query for global add-ons.

**Why this matters:** Every public segment landing page request doubles database load. For high-traffic segments, this significantly impacts performance and database costs.

## Findings

### Code Evidence

**Location:** `server/src/adapters/prisma/segment.repository.ts:195-245`

```typescript
// Query 1: Fetch segment with packages and add-ons
const segment = await this.prisma.segment.findUnique({
  where: { slug_tenantId: { slug, tenantId } },
  include: {
    packages: { include: { addOns: true } },
  },
});

// Query 2: SEPARATE query for global add-ons
const globalAddOns = await this.prisma.addOn.findMany({
  where: { tenantId, segmentId: null, active: true },
});
```

### Performance Impact

- 2 queries per segment landing page
- 100% query overhead on high-traffic pages
- Cache (15-min TTL) mitigates but cache misses cause double-hit
- At 1000 req/day, that's 2000 database queries instead of 1000

### Similar Pattern in Catalog Service

**Location:** `server/src/services/catalog.service.ts:96-113`

`getPackageBySlug()` also makes TWO separate queries:

1. `getPackageBySlug()` - fetch package
2. `getAddOnsByPackageId()` - fetch add-ons

## Proposed Solutions

### Option A: Merge Queries with OR Condition (Recommended)

**Effort:** Small | **Risk:** Low

Fetch both segment-specific and global add-ons in single query:

```typescript
const segment = await this.prisma.segment.findUnique({
  where: { slug_tenantId: { slug, tenantId } },
  include: {
    packages: {
      include: {
        addOns: {
          include: {
            addOn: true,
          },
        },
      },
    },
  },
});

// Single query for ALL add-ons (segment + global)
const allAddOns = await this.prisma.addOn.findMany({
  where: {
    tenantId,
    active: true,
    OR: [
      { segmentId: segment.id },
      { segmentId: null }, // Global
    ],
  },
});
```

**Pros:**

- 50% reduction in queries
- Simple change
- No schema modification

**Cons:**

- Slightly more complex WHERE clause

### Option B: Include Global Add-ons in Initial Query

**Effort:** Medium | **Risk:** Low

Use Prisma's raw query to fetch everything in one round-trip.

**Pros:**

- Single query
- Optimal performance

**Cons:**

- More complex implementation
- Harder to maintain

## Recommended Action

Implement **Option A** for quick win, then optimize further if needed.

## Technical Details

**Files to Update:**

- `server/src/adapters/prisma/segment.repository.ts:232-238`
- `server/src/services/catalog.service.ts:96-113`

**Expected Improvement:**

- 50% reduction in database queries on segment landing pages
- ~50ms faster response time (1 fewer DB round-trip)

## Acceptance Criteria

- [ ] Segment landing page uses single database query for add-ons
- [ ] Package detail page uses single query pattern
- [ ] Performance test shows query reduction
- [ ] No functional regression (same add-ons returned)
- [ ] Cache invalidation still works correctly

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- Performance Oracle analysis
- Prisma query optimization docs
- Current 15-min cache TTL in catalog.service.ts
