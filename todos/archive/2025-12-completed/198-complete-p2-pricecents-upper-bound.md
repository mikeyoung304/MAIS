---
status: complete
priority: p2
issue_id: '198'
tags: [code-review, security, validation]
dependencies: []
resolved_at: '2025-12-23'
resolved_by: 'claude-opus-4-5'
---

# Missing priceCents Upper Bound Validation

## Problem Statement

The `priceCents` field validates non-negative values but lacks an upper bound. This could allow integer overflow attacks or unreasonable prices.

### Why It Matters

- Integer overflow attacks (prices > 2^31 - 1)
- Business logic bugs (prices in quadrillions)
- Currency conversion issues (exceeds Stripe's maximum charge of $999,999.99)

## Findings

**Source:** Security Review

**Evidence:**

```typescript
// dto.ts:232 - Only min validation
priceCents: z.number().int().min(0),

// validation.ts:10 - Only checks negative
export function validatePrice(priceCents: number, fieldName: string = 'price'): void {
  if (priceCents < 0) {
    throw new ValidationError(`${fieldName} must be non-negative`);
  }
}
```

**Location:**

- `packages/contracts/src/dto.ts:232`
- `server/src/lib/validation.ts:10`

## Proposed Solutions

### Option A: Add Upper Bound Validation (Recommended)

**Pros:** Prevents overflow, aligns with Stripe limits
**Cons:** Could reject legitimate ultra-luxury items
**Effort:** Small (5 minutes)
**Risk:** Low

```typescript
// dto.ts
priceCents: z.number().int().min(0).max(99999999), // Max $999,999.99

// validation.ts
export function validatePrice(priceCents: number, fieldName: string = 'price'): void {
  if (priceCents < 0) {
    throw new ValidationError(`${fieldName} must be non-negative`);
  }
  if (priceCents > 99999999) { // $999,999.99
    throw new ValidationError(`${fieldName} exceeds maximum allowed value ($999,999.99)`);
  }
}
```

## Recommended Action

Option A - Add Stripe-aligned upper bound.

## Technical Details

**Affected Files:**

- `packages/contracts/src/dto.ts`
- `server/src/lib/validation.ts`

**Database Changes:** None

## Acceptance Criteria

- [x] Zod schema has max(99999999) on priceCents
- [x] validatePrice checks upper bound
- [x] Tests verify rejection of prices > $999,999.99
- [x] Error message is user-friendly

## Resolution Summary

Fixed all `priceCents` fields with Stripe-aligned upper bound validation:

### Files Modified

1. **`packages/contracts/src/dto.ts`** - Added `.max(MAX_PRICE_CENTS)` to:
   - `CreatePackageDtoSchema.priceCents`
   - `UpdatePackageDtoSchema.priceCents`
   - `UpdatePackageDraftDtoSchema.priceCents`
   - `ServiceDtoSchema.priceCents`
   - `CreateServiceDtoSchema.priceCents`
   - `UpdateServiceDtoSchema.priceCents`
   - (Note: `CreateAddOnDtoSchema` and `UpdateAddOnDtoSchema` already had this)

2. **`server/src/validation/tenant-admin.schemas.ts`** - Added upper bound to:
   - `createPackageSchema.priceCents`
   - `updatePackageSchema.priceCents`

3. **`server/src/lib/validation.ts`** - Already had upper bound; removed outdated TODO comment

### Tests Added

- **`server/test/lib/validation.spec.ts`** - 29 new tests covering:
  - Valid price ranges (0 to $999,999.99)
  - Lower bound rejection (negative prices)
  - Upper bound rejection (prices > $999,999.99)
  - Integer overflow prevention
  - Custom field name in error messages
  - MAX_PRICE_CENTS constant validation

## Work Log

| Date       | Action                   | Learnings                                                                              |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------- |
| 2025-12-03 | Created from code review | Always validate upper bounds on numeric inputs                                         |
| 2025-12-23 | Resolved                 | Apply validation to all price-related fields across contracts and tenant-admin schemas |

## Resources

- Stripe charge limits: https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
