# P2: Type Casting Overuse in DateBookingPage

## Priority: P2 Important
## Status: ready
## Feature: DATE Booking Flow
## Category: Code Simplicity

## Issue

Type assertion indicates `PackageDto` schema is incomplete - the `bookingType` field should be part of the type.

**File:** `client/src/pages/DateBookingPage.tsx:74, 85`

```typescript
const bookingType = (packageData as PackageDto & { bookingType?: string }).bookingType;
```

## Impact

- Type safety bypass
- Requires developers to remember optional fields
- Indicates schema is out of sync with reality

## Recommended Fix

Add `bookingType` to `PackageDtoSchema` in contracts:

```typescript
// In contracts/src/dto.ts PackageDtoSchema
export const PackageDtoSchema = z.object({
  // ... existing fields
  bookingType: BookingTypeSchema.optional().default('DATE'),
  // ... rest of fields
});

export type PackageDto = z.infer<typeof PackageDtoSchema>;
```

Then update the component:

```typescript
// Clean usage without type assertion
const bookingType = packageData.bookingType || 'DATE';
```

## Files to Update

1. `packages/contracts/src/dto.ts` - Add bookingType to PackageDtoSchema
2. `client/src/pages/DateBookingPage.tsx` - Remove type assertion
3. `client/src/features/storefront/TierDetail.tsx` - Same fix



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Code Simplicity Review Finding P2-7 (Type Casting Overuse)
