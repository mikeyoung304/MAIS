---
title: TypeScript Build Failure Prevention - Prisma JSON Types
category: prevention
tags: [typescript, prisma, build-errors, json-fields, type-safety, render-deployment]
priority: P1
severity: critical
date_created: 2025-12-01
related_issues:
  - "Render deployment TypeScript compilation failure"
  - "Prisma JsonValue vs InputJsonValue type incompatibility"
applies_to:
  - server/src/adapters/prisma/**
  - server/src/services/*.service.ts
  - Any file using Prisma JSON fields
---

# TypeScript Build Failure Prevention - Prisma JSON Types

## Executive Summary

**Problem:** Render deployments fail with TypeScript compilation errors when code misuses Prisma's JSON type system:

```
TS2694: Cannot find namespace 'Prisma.JsonNull'
TS2304: Name 'Prisma.JsonNull' is not defined
TS1205: Re-exporting a type when the '--isolatedModules' flag is provided requires using 'export type'
```

**Root Causes:**
1. Using `import type` for modules that need runtime values (`Prisma.JsonNull`)
2. Object spread including optional properties that become `undefined` instead of `null`
3. Prisma `JsonValue` vs `InputJsonValue` type incompatibility in update operations
4. Type assertions bypassing JSON field type safety

**Impact:**
- Production deployments blocked
- CI/CD pipeline failures
- Unable to release features with JSON field updates

---

## Part 1: Prevention Checklist

Use this before pushing code that modifies Prisma-related files.

### Pre-Commit Checklist

- [ ] **Import Analysis**
  - [ ] All Prisma imports use correct pattern: `import { Prisma, type PrismaClient }`
  - [ ] `type` keyword only used for pure type imports (not `Prisma`)
  - [ ] No `import type` for modules that export runtime values
  - [ ] Verify imports compile: `npm run typecheck` passes

- [ ] **JSON Field Assignments**
  - [ ] String/number fields use direct assignment: `field: value`
  - [ ] JSON fields use proper casts: `field: value as Prisma.InputJsonValue`
  - [ ] Null clearing uses `Prisma.JsonNull` not bare `null`
  - [ ] Complex JSON objects wrapped in `as Prisma.InputJsonValue`

- [ ] **Object Spread with Optional Properties**
  - [ ] All spread operations checked for undefined values
  - [ ] Conditional assignments use explicit null: `field: value ?? null`
  - [ ] Never use object spread to include optional undefined properties
  - [ ] Null values explicitly preserved in JSON fields

- [ ] **Null Handling Patterns**
  - [ ] `undefined` in spreads converted to `null`
  - [ ] JSON fields never contain `undefined` (always `null`)
  - [ ] Conditional operators use: `value !== undefined ? value : null`
  - [ ] Draft clearing operations use `Prisma.JsonNull`

- [ ] **Type Safety**
  - [ ] No `as any` type assertions
  - [ ] Structured types defined in `server/src/types/prisma-json.ts`
  - [ ] Use proper type casts: `as Prisma.InputJsonValue`
  - [ ] JSON field types match Prisma schema

### Quick Self-Check Commands

```bash
# Verify TypeScript compilation
npm run typecheck

# Check for problematic import patterns
grep -r "import type.*Prisma" server/src --include="*.ts" | grep -v "PrismaClient"

# Find direct Prisma.JsonNull usage
grep -r "Prisma\.JsonNull" server/src --include="*.ts"

# Check for as any assertions
grep -r "as any" server/src --include="*.ts" --exclude-dir=test

# Find undefined in object spreads
grep -r "\.\.\." server/src --include="*.ts" -A 2 | grep "undefined"
```

---

## Part 2: Code Review Guidelines

### What Reviewers Should Look For

#### 1. Import Statements

**Problem Pattern:**
```typescript
// ❌ WRONG - Using import type for Prisma
import type { Prisma } from '../../generated/prisma';

// Error: "Cannot find namespace 'Prisma.JsonNull'"
// Because type-only imports are erased at runtime
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Import Prisma as value, types with 'type'
import { Prisma, type PrismaClient } from '../../generated/prisma';

// Now Prisma.JsonNull is available at runtime
```

**Reviewer Checklist:**
- [ ] Files using `Prisma.JsonNull` import `Prisma` without `type` keyword
- [ ] Type-only imports use `type` keyword for TypeScript types
- [ ] Mixed imports follow: `import { Prisma, type PrismaClient }`

#### 2. JSON Field Updates

**Problem Pattern:**
```typescript
// ❌ WRONG - Object spread with optional undefined values
const update = {
  ...(data.title !== undefined && { title: data.title }),
  ...(data.metadata !== undefined && { metadata: data.metadata }),  // JSON field!
};

await prisma.resource.update({
  where: { id },
  data: update,
  // But metadata: undefined gets sent to JSON field!
});
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Explicit null handling for JSON fields
const update = {
  ...(data.title !== undefined && { title: data.title }),
  ...(data.metadata !== undefined && { metadata: data.metadata as Prisma.InputJsonValue }),
};

await prisma.resource.update({
  where: { id },
  data: update,
});

// Or use inline casting:
await prisma.resource.update({
  where: { id },
  data: {
    title: data.title,
    metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
  },
});
```

**Reviewer Checklist:**
- [ ] JSON fields use `as Prisma.InputJsonValue` cast
- [ ] Null values use `Prisma.JsonNull`, not `null`
- [ ] Object spreads with optional properties don't mix types
- [ ] Conditional null assignment: `value ?? null` for JSON fields

#### 3. Null Value Handling

**Problem Pattern:**
```typescript
// ❌ WRONG - Null values not properly handled
const data = {
  draftTitle: null,
  draftPhotos: null,  // JSON field
};

// JSON fields should use Prisma.JsonNull
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Explicit JsonNull for JSON fields
const data = {
  draftTitle: null,
  draftPhotos: Prisma.JsonNull,  // JSON field
  hasDraft: false,
  draftUpdatedAt: null,
};
```

**Reference Implementation:**
```typescript
// From catalog.repository.ts - exemplar
async discardDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
  const result = await this.prisma.package.updateMany({
    where,
    data: {
      draftTitle: null,
      draftDescription: null,
      draftPriceCents: null,
      draftPhotos: Prisma.JsonNull,  // ← JSON field uses JsonNull
      hasDraft: false,
      draftUpdatedAt: null,
    },
  });

  return result.count;
}
```

**Reviewer Checklist:**
- [ ] JSON field resets use `Prisma.JsonNull`
- [ ] String/number fields use `null` directly
- [ ] Array fields use `Prisma.JsonNull` for empty arrays
- [ ] Comments clarify which fields are JSON

#### 4. Type Assertions

**Problem Pattern:**
```typescript
// ❌ WRONG - Using as any
const photos = pkg.photos as any;

// ❌ WRONG - Raw cast without InputJsonValue
const data = { photos: photos };
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Use proper Prisma types
import type { PackagePhoto } from '../types/prisma-json';

// For reading:
const photos = pkg.photos as Prisma.JsonValue;
const typedPhotos = photos as PackagePhoto[] | null;

// For writing:
const data = {
  photos: draft.photos as Prisma.InputJsonValue,
};
```

**Reviewer Checklist:**
- [ ] No `as any` assertions for JSON fields
- [ ] JSON reads use `as Prisma.JsonValue`
- [ ] JSON writes use `as Prisma.InputJsonValue`
- [ ] Structured types defined in `types/prisma-json.ts`

#### 5. Property Spread Handling

**Problem Pattern:**
```typescript
// ❌ WRONG - Spreads mix optional and required
const update = {
  ...(draft.title !== undefined && { title: draft.title }),
  ...(draft.photos !== undefined && { photos: draft.photos }),  // JSON field
  ...(draft.extra !== undefined && { extra: draft.extra }),      // JSON field
};

// If draft.photos is undefined, it's not in the spread
// But if draft.photos is null, it becomes undefined in the spread!
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Explicit handling per field
const data = {
  ...(draft.title !== undefined && { title: draft.title }),
  ...(draft.photos !== undefined && {
    photos: draft.photos as Prisma.InputJsonValue
  }),
  ...(draft.extra !== undefined && {
    extra: draft.extra as Prisma.InputJsonValue
  }),
};

// Alternative - Conditional field assignment:
const data: Prisma.PackageUpdateInput = {
  title: draft.title,
  photos: draft.photos !== undefined
    ? (draft.photos as Prisma.InputJsonValue)
    : undefined,
  extra: draft.extra !== undefined
    ? (draft.extra as Prisma.InputJsonValue)
    : undefined,
};
```

**Reviewer Checklist:**
- [ ] Object spreads explicitly cast JSON fields
- [ ] Conditional spreads preserve type information
- [ ] Undefined/null distinction preserved for JSON fields
- [ ] Comments explain JSON field handling

---

## Part 3: Testing Recommendations

### Unit Tests for JSON Field Updates

```typescript
describe('JSON Field Updates', () => {
  it('should correctly update JSON fields with proper casting', async () => {
    const repo = new PrismaCatalogRepository(prisma);

    const result = await repo.updateDraft(tenantId, packageId, {
      photos: [{ url: 'https://...', filename: 'photo.jpg', size: 1024, order: 0 }],
    });

    expect(result.draftPhotos).toEqual([
      { url: 'https://...', filename: 'photo.jpg', size: 1024, order: 0 }
    ]);
  });

  it('should clear JSON fields with Prisma.JsonNull', async () => {
    const repo = new PrismaCatalogRepository(prisma);

    const result = await repo.discardDrafts(tenantId, [packageId]);

    // Verify JSON fields are truly null (Prisma.JsonNull)
    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    expect(pkg.draftPhotos).toBeNull();
  });

  it('should handle null values in JSON fields correctly', async () => {
    const repo = new PrismaCatalogRepository(prisma);

    const audit = new AuditService({ prisma });
    await audit.trackChange({
      tenantId,
      changeType: 'config_version',
      operation: 'create',
      entityType: 'ConfigVersion',
      entityId: 'v1',
      email: 'admin@example.com',
      role: 'TENANT_ADMIN',
      afterSnapshot: { status: 'draft' },
      // beforeSnapshot undefined - should be converted to Prisma.JsonNull
    });

    const logs = await prisma.configChangeLog.findMany({ where: { tenantId } });
    expect(logs[0].beforeSnapshot).toBeNull();
  });
});
```

### TypeScript Compilation Tests

```bash
# Create test script: test-ts-build.sh
#!/bin/bash

set -e

echo "Testing TypeScript build..."

# Test 1: Basic compilation
npm run typecheck || exit 1

# Test 2: JSON field imports
grep -q "import { Prisma, type PrismaClient }" \
  server/src/adapters/prisma/*.ts || {
  echo "FAIL: Incorrect Prisma imports found"
  exit 1
}

# Test 3: JsonNull usage in correct files
grep -q "Prisma.JsonNull" server/src/adapters/prisma/*.ts || {
  echo "FAIL: No Prisma.JsonNull usage found in repositories"
  exit 1
}

# Test 4: No type-only Prisma imports
if grep -r "import type.*Prisma[^C]" server/src --include="*.ts"; then
  echo "FAIL: Found type-only Prisma imports"
  exit 1
fi

echo "✅ All TypeScript build tests passed"
```

### Integration Tests with Real Database

```typescript
describe('Prisma JSON Field Type Safety - Integration', () => {
  it('should compile and run update with JSON fields', async () => {
    // This test will FAIL at TypeScript compilation if types are wrong
    const { tenantId, cleanup } = await createTestTenant();

    try {
      const pkg = await prisma.package.create({
        data: {
          tenantId,
          slug: 'test-pkg',
          name: 'Test Package',
          description: null,
          basePrice: 10000,
          photos: [{ url: 'https://...', filename: 'test.jpg', size: 1000, order: 0 }]
            as Prisma.InputJsonValue,
        },
      });

      // Update with explicit JSON casting
      const updated = await prisma.package.update({
        where: { id: pkg.id },
        data: {
          photos: [{ url: 'https://new.jpg', filename: 'new.jpg', size: 2000, order: 0 }]
            as Prisma.InputJsonValue,
        },
      });

      expect(updated.photos).toBeDefined();

      // Clear with JsonNull
      const cleared = await prisma.package.update({
        where: { id: pkg.id },
        data: {
          draftPhotos: Prisma.JsonNull,
        },
      });

      expect(cleared.draftPhotos).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
```

---

## Part 4: Best Practices

### Pattern: Reading Prisma JSON Fields

```typescript
// Problem: JSON values are stored as Prisma.JsonValue (union type)
// Solution: Cast to your structured type

import type { PackagePhoto, BrandingConfig } from '../types/prisma-json';

class CatalogRepository {
  private parsePhotosJson(photos: Prisma.JsonValue | undefined): PackagePhoto[] {
    if (!photos) return [];

    // Already an array (from Prisma deserialization)
    if (Array.isArray(photos)) {
      return photos as PackagePhoto[];
    }

    // String (from legacy data or default value "[]")
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private toBrandingConfig(branding: Prisma.JsonValue | null): BrandingConfig {
    if (!branding || typeof branding !== 'object') {
      return {};
    }

    return branding as BrandingConfig;
  }
}
```

### Pattern: Writing to Prisma JSON Fields

```typescript
// When setting JSON values during create/update

class CatalogRepository {
  async updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package> {
    const pkg = await this.prisma.package.update({
      where: { id, tenantId },
      data: {
        // String fields - direct assignment
        name: data.title,
        description: data.description,

        // Number fields - direct assignment
        basePrice: data.priceCents,

        // JSON fields - MUST cast to Prisma.InputJsonValue
        photos: data.photos
          ? (data.photos as Prisma.InputJsonValue)
          : undefined,  // Leave undefined to not update this field

        // Complex conditional JSON field updates
        branding: data.branding !== undefined
          ? (data.branding as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return this.toDomainPackage(pkg);
  }
}
```

### Pattern: Handling JSON Fields in Conditional Updates

```typescript
// When you have optional fields and some are JSON

async updateWithDrafts(
  tenantId: string,
  packageId: string,
  draft: UpdatePackageDraftInput
): Promise<PackageWithDraft> {
  // Build data object with proper type handling
  const updateData: Prisma.PackageUpdateInput = {};

  if (draft.title !== undefined) {
    updateData.draftTitle = draft.title;
  }

  if (draft.description !== undefined) {
    updateData.draftDescription = draft.description;
  }

  if (draft.priceCents !== undefined) {
    updateData.draftPriceCents = draft.priceCents;
  }

  // JSON field - needs explicit cast
  if (draft.photos !== undefined) {
    updateData.draftPhotos = draft.photos as Prisma.InputJsonValue;
  }

  // Metadata fields
  updateData.hasDraft = true;
  updateData.draftUpdatedAt = new Date();

  const pkg = await this.prisma.package.update({
    where: { id: packageId, tenantId },
    data: updateData,
  });

  return this.toDomainPackageWithDraft(pkg);
}
```

### Pattern: Clearing JSON Fields to Null

```typescript
// Use Prisma.JsonNull to clear JSON fields, not bare null

async discardDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
  const result = await this.prisma.package.updateMany({
    where: {
      tenantId,
      hasDraft: true,
      ...(packageIds && { id: { in: packageIds } }),
    },
    data: {
      // String/number fields use null
      draftTitle: null,
      draftDescription: null,
      draftPriceCents: null,

      // JSON fields use Prisma.JsonNull
      draftPhotos: Prisma.JsonNull,

      // Boolean/date fields
      hasDraft: false,
      draftUpdatedAt: null,
    },
  });

  return result.count;
}

async publishDrafts(tenantId: string, packageIds?: string[]): Promise<Package[]> {
  const packages = await this.prisma.package.findMany({
    where: {
      tenantId,
      hasDraft: true,
      ...(packageIds && { id: { in: packageIds } }),
    },
  });

  const published = await this.prisma.$transaction(
    packages.map((pkg) =>
      this.prisma.package.update({
        where: { id: pkg.id, tenantId },
        data: {
          // Promote draft fields
          name: pkg.draftTitle || pkg.name,
          description: pkg.draftDescription || pkg.description,
          basePrice: pkg.draftPriceCents || pkg.basePrice,
          photos: pkg.draftPhotos
            ? (pkg.draftPhotos as Prisma.InputJsonValue)
            : (pkg.photos as Prisma.InputJsonValue),

          // Clear all draft fields
          draftTitle: null,
          draftDescription: null,
          draftPriceCents: null,
          draftPhotos: Prisma.JsonNull,  // ← JSON field
          hasDraft: false,
          draftUpdatedAt: null,
        },
      })
    )
  );

  return published.map((pkg) => this.toDomainPackage(pkg));
}
```

### Pattern: Audit Service with JSON Fields

```typescript
// Handling optional undefined values that become Prisma.JsonNull

class AuditService {
  async trackChange(input: TrackChangeInput): Promise<void> {
    await this.prisma.configChangeLog.create({
      data: {
        tenantId: input.tenantId,
        changeType: input.changeType,
        operation: input.operation,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        agentId: input.agentId ?? null,
        email: input.email,
        role: input.role,

        // ✅ Proper handling of optional JSON fields
        beforeSnapshot: input.beforeSnapshot !== undefined && input.beforeSnapshot !== null
          ? (input.beforeSnapshot as Prisma.InputJsonValue)
          : Prisma.JsonNull,

        afterSnapshot: input.afterSnapshot !== undefined && input.afterSnapshot !== null
          ? (input.afterSnapshot as Prisma.InputJsonValue)
          : Prisma.JsonNull,

        reason: input.reason ?? null,

        metadata: input.metadata !== undefined && input.metadata !== null
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }
}
```

---

## Part 5: TypeScript Configuration

### Verify tsconfig.json Settings

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "strict": true,
    "isolatedModules": true,  // ← Required for build systems
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noImplicitAny": true,     // ← Prevents type-safety bypasses
    "noImplicitThis": true,
    "strictNullChecks": true,   // ← Required for JSON field safety
    "strictFunctionTypes": true,
    "paths": {
      "@macon/*": ["../packages/*/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### CI/CD TypeScript Check

