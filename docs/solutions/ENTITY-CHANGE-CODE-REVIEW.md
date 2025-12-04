# Code Review Checklist: Entity Changes

**Use this checklist for ALL pull requests that modify entity interfaces in `server/src/lib/entities.ts`.**

---

## Pre-Review: PR Description Check

Before reviewing code, verify the PR description includes:

- [ ] Which entity was modified (Package, Booking, AddOn, Service, etc.)
- [ ] Which fields were added/removed/changed
- [ ] Why the change is needed (feature, bug fix, refactoring)
- [ ] List of files modified (expected 5-7 locations)

**If missing:** Ask author to update PR description with this info.

---

## Step 1: Entity Definition Review

**File:** `server/src/lib/entities.ts`

### Required fields check:

```typescript
export interface Package {
  id: string; // ✅ Required - no ? or | null
  title: string; // ✅ Required
  photoUrl?: string; // ✅ Optional - has ?
  segmentId?: string | null; // ✅ Optional - has ? and union
}
```

**Checklist:**

- [ ] New field has `?` if optional, nothing if required
- [ ] Union types include null if nullable: `Type | null`
- [ ] Field names are semantic (not abbreviated: `tenantId` not `tid`)
- [ ] Documentation comment above field if non-obvious
- [ ] Matches business logic (is this really required?)

**Red flags:**

- ❌ `id?: string` (ID should always be required)
- ❌ `createdAt: Date | string | null` (pick one, be consistent)
- ❌ `metadata: any` (too vague, use specific types)

---

## Step 2: API Contract Review

**Files:** `packages/contracts/src/*.ts`

### Check if entity is returned via API:

```bash
# Search for this entity in contracts
grep -r "Package" packages/contracts/src/

# Look for responses like:
export const getPackages = {
  responses: {
    200: z.array(PackageResponse),  // ← Check this
  }
}
```

**For each contract returning this entity:**

```typescript
// ✅ CORRECT - All fields in both Zod and interface
export const PackageResponse = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  newField: z.string().optional(), // New field here
});

export interface IPackageResponse extends z.infer<typeof PackageResponse> {}
```

**Checklist:**

- [ ] Zod schema updated with new field
- [ ] Validation matches field type (z.string(), z.number(), etc.)
- [ ] Optional fields use `.optional()` in Zod
- [ ] TypeScript interface kept in sync with Zod schema
- [ ] API documentation updated if applicable

**Red flags:**

- ❌ New field in entity but not in Zod schema
- ❌ Zod says required (`z.string()`) but entity says optional (`string?`)
- ❌ Type mismatch: Zod `z.number()` but entity `string`

---

## Step 3: Port Interfaces & Input DTOs

**File:** `server/src/lib/ports.ts`

### Check input/output types:

```typescript
// ❌ WRONG - New field missing from input DTO
export interface CreatePackageInput {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  // Missing: newField?
}

// ✅ CORRECT - Field included in input DTO
export interface CreatePackageInput {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  newField?: string; // Added here
}
```

**Checklist:**

- [ ] `CreatePackageInput` includes new field if settable on creation
- [ ] `UpdatePackageInput` includes new field if settable on update
- [ ] Repository interface return types match entity definition
- [ ] Input types are complete (can create entity without separate fields)

**Red flags:**

- ❌ Input DTO missing new field but it's set somewhere
- ❌ Required field in entity but optional in input (or vice versa)
- ❌ Field type doesn't match between entity and DTO

---

## Step 4: Mock Adapter Review

**File:** `server/src/adapters/mock/index.ts`

### Check seed data:

```typescript
// ❌ WRONG - Missing newField in seed data
packages.set('pkg_basic', {
  id: 'pkg_basic',
  tenantId: DEFAULT_TENANT,
  slug: 'basic-elopement',
  title: 'Basic Elopement',
  // Missing: newField
  priceCents: 99900,
});

// ✅ CORRECT - All required fields included
packages.set('pkg_basic', {
  id: 'pkg_basic',
  tenantId: DEFAULT_TENANT,
  slug: 'basic-elopement',
  title: 'Basic Elopement',
  newField: 'value', // Added
  priceCents: 99900,
});
```

### Check repository methods:

```typescript
// ❌ WRONG - Mapper returns incomplete type
async createPackage(tenantId: string, data: any): Promise<Package> {
  const pkg: any = {  // Using 'any' bypasses type checking
    id: `pkg_${Date.now()}`,
    ...data,
  };
  packages.set(pkg.id, pkg);
  return pkg;  // May not have all required fields
}

// ✅ CORRECT - Strict typing ensures completeness
async createPackage(tenantId: string, data: CreatePackageInput): Promise<Package> {
  const pkg: Package = {
    id: `pkg_${Date.now()}`,
    tenantId,
    slug: data.slug,
    title: data.title,
    description: data.description,
    priceCents: data.priceCents,
    newField: data.newField ?? 'default',  // Set here
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  };
  packages.set(pkg.id, pkg);
  return pkg;
}
```

