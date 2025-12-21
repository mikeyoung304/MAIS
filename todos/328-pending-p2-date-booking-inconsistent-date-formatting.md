# P2: Inconsistent Date Formatting

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Identical date formatting logic duplicated twice in the same component.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:254-259, 364-369`

```typescript
// Line 254-259
{selectedDate.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})}

// Line 364-369 (duplicate)
{selectedDate.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})}
```

## Impact

- Code duplication
- Harder to maintain consistent formatting across app
- If format needs to change, must update multiple places

## Recommended Fix

The `formatDate()` utility already exists in `client/src/lib/utils.ts:28-39`.

```typescript
import { formatDate } from '@/lib/utils';

// Replace both instances with:
{formatDate(selectedDate)}
```

Or create a specific date format for booking displays:

```typescript
// In client/src/lib/utils.ts
export function formatBookingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

## Files to Update

1. `client/src/features/storefront/DateBookingWizard.tsx` - Use utility

## Review Reference
- Code Simplicity Review Finding P2-5 (Inconsistent Date Formatting)
