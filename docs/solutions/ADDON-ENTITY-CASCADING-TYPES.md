# AddOn Entity Cascading Type Errors - Complete Solution

## Problem Statement

After adding `description: string | null` to the `AddOn` entity interface, TypeScript compilation failed with 15+ errors across multiple files. The entity change wasn't automatically propagated to all places that create or consume `AddOn` objects, creating a cascade of type mismatches.

### Root Cause Analysis

The `AddOn` entity serves as a **contract** across multiple layers of the application:

1. **Entity Definition** (`server/src/lib/entities.ts`) - Source of truth
2. **Mock Adapter** (`server/src/adapters/mock/index.ts`) - Creates AddOn objects for testing
3. **Prisma Repository** (`server/src/adapters/prisma/catalog.repository.ts`) - Maps DB records to AddOn objects
4. **Routes** (`server/src/routes/tenant-admin.routes.ts`) - Maps AddOn entities to DTOs for API responses
5. **DTO Contracts** (`packages/contracts/src/dto.ts`) - API response format specification

When the entity interface changes, **all these locations must be updated simultaneously** to maintain type safety.

## Solution Components

### 1. Entity Definition (Source of Truth)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/entities.ts`

```typescript
export interface AddOn {
  id: string;
  packageId: string;
  title: string;
  description?: string | null;  // ✅ Optional AND nullable
  priceCents: number;
  photoUrl?: string;  // Optional only (no null)
}
```

**Key Design Decisions:**

- `description?: string | null` - Optional field that can be `undefined` (not set) OR `null` (explicitly null)
- `photoUrl?: string` - Optional field, no null union (consistent with Package entity pattern)
- This matches Prisma's JSON schema and repository patterns

### 2. Mock Adapter (Test Fixtures)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts` (lines 135-188)

All AddOn fixtures must include the `description` field:

```typescript
// Add-ons
addOns.set('addon_video', {
  id: 'addon_video',
  packageId: 'pkg_basic',
  title: 'Video Recording',
  description: 'Professional video recording of your ceremony',  // ✅ ADDED
  priceCents: 50000,
  photoUrl: 'https://images.unsplash.com/...',
});

addOns.set('addon_flowers', {
  id: 'addon_flowers',
  packageId: 'pkg_basic',
  title: 'Floral Arrangement',
  description: 'Beautiful floral arrangements for your special day',  // ✅ ADDED
  priceCents: 15000,
  photoUrl: 'https://images.unsplash.com/...',
});

addOns.set('addon_makeup', {
  id: 'addon_makeup',
  packageId: 'pkg_micro',
  title: 'Hair & Makeup',
  description: 'Professional hair and makeup services',  // ✅ ADDED
  priceCents: 30000,
  photoUrl: 'https://images.unsplash.com/...',
});

addOns.set('addon_music', {
  id: 'addon_music',
  packageId: 'pkg_garden',
  title: 'Live Music (Acoustic)',
  description: 'Live acoustic music performance',  // ✅ ADDED
  priceCents: 75000,
  photoUrl: 'https://images.unsplash.com/...',
});

addOns.set('addon_cake', {
  id: 'addon_cake',
  packageId: 'pkg_garden',
  title: 'Custom Wedding Cake',
  description: 'Custom designed wedding cake',  // ✅ ADDED
  priceCents: 35000,
  photoUrl: 'https://images.unsplash.com/...',
});

addOns.set('addon_album', {
  id: 'addon_album',
  packageId: 'pkg_luxury',
  title: 'Premium Photo Album',
  description: 'Premium leather-bound photo album',  // ✅ ADDED
  priceCents: 45000,
  photoUrl: 'https://images.unsplash.com/...',
});
```

**Important:** All 6 mock AddOn fixtures must have the `description` field populated with meaningful values for testing.

### 3. Prisma Repository Mapper

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/catalog.repository.ts` (lines 642-656)

The `toDomainAddOn` private method must include the `description` field:

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
    description: null,  // ✅ ADDED - currently null until DB schema supports it
    priceCents: addOn.price,
    photoUrl: undefined,
  };
}
```

