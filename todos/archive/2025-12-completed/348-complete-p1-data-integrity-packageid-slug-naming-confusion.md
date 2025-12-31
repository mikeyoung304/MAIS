---
status: complete
priority: p1
issue_id: '348'
tags: [code-review, data-integrity, naming, security]
dependencies: []
---

# Data Integrity: packageId vs slug Naming Confusion in onPaymentCompleted

## Problem Statement

The `onPaymentCompleted` method calls `getPackageBySlugWithAddOns(tenantId, input.packageId)` but the parameter is actually a **slug**, not a package ID. This confusing naming could lead to bugs if a caller passes an actual package ID instead of a slug.

**Why it matters:** Payment could be received but booking creation fails due to lookup failure, leading to orphaned payments and customer support issues.

## Findings

**File:** `server/src/services/booking.service.ts:707-716`

```typescript
// The variable is named packageId but it's actually a slug
const pkgWithAddOns = await this.catalogRepo.getPackageBySlugWithAddOns(
  tenantId,
  input.packageId // This is actually a SLUG, not an ID
);
```

**Agent:** data-integrity-guardian

## Proposed Solutions

### Option A: Rename input parameter (Recommended)

- **Pros:** Clear intent, prevents misuse, self-documenting
- **Cons:** Breaking change to internal interface
- **Effort:** Small
- **Risk:** Low

```typescript
input: {
  sessionId: string;
  packageSlug: string;  // Was: packageId
  ...
}
```

### Option B: Add validation guard

- **Pros:** Catches misuse at runtime
- **Cons:** Adds complexity, doesn't fix root cause
- **Effort:** Small
- **Risk:** Low

```typescript
if (input.packageId.startsWith('pkg_')) {
  logger.error(
    { packageId: input.packageId },
    'onPaymentCompleted called with package ID instead of slug'
  );
  throw new Error('Invalid parameter: expected slug, got ID');
}
```

### Option C: Document in JSDoc

- **Pros:** No code change
- **Cons:** Easy to miss, doesn't prevent bugs
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

Option A - Rename the parameter to `packageSlug` throughout the call chain.

## Technical Details

- **Affected files:** `server/src/services/booking.service.ts`, input type definitions
- **Components:** Booking service, payment completion flow
- **Database changes:** None

## Acceptance Criteria

- [ ] Input parameter renamed to `packageSlug` or clearly documented
- [ ] All callers updated to use correct naming
- [ ] Tests verify slug-based lookup works correctly

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2024-12-24 | Created from code review | data-integrity-guardian agent finding |

## Resources

- File: `server/src/services/booking.service.ts:707`
- Related: `getPackageBySlugWithAddOns` method in catalog repository
