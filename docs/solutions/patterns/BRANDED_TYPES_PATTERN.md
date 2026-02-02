# Branded Types Pattern for Type-Safe Identifiers

> **Status**: Available (2026-02-01)
> **Location**: `packages/shared/src/branded-types.ts`

## Problem

Without branded types, all identifiers are `string`, and TypeScript cannot catch when you accidentally pass a slug where an ID is expected:

```typescript
// BUG: This compiles but fails at runtime
const slug = 'wedding-gold';
findPackageById(slug); // ❌ Runtime: "Package not found"

// The real fix was to use:
findPackageById(packageId); // ✅ But TS can't enforce this
```

This exact bug occurred in our webhook tests (commit eb73d6e5) where `testPackageSlug` was passed to a function expecting `testPackageId`.

## Solution: Branded Types

Branded types add a "phantom" property that makes `PackageId` and `PackageSlug` incompatible at compile time, even though both are strings at runtime:

```typescript
import { PackageId, PackageSlug, asPackageId, asPackageSlug } from '@macon/shared';

// Branding at system boundaries
const id: PackageId = asPackageId(req.params.id);
const slug: PackageSlug = asPackageSlug(req.params.slug);

// Now TypeScript catches the bug at compile time
findPackageById(slug); // ❌ TS2345: Argument of type 'PackageSlug' is not assignable

// Correct usage
findPackageById(id); // ✅ Compiles and works
```

## Available Types

| Type            | Format | Example            | Use Case               |
| --------------- | ------ | ------------------ | ---------------------- |
| `PackageId`     | CUID   | `clz9x7k8m0001...` | Database lookups by ID |
| `PackageSlug`   | slug   | `wedding-gold`     | URLs, external APIs    |
| `TenantId`      | CUID   | `clz9a1b2c0001...` | Multi-tenant isolation |
| `TenantSlug`    | slug   | `handled-e2e`      | Storefront URLs        |
| `BookingId`     | CUID   | `clz9b1c2d0001...` | Booking references     |
| `CustomerId`    | CUID   | `clz9c1d2e0001...` | Customer lookups       |
| `CustomerEmail` | email  | `jane@example.com` | Email-based lookups    |
| `ServiceId`     | CUID   | `clz9d1e2f0001...` | Appointment services   |
| `ServiceSlug`   | slug   | `headshot-30min`   | Service URLs           |

## Assertion Functions

Use assertion functions at **system boundaries** (API inputs, database results):

```typescript
import { asPackageId, asPackageSlug, asTenantId } from '@macon/shared';

// API route handler - brand the input
router.get('/packages/:id', (req, res) => {
  const packageId = asPackageId(req.params.id); // Validates & brands
  const pkg = await packageRepo.findById(packageId);
  // ...
});

// Webhook handler - brand metadata
const packageId = asPackageId(metadata.packageId);
```

### Safe vs Unsafe Branding

```typescript
// SAFE: Validates format, throws on invalid input
const id = asPackageId(userInput); // Throws if not CUID format

// UNSAFE: No validation, use only for known-good values
const id = unsafeAsPackageId(prismaResult.id); // From trusted source
```

**When to use unsafe:**

- Values directly from Prisma (database is source of truth)
- Values from JWT claims (already validated by middleware)
- Hardcoded test fixtures

**When to use safe:**

- User input (URL params, request body)
- External API responses
- Webhook payloads

## Gradual Adoption Strategy

Since the codebase has hundreds of uses of plain `string` for identifiers, adopt branded types gradually:

### Phase 1: New Code Only (Recommended Starting Point)

1. Use branded types in all new functions and services
2. Add assertion functions at API entry points
3. Don't change existing function signatures yet

```typescript
// New service method - use branded types
async findBySlugAndTenant(slug: PackageSlug, tenantId: TenantId): Promise<Package | null> {
  // ...
}

// Existing method - keep string for now
async findById(id: string): Promise<Package | null> {
  // ...
}
```

### Phase 2: Update Repository Interfaces

Update port interfaces to use branded types:

```typescript
// Before
interface IPackageRepository {
  findById(id: string): Promise<Package | null>;
  findBySlug(tenantId: string, slug: string): Promise<Package | null>;
}

// After
interface IPackageRepository {
  findById(id: PackageId): Promise<Package | null>;
  findBySlug(tenantId: TenantId, slug: PackageSlug): Promise<Package | null>;
}
```

### Phase 3: Update DTOs and Entities

Update entity interfaces:

```typescript
// Before
interface Package {
  id: string;
  tenantId: string;
  slug: string;
}

// After
interface Package {
  id: PackageId;
  tenantId: TenantId;
  slug: PackageSlug;
}
```

### Phase 4: Update Zod Schemas (Optional)

Zod schemas can use `transform` to brand values:

```typescript
const PackageIdSchema = z
  .string()
  .refine(isCuidFormat, 'Must be a valid CUID')
  .transform((s) => s as PackageId);

const PackageSlugSchema = z
  .string()
  .refine(isSlugFormat, 'Must be a valid slug')
  .transform((s) => s as PackageSlug);
```

## Testing with Branded Types

In tests, use the `unsafe` functions to create test fixtures without validation overhead:

```typescript
import { unsafeAsPackageId, unsafeAsPackageSlug, unsafeAsTenantId } from '@macon/shared';

const testPackageId = unsafeAsPackageId('clz9x7k8m0001a2b3c4d5e6f7g');
const testPackageSlug = unsafeAsPackageSlug('wedding-gold');
const testTenantId = unsafeAsTenantId('clz9a1b2c0001d2e3f4g5h6i7j');

describe('Package Repository', () => {
  it('finds package by ID', async () => {
    const pkg = await repo.findById(testPackageId);
    expect(pkg).toBeDefined();
  });

  it('finds package by slug', async () => {
    // TypeScript now enforces you use the right identifier!
    const pkg = await repo.findBySlug(testTenantId, testPackageSlug);
    expect(pkg).toBeDefined();
  });
});
```

## Common Pitfalls

### 1. Forgetting to Brand at Boundaries

```typescript
// WRONG: Plain string passed without branding
const pkg = await repo.findById(req.params.id); // ❌ Still string

// RIGHT: Brand at the boundary
const id = asPackageId(req.params.id);
const pkg = await repo.findById(id); // ✅ PackageId
```

### 2. Over-validating Internal Values

```typescript
// WRONG: Re-validating already-branded values
const id = asPackageId(pkg.id); // ❌ pkg.id is already PackageId

// RIGHT: Just use the branded value
const relatedId = pkg.id; // ✅ Already branded
```

### 3. Using Branded Types in JSON

Branded types are only a compile-time construct. JSON serialization works normally:

```typescript
const pkg = { id: asPackageId('clz9...') };
JSON.stringify(pkg); // { "id": "clz9..." } - works fine

// On deserialization, you need to re-brand:
const parsed = JSON.parse(json);
const id = asPackageId(parsed.id); // Re-brand from plain string
```

## Related Documentation

- [CLAUDE.md Pitfall #24](../../CLAUDE.md) - UUID validation on CUID fields
- [Webhook Tests Fix](../../commits/eb73d6e5) - Original bug that motivated this pattern
- [Multi-Tenant Isolation](../security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md) - Why TenantId matters
