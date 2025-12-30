# ADR-016: Field Naming Conventions (Database vs API/Frontend)

**Date:** 2025-12-29
**Status:** ACCEPTED
**Context:** Multi-layer architecture with Prisma ORM, Express API, and React/Next.js frontends
**Participants:** Architecture team

---

## Problem Statement

The codebase has inconsistent field naming between layers:

| Layer                 | Package Fields        | AddOn Fields          | Service Fields       |
| --------------------- | --------------------- | --------------------- | -------------------- |
| **Database (Prisma)** | `name`, `basePrice`   | `name`, `price`       | `name`, `priceCents` |
| **Domain Entities**   | `title`, `priceCents` | `title`, `priceCents` | `name`, `priceCents` |
| **API DTOs**          | `title`, `priceCents` | `title`, `priceCents` | `name`, `priceCents` |
| **Frontend**          | `name`, `basePrice`   | `name`, `price`       | `name`, `priceCents` |
| **AI Agent Tools**    | Both mixed            | Both mixed            | -                    |

This causes:

- Confusion for developers working across layers
- Ad-hoc normalization code in executors and routes
- Potential bugs when wrong field name is used
- Fragile code that breaks when fields are missing

---

## Decision

**Keep both naming conventions at their respective layers with explicit DTO mapping.**

### Layer Conventions

| Layer               | Field Names                 | Rationale                                            |
| ------------------- | --------------------------- | ---------------------------------------------------- |
| **Database**        | `name`, `basePrice` (cents) | Prisma uses `name` for consistency with other models |
| **Domain Entities** | `title`, `priceCents`       | Historical naming, explicit cents suffix             |
| **API DTOs**        | `title`, `priceCents`       | Contract stability, matches external documentation   |
| **Frontend**        | `name`, `basePrice`         | User-friendly naming, backward compatibility         |
| **AI Agent**        | Accept both                 | Robust to either naming convention                   |

### Key Mappings

```typescript
// Database → Domain Entity (in repositories)
const entity: Package = {
  title: dbRecord.name,           // name → title
  priceCents: dbRecord.basePrice, // basePrice → priceCents
  ...
};

// Domain Entity → API Response (in routes)
const dto = {
  title: entity.title,            // Keep as title
  priceCents: entity.priceCents,  // Keep as priceCents
  name: entity.title,             // Also expose as name for frontend
  basePrice: entity.priceCents,   // Also expose as basePrice for frontend
};

// API Request → Domain (accept both)
const packageName = payload.name || payload.title;
const packagePrice = payload.basePrice ?? payload.priceCents;
```

---

## Design Details

### Mapping Locations

| File                                         | Responsibility                    |
| -------------------------------------------- | --------------------------------- |
| `server/src/adapters/prisma/*.repository.ts` | DB → Domain Entity                |
| `server/src/routes/tenant-admin.routes.ts`   | Domain → API Response             |
| `server/src/agent/executors/index.ts`        | Accept both field names           |
| `packages/contracts/src/dto.ts`              | Schema definitions (API contract) |
| `server/src/lib/entities.ts`                 | Domain entity types               |

### Current Mapping Code

**In `tenant-admin.routes.ts` (GET /packages):**

```typescript
const packagesDto = packages.map((pkg) => ({
  id: pkg.id,
  slug: pkg.slug,
  // Map to frontend-expected field names
  name: pkg.title || pkg.name,
  basePrice: pkg.priceCents ?? pkg.basePrice,
  // Also include original names for backward compatibility
  title: pkg.title,
  priceCents: pkg.priceCents,
  ...
}));
```

**In `executors/index.ts` (upsert_package):**

```typescript
// Accept both 'title' (old) and 'name' (new) field names
const { title, name, priceCents, basePrice, ... } = payload;

// Normalize field names (name takes precedence, fall back to title)
const packageName = name || title;
const packagePrice = basePrice ?? priceCents;
```

### Why Both Conventions?

1. **Database (`name`, `basePrice`):**
   - Consistent with Prisma model naming (User.name, Tenant.name, etc.)
   - `basePrice` in cents for financial precision

2. **Domain Entities (`title`, `priceCents`):**
   - Historical naming from early development
   - `priceCents` makes unit explicit (prevents dollar/cent confusion)

3. **API DTOs (`title`, `priceCents`):**
   - Contract stability for external consumers
   - Matches existing documentation

4. **Frontend (`name`, `basePrice`):**
   - User-friendly display names
   - Backward compatibility with UI components

---

## Price Handling: Cents vs Dollars

**All prices are stored and transmitted in cents (integers).**

| Field        | Type  | Example         |
| ------------ | ----- | --------------- |
| `basePrice`  | `Int` | 9999 (= $99.99) |
| `priceCents` | `Int` | 9999 (= $99.99) |
| `price`      | `Int` | 9999 (= $99.99) |

**Frontend formatting:**

```typescript
const displayPrice = `$${(priceCents / 100).toFixed(2)}`;
// 9999 → "$99.99"
```

**Why cents?**

- Avoids floating-point precision issues
- Matches Stripe's amount format
- Integer math is predictable

---

## Migration Path (If Refactoring)

If we decide to standardize naming in the future:

### Option A: Standardize on `name`/`priceCents`

