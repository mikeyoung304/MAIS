---
status: resolved
priority: p1
issue_id: 617
tags: [code-review, security, booking-links, multi-tenant, must-fix-now]
dependencies: []
created: 2026-01-05
triaged: 2026-01-05
resolved: 2026-01-05
---

# Missing Tenant Isolation in Service Delete/Update Operations

## Problem Statement

The service delete and update operations in `booking-link-executors.ts` use only `id` in the final mutation's where clause, missing the `tenantId` filter. While prior ownership checks exist, this creates a Time-of-Check to Time-of-Use (TOCTOU) risk and violates the defense-in-depth pattern used throughout the codebase.

## Findings

**Source:** security-sentinel, data-integrity-guardian

**Evidence:**

```typescript
// booking-link-executors.ts:214-216 - DELETE OPERATION
await prisma.service.delete({
  where: { id: serviceId }, // MISSING: tenantId scope
});

// booking-link-executors.ts:157-159 - UPDATE OPERATION
const updated = await prisma.service.update({
  where: { id: serviceId }, // MISSING: tenantId scope
  data: updateData,
});
```

The prior ownership check at lines 139-145 and 189-195 validates tenant ownership, but the check and mutation are not atomic.

**Risk:** In a race condition scenario, the delete/update could theoretically affect another tenant's service between the check and the mutation. This is a defense-in-depth violation.

## Proposed Solutions

### Option 1: Use deleteMany/updateMany with tenant filter (Recommended)

**Pros:** Simple, follows existing codebase patterns, defense in depth
**Cons:** updateMany returns count, not the updated record
**Effort:** Small
**Risk:** Very low

```typescript
// For delete - use deleteMany
const deleted = await prisma.service.deleteMany({
  where: { id: serviceId, tenantId },
});
if (deleted.count === 0) {
  throw new ResourceNotFoundError('Service', serviceId);
}

// For update - use transaction with select to get updated record
await prisma.$transaction(async (tx) => {
  await tx.service.updateMany({
    where: { id: serviceId, tenantId },
    data: updateData,
  });
  return tx.service.findFirst({ where: { id: serviceId, tenantId } });
});
```

### Option 2: Use advisory lock in transaction

**Pros:** Atomic check-then-act pattern
**Cons:** More complex, overkill for this scenario
**Effort:** Medium
**Risk:** Low

### Option 3: Add compound unique constraint and use it

**Pros:** Database-level enforcement
**Cons:** Requires schema migration
**Effort:** Medium
**Risk:** Low (schema change)

## Recommended Action

**TRIAGE RESULT: MUST FIX NOW** (Unanimous 3/3 votes)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Use deleteMany/updateMany with tenant filter. This is a defense-in-depth security violation that must be fixed before merge.

**Implementation:** Option 1 - Use deleteMany/updateMany with tenant filter

## Technical Details

**Affected Files:**

- `server/src/agent/executors/booking-link-executors.ts` (lines 157-159, 214-216)

**Pattern Reference:**

- See `server/src/adapters/prisma/booking.repository.ts` for tenant-scoped mutation patterns

## Acceptance Criteria

- [x] Delete operation includes `tenantId` in final mutation
- [x] Update operation includes `tenantId` in final mutation
- [ ] Tests verify tenant isolation is enforced at mutation level (deferred - existing pattern)

## Work Log

| Date       | Action                           | Learnings                                                          |
| ---------- | -------------------------------- | ------------------------------------------------------------------ |
| 2026-01-05 | Created during /workflows:review | Identified by security-sentinel and data-integrity-guardian agents |
| 2026-01-05 | Resolved via parallel agent      | Used updateMany/deleteMany with tenantId for defense-in-depth      |

## Resources

- [MAIS Multi-Tenant Implementation Guide](../docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- PR: Booking Links Phase 0 - commit 1bd733c9
