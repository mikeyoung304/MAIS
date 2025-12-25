---
status: complete
priority: p3
issue_id: "356"
tags: [code-review, simplicity, cleanup]
dependencies: []
---

# Simplicity: Redundant Variable Assignment in onPaymentCompleted

## Problem Statement

After fetching `pkgWithAddOns`, there's a redundant assignment `const pkg = pkgWithAddOns` that adds unnecessary indirection.

**Why it matters:** Minor readability issue. One less variable to track through the method.

## Findings

**File:** `server/src/services/booking.service.ts:715-716`

```typescript
const pkgWithAddOns = await this.catalogRepo.getPackageBySlugWithAddOns(
  tenantId,
  input.packageId
);
// ... null check ...
const pkg = pkgWithAddOns;  // <-- Redundant assignment
```

**Agent:** code-simplicity-reviewer

## Proposed Solutions

### Option A: Use pkgWithAddOns directly
- **Pros:** Removes indirection
- **Cons:** Longer variable name
- **Effort:** Small
- **Risk:** Low

### Option B: Name it pkg from the start (Recommended)
- **Pros:** Clean, consistent with rest of codebase
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

```typescript
const pkg = await this.catalogRepo.getPackageBySlugWithAddOns(
  tenantId,
  input.packageId
);
```

## Recommended Action

Option B - Rename to `pkg` at declaration.

## Technical Details

- **Affected files:** `server/src/services/booking.service.ts`
- **Components:** Booking service, payment completion flow
- **Database changes:** None

## Acceptance Criteria

- [ ] Redundant variable assignment removed
- [ ] All usages updated to consistent name
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | code-simplicity-reviewer finding |

## Resources

- File: `server/src/services/booking.service.ts:707-750`