```yaml
# .github/workflows/build.yml
name: Build

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run typecheck  # Fails if JSON types are wrong
      - run: npm run build
```

---

## Part 6: Common Pitfalls

### Pitfall 1: Type-Only Prisma Imports

```typescript
// ❌ WRONG
import type { Prisma } from '../../generated/prisma';

// Prisma.JsonNull is not available at runtime
// Error: Cannot find namespace 'Prisma.JsonNull'

// ✅ CORRECT
import { Prisma, type PrismaClient } from '../../generated/prisma';

// Now Prisma.JsonNull works
```

### Pitfall 2: Using null Instead of Prisma.JsonNull

```typescript
// ❌ WRONG for JSON fields
data: {
  photos: null,  // JSON field
}

// ✅ CORRECT
data: {
  photos: Prisma.JsonNull,  // JSON field
  title: null,              // String field
}
```

### Pitfall 3: Not Casting JSON Updates

```typescript
// ❌ WRONG
const photos = [...newPhotos];
await prisma.package.update({
  where: { id },
  data: { photos },  // Type error!
});

// ✅ CORRECT
await prisma.package.update({
  where: { id },
  data: { photos: photos as Prisma.InputJsonValue },
});
```

### Pitfall 4: Mixing undefined and null in JSON Fields

```typescript
// ❌ WRONG - Object spread creates undefined
const update = {
  ...(data.photos !== undefined && { photos: data.photos }),
};

// If spread is empty, photos field has undefined type
await prisma.package.update({
  where: { id },
  data: update,  // Type error
});

// ✅ CORRECT
const update: Prisma.PackageUpdateInput = {};

if (data.photos !== undefined) {
  update.photos = data.photos as Prisma.InputJsonValue;
}

await prisma.package.update({
  where: { id },
  data: update,
});
```