**Checklist:**

- [ ] All seed data objects include new field
- [ ] Type annotations don't use `any` (should be strict `Package`)
- [ ] Optional fields use guards: `data.field ?? defaultValue`
- [ ] New field set to sensible test value (not undefined)
- [ ] Mock behavior matches Prisma adapter (consistency)

**Red flags:**

- ❌ Seed data uses `any` type
- ❌ Return type is `any` instead of `Package`
- ❌ New optional field not guarded (could be undefined)
- ❌ Mock seed doesn't match Prisma seed

---

## Step 5: Prisma Repository Review

**Files:** `server/src/adapters/prisma/*.repository.ts`

### Check mapper input type:

```typescript
// ❌ WRONG - Missing newField in input type
private toDomainPackage(pkg: {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  basePrice: number;
  // Missing: newField
}): Package {
  return {
    id: pkg.id,
    tenantId: pkg.tenantId,
    title: pkg.name,
    priceCents: pkg.basePrice,
    newField: pkg.newField,  // ← ERROR: newField not in input
  };
}

// ✅ CORRECT - Input type includes all DB fields
private toDomainPackage(pkg: {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  basePrice: number;
  newField: string;  // Added
}): Package {
  return {
    id: pkg.id,
    tenantId: pkg.tenantId,
    title: pkg.name,
    priceCents: pkg.basePrice,
    newField: pkg.newField,  // Safe to use
  };
}
```

### Check mapper return:

```typescript
// ❌ WRONG - Forgot to map field
return {
  id: pkg.id,
  tenantId: pkg.tenantId,
  title: pkg.name,
  priceCents: pkg.basePrice,
  // Missing: newField
};

// ✅ CORRECT - All fields mapped
return {
  id: pkg.id,
  tenantId: pkg.tenantId,
  title: pkg.name,
  priceCents: pkg.basePrice,
  newField: pkg.newField, // Mapped
};
```

### Check create/update methods:

```typescript
// ❌ WRONG - Field not set in data
const pkg = await tx.package.create({
  data: {
    tenantId,
    slug: data.slug,
    name: data.title,
    description: data.description,
    basePrice: data.priceCents,
    // Missing: newField
  },
});

// ✅ CORRECT - Field included in create
const pkg = await tx.package.create({
  data: {
    tenantId,
    slug: data.slug,
    name: data.title,
    description: data.description,
    basePrice: data.priceCents,
    newField: data.newField ?? null, // Set here
  },
});
```

### Optional field guards:

```typescript
// ❌ WRONG - Optional field not guarded in return
return {
  id: pkg.id,
  title: pkg.name,
  newField: pkg.newField, // Could be null/undefined
};

// ✅ CORRECT - Optional field guarded
return {
  id: pkg.id,
  title: pkg.name,
  ...(pkg.newField && { newField: pkg.newField }), // Only set if exists
};

// OR for nullable fields
return {
  id: pkg.id,
  title: pkg.name,
  newField: pkg.newField ?? null, // Explicitly null if not set
};
```

**Checklist:**

- [ ] Mapper input type includes ALL Prisma model fields
- [ ] Return mapping includes new field
- [ ] Field type conversion correct (e.g., Prisma string → domain Date)
- [ ] Null/undefined handling appropriate
- [ ] Optional fields only set if they exist (guards)
- [ ] Create/update methods include field in data object

**Red flags:**

- ❌ Input type missing field but mapper tries to use it
- ❌ Mapper return missing field entirely
- ❌ Optional field set to undefined instead of guarded
- ❌ Type mismatch: Date from Prisma but string expected in domain

---

## Step 6: Routes Review

**Files:** `server/src/routes/*.routes.ts`

### Check DTO mapping:

```typescript
// ❌ WRONG - Response DTO missing new field
res.status(200).json({
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.title,
  // Missing: newField
});

// ✅ CORRECT - All fields mapped to response
res.status(200).json({
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.title,
  newField: pkg.newField, // Included
});
```

**Checklist:**

- [ ] DTO in response includes new field
- [ ] DTO structure matches contract (from Step 2)
- [ ] Validation done via Zod before using field
- [ ] No type assertions (`as Package`) bypassing validation

**Red flags:**

- ❌ Response DTO missing field but contract expects it
- ❌ Using `as any` or `as Package` to bypass type checking

---

## Step 7: Services Review

**Files:** `server/src/services/*.service.ts`

### Check factory methods:

```typescript
// ❌ WRONG - Factory creates incomplete entity
async createPackage(tenantId: string, input: CreatePackageInput): Promise<Package> {
  const pkg: Package = {
    id: generateId(),
    tenantId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    // Missing: newField
    photos: [],
    active: true,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  return pkg;
}

// ✅ CORRECT - Factory includes all fields
async createPackage(tenantId: string, input: CreatePackageInput): Promise<Package> {
  const pkg: Package = {
    id: generateId(),
    tenantId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    newField: input.newField ?? 'default',  // Added
    photos: [],
    active: true,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  return pkg;
}
```

