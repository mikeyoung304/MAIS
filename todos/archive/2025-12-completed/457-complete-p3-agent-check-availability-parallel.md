---
status: complete
priority: p3
issue_id: '457'
tags: [performance, agent, code-review, optimization]
dependencies: []
---

# check_availability Tool Has Sequential Queries

## Problem Statement

The `check_availability` tool makes two separate sequential database queries that could run in parallel, causing unnecessary latency.

## Severity: P3 - NICE-TO-HAVE

Optimization opportunity, not blocking.

## Findings

- **Location**: `server/src/agent/tools/read-tools.ts` lines 439-455

Current code:

```typescript
// Check for existing booking - Query 1
const existingBooking = await prisma.booking.findFirst({
  where: { tenantId, date, status: { notIn: ['CANCELED', 'REFUNDED'] } },
  select: { id: true, status: true },
});

// Check for blackout - Query 2 (waits for Query 1)
const blackout = await prisma.blackoutDate.findFirst({
  where: { tenantId, date },
  select: { reason: true },
});
```

## Proposed Solution

Use `Promise.all` for parallel execution:

```typescript
const [existingBooking, blackout] = await Promise.all([
  prisma.booking.findFirst({
    where: { tenantId, date, status: { notIn: ['CANCELED', 'REFUNDED'] } },
    select: { id: true, status: true },
  }),
  prisma.blackoutDate.findFirst({
    where: { tenantId, date },
    select: { reason: true },
  }),
]);
```

**Impact:** ~50% latency reduction for this tool (~20ms -> ~10ms typical)

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Update `check_availability`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Queries run in parallel with `Promise.all`
- [ ] Same functionality preserved
- [ ] Tests pass

## Notes

Source: Code Review - Performance Review Agent (2025-12-28)
Estimated Effort: Small (15 min)
