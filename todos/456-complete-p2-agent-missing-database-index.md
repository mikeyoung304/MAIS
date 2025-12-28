---
status: complete
priority: p2
issue_id: '456'
tags: [performance, database, agent, code-review]
dependencies: []
---

# Missing Database Index for Agent Revenue Queries

## Problem Statement

The `get_dashboard` and `refresh_context` tools query bookings by `tenantId + createdAt + status` for revenue calculations, but there's no composite index covering this pattern. The existing indexes are:

- `@@index([tenantId, status])` - Missing createdAt
- `@@index([createdAt])` - Not tenant-scoped

## Severity: P2 - IMPORTANT

Query performance will degrade as booking volume increases.

## Findings

- **Location**:
  - `server/src/agent/tools/read-tools.ts` lines 143-150 (`get_dashboard`)
  - `server/src/agent/tools/read-tools.ts` lines 1228-1250 (`refresh_context`)
  - `server/prisma/schema.prisma` lines 400-401 (existing indexes)

Query pattern:

```typescript
const thisMonthBookings = await prisma.booking.aggregate({
  where: {
    tenantId,
    createdAt: { gte: thisMonthStart },
    status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
  },
  _sum: { totalPrice: true },
});
```

Current Booking indexes (schema.prisma):

```prisma
@@index([tenantId, confirmedAt])  // Not createdAt
@@index([createdAt])              // Not tenant-scoped
```

## Problem Scenario

1. Tenant has 10,000 bookings over 3 years
2. `get_dashboard` calculates this month's revenue
3. Query must scan all bookings (no efficient index)
4. Response time degrades from <100ms to >1s

## Proposed Solutions

### Option 1: Add Composite Index (Recommended)

- **Pros**: Direct fix, standard pattern
- **Cons**: Index maintenance overhead
- **Effort**: Small (30 min)
- **Risk**: Low

```prisma
// Add to Booking model in schema.prisma
@@index([tenantId, createdAt, status])
```

### Option 2: Use confirmedAt Instead of createdAt

- **Pros**: Uses existing index
- **Cons**: Changes semantics (may not be correct for revenue)
- **Effort**: Small
- **Risk**: Medium (semantic change)

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/prisma/schema.prisma` - Add new index
- **Related Components**: Booking model
- **Database Changes**: Yes - new index

Migration command:

```bash
npx prisma migrate dev --name add_booking_tenant_created_status_index
```

## Acceptance Criteria

- [ ] New index `@@index([tenantId, createdAt, status])` added to Booking
- [ ] Migration applied successfully
- [ ] Query plan shows index usage for dashboard revenue query
- [ ] No performance regression

## Resources

- Source: Code Review - Performance Review Agent (2025-12-28)
- Related: `server/prisma/schema.prisma` existing indexes

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Small (30 min)
