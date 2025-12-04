---
title: AddOn Entity Cascading Type Errors
slug: addon-entity-cascading-type-errors
category: build-errors
severity: high
component: server/entities
date_resolved: 2025-12-03
symptoms:
  - "Property 'description' is missing in type 'AddOn'"
  - "Type 'string | null | undefined' is not assignable to type 'string | undefined'"
  - Render build failure with 15+ TypeScript errors
  - Errors in mock adapter, Prisma repository, and route handlers
root_cause: Entity interface change not propagated to all locations that create or consume AddOn objects
solution_type: type-fix
related_files:
  - server/src/lib/entities.ts
  - server/src/adapters/mock/index.ts
  - server/src/adapters/prisma/catalog.repository.ts
  - server/src/routes/tenant-admin.routes.ts
tags:
  - entity-sync
  - type-safety
  - cascading-errors
  - typescript-strict
---

# AddOn Entity Cascading Type Errors

## Problem Summary

After adding a `description` field to the `AddOn` entity interface, the Render build failed with 15+ TypeScript compilation errors across multiple files. The entity change wasn't propagated to all locations that create or consume AddOn objects.

## Error Messages

```
src/adapters/mock/index.ts(136,29): error TS2345: Argument of type '{ id: string; packageId: string; title: string; priceCents: number; photoUrl: string; }' is not assignable to parameter of type 'AddOn'.
  Property 'description' is missing in type '{ id: string; packageId: string; title: string; priceCents: number; photoUrl: string; }' but required in type 'AddOn'.

src/adapters/prisma/catalog.repository.ts(648,5): error TS2741: Property 'description' is missing in type '{ id: string; packageId: string; title: string; priceCents: number; photoUrl: undefined; }' but required in type 'AddOn'.

src/routes/tenant-admin.routes.ts(1052,27): error TS2345: Types of property 'photoUrl' are incompatible.
  Type 'string | null | undefined' is not assignable to type 'string | null'.
```

## Root Cause Analysis

The `AddOn` entity interface is used as a **contract across multiple architectural layers**:

1. **Entity Definition** - The source of truth
2. **Mock Adapters** - Create AddOn objects for testing
3. **Prisma Repository** - Maps database records to AddOn objects
4. **Route Handlers** - Map AddOn entities to DTOs

When the entity interface changes, **ALL** these locations must be updated. The initial fix only updated the entity definition, causing cascading failures.

### Affected Locations (5 files)

| Layer      | File                                    | What Creates AddOn         |
| ---------- | --------------------------------------- | -------------------------- |
| Entity     | `entities.ts`                           | Interface definition       |
| Mock       | `adapters/mock/index.ts`                | 6 test fixtures            |
| Repository | `adapters/prisma/catalog.repository.ts` | `toDomainAddOn()` mapper   |
| Routes     | `routes/tenant-admin.routes.ts`         | `mapAddOnToDto()` function |
| Routes     | `routes/admin-packages.routes.ts`       | Inline DTO mapping         |

## Solution

### Step 1: Entity Definition (entities.ts)

Make `description` **optional AND nullable** to handle both missing values and database NULLs:

```typescript
export interface AddOn {
  id: string;
  packageId: string;
  title: string;
  description?: string | null; // Optional AND nullable
  priceCents: number;
  photoUrl?: string; // Optional only (matches DTO schema)
}
```

**Key Decision**: `photoUrl` stays as `?: string` (not `| null`) because the DTO schema expects `string | undefined`, not `string | null`.

### Step 2: Mock Adapter Fixtures (adapters/mock/index.ts)

Add `description` to ALL 6 mock AddOn objects:

```typescript
addOns.set('addon_video', {
  id: 'addon_video',
  packageId: 'pkg_basic',
  title: 'Video Recording',
  description: 'Professional video recording of your ceremony', // ADDED
  priceCents: 50000,
  photoUrl: 'https://...',
});

// Repeat for: addon_flowers, addon_makeup, addon_music, addon_cake, addon_album
```

### Step 3: Prisma Repository Mapper (catalog.repository.ts)

Add `description` to the domain mapper:

```typescript
private toDomainAddOn(addOn: {
  id: string;
  name: string;
  price: number;
  packages: { packageId: string }[];
}): AddOn {
  return {
    id: addOn.id,
    packageId: addOn.packages[0]?.packageId || '',
    title: addOn.name,
    description: null,  // ADDED - explicit null for legacy records
    priceCents: addOn.price,
    photoUrl: undefined,
  };
}
```

### Step 4: Route DTO Mapper (tenant-admin.routes.ts)

Use the `AddOn` type directly with nullish coalescing:

```typescript
import type { AddOn } from '../lib/entities';

const mapAddOnToDto = (addOn: AddOn) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description ?? null, // Handle undefined → null
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});
```

## Verification

```bash
# Run typecheck to verify all errors resolved
npm run typecheck

# Should output clean with no errors
> tsc --noEmit
```

## Prevention Strategies

### 1. Entity Change Checklist

When modifying ANY entity in `entities.ts`, check these locations:

- [ ] Entity definition (`server/src/lib/entities.ts`)
- [ ] Mock adapter fixtures (`server/src/adapters/mock/index.ts`)
- [ ] Prisma repository mappers (`server/src/adapters/prisma/*.ts`)
- [ ] Route DTO mappers (`server/src/routes/*.ts`)
- [ ] Service factories (if applicable)

### 2. Pre-Commit Verification

Always run `npm run typecheck` before pushing changes that touch entity files:

```bash
# Add to pre-push hook or CI
npm run typecheck
```

### 3. Code Review Guidelines

When reviewing entity changes, verify:

1. **All fixtures updated** - Search for entity name in mock adapter
2. **All mappers updated** - Check Prisma repository `toDomain*` methods
3. **All DTOs aligned** - Compare entity fields with DTO schemas
4. **Type compatibility** - `null` vs `undefined` handling at boundaries

### 4. Type Safety Patterns

| Pattern                | Use When                    | Example                        |
| ---------------------- | --------------------------- | ------------------------------ |
| `field?: Type`         | Optional, never null        | `photoUrl?: string`            |
| `field?: Type \| null` | Optional OR null (database) | `description?: string \| null` |
| `field: Type \| null`  | Required but nullable       | `deletedAt: Date \| null`      |

## Related Documentation

- [SCHEMA_DRIFT_PREVENTION.md](../SCHEMA_DRIFT_PREVENTION.md) - Database schema sync
- [PRISMA-TYPESCRIPT-BUILD-PREVENTION.md](../PRISMA-TYPESCRIPT-BUILD-PREVENTION.md) - Prisma type safety

## Commits

- `36f0aca` - fix: add description field to AddOn entity (initial, incomplete)
- `d85ba07` - fix: resolve AddOn entity type mismatches across codebase (complete fix)