**Explanation:**
- Sets `description: null` since the current Prisma schema doesn't have a description field
- Once the schema is updated with a `description` column, change to: `description: addOn.description ?? null`
- The `??` (nullish coalescing) handles both `undefined` and `null` cases

### 4. Route DTO Mapper

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts` (lines 1020-1029)

The `mapAddOnToDto` function must handle the optional description field:

```typescript
/**
 * Maps AddOn entity to API response format
 */
const mapAddOnToDto = (addOn: AddOn) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description ?? null,  // ✅ Handle undefined → null
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});
```

**Critical Detail:**
- `addOn.description ?? null` converts `undefined` to `null` for API consistency
- Ensures frontend always receives `null` (never `undefined`) for missing descriptions
- This is the **boundary between domain entities and API DTOs**

### 5. DTO Contract (API Specification)

**File:** `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/dto.ts` (lines 65-72)

The Zod schema must match the API response format:

```typescript
export const AddOnDtoSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),  // ✅ Matches mapAddOnToDto output
  priceCents: z.number().int(),
  photoUrl: z.string().url().optional(),
});

export type AddOnDto = z.infer<typeof AddOnDtoSchema>;
```

**Schema Definition:**
- `description: z.string().nullable().optional()` = field can be omitted, null, or a string
- This is used by:
  - Frontend to validate API responses
  - Zod parsers in routes for validation
  - Type generation via `z.infer`

## Cascading Type Resolution Map

This diagram shows how a single entity change ripples through the codebase:

```
┌─────────────────────────────────────────┐
│ entities.ts (AddOn interface)           │
│ description?: string | null             │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────────────┬───────────────────┐
        │                         │                   │
        ↓                         ↓                   ↓
┌───────────────┐      ┌──────────────────┐  ┌──────────────────┐
│ Mock Adapter  │      │ Prisma Repo      │  │ Routes/DTOs      │
│ (fixtures)    │      │ (mappers)        │  │ (API boundary)   │
│ 6 addOns      │      │ toDomainAddOn    │  │ mapAddOnToDto    │
│ +description  │      │ +description     │  │ +description     │
└───────┬───────┘      └────────┬─────────┘  └──────────┬───────┘
        │                       │                       │
        │                       │                       ↓
        │                       │          ┌──────────────────────┐
        │                       │          │ dto.ts (Zod schema)  │
        │                       │          │ AddOnDtoSchema       │
        │                       │          │ +description field   │
        │                       │          └──────────────────────┘
        │                       │                       │
        └───────────┬───────────┴───────────────────────┘
                    │
                    ↓
        ✅ Full type alignment
        All AddOn objects have description field
