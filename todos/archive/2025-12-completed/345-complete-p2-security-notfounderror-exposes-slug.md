---
status: complete
priority: p2
issue_id: '345'
tags: [code-review, security, information-disclosure]
dependencies: ['344']
---

# Security: NotFoundError Exposes Package Slug

## Problem Statement

The `NotFoundError` in booking service includes the package slug/ID in its message, allowing attackers to distinguish between "valid but inactive" and "non-existent" packages.

**Why it matters:** Information enumeration aids reconnaissance for targeted attacks.

## Findings

**File:** `server/src/services/booking.service.ts:383-384, 708-710`

```typescript
if (!pkg) {
  throw new NotFoundError(`Package not found: ${input.packageId}`);
}
// ... and ...
if (!pkgWithAddOns) {
  throw new NotFoundError(`Package ${input.packageId} not found`);
}
```

**Agent:** security-sentinel

## Proposed Solutions

### Option A: Generic message (Recommended)

- **Pros:** Consistent with P1-172 fix pattern
- **Cons:** Less client-side debugging info
- **Effort:** Small
- **Risk:** Low

```typescript
// Follow existing P1-172 pattern
logger.warn({ tenantId, packageId: input.packageId }, 'Package not found in booking flow');
throw new NotFoundError('The requested resource was not found');
```

## Recommended Action

Apply Option A following existing pattern from line 163.

## Technical Details

- **Affected files:** `server/src/services/booking.service.ts`
- **Components:** Booking service, error handling
- **Database changes:** None

## Acceptance Criteria

- [ ] Error messages do not expose package identifiers
- [ ] Package identifiers logged internally
- [ ] Consistent with P1-172 fix pattern

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2024-12-24 | Created from code review | security-sentinel agent finding |

## Resources

- Reference pattern: `booking.service.ts:163` (P1-172 FIX)
