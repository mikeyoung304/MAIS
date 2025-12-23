# P1: Missing Runtime Validation in Seed Data

## Priority: P1 Critical
## Status: ready
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The seed function accepts `bookingType` as an optional parameter with no runtime validation that the value is a valid `BookingType` enum member.

**File:** `server/prisma/seeds/la-petit-mariage.ts:107-136`

```typescript
// Line 107: Accepts any string, no validation
bookingType?: 'DATE' | 'TIMESLOT';

// Line 122: No validation before database write
bookingType, // Could be invalid enum value
```

## Impact

- If a typo is introduced (e.g., `bookingType: 'DATTE'`), migration fails at runtime
- TypeScript type checking is compile-time only; seed scripts run at runtime
- Potential for database constraint violations in production seeds

## Recommended Fix

```typescript
import { BookingType } from '../../src/generated/prisma';

async function createOrUpdatePackageWithSegment(
  prisma: PrismaOrTransaction,
  tenantId: string,
  segmentId: string,
  options: {
    // ... other fields ...
    bookingType?: BookingType; // Use Prisma-generated enum
  }
): Promise<Package> {
  const { bookingType = BookingType.DATE } = options;

  // Validate enum value at runtime
  if (!Object.values(BookingType).includes(bookingType)) {
    throw new Error(`Invalid bookingType: ${bookingType}`);
  }

  // ... rest of implementation
}
```

## Files to Update

1. `server/prisma/seeds/la-petit-mariage.ts`
2. Any other seed files that create packages

## Testing

- Run seed with intentional typo to verify validation catches it
- Verify correct values pass validation



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Data Integrity Review Finding P1-004 (Seed data inconsistency)