### Pitfall 5: Forgetting JsonNull in Transaction

```typescript
// ❌ WRONG - In transaction batch operations
const updates = packages.map((pkg) =>
  prisma.package.update({
    where: { id: pkg.id },
    data: {
      draftPhotos: null,  // ← Should be Prisma.JsonNull
    },
  })
);

// ✅ CORRECT
const updates = packages.map((pkg) =>
  prisma.package.update({
    where: { id: pkg.id },
    data: {
      draftPhotos: Prisma.JsonNull,
    },
  })
);
```

---

## Part 7: Deployment Checklist

### Before Merging to main

- [ ] `npm run typecheck` passes locally
- [ ] All JSON field updates use proper casting
- [ ] Imports follow: `import { Prisma, type PrismaClient }`
- [ ] No type-only imports of `Prisma`
- [ ] JSON field nullification uses `Prisma.JsonNull`
- [ ] No `as any` assertions for Prisma types
- [ ] Tests pass: `npm test`
- [ ] E2E tests with JSON field mutations pass

### Before Rendering Deployment

```bash
# Final verification script
#!/bin/bash

set -e

echo "🔍 Pre-deployment verification..."

# TypeScript compilation
npm run typecheck || exit 1
echo "✅ TypeScript compilation passed"

# ESLint (catches some patterns)
npm run lint || exit 1
echo "✅ Linting passed"

# Build
npm run build || exit 1
echo "✅ Build passed"

# Tests
npm test || exit 1
echo "✅ Tests passed"

# Check for problematic patterns
echo "🔍 Checking for common mistakes..."

if grep -r "import type.*Prisma[^C]" server/src --include="*.ts"; then
  echo "❌ Found type-only Prisma imports"
  exit 1
fi

if grep -r "as any.*Prisma" server/src --include="*.ts"; then
  echo "❌ Found as any assertions with Prisma"
  exit 1
fi

echo "✅ All pre-deployment checks passed"
```