**Checklist:**

- [ ] Factory methods create complete entities (no missing fields)
- [ ] Default values set for optional fields
- [ ] No `any` types in factories
- [ ] Return type strictly typed (not `Partial<Package>`)

**Red flags:**

- ❌ Factory returns incomplete entity
- ❌ Using `as any` in factory
- ❌ Optional field not initialized to default

---

## Step 8: Tests Review

**Files:** `*.test.ts` or `*.spec.ts`

### Check entity invariant tests:

```typescript
// ✅ Tests verify all creation paths include new field
describe('Entity Invariants', () => {
  it('Package should have all required fields after creation', async () => {
    const packages = [
      await mockRepo.getPackageById('tenant', 'pkg_1'),
      await prismaRepo.getPackageById('tenant', 'pkg_2'),
      await service.createPackage('tenant', { ... }),
    ];

    packages.forEach(pkg => {
      expect(pkg?.id).toBeDefined();
      expect(pkg?.tenantId).toBeDefined();
      expect(pkg?.newField).toBeDefined();  // ← Test new field
    });
  });
});
```

**Checklist:**

- [ ] New field tested in entity invariant tests
- [ ] All 3+ creation paths tested together
- [ ] Optional field test confirms default value
- [ ] Mock and Prisma behavior compared
- [ ] Integration tests verify end-to-end

**Red flags:**

- ❌ No tests for new field
- ❌ Only unit tests, no integration tests
- ❌ Tests only check one creation path

---

## Step 9: Final Verification Checklist

**Before approving the PR:**

**Author must confirm:**

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes all tests
- [ ] `npm run build` succeeds
- [ ] Entity invariant tests pass: `npm test -- --grep "Entity Invariants"`

**Reviewer must verify:**

- [ ] All 5-7 locations updated (checklist from Step 1)
- [ ] No `any` types bypass type safety
- [ ] Optional vs required fields consistent
- [ ] Type conversions correct (e.g., Prisma → Domain)
- [ ] Tests cover new field behavior
- [ ] PR description lists all modified files

---

## Approval Decision Tree

```
Is entity interface changed?
├─ NO → Use standard code review checklist
└─ YES → Use this checklist

Are all 5-7 locations updated?
├─ NO → Request changes: "Missing updates in [files]"
└─ YES → Continue below

Are there type errors or unsafe patterns?
├─ YES → Request changes: "TypeScript issues or unsafe patterns"
└─ NO → Continue below

Do tests pass and cover new field?
├─ NO → Request changes: "Tests missing or failing"
└─ YES → Continue below

APPROVED ✅
```

---

## Common PR Comments

### Comment: Missing mapper field

````
The new `newField` was added to the entity but the
`toDomainPackage()` mapper doesn't include it in the return statement.

Please add:
```typescript
newField: pkg.newField,
````

to the return object on line 612.

```

### Comment: Input type incomplete

```

The `CreatePackageInput` DTO in ports.ts is missing the new `newField`.
Since it's a required field in the entity, it should be settable on creation.

Please add `newField: string;` to CreatePackageInput interface.

```

### Comment: Seed data missing field

```

Mock seed data in `/mock/index.ts` is missing the new `newField`.

Please update all `packages.set()` calls to include:

```typescript
newField: 'value',
```

```

### Comment: Type safety

```

Found unsafe type usage:

- Line 45: `...data as any` bypasses type checking
- Line 89: Return type should be `Package` not `any`

This prevents TypeScript from catching missing fields.
Please use strict types instead.

```

---

## Quick Reference: All 5-7 Locations

Copy this list and verify each location is updated:

```

[ ] 1. server/src/lib/entities.ts - Entity interface
[ ] 2. packages/contracts/src/_.ts - API contracts (if applicable)
[ ] 3. server/src/lib/ports.ts - Input/output DTOs
[ ] 4. server/src/adapters/mock/index.ts - Mock implementation
[ ] 5. server/src/adapters/prisma/_.repository.ts - Prisma mapper
[ ] 6. server/src/routes/_.routes.ts - DTO response mapping
[ ] 7. server/src/services/_.service.ts - Factory methods

```

---

## Related Documents

- **[PREVENTION-ENTITY-TYPE-ERRORS.md](PREVENTION-ENTITY-TYPE-ERRORS.md)** - Full strategies
- **[ENTITY-ERRORS-QUICK-REF.md](ENTITY-ERRORS-QUICK-REF.md)** - 30-second decision tree
- **[CLAUDE.md](../../../CLAUDE.md)** - Repository pattern rules
- **[server/src/lib/entities.ts](../../../server/src/lib/entities.ts)** - Entity definitions

```
