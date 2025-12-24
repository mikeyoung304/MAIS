# P2: Database N+1 Query Risk in Booking Service

## Priority: P2 Important

## Status: ready

## Feature: DATE Booking Flow

## Category: Performance

## Issue

In `onPaymentCompleted`, the service fetches package data and then separately fetches add-ons, creating 2 sequential queries when 1 would suffice.

**File:** `server/src/services/booking.service.ts:578-582`

```typescript
// Line 570-574 - First query: package only
const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);

// Line 577-582 - Second query: add-ons for that package
if (input.addOnIds && input.addOnIds.length > 0) {
  const addOns = await this.catalogRepo.getAddOnsByPackageId(tenantId, pkg.id);
  // ...
}
```

## Impact

- 2 round-trips to database instead of 1
- Happens on every successful payment webhook (high-traffic endpoint)
- Performance degrades with number of bookings

## Recommended Fix

Create a new repository method `getPackageBySlugWithAddOns`:

```typescript
// In catalog.repository.ts
async getPackageBySlugWithAddOns(tenantId: string, slug: string) {
  const pkg = await this.prisma.package.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: {
      addOns: {
        include: {
          addOn: true,
        },
      },
    },
  });

  if (!pkg) return null;

  return {
    ...this.toDomainPackage(pkg),
    addOns: pkg.addOns.map(pa => this.toDomainAddOn({ /* ... */ })),
  };
}
```

## Reference

The pattern already exists at lines 383-421 in `catalog.repository.ts` for `getPackagesBySegmentWithAddOns`.

## Files to Update

1. `server/src/adapters/prisma/catalog.repository.ts` - Add method
2. `server/src/lib/ports.ts` - Add to interface
3. `server/src/services/booking.service.ts` - Use new method

## Work Log

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference

- Performance Review Finding P2 (Database N+1 Query Risk)