---

## Part 8: Documentation References

**Key Files:**
- `/server/src/types/prisma-json.ts` - Type definitions for JSON fields
- `/server/src/adapters/prisma/catalog.repository.ts` - Reference implementation
- `/server/src/services/audit.service.ts` - Audit with JSON field handling
- `/server/src/generated/prisma/index.d.ts` - Generated Prisma types

**Related Docs:**
- [Prisma JSON Field Documentation](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#json)
- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Render Deployment Guide](../../setup/RENDER.md)

---

## Quick Reference Card

Print and keep on your desk:

```
┌─────────────────────────────────────────────────────────────┐
│  PRISMA JSON FIELD TYPE SAFETY QUICK REFERENCE              │
├─────────────────────────────────────────────────────────────┤
│  IMPORTS                                                    │
│  ✅ import { Prisma, type PrismaClient } from ...          │
│  ❌ import type { Prisma } from ...                        │
│                                                             │
│  JSON FIELD READS                                           │
│  ✅ const val = field as Prisma.JsonValue                  │
│  ❌ const val = field as any                               │
│                                                             │
│  JSON FIELD WRITES                                          │
│  ✅ photos: value as Prisma.InputJsonValue                 │
│  ✅ photos: Prisma.JsonNull                                │
│  ❌ photos: null (for JSON fields)                         │
│  ❌ photos: value (uncast)                                 │
│                                                             │
│  CONDITIONAL UPDATES                                        │
│  ✅ data: value ? value as Prisma.InputJsonValue : undef   │
│  ❌ { ...(cond && { photos: value }) }                    │
│                                                             │
│  CLEARING JSON FIELDS                                       │
│  ✅ draftPhotos: Prisma.JsonNull                           │
│  ❌ draftPhotos: null                                      │
│                                                             │
│  NULLISH COALESCING                                         │
│  ✅ value ?? Prisma.JsonNull                               │
│  ✅ value !== undefined ? value : Prisma.JsonNull         │
│  ❌ value || null                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Questions & Escalation

If you encounter TypeScript errors related to Prisma JSON types:

1. **Check the error message** - look for `Prisma.JsonNull` or `InputJsonValue`
2. **Review the file** - does it import `Prisma` as a value (not type-only)?
3. **Check the assignment** - is it using proper `Prisma.InputJsonValue` cast?
4. **Run `npm run typecheck`** - get full context of the error
5. **Ask in #engineering** - link to this document in your question

---

**Last Updated:** 2025-12-01
**Maintained By:** Platform Team
**Status:** Active Prevention Strategy
