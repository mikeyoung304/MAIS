---
status: complete
priority: p2
issue_id: "178"
tags: [todo]
dependencies: []
---

# TODO-178: Seed Operations Missing Transaction Wrapping

**Priority:** P2 (Data Integrity)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Data Integrity Guardian)

## Issue

The extracted seed utilities in `server/prisma/seeds/utils.ts` perform multi-step operations without transaction wrapping. If seeding fails mid-operation:

1. Partial data remains in the database
2. Re-running seed may fail due to unique constraint violations
3. Database ends up in inconsistent state requiring manual cleanup

## Location

- `server/prisma/seeds/utils.ts`
- `server/prisma/seeds/demo.ts`
- `server/prisma/seeds/e2e.ts`

## Current Pattern

```typescript
// utils.ts - Functions operate independently
export async function createTenantWithOwner(prisma: PrismaClient, data: TenantData) {
  const tenant = await prisma.tenant.create({ ... });
  const owner = await prisma.user.create({ ... });
  // If user creation fails, tenant is orphaned
  return { tenant, owner };
}

// demo.ts - Multiple utility calls without transaction
await createTenantWithOwner(prisma, tenantData);
await createPackages(prisma, tenantId);
await createBookings(prisma, tenantId);
// If bookings fail, packages exist without bookings
```

## Recommended Pattern

```typescript
// Option A: Transaction wrapper in utilities
export async function createTenantWithOwner(prisma: PrismaClient, data: TenantData) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ ... });
    const owner = await tx.user.create({ ... });
    return { tenant, owner };
  });
}

// Option B: Transaction at seed level
async function seed() {
  await prisma.$transaction(async (tx) => {
    await createTenantWithOwner(tx, tenantData);
    await createPackages(tx, tenantId);
    await createBookings(tx, tenantId);
  }, { timeout: 60000 }); // Increase timeout for large seeds
}
```

## Risk Assessment

- **Impact**: Medium (corrupted seed data requires manual DB cleanup)
- **Likelihood**: Low (seeds run infrequently, usually in dev/test)
- **Overall**: P2 - Important for developer experience and CI reliability

## Acceptance Criteria

- [ ] All seed utility functions accept `PrismaClient | Prisma.TransactionClient`
- [ ] Demo seed wrapped in transaction with appropriate timeout
- [ ] E2E seed wrapped in transaction with appropriate timeout
- [ ] Test for seed idempotency (can re-run after failure)
- [ ] Document transaction pattern in seed utils

## Related

- TODO-084: Completed extraction of seed utilities (foundation for this work)
- `server/prisma/seeds/demo.ts` - Demo data seeding
- `server/prisma/seeds/e2e.ts` - E2E test seeding
