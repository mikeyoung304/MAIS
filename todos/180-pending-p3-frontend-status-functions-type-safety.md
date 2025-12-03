# TODO-180: Frontend Status Functions Accept String Instead of Typed Unions

**Priority:** P3 (Type Safety)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Pattern Recognition Specialist)

## Issue

The extracted utility functions `getStatusVariant()` and `getRefundStatusText()` accept `string` type instead of typed union types. This loses type safety that was present in the original inline implementations.

## Location

- `client/src/lib/utils.ts`

## Current Implementation

```typescript
export function getStatusVariant(status: string): 'default' | 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'confirmed': return 'success';
    case 'cancelled': return 'destructive';
    case 'pending': return 'secondary';
    default: return 'default';
  }
}

export function getRefundStatusText(status: string): string {
  switch (status) {
    case 'pending': return 'Refund Pending';
    case 'succeeded': return 'Refunded';
    case 'failed': return 'Refund Failed';
    default: return status;
  }
}
```

## Recommended Implementation

```typescript
// Import or define status types
import type { BookingStatus, RefundStatus } from '@macon/contracts';

// Or define locally if not in contracts
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'requires_action';

export function getStatusVariant(status: BookingStatus): 'default' | 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'no_show':
      return 'destructive';
    case 'pending':
      return 'secondary';
    default:
      // Exhaustive check - TypeScript will error if a case is missing
      const _exhaustive: never = status;
      return 'default';
  }
}

export function getRefundStatusText(status: RefundStatus): string {
  switch (status) {
    case 'pending': return 'Refund Pending';
    case 'succeeded': return 'Refunded';
    case 'failed': return 'Refund Failed';
    case 'requires_action': return 'Action Required';
    default:
      const _exhaustive: never = status;
      return status;
  }
}
```

## Benefits

1. Compile-time validation of status values
2. IDE autocomplete for valid status options
3. Exhaustive switch ensures all cases handled
4. Self-documenting code (types show valid values)

## Acceptance Criteria

- [ ] Status types imported from contracts or defined in utils
- [ ] `getStatusVariant` uses typed BookingStatus union
- [ ] `getRefundStatusText` uses typed RefundStatus union
- [ ] Exhaustive switch patterns with `never` fallback
- [ ] All callers updated to pass typed values (or add type guards)

## Related

- `packages/contracts/src/schemas/booking.ts` - Source of truth for status types
- `client/src/pages/booking-management/` - Primary consumers of these utilities
