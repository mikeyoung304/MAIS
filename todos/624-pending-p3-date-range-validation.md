---
status: pending
priority: p3
issue_id: 624
tags: [code-review, data-integrity, booking-links, validation]
dependencies: []
created: 2026-01-05
---

# Missing Date Range Validation in clear_range Operation

## Problem Statement

The `clear_range` operation for date overrides does not validate that `startDate <= endDate`. If `startDate > endDate`, no records will be deleted, but the user receives a "cleared" success message which could be confusing.

## Findings

**Source:** data-integrity-guardian

**Evidence:**

```typescript
// booking-link-executors.ts:353-378
if ('startDate' in payload && 'endDate' in payload) {
  const typedPayload = payload as unknown as ClearDateOverridesPayload;
  const { startDate, endDate } = typedPayload;

  // NO VALIDATION that startDate <= endDate

  const deleted = await prisma.blackoutDate.deleteMany({
    where: {
      tenantId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
  });

  // Returns success with count=0 if dates are inverted
  return {
    action: 'cleared',
    range: `${startDate} to ${endDate}`,
    deletedCount: deleted.count,
  };
}
```

**Risk:** User confusion - "cleared 0 items" when they expected items to be cleared. The inverted date range silently produces empty results.

## Proposed Solutions

### Option 1: Add validation in executor (Recommended)

**Pros:** Simple, clear error message
**Cons:** None
**Effort:** Small
**Risk:** Very low

```typescript
if (new Date(startDate) > new Date(endDate)) {
  throw new ValidationError('startDate must be before or equal to endDate');
}
```

### Option 2: Add validation in Zod schema with refine

**Pros:** Catches at validation layer
**Cons:** More complex, requires accessing sibling fields
**Effort:** Small
**Risk:** Very low

```typescript
z.object({
  operation: z.literal('clear_range'),
  startDate: z.string().date(),
  endDate: z.string().date(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'startDate must be before or equal to endDate',
});
```

### Option 3: Auto-swap if inverted

**Pros:** Forgiving, works with any order
**Cons:** May mask user errors
**Effort:** Small
**Risk:** Low

## Recommended Action

**TRIAGE RESULT: FIX BEFORE PRODUCTION** (Split vote: 1 MUST FIX, 1 FIX BEFORE PROD, 1 DEFER)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Add validation. Inverted date ranges silently fail (0 items deleted). Not a security issue but poor UX.

**Implementation:** Option 1 - Add validation in executor

## Technical Details

**Affected Files:**
- `server/src/agent/executors/booking-link-executors.ts` (lines 353-378)
- Optionally: `packages/contracts/src/schemas/booking-link.schema.ts` (ManageDateOverridesInputSchema)

## Acceptance Criteria

- [ ] Inverted date ranges produce clear error message
- [ ] Valid date ranges continue to work as expected
- [ ] Error message is user-friendly

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by data-integrity-guardian agent |

## Resources

- PR: Booking Links Phase 0 - commit 1bd733c9
