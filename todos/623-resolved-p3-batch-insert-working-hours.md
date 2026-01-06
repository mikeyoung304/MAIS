---
status: resolved
priority: p3
issue_id: 623
tags: [code-review, performance, booking-links]
dependencies: []
created: 2026-01-05
---

# Working Hours Update Lacks Batch Optimization

## Problem Statement

Working hours are inserted one at a time in a loop within a transaction instead of using a single batch insert. This results in up to 8 round trips (1 DELETE + 7 INSERTs) instead of 2.

## Findings

**Source:** performance-oracle

**Evidence:**

```typescript
// booking-link-executors.ts:310-333
await prisma.$transaction(async (tx) => {
  await tx.availabilityRule.deleteMany({ where: { tenantId, serviceId: null } });

  for (const entry of workingHours) {
    if (entry.isActive) {
      await tx.availabilityRule.create({
        // Sequential inserts - N round trips
        data: {
          tenantId,
          serviceId: null,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
        },
      });
    }
  }
});
```

**Impact:** For 7 days of working hours with all active, this is 1 DELETE + 7 INSERT statements. Maximum ~50ms for typical scenarios, but inefficient.

## Proposed Solutions

### Option 1: Use createMany for batch insertion (Recommended)

**Pros:** Simple change, significant reduction in round trips
**Cons:** None
**Effort:** Small
**Risk:** Very low

```typescript
await prisma.$transaction(async (tx) => {
  await tx.availabilityRule.deleteMany({ where: { tenantId, serviceId: null } });

  await tx.availabilityRule.createMany({
    data: workingHours
      .filter((h) => h.isActive)
      .map((h) => ({
        tenantId,
        serviceId: null,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
      })),
  });
});
```

This reduces round trips from 8 to 2.

### Option 2: Leave as-is for Phase 0

**Pros:** No change required
**Cons:** Suboptimal performance
**Effort:** None
**Risk:** None

Current implementation works correctly, just slightly slower.

## Recommended Action

**TRIAGE RESULT: DEFER TO PHASE 1** (2/3 DEFER, 1/3 FIX BEFORE PROD)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Optimization only. Working hours setup is rare (once per tenant). Current implementation is correct, just inefficient.

**Implementation:** Option 1 - Use createMany for batch insertion (Phase 1 optimization)

## Technical Details

**Affected Files:**

- `server/src/agent/executors/booking-link-executors.ts` (lines 310-333)

**Performance Impact:**

- Current: 1 + N database round trips (N = active days, max 7)
- Optimized: 2 database round trips
- Estimated time savings: ~30-40ms per working hours update

## Acceptance Criteria

- [ ] Working hours inserted using `createMany`
- [ ] Transaction still atomic
- [ ] Same end result (delete old, create new)

## Work Log

| Date       | Action                           | Learnings                              |
| ---------- | -------------------------------- | -------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by performance-oracle agent |

## Resources

- [Prisma createMany docs](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#createmany)
- PR: Booking Links Phase 0 - commit 1bd733c9