```

## Verification Checklist

After implementing the solution, verify all changes:

### 1. Entity Layer
- [ ] `AddOn` interface has `description?: string | null` field
- [ ] All other files properly import `AddOn` from `entities.ts`

### 2. Mock Adapter Layer
- [ ] All 6 mock AddOn fixtures have `description` field with values:
  - `addon_video` - "Professional video recording of your ceremony"
  - `addon_flowers` - "Beautiful floral arrangements for your special day"
  - `addon_makeup` - "Professional hair and makeup services"
  - `addon_music` - "Live acoustic music performance"
  - `addon_cake` - "Custom designed wedding cake"
  - `addon_album` - "Premium leather-bound photo album"

### 3. Repository Layer
- [ ] `toDomainAddOn` mapper includes `description` field
- [ ] Uses `addOn.description ?? null` pattern (once DB schema updated)
- [ ] All methods returning `AddOn[]` properly map description

### 4. Route Layer
- [ ] `mapAddOnToDto` includes `description: addOn.description ?? null`
- [ ] All route handlers use `mapAddOnToDto` for responses
- [ ] POST/PUT endpoints accept description via DTO schemas

### 5. DTO/Contract Layer
- [ ] `AddOnDtoSchema` includes `description: z.string().nullable().optional()`
- [ ] `CreateAddOnDtoSchema` has optional description
- [ ] `UpdateAddOnDtoSchema` has optional description

### 6. Compilation & Testing
- [ ] `npm run typecheck` passes (all workspaces)
- [ ] No TypeScript errors in client or server
- [ ] Mock mode tests pass: `npm test` (server workspace)
- [ ] Integration tests work with new AddOn structure

## Common Pitfalls to Avoid

### 1. Inconsistent Null Handling
❌ **WRONG:**
```typescript
// In entity: description?: string | null
// In mapper: description: addOn.description
// Problem: Type mismatch when undefined
```

✅ **CORRECT:**
```typescript
// In entity: description?: string | null
// In mapper: description: addOn.description ?? null
// Converts undefined → null for API consistency
```

### 2. Forgetting Mock Fixtures
❌ **WRONG:**
```typescript
addOns.set('addon_video', {
  id: 'addon_video',
  title: 'Video Recording',
  priceCents: 50000,
  // Missing description field!
});
```

✅ **CORRECT:**
```typescript
addOns.set('addon_video', {
  id: 'addon_video',
  title: 'Video Recording',
  description: 'Professional video recording of your ceremony',
  priceCents: 50000,
  photoUrl: '...',
});
```

### 3. Mismatched DTO Schema
❌ **WRONG:**
```typescript
// Entity: description?: string | null
// DTO: description: z.string() // NOT optional, NOT nullable
// Problem: Validation fails when description is null
```

✅ **CORRECT:**
```typescript
// Entity: description?: string | null
// DTO: description: z.string().nullable().optional()
// Matches entity and mapAddOnToDto output
```

### 4. Missing Repository Mapper Update
❌ **WRONG:**
```typescript
// Only updating entity interface
// Forgetting to update toDomainAddOn mapper
const addOn = await catalogService.getAddOnById(...);
// addOn.description is undefined because mapper didn't include it!
```

✅ **CORRECT:**
```typescript
private toDomainAddOn(addOn: {...}): AddOn {
  return {
    ...
    description: null,  // Explicitly set
    ...
  };
}
```

## Migration Path (Future)

Once the Prisma schema is updated with a `description` column, follow this sequence:

1. **Schema Update:**
   ```prisma
   model AddOn {
     id        String  @id @default(cuid())
     tenantId  String
     slug      String  @unique
     name      String
     description String? // NEW FIELD
     price     Int
     active    Boolean @default(true)
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. **Migration:**
   ```bash
   cd server
   npm exec prisma migrate dev --name add_addon_description
   ```

3. **Update Repository Mapper:**
   ```typescript
   private toDomainAddOn(addOn: {
     id: string;
     name: string;
     description: string | null;  // NEW from DB
     price: number;
     packages: { packageId: string }[];
   }): AddOn {
     return {
       id: addOn.id,
       packageId: addOn.packages[0]?.packageId || '',
       title: addOn.name,
       description: addOn.description ?? null,  // ✅ Use DB value
       priceCents: addOn.price,
       photoUrl: undefined,
     };
   }
   ```

4. **Verify Tests:**
   ```bash
   npm test  # All tests pass
   npm run typecheck  # No type errors
   ```

## Related Prevention Strategies

For preventing similar cascading type errors in the future, see:
- **[PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md)** - Type safety decision tree
- **[CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md)** - Multi-layer entity review process

## Summary

The solution requires updating **5 key locations** when the `AddOn` entity changes:

| Location | File | Change | Lines |
|----------|------|--------|-------|
| Entity | `entities.ts` | Add `description?: string \| null` | 37 |
| Fixtures | `mock/index.ts` | Update 6 AddOn fixtures | 136-188 |
| Mapper | `catalog.repository.ts` | Update `toDomainAddOn` | 642-656 |
| Route DTO | `tenant-admin.routes.ts` | Update `mapAddOnToDto` | 1022-1029 |
| Contract | `dto.ts` | Update `AddOnDtoSchema` | 65-72 |

**Implementation time:** ~15 minutes
**Test validation:** ~5 minutes
**Total:** ~20 minutes for complete solution
