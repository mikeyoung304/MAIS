---
title: 'Render Deployment: TypeScript Errors in Visual Editor Draft Operations'
date: 2025-12-02
category: build-errors
severity: high
component: visual-editor/catalog.repository
tags:
  - typescript
  - prisma
  - mock-adapter
  - type-safety
  - deployment
  - render
related_files:
  - server/src/adapters/mock/index.ts
  - server/src/adapters/prisma/catalog.repository.ts
  - server/src/lib/ports.ts
symptoms:
  - "TS2322: Type 'boolean | undefined' is not assignable to type 'boolean'"
  - "TS2322: Type 'string | null | undefined' is not assignable to type 'string | null'"
  - "TS2322: Type 'JsonValue' is not assignable to type 'JsonNull | InputJsonValue | undefined'"
  - "TS1361: 'Prisma' cannot be used as a value because it was imported using 'import type'"
root_cause: |
  Code review fixes for draft field deletion (commit 37e9184) introduced type mismatches:
  1. Mock adapter spread optional properties onto PackageWithDraft, creating union types
  2. Prisma.JsonNull used with type-only import (needs value import)
  3. Missing type assertions for conditional JSON field assignments
trigger_commits:
  - '37e9184: fix(visual-editor): address code review findings'
solution_commits:
  - 'bfcc00c: fix(build): resolve TypeScript errors for Render deployment'
---

# Render Deployment: TypeScript Errors in Visual Editor Draft Operations

## Problem Description

After pushing visual editor code review fixes (commit `37e9184`), the Render deployment build failed with 5 TypeScript errors. The build succeeded locally with `npm run typecheck` but failed during Render's `tsc -b` compilation.

### Error Messages

```
src/adapters/mock/index.ts(393,5): error TS2322: Type '{ name: string; basePrice: number; draftTitle: null; ... }[]' is not assignable to type 'PackageWithDraft[]'.
  Types of property 'active' are incompatible.
    Type 'boolean | undefined' is not assignable to type 'boolean'.

src/adapters/mock/index.ts(419,5): error TS2322: Type '{ name: string; basePrice: number; draftTitle: string | null; ... }' is not assignable to type 'PackageWithDraft'.
  Types of property 'segmentId' are incompatible.
    Type 'string | null | undefined' is not assignable to type 'string | null'.

src/adapters/prisma/catalog.repository.ts(510,13): error TS2322: Type 'JsonValue' is not assignable to type 'JsonNull | InputJsonValue | undefined'.

src/adapters/prisma/catalog.repository.ts(515,13): error TS2322: Type 'null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.

src/adapters/prisma/catalog.repository.ts(542,22): error TS1361: 'Prisma' cannot be used as a value because it was imported using 'import type'.
```

## Root Cause Analysis

### Issue 1: Prisma Import Error (TS1361)

The catalog repository used a type-only import for `Prisma`:

```typescript
// BROKEN - type-only import
import type { Prisma } from '../../generated/prisma';

// Later in code:
draftPhotos: Prisma.JsonNull,  // Error: Prisma cannot be used as a value
```

Type-only imports are erased at compile time and cannot be used as runtime values. `Prisma.JsonNull` is a special sentinel value that requires a value import.

### Issue 2: JSON Type Casting (TS2322)

Conditional JSON field assignments lacked proper type assertions:

```typescript
// BROKEN - no type assertion
photos: pkg.draftPhotos !== null ? pkg.draftPhotos : pkg.photos,
```

Prisma distinguishes between:

- `JsonValue` - output type when reading from database
- `InputJsonValue` - input type when writing to database

Conditional expressions need explicit casts to `InputJsonValue`.

### Issue 3: Mock Adapter Type Mismatch (TS2322)

The mock adapter used object spread on Package objects:

```typescript
// BROKEN - spreads optional properties as undefined
return Array.from(packages.values()).map((pkg) => ({
  ...pkg, // active?: boolean becomes boolean | undefined
  name: pkg.title,
  // ...
}));
```

