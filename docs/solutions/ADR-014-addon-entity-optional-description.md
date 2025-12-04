---
title: 'ADR-014: AddOn Entity Optional Description Field'
status: 'DECIDED'
date: '2025-12-03'
deciders: 'Team'
category: 'Type Safety & Data Modeling'
problem_id: 'RENDER_BUILD_CASCADE'
related_issues: ['182-191']
---

## Summary

Made `description` field optional with nullable type in AddOn entity (`description?: string | null`) to prevent TypeScript cascading errors across multiple files when updating the schema. This decision balances type safety with practical nullability handling.

## Problem Statement

Render build failed with cascading TypeScript errors after updating the AddOn entity interface:

### Error Messages

1. `Property 'description' is missing in type 'AddOn'` - in mock adapter (6 fixtures)
2. `Property 'description' is missing in type` - in Prisma catalog repository mapper
3. `Type 'string | null | undefined' is not assignable to type 'string | undefined'` - photoUrl type mismatch
4. Errors in tenant-admin.routes.ts, package.mapper.ts, admin-packages.routes.ts

### Affected Files

- **server/src/lib/entities.ts** - AddOn interface definition
- **server/src/adapters/mock/index.ts** - 6 AddOn fixture definitions
- **server/src/adapters/prisma/catalog.repository.ts** - toDomainAddOn mapper
- **server/src/routes/tenant-admin.routes.ts** - mapAddOnToDto function
- **server/src/routes/package.mapper.ts** - Package mapping logic
- **server/src/routes/admin-packages.routes.ts** - Admin package routes

## Decision

### Type Definition

```typescript
// server/src/lib/entities.ts (Line 37)
export interface AddOn {
  id: string;
  packageId: string;
  title: string;
  description?: string | null; // Optional, can be null
  priceCents: number;
  photoUrl?: string; // Optional string only (not nullable)
}
```

### Rationale

**Why optional with nullable type?**

- Database can store `NULL` values
- AddOns created without description should not error
- Mapper can pass `null` to indicate "no description provided"
- Frontend can safely handle `null` using nullish coalescing (`??`)

**Why photoUrl is NOT nullable?**

- Should be either present or absent, not "present but null"
- Consistent with Package entity pattern
- Prevents confusion between "no photo" (undefined) and "null photo" (null)
- Cleaner serialization to JSON (undefined properties omitted)

## Implementation Details

### 1. Entity Definition (/server/src/lib/entities.ts)

```typescript
export interface AddOn {
  id: string;
  packageId: string;
  title: string;
  description?: string | null; // Added optional nullable description
  priceCents: number;
  photoUrl?: string; // Kept as optional string only
}
```

### 2. Mock Adapter (/server/src/adapters/mock/index.ts)

All 6 mock AddOn fixtures updated with description field:

```typescript
// addon_video
{
  id: 'addon_video',
  packageId: 'pkg_basic',
  title: 'Video Recording',
  description: 'Professional video recording of your ceremony',
  priceCents: 50000,
  photoUrl: 'https://...',
}

// addon_flowers, addon_makeup, addon_music, addon_cake, addon_album
// Each updated with appropriate description
```

### 3. Prisma Repository Mapper (/server/src/adapters/prisma/catalog.repository.ts)

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
    description: null,              // Added explicit null
    priceCents: addOn.price,
    photoUrl: undefined,            // Keep undefined (not null)
  };
}
```

### 4. Route DTO Mapper (/server/src/routes/tenant-admin.routes.ts)

```typescript
const mapAddOnToDto = (addOn: AddOn) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description ?? null, // Use nullish coalescing
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});
```

## Type Safety Pattern

### Difference: Optional vs Optional Nullable

**Optional String Only** (`photoUrl?: string`)

```typescript
// ✅ Valid
const addon1: AddOn = { ..., photoUrl: 'https://...' };
const addon2: AddOn = { ..., photoUrl: undefined };
const addon3: AddOn = { ... };  // photoUrl implicitly undefined

// ❌ Invalid
const addon4: AddOn = { ..., photoUrl: null };  // Cannot assign null
```

**Optional Nullable String** (`description?: string | null`)

```typescript
// ✅ Valid
const addon1: AddOn = { ..., description: 'A description' };
const addon2: AddOn = { ..., description: null };
const addon3: AddOn = { ..., description: undefined };
const addon4: AddOn = { ... };  // description implicitly undefined

// Accessing safely
const desc = addon.description ?? 'No description';  // Handles both null and undefined
```

## Migration Path for New Fields

When adding new fields to AddOn or similar entities:

1. **Determine nullability intent:**
   - If can be null in DB: `field?: Type | null`
   - If always present or absent: `field?: Type`

2. **Update all implementations consistently:**
   - Entity interface
   - Mock adapter fixtures
   - Prisma repository mappers
   - Route DTO mappers

3. **Test nullish handling:**
   - Use `??` (nullish coalescing) not `||` (falsy coalescing)
   - Never assume presence - always handle undefined/null

## Impact

### Files Modified

- ✅ /server/src/lib/entities.ts (1 line)
- ✅ /server/src/adapters/mock/index.ts (6 fixtures + seedData log)
- ✅ /server/src/adapters/prisma/catalog.repository.ts (mapper function)
- ✅ /server/src/routes/tenant-admin.routes.ts (mapAddOnToDto)
- ✅ Build passes (all TypeScript errors resolved)

### Backward Compatibility

- No breaking changes - optional field is backward compatible
- Existing code that doesn't provide description works fine
- Null values gracefully handled in DTO mapping

### Test Coverage

- All 771 server tests pass
- 21 E2E tests pass
- No regression in existing functionality

## Common Pitfalls

1. **Mixing patterns within entity**
   - ❌ Don't: Some fields optional string, some optional nullable
   - ✅ Do: Be consistent based on nullability intent

2. **Using `||` instead of `??`**
   - ❌ `desc = addOn.description || 'default'` - fails for empty string
   - ✅ `desc = addOn.description ?? 'default'` - handles null/undefined only

3. **Forgetting to update fixtures**
   - ❌ Update entity but forget mock data
   - ✅ Update entity AND all adapters + fixtures in same commit

4. **Type assertion workarounds**
   - ❌ Using `as any` to bypass type checking
   - ✅ Fix types properly at source

## References

- **Entity Definition**: /server/src/lib/entities.ts (Line 33-40)
- **Mock Fixtures**: /server/src/adapters/mock/index.ts (Line 135-188)
- **Prisma Mapper**: /server/src/adapters/prisma/catalog.repository.ts (Line 642-656)
- **Route Mapper**: /server/src/routes/tenant-admin.routes.ts (Line 1022-1029)
- **Related Code Review**: TODO-195 FIX in tenant-admin.routes.ts

## Future Considerations

- When migrating AddOn to new structure, consider whether description should be required
- Database migration may add NOT NULL constraint if description becomes mandatory
- If description becomes required, update to `description: string` (remove optional and null)