1. Update domain entities: `title` → `name`
2. Update API DTOs: keep both for backward compatibility
3. Update tests
4. No database migration needed (already uses `name`)

### Option B: Standardize on `title`/`priceCents`

1. Create database migration: `name` → `title`
2. Update all Prisma queries
3. Update API DTOs
4. Risk: Breaking change for existing consumers

### Recommended: Keep Current Pattern

- Add more explicit DTO converter functions
- Document field mappings in code comments
- Use TypeScript strict mode to catch mismatches

---

## Implementation Guidelines

### For New Features

1. **Database models:** Use `name` for display names, `priceCents` for prices
2. **Domain entities:** Use `title` and `priceCents` for consistency
3. **API DTOs:** Expose both conventions for flexibility
4. **Frontend:** Use `name` and `basePrice`

### For AI Agent Tools

Always accept both field names:

```typescript
// In tool handlers
const packageName = payload.name || payload.title;
const packagePrice = payload.basePrice ?? payload.priceCents;

if (!packageName) {
  throw new Error('Package name/title is required');
}
```

### For Repository Mappings

Always map explicitly:

```typescript
// ✅ CORRECT - Explicit mapping
return {
  title: dbRecord.name,
  priceCents: dbRecord.basePrice,
};

// ❌ WRONG - Spreading without mapping
return { ...dbRecord }; // Field names mismatch!
```

---

## Affected Files

### Core Mapping Files

| File                                       | Role                              |
| ------------------------------------------ | --------------------------------- |
| `server/prisma/schema.prisma`              | Database schema (source of truth) |
| `server/src/lib/entities.ts`               | Domain entity types               |
| `packages/contracts/src/dto.ts`            | API contract schemas              |
| `server/src/routes/tenant-admin.routes.ts` | Response mapping                  |
| `server/src/agent/executors/index.ts`      | Request normalization             |

### Schema Comparison

**Prisma Schema (Package):**

```prisma
model Package {
  name        String
  basePrice   Int
  ...
}
```

**Domain Entity (Package):**

```typescript
interface Package {
  title: string;
  priceCents: number;
  ...
}
```

**API DTO (PackageDto):**

```typescript
const PackageDtoSchema = z.object({
  title: z.string(),
  priceCents: z.number().int(),
  ...
});
```

---

## Testing Considerations

When writing tests, be aware of the field name differences:

```typescript
// Creating test data
const dbPackage = await prisma.package.create({
  data: {
    name: 'Test Package', // Database uses 'name'
    basePrice: 9999, // Database uses 'basePrice'
  },
});

// Asserting API response
expect(response.body.title).toBe('Test Package'); // API returns 'title'
expect(response.body.priceCents).toBe(9999); // API returns 'priceCents'
```

---

## Alternative Approaches Considered

### Alternative 1: Full Standardization on One Convention

**Rejected because:**

- Breaking change for existing consumers
- Significant refactoring effort
- Risk of introducing bugs during migration

### Alternative 2: Automated DTO Converters (class-transformer)

**Rejected because:**

- Additional dependency
- Runtime overhead
- Explicit mapping is more transparent

### Alternative 3: No Mapping (Direct Passthrough)

**Rejected because:**

- Leaks database structure to API consumers
- Makes schema changes breaking changes
- Violates layered architecture principles

---

## Decision Record

**Decision:** Keep dual naming conventions with explicit DTO mapping at layer boundaries.

**Rationale:**

- Maintains backward compatibility
- Explicit mapping prevents subtle bugs
- Each layer can evolve independently
- Matches existing codebase patterns

**Trade-offs:**

- Requires understanding of field mappings
- More verbose mapping code
- Potential confusion for new developers (mitigated by this ADR)

**Approved by:** Architecture team
**Effective date:** 2025-12-29
**Review date:** 2026-06-29 (6 months)

---

## Quick Reference

### Field Mapping Cheat Sheet

| Database             | Domain               | API                      | Frontend     | Used For             |
| -------------------- | -------------------- | ------------------------ | ------------ | -------------------- |
| `Package.name`       | `Package.title`      | `title`/`name`           | `name`       | Package display name |
| `Package.basePrice`  | `Package.priceCents` | `priceCents`/`basePrice` | `basePrice`  | Price in cents       |
| `AddOn.name`         | `AddOn.title`        | `title`                  | `name`       | AddOn display name   |
| `AddOn.price`        | `AddOn.priceCents`   | `priceCents`             | `price`      | Price in cents       |
| `Service.name`       | `Service.name`       | `name`                   | `name`       | Service display name |
| `Service.priceCents` | `Service.priceCents` | `priceCents`             | `priceCents` | Price in cents       |

### When Accepting User Input (Agent Tools)

```typescript
// Always accept both and normalize
const name = payload.name || payload.title;
const price = payload.basePrice ?? payload.priceCents;
```

### When Returning Data

```typescript
// Include both for maximum compatibility
return {
  name: entity.title, // Frontend convention
  title: entity.title, // Legacy/API convention
  basePrice: entity.priceCents, // Frontend convention
  priceCents: entity.priceCents, // Legacy/API convention
};
```

---

## References

- Prisma schema: `server/prisma/schema.prisma`
- Domain entities: `server/src/lib/entities.ts`
- API DTOs: `packages/contracts/src/dto.ts`
- Prevention Strategy: `docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md`
