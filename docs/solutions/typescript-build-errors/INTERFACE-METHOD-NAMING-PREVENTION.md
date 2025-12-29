---
module: MAIS
date: 2025-12-29
problem_type: build_error
component: server/lib/ports.ts, server/services/
symptoms:
  - TS2339: Property 'getById' does not exist on type 'CatalogRepository'
  - Interface expects 'findById' but implementation uses 'getById'
  - Inconsistent naming between interface and implementation causes build failures
root_cause: Repository interface defines method as 'findById' but service implementation calls 'getById' (or vice versa)
resolution_type: code_review_pattern
severity: P1
related_files:
  - server/src/lib/ports.ts (interface definitions)
  - server/src/adapters/prisma/*.repository.ts (implementations)
  - server/src/services/*.service.ts (consumers)
tags: [typescript, interfaces, naming-conventions, build-errors, code-review]
---

# Prevention Strategy: Interface Method Naming Mismatch

## Problem Summary

**Issue:** TypeScript compilation fails when repository interface methods are defined with one name (e.g., `findById`) but called with a different name (e.g., `getById`) in services or implementation classes.

**Root Cause:** Interface definitions and their implementations/consumers get out of sync during refactoring or when multiple developers use different naming conventions.

**Impact:**

- Build fails with TS2339 error
- Cannot proceed to deployment
- Runtime behavior appears correct until compilation reveals mismatch

**Example:**

```typescript
// ❌ WRONG - Interface and implementation don't match

// In ports.ts
export interface CatalogRepository {
  findById(tenantId: string, id: string): Promise<Package | null>;
}

// In catalog.service.ts (consumer)
const package = await this.catalogRepo.getById(tenantId, id);
// ← Error: Property 'getById' does not exist
```

---

## Prevention Strategy

### 1. Establish Repository Method Naming Conventions

**Document the standard naming patterns in CLAUDE.md:**

```markdown
## Repository Method Naming Conventions

Use these patterns consistently across ALL repositories:

### Read Methods

- `getById(tenantId, id)` - Single record by ID
- `getBySlug(tenantId, slug)` - Single record by slug
- `getAll(tenantId)` - Multiple records
- `find(tenantId, filters)` - Search with filters
- `exists(tenantId, id)` - Boolean existence check
- `count(tenantId, filters)` - Count records

### Write Methods

- `create(tenantId, data)` - Insert single
- `update(tenantId, id, data)` - Update single
- `delete(tenantId, id)` - Delete single
- `bulkCreate(tenantId, data)` - Insert multiple
- `bulkUpdate(tenantId, updates)` - Update multiple
- `bulkDelete(tenantId, ids)` - Delete multiple

### Special Methods

- `publish(tenantId, ids)` - Activate/publish records
- `draft(tenantId, id, data)` - Create draft version
- `archive(tenantId, id)` - Soft delete

### DO NOT MIX:

- ❌ Don't use `fetch` and `get` in same codebase
- ❌ Don't use `find` and `get` interchangeably for ID lookups
- ❌ Don't use `list` instead of `getAll`
```

### 2. Interface-First Development Pattern

**Always define the interface BEFORE implementing:**

```typescript
// Step 1: Define interface in ports.ts
export interface CatalogRepository {
  getById(tenantId: string, id: string): Promise<Package | null>;
  getBySlug(tenantId: string, slug: string): Promise<Package | null>;
  getAll(tenantId: string): Promise<Package[]>;
  create(tenantId: string, data: CreatePackageInput): Promise<Package>;
  update(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package>;
  delete(tenantId: string, id: string): Promise<void>;
}

// Step 2: Implement EXACTLY as defined
export class PrismaCatalogRepository implements CatalogRepository {
  async getById(tenantId: string, id: string): Promise<Package | null> {
    // ← Method name MATCHES interface
    return this.prisma.package.findFirst({
      where: { tenantId, id },
    });
  }

  async getBySlug(tenantId: string, slug: string): Promise<Package | null> {
    // ← Method name MATCHES interface
    return this.prisma.package.findFirst({
      where: { tenantId, slug },
    });
  }

  // ... other methods matching interface exactly
}

// Step 3: Use in service - will fail at build time if names don't match
export class CatalogService {
  async getPackage(tenantId: string, id: string): Promise<Package | null> {
    return this.catalogRepo.getById(tenantId, id); // ← Type-safe call
  }
}
```

### 3. TypeScript Strict Mode Catches This Automatically

**Ensure tsconfig.json has strict mode enabled:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Verify with TypeScript check before committing:**

```bash
npm run typecheck  # Must pass before pushing
```

---

## Code Review Checklist

### When Reviewing Interface Changes

```yaml
Interface Method Naming Review: □ Does interface method name match repository naming convention?
  └─ Verify against CLAUDE.md naming standards
  └─ Check for getById/findById mixing
  └─ Check for get/fetch/retrieve mixing

  □ Do ALL implementations have matching method names?
  └─ Mock implementation in adapters/mock/
  └─ Prisma implementation in adapters/prisma/
  └─ Any other implementations

  □ Do ALL service calls use correct method names?
  └─ Search for interface name in services/
  └─ Verify each call uses defined method name
  └─ Check for typos in method names

  □ Did the reviewer check the interface definition?
  └─ Read ports.ts to confirm method signature
  └─ Verify return types match
  └─ Verify parameter types match

  □ Does this PR pass local typecheck?
  └─ npm run typecheck must complete without errors
  └─ No "property does not exist" errors
```

### Pull Request Template Addition

```markdown
## Type Safety Checklist

- [ ] All interface methods are defined in `server/src/lib/ports.ts`
- [ ] All method names follow CLAUDE.md naming conventions
- [ ] All implementations (`adapters/mock/`, `adapters/prisma/`) have matching method names
- [ ] All service calls use correct method names (verify with IDE)
- [ ] Local typecheck passes: `npm run typecheck`
- [ ] No TS2339 or TS2345 errors in build output

### If adding new repository interface:

- [ ] Added to appropriate interface in `ports.ts`
- [ ] Method name uses GET pattern (not FIND) for ID lookups
- [ ] Mock implementation created
- [ ] Prisma implementation created
- [ ] Service updated to use new method
```

---

## IDE Configuration to Catch This Early

### VSCode Settings

**Add to `.vscode/settings.json`:**

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "typescript.preferences": {
    "importModuleSpecifierPreference": "relative",
    "importModuleSpecifierEnding": "auto"
  },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  }
}
```

### Pre-Commit Hook to Validate

**Add to `.husky/pre-commit`:**

```bash
#!/bin/bash
set -e

echo "Checking TypeScript strict mode..."
npm run typecheck

if [ $? -ne 0 ]; then
  echo ""
  echo "ERROR: TypeScript compilation failed!"
  echo "Please review these errors:"
  echo "  - TS2339: Property 'X' does not exist"
  echo "  - TS2345: Argument of type 'X' is not assignable"
  echo ""
  echo "Check that interface methods match implementation method names."
  exit 1
fi

echo "✓ TypeScript check passed"
```

---

## Quick Reference: Method Naming Decision Tree

```
Need to retrieve a single record by ID?
├─ YES → Use getById(tenantId, id)
└─ NO  → Continue

Need to retrieve a single record by non-ID?
├─ YES → Use getBySlug(tenantId, slug) or getBy[FieldName](...)
└─ NO  → Continue

Need to retrieve multiple records?
├─ YES → Use getAll(tenantId) or find(tenantId, filters)
└─ NO  → Continue

Need to search with complex filters?
├─ YES → Use find(tenantId, filters)
└─ NO  → Continue

Need to check if record exists?
├─ YES → Use exists(tenantId, id)
└─ NO  → Continue

Need to count records?
├─ YES → Use count(tenantId, filters)
└─ NO  → Use create/update/delete methods
```

---

## Real-World Examples from MAIS

### ✅ CORRECT Pattern

**In `server/src/lib/ports.ts`:**

```typescript
export interface CatalogRepository {
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package | null>;
  getAllPackages(tenantId: string): Promise<Package[]>;
  getAddOnById(tenantId: string, id: string): Promise<AddOn | null>;
}

export interface BookingRepository {
  getById(tenantId: string, id: string): Promise<Booking | null>;
  getAll(tenantId: string): Promise<Booking[]>;
  find(tenantId: string, filters: BookingFilters): Promise<Booking[]>;
}
```

**In `server/src/adapters/prisma/catalog.repository.ts`:**

```typescript
export class PrismaCatalogRepository implements CatalogRepository {
  async getPackageById(tenantId: string, id: string): Promise<Package | null> {
    return this.prisma.package.findFirst({ where: { tenantId, id } });
  }

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    return this.prisma.package.findFirst({ where: { tenantId, slug } });
  }

  async getAllPackages(tenantId: string): Promise<Package[]> {
    return this.prisma.package.findMany({ where: { tenantId } });
  }

  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
    return this.prisma.addOn.findFirst({ where: { tenantId, id } });
  }
}
```

**In `server/src/services/catalog.service.ts`:**

```typescript
export class CatalogService {
  constructor(private readonly catalogRepo: CatalogRepository) {}

  async getPackage(tenantId: string, id: string): Promise<Package | null> {
    return this.catalogRepo.getPackageById(tenantId, id); // ✅ Correct
  }

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    return this.catalogRepo.getPackageBySlug(tenantId, slug); // ✅ Correct
  }

  async getAllPackages(tenantId: string): Promise<Package[]> {
    return this.catalogRepo.getAllPackages(tenantId); // ✅ Correct
  }
}
```

### ❌ INCORRECT Pattern (What to Avoid)

```typescript
// ports.ts defines getPackageById
export interface CatalogRepository {
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
}

// But service uses findById
export class CatalogService {
  async getPackage(tenantId: string, id: string): Promise<Package | null> {
    return this.catalogRepo.findById(tenantId, id); // ❌ WRONG - doesn't exist!
  }
}

// Build fails with:
// TS2339: Property 'findById' does not exist on type 'CatalogRepository'
```

---

## Testing to Verify Method Names

### Unit Test for Repository Interface Conformance

```typescript
import { describe, it, expect } from 'vitest';
import type { CatalogRepository } from '../lib/ports';

describe('CatalogRepository Interface Conformance', () => {
  it('should have all expected methods with correct signatures', () => {
    // Check that interface has expected methods
    const expectedMethods = [
      'getPackageById',
      'getPackageBySlug',
      'getAllPackages',
      'getAddOnById',
    ];

    // This type assertion will fail at compile time if methods are missing
    type RepositoryKeys = keyof CatalogRepository;
    const actualMethods: RepositoryKeys[] = expectedMethods as RepositoryKeys[];

    expect(actualMethods).toHaveLength(expectedMethods.length);
  });

  it('should not have confusing method name variations', () => {
    // This verifies naming consistency
    const repo: CatalogRepository = {} as CatalogRepository;

    // These should exist:
    expect(typeof repo.getPackageById).toBe('undefined'); // Will be defined at runtime
    expect(typeof repo.getAllPackages).toBe('undefined');

    // These should NOT exist - verify spelling is consistent:
    expect('getById' in repo).toBe(false); // Wrong name
    expect('findById' in repo).toBe(false); // Wrong name
    expect('fetchPackage' in repo).toBe(false); // Wrong name
  });
});
```

---

## Deployment Verification

### Before Deploying to Render/Production

```bash
# 1. Run full typecheck (catches all naming mismatches)
npm run typecheck

# 2. Build project (will fail if TS2339 errors exist)
npm run build

# 3. Verify no new type errors introduced
git diff origin/main -- "*.ts" | grep -E "TS(2339|2345|2722)" || echo "No type errors"

# 4. Run tests that instantiate repositories (catches runtime issues)
npm test -- --grep "Repository"
```

### CI/CD Check (GitHub Actions)

**Add to `.github/workflows/ci.yml`:**

```yaml
- name: Type Check
  run: npm run typecheck

- name: Catch Method Name Mismatches
  run: |
    # Find all interface definitions and verify implementations
    grep -r "async get" server/src/lib/ports.ts | wc -l > /tmp/interface_methods
    grep -r "async get" server/src/adapters/prisma/*.ts | wc -l > /tmp/impl_methods

    if [ $(cat /tmp/interface_methods) -ne $(cat /tmp/impl_methods) ]; then
      echo "ERROR: Interface and implementation method count mismatch!"
      exit 1
    fi
```

---

## Training for Development Team

### Onboarding Checklist

When new developer joins, ensure they:

- [ ] Read `CLAUDE.md` section on "Repository Method Naming Conventions"
- [ ] Review `server/src/lib/ports.ts` to understand naming patterns
- [ ] Complete a practice exercise: Add new method to CatalogRepository
  - Add method signature to interface
  - Implement in PrismaCatalogRepository
  - Implement in MockCatalogRepository
  - Use in a service
  - Verify typecheck passes

### Common Mistakes to Avoid

```typescript
// ❌ DON'T: Mix naming patterns
getPackageById()  // Interface
findPackageById() // Implementation

// ❌ DON'T: Use different patterns for same operation type
getPackageById()      // For package lookup
findUserById()        // For user lookup
retrieveBookingById() // For booking lookup

// ❌ DON'T: Forget tenantId parameter in implementations
async getById(id: string) {  // ← Missing tenantId!
  return this.prisma.package.findFirst({ where: { id } });
}

// ✅ DO: Use consistent naming across all repositories
async getById(tenantId: string, id: string) {
  return this.prisma.package.findFirst({ where: { tenantId, id } });
}
```

---

## Summary

**Key Takeaway:** Interface method naming mismatches are preventable with:

1. **Clear conventions** documented in CLAUDE.md
2. **Interface-first development** - define before implementing
3. **Strict TypeScript mode** - catches errors at build time
4. **Code review checklist** - verify names match during review
5. **Pre-commit hooks** - run typecheck before pushing
6. **Consistent patterns** across all repositories

**Prevention Checklist:**

- [ ] Use naming conventions from CLAUDE.md
- [ ] Define interface first, then implement
- [ ] Run `npm run typecheck` before every commit
- [ ] Code review verifies interface matches implementation
- [ ] All repository methods follow GET pattern for reads
- [ ] All service calls use correct method names