The internal Package type uses optional properties (`active?: boolean`), but `PackageWithDraft` requires them as required (`active: boolean`) or nullable (`segmentId: string | null`).

## Solution

### Fix 1: Value Import for Prisma

Changed from type-only import to value import:

```typescript
// Before
import type { PrismaClient } from '../../generated/prisma';
import type { Prisma } from '../../generated/prisma';

// After
import { Prisma, type PrismaClient } from '../../generated/prisma';
```

### Fix 2: Explicit JSON Type Casting

Added type assertions for conditional JSON assignments:

```typescript
// Before
photos: pkg.draftPhotos !== null ? pkg.draftPhotos : pkg.photos,
draftPhotos: null,

// After
photos: pkg.draftPhotos !== null
  ? (pkg.draftPhotos as Prisma.InputJsonValue)
  : (pkg.photos as Prisma.InputJsonValue),
draftPhotos: Prisma.JsonNull,
```

### Fix 3: Explicit Property Mapping in Mock Adapter

Changed from spread operator to explicit property assignments:

```typescript
// Before
return Array.from(packages.values()).map((pkg) => ({
  ...pkg,
  name: pkg.title,
  basePrice: pkg.priceCents,
  draftTitle: null,
  // ...
}));

// After
return Array.from(packages.values()).map((pkg) => ({
  id: pkg.id,
  tenantId: pkg.tenantId,
  slug: pkg.slug,
  name: pkg.title,
  description: pkg.description,
  basePrice: pkg.priceCents,
  active: pkg.active ?? true,
  segmentId: pkg.segmentId ?? null,
  grouping: pkg.grouping ?? null,
  groupingOrder: pkg.groupingOrder ?? null,
  photos: pkg.photos ?? [],
  draftTitle: null,
  draftDescription: null,
  draftPriceCents: null,
  draftPhotos: null,
  hasDraft: false,
  draftUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}));
```

## Prevention Checklist

### Before Committing Prisma-Related Changes

- [ ] **Import Check**: If using `Prisma.JsonNull` or `Prisma.InputJsonValue`, ensure Prisma is imported as a value (not type-only)
- [ ] **JSON Field Check**: All conditional JSON assignments have `as Prisma.InputJsonValue` casts
- [ ] **Null vs JsonNull**: Use `Prisma.JsonNull` (not `null`) when clearing JSON fields in transactions
- [ ] **Build Check**: Run `npm run build` (not just `typecheck`) before pushing

### Code Review Guidelines

1. **Prisma Imports**: Look for `import type { Prisma }` - should be `import { Prisma }`
2. **Object Spreads**: When spreading onto strict interfaces, verify all required properties are explicitly set
3. **Optional to Required**: Use nullish coalescing (`??`) to convert `undefined` to default values

### Quick Verification Commands

```bash
# Check for type-only Prisma imports that use runtime values
grep -n "import type.*Prisma" server/src/**/*.ts

# Check for JSON field assignments without type assertions
grep -n "photos:.*pkg\." server/src/adapters/prisma/*.ts

# Full build test (catches what typecheck misses)
cd server && npm run build
```

## Related Documentation

- [ESM/CJS Module Compatibility](../deployment-issues/esm-cjs-module-compatibility-file-type-node25.md)
- [Render Database Verification Fix](../deployment-issues/render-supabase-client-database-verification.md)
- [CI/CD Failure Prevention](../../deployment/CI_CD_FAILURE_PREVENTION.md)
- [Schema Drift Prevention](../SCHEMA_DRIFT_PREVENTION.md)

## Files Modified

| File                                               | Changes                                     |
| -------------------------------------------------- | ------------------------------------------- |
| `server/src/adapters/prisma/catalog.repository.ts` | Import fix, type assertions, JsonNull usage |
| `server/src/adapters/mock/index.ts`                | Explicit property mapping in 2 methods      |

## Commit

```
bfcc00c fix(build): resolve TypeScript errors for Render deployment
```
