---
status: completed
priority: p2
issue_id: "186"
tags: [code-review, type-safety, patterns]
dependencies: []
---

# Switch Statements Missing Exhaustiveness Checks

## Problem Statement

The `getStatusVariant()` and `getRefundStatusText()` functions use switch statements on union types without exhaustiveness checks. If new status values are added, TypeScript won't catch missing cases - the function silently returns undefined.

## Findings

**Location:** `client/src/lib/utils.ts:50-65` and `70-83`

**Current Code (no exhaustiveness check):**
```typescript
export function getStatusVariant(status: BookingStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'CONFIRMED':
    case 'FULFILLED':
      return 'default';
    case 'PAID':
    case 'DEPOSIT_PAID':
      return 'secondary';
    case 'CANCELED':
      return 'destructive';
    case 'REFUNDED':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    // ❌ No default case - if new status added, returns undefined silently
  }
}
```

**Risk Assessment:**
- Impact: Medium (silent failures if union types expand)
- Likelihood: Medium (status types may expand as product evolves)

## Proposed Solutions

### Solution 1: Add exhaustiveness check with never (Recommended)
- Add default case that assigns to `never` type
- TypeScript errors if any case is missing
- **Pros:** Compile-time guarantee all cases handled
- **Cons:** Slightly more verbose
- **Effort:** Small (10 minutes)
- **Risk:** None

### Solution 2: Add default case with fallback
- Add explicit default case returning safe value
- **Pros:** Simple, no runtime errors
- **Cons:** Masks missing cases, no compile-time warning
- **Effort:** Small (5 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** for compile-time safety.

## Technical Details

**Affected Files:**
- `client/src/lib/utils.ts`

**Proposed Change:**
```typescript
export function getStatusVariant(status: BookingStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'CONFIRMED':
    case 'FULFILLED':
      return 'default';
    case 'PAID':
    case 'DEPOSIT_PAID':
      return 'secondary';
    case 'CANCELED':
      return 'destructive';
    case 'REFUNDED':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    default: {
      // Exhaustiveness check - TypeScript will error if a case is missing
      const _exhaustiveCheck: never = status;
      return 'outline'; // Safe fallback
    }
  }
}

export function getRefundStatusText(status?: RefundStatus): string | null {
  if (!status || status === 'NONE') return null;

  switch (status) {
    case 'PENDING':
      return 'Refund pending';
    case 'PROCESSING':
      return 'Refund processing';
    case 'COMPLETED':
      return 'Refund completed';
    case 'PARTIAL':
      return 'Partial refund issued';
    case 'FAILED':
      return 'Refund failed';
    default: {
      const _exhaustiveCheck: never = status;
      return null;
    }
  }
}
```

## Acceptance Criteria

- [ ] Both functions have exhaustiveness checks
- [ ] TypeScript errors if new status value added without handling
- [ ] No runtime behavior change for existing cases
- [ ] No TypeScript errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced typed status functions)
- TypeScript Handbook: Exhaustiveness checking
