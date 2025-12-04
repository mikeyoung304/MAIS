# Entity Type Errors: 30-Second Decision Tree

**When you modify an entity interface, you MUST update 5-7 locations.** This page helps you find them quickly.

---

## Modification Checklist (Copy & Paste)

```markdown
## Entity Modified: \***\*\_\_\_\*\***

Step 1: Entity Definition

- [ ] Updated `server/src/lib/entities.ts`
  - [ ] Required fields without `?`
  - [ ] Optional fields with `?` or `| null`

Step 2: API Contracts

- [ ] Updated `packages/contracts/src/*.ts` (if API returns this entity)
  - [ ] DTO Zod schema updated
  - [ ] API response type matches

Step 3: Input/Port Types

- [ ] Updated `server/src/lib/ports.ts`
  - [ ] Repository input types (Create/Update DTOs)
  - [ ] If new field, add to input DTO

Step 4: Mock Adapter

- [ ] Updated `server/src/adapters/mock/index.ts`
  - [ ] All seed data objects
  - [ ] Builder/factory methods
  - [ ] Create/update method returns

Step 5: Prisma Adapter

- [ ] Updated `server/src/adapters/prisma/*.repository.ts`
  - [ ] Input type includes DB field
  - [ ] Mapper function (toDomain\*) maps field
  - [ ] Optional fields use guards

Step 6: Routes

- [ ] Updated `server/src/routes/*.routes.ts`
  - [ ] DTO → Entity mapping if applicable
  - [ ] Response mapping if needed

Step 7: Services

- [ ] Updated `server/src/services/*.service.ts`
  - [ ] Any factory methods creating entity
  - [ ] Comments in docstrings

Step 8: Tests

- [ ] Added test for new field behavior
- [ ] Entity invariant tests pass: `npm test -- --grep "Entity Invariants"`

Final: Verification

- [ ] `npm run typecheck` - passes
- [ ] `npm test` - all pass
- [ ] `npm run build` - succeeds
```

---

## Finding the 5-7 Update Locations

### For Package entity changes:

```
1. server/src/lib/entities.ts
   └─ Package interface (required fields without ?)

2. packages/contracts/src/*.ts
   └─ Any contract returning Package (CatalogService, etc.)

3. server/src/lib/ports.ts
   └─ CatalogRepository interface
   └─ CreatePackageInput / UpdatePackageInput DTOs

4. server/src/adapters/mock/index.ts
   └─ Seed data: packages.set('pkg_basic', { ... })
   └─ createPackage() method
   └─ Any builder methods

5. server/src/adapters/prisma/catalog.repository.ts
   └─ toDomainPackage() mapper input type
   └─ toDomainPackage() mapper return mapping
   └─ createPackage() data object

6. server/src/routes/packages.routes.ts (or admin-packages.routes.ts)
   └─ DTO to Package mapping (if applicable)

7. server/src/services/catalog.service.ts
   └─ Any factory methods creating Package
```

### For Booking entity changes:

```
1. server/src/lib/entities.ts
   └─ Booking interface

2. packages/contracts/src/booking.ts (if public API)
   └─ BookingResponse Zod schema

3. server/src/lib/ports.ts
   └─ BookingRepository interface
   └─ BookingUpdateInput DTO

4. server/src/adapters/mock/index.ts
   └─ Seed bookings creation
   └─ MockBookingRepository methods

5. server/src/adapters/prisma/booking.repository.ts
   └─ toDomainBooking() mapper (lines 956-1072)
   └─ create() data mapping
   └─ update() data mapping

6. server/src/routes/bookings.routes.ts
   └─ Response mapping

7. server/src/services/booking.service.ts
   └─ Factory methods for creating/updating
```

---

## Common Mistakes & How to Catch Them

### Mistake 1: Forget to update mapper input type

```typescript
// WRONG - Missing 'newField' in input type
private toDomainPackage(pkg: {
  id: string;
  name: string;
  // Missing: newField: string;
}): Package {
  return {
    id: pkg.id,
    title: pkg.name,
    newField: pkg.newField,  // Runtime error: undefined
  };
}

// RIGHT - Input type includes all DB fields
private toDomainPackage(pkg: {
  id: string;
  name: string;
  newField: string;  // Included
}): Package {
  return {
    id: pkg.id,
    title: pkg.name,
    newField: pkg.newField,  // Safe to use
  };
}
```

**How to catch:** `npm run typecheck` will error on mapper call in repo methods

### Mistake 2: Forget to add to seed data

```typescript
// WRONG - Missing newField in seed
packages.set('pkg_basic', {
  id: 'pkg_basic',
  tenantId: DEFAULT_TENANT,
  slug: 'basic-elopement',
  title: 'Basic Elopement',
  // Missing: newField: string;
});

// RIGHT - Include all required fields
packages.set('pkg_basic', {
  id: 'pkg_basic',
  tenantId: DEFAULT_TENANT,
  slug: 'basic-elopement',
  title: 'Basic Elopement',
  newField: 'value', // Included
});
```

**How to catch:** TypeScript error when assigning to map, or `npm test` shows undefined field

### Mistake 3: Optional field not guarded in mock

```typescript
// WRONG - Optional field always set
async update(tenantId: string, id: string, data: {
  title?: string;
}): Promise<Package> {
  const updated: Package = {
    ...existing,
    title: data.title,  // May be undefined!
  };
  return updated;
}

// RIGHT - Use guard for optional
async update(tenantId: string, id: string, data: {
  title?: string;
}): Promise<Package> {
  const updated: Package = {
    ...existing,
    ...(data.title !== undefined && { title: data.title }),
  };
  return updated;
}
```

**How to catch:** Type error if required field could be undefined

### Mistake 4: Prisma field name ≠ domain field name

```typescript
// WRONG - Forgot name conversion (Prisma 'name' → Domain 'title')
private toDomainPackage(pkg: {
  id: string;
  name: string;  // DB field
}): Package {
  return {
    id: pkg.id,
    name: pkg.name,  // ERROR: Domain expects 'title', not 'name'
  };
}

// RIGHT - Map field names explicitly
private toDomainPackage(pkg: {
  id: string;
  name: string;  // DB field
}): Package {
  return {
    id: pkg.id,
    title: pkg.name,  // Correct: map to 'title'
  };
}
```

**How to catch:** TypeScript error: "Property 'name' does not exist on type 'Package'"

---

## Quick Test: Is Your Entity Change Complete?

After modifying an entity, run this:

```bash
# 1. Check compilation
npm run typecheck
# Expected: No errors related to your entity

# 2. Run tests
npm test
# Expected: All tests pass, especially entity invariant tests

# 3. Check specific entity tests
npm test -- --grep "Entity Invariants"
# Expected: Test passes with all creation paths working

# 4. Check build
npm run build
# Expected: Build succeeds
```

---

## Mental Model: The 5 Creation Paths

When you add a field, it must flow through these paths:

```
              entities.ts (interface definition)
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
    contracts/  ports.ts   services/
    (API DTO)   (I/O types) (factories)
        ↓           ↓           ↓
        ├─────────────┬─────────────┤
        ↓             ↓             ↓
    routes/       adapters/   (services use repos)
  (validation)   (persistence)
        ↓             ↓
    ┌───────────────────┐
    │ Complete Entity   │
    │ (all fields set)  │
    └───────────────────┘
```

**Each path must include the new field.** If any path is incomplete → type error or runtime bug.

---

## Entity Mapping Patterns by Type

### Pattern A: Database-Backed Entity (Booking)

```
Prisma Model    →   Prisma Record   →   toDomainBooking()   →   Booking Entity
(schema.prisma)     (from DB)           (mapper)              (domain logic)

Input type must list ALL Prisma fields
Mapper must map each field (name conversions, etc.)
Return type must be strict Booking (not Partial)
```

### Pattern B: Mock-Only Entity (Calendar events)

```
In-Memory Object   →   Factory Method   →   Entity
(Map/Array)         (MockCalendarProvider) (CalendarEvent)

Must match exact shape of domain entity
All required fields set in factory
Optional fields guarded with if checks
```

### Pattern C: Input DTO → Entity (CreateBookingInput)

```
API Request   →   Zod Validation   →   Service Method   →   Entity
(JSON)        (Contract)           (Business Logic)     (Booking)

Zod schema defines required/optional fields
Service factory fills in defaults/generated fields (id, createdAt)
Return type strict Entity
```

---

## Debugging: "Property X does not exist on type Y"

This error means a mapper forgot to include a field.

### Find the mapper:

```bash
# Error says: Property 'title' does not exist on type 'Package'
# Hint: Look for toDomainPackage() in catalog.repository.ts

grep -r "toDomainPackage" server/src/
# Should find: catalog.repository.ts line 586

# Open it, check if 'title' is being set:
# Should have: title: pkg.name (or similar mapping)
```

### Fix:

```typescript
// Add the missing field mapping
return {
  id: pkg.id,
  tenantId: pkg.tenantId,
  title: pkg.name, // ADD THIS
  // ... rest of fields
};
```

---

## Debugging: "Type 'any' is not assignable to type Package"

This error means a creation path is using wrong type.

### Find it:

```bash
# Error message shows file/line number
# Check that location for: as any, any, or incomplete object literal
```

### Fix:

```typescript
// WRONG
const pkg: any = { id: 'x' }; // Type 'any' → Package fails
packages.push(pkg);

// RIGHT
const pkg: Package = {
  id: 'x',
  // ... all required fields
}; // Type Package → Package works
packages.push(pkg);
```

---

## Prevention Checklist for Code Review

When reviewing a PR that modifies an entity:

```
[ ] Entity definition updated (entities.ts)
[ ] All 5-7 creation paths updated (checklist above)
[ ] TypeScript strict: no `any` in returns
[ ] Tests added for new field
[ ] Mapper includes field in input type AND output mapping
[ ] Optional fields have guards
[ ] PR author can point to ALL locations modified
```

If any checkbox fails → Request changes.

---

## One-Minute Fix Strategy

If you're blocked by entity type errors:

1. **Identify the error** - Read TypeScript error message
2. **Find the location** - Error shows file:line
3. **Identify the mapper** - Usually toDomain\* method
4. **Map the field** - Add to input type AND return object
5. **Test** - `npm run typecheck` to verify fix
6. **Confirm** - `npm test` to catch runtime errors

**Total time:** 1-2 minutes per location

---

## Links to Full Documentation

- **[PREVENTION-ENTITY-TYPE-ERRORS.md](PREVENTION-ENTITY-TYPE-ERRORS.md)** - Full strategy guide (all 10 strategies)
- **[CLAUDE.md](../../../CLAUDE.md)** - Repository pattern rules
- **[server/src/lib/entities.ts](../../../server/src/lib/entities.ts)** - Entity definitions
- **[server/src/lib/ports.ts](../../../server/src/lib/ports.ts)** - Input DTO definitions
