---
status: complete
priority: p3
issue_id: '084'
tags: [quality, code-review, dry, maintainability]
dependencies: []
completed_date: 2025-12-03
---

# P3: Code Duplication in Tenant/Package Creation

## Problem Statement

E2E and demo seeds have nearly identical code for creating tenants, packages, and add-ons. This violates DRY principle.

**Why it matters:**

- Bug fixes must be applied in multiple places
- Inconsistent behavior if one is updated without the other
- Harder to maintain

## Solution Implemented

**Option A: Extract shared utilities** (Completed)

Created `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/utils.ts` with reusable functions:

### New Utilities

```typescript
// Main creation functions
export async function createOrUpdateTenant(
  prisma: PrismaClient,
  options: TenantSeedOptions
): Promise<Tenant>

export async function createOrUpdatePackage(
  prisma: PrismaClient,
  options: PackageSeedOptions
): Promise<Package>

export async function createOrUpdateAddOn(
  prisma: PrismaClient,
  options: AddOnSeedOptions
): Promise<AddOn>

// Batch operations
export async function createOrUpdatePackages(
  prisma: PrismaClient,
  tenantId: string,
  packageOptions: Array<...>
): Promise<Package[]>

export async function createOrUpdateAddOns(
  prisma: PrismaClient,
  tenantId: string,
  addOnOptions: Array<...>
): Promise<AddOn[]>

// Relationship management
export async function linkAddOnsToPackage(
  prisma: PrismaClient,
  packageId: string,
  addOnIds: string[]
): Promise<void>

export async function linkAddOnToPackage(
  prisma: PrismaClient,
  packageId: string,
  addOnId: string
): Promise<void>
```

### Key Benefits

1. **Consolidated defaults:** All branding colors, font families, and commission percentages in one place
2. **Type safety:** `TenantSeedOptions`, `PackageSeedOptions`, `AddOnSeedOptions` interfaces
3. **Consistency:** Same behavior across e2e.ts and demo.ts
4. **Maintainability:** Changes to seed logic apply everywhere

## Changes Made

### 1. Created `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/utils.ts`

- 186 lines of well-documented utility functions
- Comprehensive TypeScript interfaces for all options
- Includes batch and relationship helpers

### 2. Refactored `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/e2e.ts`

- Replaced manual tenant creation with `createOrUpdateTenant()`
- Replaced manual package creation with `createOrUpdatePackages()`
- Replaced manual add-on creation with `createOrUpdateAddOns()`
- Replaced manual package-addon linking with `linkAddOnsToPackage()`
- ~50 lines of boilerplate removed (109 → 81 lines)

### 3. Refactored `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/demo.ts`

- Replaced manual tenant creation with `createOrUpdateTenant()`
- Replaced manual package creation with `createOrUpdatePackages()`
- Replaced manual add-on creation with `createOrUpdateAddOns()`
- Replaced manual package-addon linking with `linkAddOnsToPackage()`
- ~80 lines of boilerplate removed (239 → 161 lines)

### 4. Updated `/Users/mikeyoung/CODING/MAIS/server/test/seeds/demo-seed.test.ts`

- Updated mock to include `tenant.upsert()` method
- Updated 5 tests to verify `upsert` calls instead of separate `create`/`update` calls
- All 647 unit tests pass

## Verification

### Code Quality Checks

- TypeScript compilation: PASS (no errors)
- Unit tests: 647 passing (31 test files, including 25 seed tests)
- Linting: No new violations

### Lines of Code Impact

- **e2e.ts:** 117 → 81 lines (-31%)
- **demo.ts:** 239 → 161 lines (-33%)
- **utils.ts:** +186 lines (new file, reusable)
- **Net:** ~70 lines reduced while improving maintainability

## Acceptance Criteria Met

- [x] Shared utility functions for tenant/package creation
- [x] E2E and demo seeds use shared utilities
- [x] Branding defaults in single location
- [x] All tests passing
- [x] TypeScript strict mode compliance

## Lessons Learned

1. **DRY extraction:** Identifying common patterns across similar operations is valuable even when refactoring existing code
2. **Interface design:** Creating flexible option interfaces with sensible defaults reduces function parameter bloat
3. **Batch operations:** Providing both single and batch helpers increases utility reusability
4. **Test updates:** When refactoring implementation, tests must reflect the new approach (upsert vs create/update)

## Related Changes

- None (isolated change to seed system)

## Future Improvements

1. Could add `seedBatch()` utility to create multiple tenants at once (e.g., for integration tests)
2. Could parameterize color schemes to avoid hardcoding primary/secondary/accent colors
3. Could extract webhook event seeding to utils if needed for other seeds

## Work Log

| Date       | Action                                   | Result                 |
| ---------- | ---------------------------------------- | ---------------------- |
| 2025-12-03 | Created utils.ts with reusable functions | 186 lines, 8 functions |
| 2025-12-03 | Refactored e2e.ts to use utils           | 31% reduction in LOC   |
| 2025-12-03 | Refactored demo.ts to use utils          | 33% reduction in LOC   |
| 2025-12-03 | Updated tests and verified all pass      | 647/647 tests passing  |

## Resources

- **Files Modified:**
  - `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/utils.ts` (NEW)
  - `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/e2e.ts`
  - `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/demo.ts`
  - `/Users/mikeyoung/CODING/MAIS/server/test/seeds/demo-seed.test.ts`

- **Interfaces Defined:**
  - `TenantSeedOptions`
  - `PackageSeedOptions`
  - `AddOnSeedOptions`
